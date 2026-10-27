import { randomUUID } from "crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";

// The mailer is outside the test: what would be sent is recorded instead.
const sent = vi.hoisted(() => [] as { to: string; templateName: string; templateData: Record<string, unknown> }[]);
vi.mock("../../src/app/utils/email", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/app/utils/email")>();
    return { ...original, sendEmailAsync: vi.fn((email: (typeof sent)[number]) => sent.push(email)) };
});

/**
 * What admins do to accounts: make mentors and admins, move people between
 * student and mentor, and send password resets — never seeing a password.
 */

/** Signs `account` in once so it has a learning profile, as a real visit would. */
const visit = async (account: TestAccount) => {
    const res = await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
    expect(res.status).toBe(200);
};

const accountRow = async (email: string) =>
    (await owner.query(`SELECT id, role, "emailVerified", "needPasswordChange", "passwordHash" FROM learning."user" WHERE email = $1`, [email])).rows[0];

beforeEach(() => {
    sent.length = 0;
});

describe("password reset", () => {
    let admin: TestAccount;

    beforeAll(async () => {
        admin = await createAccount("ADMIN");
        await visit(admin);
    });

    it("mails the person a reset code, and the admin never handles a password", async () => {
        const student = await createAccount("STUDENT");
        await visit(student);

        const res = await api().patch(`/api/v1/users/${student.id}/reset-password`).set("Cookie", admin.cookie);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ userId: student.id, sentTo: student.email });
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ to: student.email, templateName: "code" });
        expect(JSON.stringify(res.body)).not.toContain(sent[0].templateData.code as string);
    });

    it("is refused to a mentor", async () => {
        const mentor = await createAccount("MENTOR");
        const student = await createAccount("STUDENT");
        await visit(student);
        const res = await api().patch(`/api/v1/users/${student.id}/reset-password`).set("Cookie", mentor.cookie);
        expect(res.status).toBe(403);
        expect(sent).toHaveLength(0);
    });
});

describe("making mentors", () => {
    let admin: TestAccount;

    beforeAll(async () => {
        admin = await createAccount("ADMIN");
        await visit(admin);
    });

    const mentorPayload = (email: string) => ({ name: "Mentor Person", email, password: "Mentor#Pass123", designation: "Engineer" });

    it("creates a new MENTOR account on a temporary password they must change", async () => {
        const email = `brand-new-${randomUUID().slice(0, 8)}@example.test`;
        const res = await api().post("/api/v1/users/mentors").set("Cookie", admin.cookie).send(mentorPayload(email));

        expect(res.status).toBe(201);
        expect(res.body.data.linkedExistingAccount).toBe(false);
        const row = await accountRow(email);
        expect(row).toMatchObject({ role: "MENTOR", emailVerified: true, needPasswordChange: true });
        expect(row.passwordHash).toMatch(/^scrypt\$/);

        const login = await api().post("/api/v1/auth/login").send({ email, password: "Mentor#Pass123" });
        expect(login.status).toBe(200);
        expect(login.body.data).toMatchObject({ role: "MENTOR", needPasswordChange: true });
    });

    it("turns an existing student into a mentor, keeping their password", async () => {
        const student = await createAccount("STUDENT");
        const res = await api().post("/api/v1/users/mentors").set("Cookie", admin.cookie).send(mentorPayload(student.email));

        expect(res.status).toBe(201);
        expect(res.body.data.linkedExistingAccount).toBe(true);
        expect(await accountRow(student.email)).toMatchObject({ role: "MENTOR", needPasswordChange: false });
    });

    it("refuses an admin's email", async () => {
        const other = await createAccount("ADMIN");
        const res = await api().post("/api/v1/users/mentors").set("Cookie", admin.cookie).send(mentorPayload(other.email));
        expect(res.status).toBe(409);
    });

    it("changes student <-> mentor, and nothing else", async () => {
        const student = await createAccount("STUDENT");
        await visit(student);

        const promote = await api().patch(`/api/v1/users/${student.id}/role`).set("Cookie", admin.cookie).send({ role: "MENTOR" });
        expect(promote.status).toBe(200);
        expect(promote.body.data.role).toBe("MENTOR");

        const toAdmin = await api().patch(`/api/v1/users/${student.id}/role`).set("Cookie", admin.cookie).send({ role: "ADMIN" });
        expect(toAdmin.status).toBe(400);
    });

    it("edits a mentor's name", async () => {
        const mentor = await createAccount("MENTOR");
        await visit(mentor);
        const res = await api().patch(`/api/v1/users/mentors/${mentor.id}`).set("Cookie", admin.cookie).send({ name: "New Name" });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe("New Name");
    });
});

describe("a person's own account", () => {
    it("renames themselves and changes their mobile number", async () => {
        const student = await createAccount("STUDENT");
        await visit(student);
        const res = await api().patch("/api/v1/auth/me").set("Cookie", student.cookie).send({ name: "Renamed Me", phone: "01812345678" });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ name: "Renamed Me", phone: "01812345678" });
    });
});

describe("admin accounts", () => {
    it("are created by a super admin, on a temporary password", async () => {
        const superAdmin = await createAccount("SUPER_ADMIN");
        const email = `admin-${randomUUID().slice(0, 8)}@example.test`;
        const res = await api()
            .post("/api/v1/users/admins")
            .set("Cookie", superAdmin.cookie)
            .send({ name: "New Admin", email, password: "Admin#Pass123" });
        expect(res.status).toBe(201);
        expect(await accountRow(email)).toMatchObject({ role: "ADMIN", needPasswordChange: true });
    });

    it("can't be created by an admin", async () => {
        const admin = await createAccount("ADMIN");
        const res = await api()
            .post("/api/v1/users/admins")
            .set("Cookie", admin.cookie)
            .send({ name: "Nope", email: `nope-${randomUUID().slice(0, 8)}@example.test`, password: "Admin#Pass123" });
        expect(res.status).toBe(403);
    });

    it("are all listed, whether or not they have opened the console", async () => {
        const superAdmin = await createAccount("SUPER_ADMIN");
        const neverVisited = await createAccount("ADMIN");
        const res = await api().get("/api/v1/users/admins?limit=100").set("Cookie", superAdmin.cookie);
        expect(res.status).toBe(200);
        const listed = res.body.data.find((a: { id: string }) => a.id === neverVisited.id);
        expect(listed).toMatchObject({ role: "ADMIN" });
    });
});
