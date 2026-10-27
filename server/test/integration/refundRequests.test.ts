import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, notificationsOf } from "../helpers/learning";

/**
 * Refund requests: a student asks within 48 hours of paying, admins approve
 * (the order is refunded, access ends) or decline with a reason — and the
 * student hears either way.
 */
describe("refund requests", () => {
    let admin: TestAccount;
    let student: TestAccount;
    let other: TestAccount;
    let courseId: string;

    beforeAll(async () => {
        [admin, student, other] = await Promise.all([createAccount("ADMIN"), createAccount("STUDENT"), createAccount("STUDENT")]);
        courseId = (await createCourse({ title: "Refundable", price: 3000 })).id;
        for (const account of [student, other]) await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
    });

    /** A paid order for `account`, paid `hoursAgo` hours ago (Prisma keeps UTC in a zone-less column). */
    const paidOrder = async (account: TestAccount, hoursAgo = 1, course = courseId) => {
        const order = (await api().post("/api/v1/orders").set("Cookie", account.cookie).send({ courseId: course })).body.data;
        const paid = await api().patch(`/api/v1/orders/manage/${order.id}/paid`).set("Cookie", admin.cookie).send({ gateway: "MANUAL" });
        expect(paid.status).toBe(200);
        await owner.query(`UPDATE learning.payment SET "paidAt" = (now() AT TIME ZONE 'UTC') - ($2 || ' hours')::interval WHERE "orderId" = $1`, [order.id, String(hoursAgo)]);
        return order.id as string;
    };
    const ask = (account: TestAccount, orderId: string, reason = "The schedule doesn't fit my job after all.") =>
        api().post("/api/v1/refund-requests").set("Cookie", account.cookie).send({ orderId, reason });

    it("takes a request within 48 hours, once, and tells the admins", async () => {
        const orderId = await paidOrder(student);
        expect((await ask(student, orderId)).status).toBe(201);
        expect((await ask(student, orderId)).status).toBe(409);
        expect((await ask(other, orderId)).status).toBe(404);
        expect((await notificationsOf(admin.id)).some((n: { link: string }) => n.link === "/admin/refunds")).toBe(true);
    });

    it("approves: refunds the order, ends access, tells the student", async () => {
        const [pending] = (await api().get("/api/v1/refund-requests/manage?status=PENDING").set("Cookie", admin.cookie)).body.data;
        const res = await api().patch(`/api/v1/refund-requests/manage/${pending.id}`).set("Cookie", admin.cookie).send({ decision: "APPROVE" });
        expect(res.status).toBe(200);
        const order = (await owner.query(`SELECT status FROM learning."order" WHERE id = $1`, [pending.order.id])).rows[0];
        expect(order.status).toBe("REFUNDED");
        const enrolment = (await owner.query(`SELECT status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [student.id, courseId])).rows[0];
        expect(enrolment.status).toBe("CANCELLED");
        expect((await notificationsOf(student.id)).some((n: { title: string }) => n.title.startsWith("Refund approved"))).toBe(true);
        expect((await api().patch(`/api/v1/refund-requests/manage/${pending.id}`).set("Cookie", admin.cookie).send({ decision: "DECLINE", note: "x" })).status).toBe(409);
    });

    it("declines only with a reason the student reads", async () => {
        const orderId = await paidOrder(other);
        const created = (await ask(other, orderId)).body.data;
        expect((await api().patch(`/api/v1/refund-requests/manage/${created.id}`).set("Cookie", admin.cookie).send({ decision: "DECLINE" })).status).toBe(400);
        expect(
            (await api().patch(`/api/v1/refund-requests/manage/${created.id}`).set("Cookie", admin.cookie).send({ decision: "DECLINE", note: "You've completed most of the course." })).status,
        ).toBe(200);
        const notice = (await notificationsOf(other.id)).find((n: { title: string }) => n.title.startsWith("Refund declined"));
        expect(notice.message).toContain("You've completed most of the course.");
    });

    it("refuses requests past 48 hours, or on free orders", async () => {
        const late = await createCourse({ title: "Late", price: 500 });
        const lateOrder = await paidOrder(student, 49, late.id);
        expect((await ask(student, lateOrder)).body.message).toMatch(/within 48 hours/);

        const free = await createCourse({ title: "Free", price: 0 });
        const freeOrder = (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId: free.id })).body.data;
        expect((await ask(student, freeOrder.id)).status).toBe(400);
    });

    it("lets a student see and withdraw their own requests", async () => {
        const course = await createCourse({ title: "Withdrawable", price: 800 });
        const orderId = await paidOrder(student, 2, course.id);
        const created = (await ask(student, orderId)).body.data;
        const mine = (await api().get("/api/v1/refund-requests/mine").set("Cookie", student.cookie)).body.data;
        expect(mine.map((r: { id: string }) => r.id)).toContain(created.id);
        expect((await api().post(`/api/v1/refund-requests/${created.id}/withdraw`).set("Cookie", student.cookie)).body.data.status).toBe("WITHDRAWN");
        expect((await api().get("/api/v1/refund-requests/manage").set("Cookie", student.cookie)).status).toBe(403);
    });
});
