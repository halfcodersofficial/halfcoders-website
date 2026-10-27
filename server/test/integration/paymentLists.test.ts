import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse } from "../helpers/learning";

/**
 * The admin Successful and Failed payments screens: every course's orders in
 * one list, narrowed to a window of payment time, newest payment first — and
 * a failed order says whether the student paid for the course afterwards.
 */
describe("admin payment lists", () => {
    let admin: TestAccount;
    let retried: TestAccount;
    let gaveUp: TestAccount;
    let earlier: TestAccount;
    let courseId: string;
    let paidAgainId: string;

    const order = async (account: TestAccount) =>
        (await api().post("/api/v1/orders").set("Cookie", account.cookie).send({ courseId })).body.data as { id: string; orderNumber: string };
    const fail = async (orderId: string, reason: string) =>
        expect((await api().patch(`/api/v1/orders/manage/${orderId}/failed`).set("Cookie", admin.cookie).send({ reason })).status).toBe(200);
    const pay = async (orderId: string) =>
        expect((await api().patch(`/api/v1/orders/manage/${orderId}/paid`).set("Cookie", admin.cookie).send({ gateway: "MANUAL" })).status).toBe(200);
    const list = async (query: string) => {
        const res = await api().get(`/api/v1/orders/manage?courseId=${courseId}&${query}`).set("Cookie", admin.cookie);
        expect(res.status).toBe(200);
        return res.body.data as { id: string; student: { id: string }; paidLater: { id: string; orderNumber: string; paidAt: string | null } | null }[];
    };

    beforeAll(async () => {
        [admin, retried, gaveUp, earlier] = await Promise.all([
            createAccount("ADMIN"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        courseId = (await createCourse({ title: "Payments ledger", price: 2500 })).id;
        for (const student of [retried, gaveUp, earlier]) await api().get("/api/v1/auth/me").set("Cookie", student.cookie);

        // Fails at the gateway, then buys the course with a new order.
        await fail((await order(retried)).id, "Payment failed at the gateway.");
        const again = await order(retried);
        await pay(again.id);
        paidAgainId = again.id;

        // Cancels and never comes back.
        await fail((await order(gaveUp)).id, "Cancelled by the student.");

        // Paid ten days ago (Prisma keeps UTC in a zone-less column).
        const old = await order(earlier);
        await pay(old.id);
        await owner.query(`UPDATE learning.payment SET "paidAt" = (now() AT TIME ZONE 'UTC') - interval '10 days' WHERE "orderId" = $1`, [old.id]);
    });

    it("marks a failed order the student later paid for, and leaves the rest unmarked", async () => {
        const failed = await list("status=FAILED");
        expect(failed).toHaveLength(2);
        const byStudent = new Map(failed.map((row) => [row.student.id, row.paidLater]));
        expect(byStudent.get(retried.id)?.id).toBe(paidAgainId);
        expect(byStudent.get(retried.id)?.paidAt).toBeTruthy();
        expect(byStudent.get(gaveUp.id)).toBeNull();
        // Only failed orders carry it.
        expect((await list("status=PAID")).every((row) => row.paidLater === null)).toBe(true);
    });

    it("narrows paid orders to a window of payment time", async () => {
        const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const recent = await list(`status=PAID&payment.paidAt[gte]=${encodeURIComponent(weekAgo)}`);
        expect(recent.map((row) => row.student.id)).toEqual([retried.id]);
        const older = await list(`status=PAID&payment.paidAt[lt]=${encodeURIComponent(weekAgo)}`);
        expect(older.map((row) => row.student.id)).toEqual([earlier.id]);
    });

    it("sorts by when the payment landed", async () => {
        const newest = await list("status=PAID&sortBy=payment.paidAt&sortOrder=desc");
        expect(newest.map((row) => row.student.id)).toEqual([retried.id, earlier.id]);
        const oldest = await list("status=PAID&sortBy=payment.paidAt&sortOrder=asc");
        expect(oldest.map((row) => row.student.id)).toEqual([earlier.id, retried.id]);
    });

    it("filters failed orders by when they failed", async () => {
        const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
        expect(await list(`status=FAILED&payment.updatedAt[gte]=${encodeURIComponent(dayAgo)}`)).toHaveLength(2);
    });
});
