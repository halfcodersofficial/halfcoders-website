import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, learningProfileOf, type TestAccount } from "../helpers/fixtures";

/**
 * The super admin's admin directory: every admin, whether they've opened
 * Half Coders or not, and the one control Half Coders has over them — their access.
 */
describe("admin directory", () => {
    let superAdmin: TestAccount;
    let otherSuper: TestAccount;
    let admin: TestAccount;
    let newcomer: TestAccount;

    beforeAll(async () => {
        [superAdmin, otherSuper, admin, newcomer] = await Promise.all([
            createAccount("SUPER_ADMIN"),
            createAccount("SUPER_ADMIN"),
            createAccount("ADMIN"),
            createAccount("ADMIN"),
        ]);
        // Opening Half Coders once is what makes a learning profile; `newcomer` never has.
        for (const account of [superAdmin, admin]) await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
    });

    const directory = async () => (await api().get("/api/v1/users/admins?limit=100").set("Cookie", superAdmin.cookie)).body.data;
    const entry = async (id: string) => (await directory()).find((row: { id: string }) => row.id === id);

    it("lists every admin, saying who hasn't opened Half Coders yet", async () => {
        expect((await entry(admin.id)).hasOpenedHalfCoders).toBe(true);
        expect((await entry(newcomer.id)).hasOpenedHalfCoders).toBe(false);
        expect(await entry(otherSuper.id)).toMatchObject({ role: "SUPER_ADMIN" });
    });

    it("is for super admins only", async () => {
        expect((await api().get("/api/v1/users/admins").set("Cookie", admin.cookie)).status).toBe(403);
    });

    it("suspends an admin's Half Coders access — and they're locked out at once", async () => {
        const res = await api().patch(`/api/v1/users/${admin.id}/status`).set("Cookie", superAdmin.cookie).send({ status: "BLOCKED" });
        expect(res.status).toBe(200);
        expect((await api().get("/api/v1/dashboard/admin").set("Cookie", admin.cookie)).status).toBe(403);

        expect((await api().patch(`/api/v1/users/${admin.id}/status`).set("Cookie", superAdmin.cookie).send({ status: "ACTIVE" })).status).toBe(200);
        expect((await api().get("/api/v1/dashboard/admin").set("Cookie", admin.cookie)).status).toBe(200);
    });

    it("can suspend an admin who has never opened Half Coders", async () => {
        const res = await api().patch(`/api/v1/users/${newcomer.id}/status`).set("Cookie", superAdmin.cookie).send({ status: "BLOCKED" });
        expect(res.status).toBe(200);
        expect((await learningProfileOf(newcomer.id)).status).toBe("BLOCKED");
        expect((await api().get("/api/v1/dashboard/admin").set("Cookie", newcomer.cookie)).status).toBe(403);
    });

    it("leaves super admins, and the person asking, alone", async () => {
        expect((await api().patch(`/api/v1/users/${otherSuper.id}/status`).set("Cookie", superAdmin.cookie).send({ status: "BLOCKED" })).status).toBe(403);
        expect((await api().patch(`/api/v1/users/${superAdmin.id}/status`).set("Cookie", superAdmin.cookie).send({ status: "BLOCKED" })).status).toBe(400);
    });

    it("won't let a plain admin suspend another admin", async () => {
        const res = await api().patch(`/api/v1/users/${newcomer.id}/status`).set("Cookie", admin.cookie).send({ status: "ACTIVE" });
        expect(res.status).toBe(403);
    });
});
