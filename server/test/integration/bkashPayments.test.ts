import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, notificationsOf } from "../helpers/learning";

/**
 * Manual bKash payments: the student pays the merchant account, sends in the
 * transaction ID and the number they paid from, and an admin verifies it —
 * nothing opens on the student's word alone.
 */
describe("bKash payments", () => {
    let admin: TestAccount;
    let courseId: string;

    beforeAll(async () => {
        admin = await createAccount("ADMIN");
        courseId = (await createCourse({ title: "bKash course", price: 1500 })).id;
    });

    const placeOrder = async (student: TestAccount) =>
        (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data as { id: string; total: number };
    const sendIn = (student: TestAccount, orderId: string, transactionId: string, senderNumber = "+880 1711-222333") =>
        api().post(`/api/v1/orders/${orderId}/bkash`).set("Cookie", student.cookie).send({ transactionId, senderNumber });
    const enrolment = async (studentId: string) =>
        (await owner.query(`SELECT status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [studentId, courseId])).rows[0];

    it("records what the student sent in and keeps the order pending, with no access yet", async () => {
        const student = await createAccount("STUDENT");
        const order = await placeOrder(student);

        const res = await sendIn(student, order.id, "bfh4k9l2qx");
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("PENDING");
        expect(res.body.data.payment).toMatchObject({
            gateway: "BKASH",
            transactionId: "BFH4K9L2QX",
            status: "PENDING",
            gatewayData: { senderNumber: "01711222333" },
        });
        expect(await enrolment(student.id)).toBeUndefined();
        expect((await notificationsOf(student.id)).map((n: { title: string }) => n.title)).toContain("Payment details received");
    });

    it("refuses a malformed transaction ID or number", async () => {
        const student = await createAccount("STUDENT");
        const order = await placeOrder(student);
        expect((await sendIn(student, order.id, "abc")).status).toBe(400);
        expect((await sendIn(student, order.id, "BFH4K9L2QA", "12345")).status).toBe(400);
    });

    it("won't take one transaction ID for two orders", async () => {
        const first = await createAccount("STUDENT");
        const second = await createAccount("STUDENT");
        expect((await sendIn(first, (await placeOrder(first)).id, "DUPL1CATE1")).status).toBe(200);
        const again = await sendIn(second, (await placeOrder(second)).id, "DUPL1CATE1");
        expect(again.status).toBe(409);
    });

    it("opens the course when an admin verifies it, keeping the transaction ID", async () => {
        const student = await createAccount("STUDENT");
        const order = await placeOrder(student);
        await sendIn(student, order.id, "VER1F1ED00");

        const verify = await api().patch(`/api/v1/orders/manage/${order.id}/paid`).set("Cookie", admin.cookie).send({ gateway: "BKASH" });
        expect(verify.status).toBe(200);
        const mine = (await api().get(`/api/v1/orders/my/${order.id}`).set("Cookie", student.cookie)).body.data;
        expect(mine.status).toBe("PAID");
        expect(mine.payment).toMatchObject({ gateway: "BKASH", transactionId: "VER1F1ED00", status: "PAID" });
        expect(await enrolment(student.id)).toMatchObject({ status: "ACTIVE" });
    });

    it("tells the student why when an admin turns it down", async () => {
        const student = await createAccount("STUDENT");
        const order = await placeOrder(student);
        await sendIn(student, order.id, "REJECTED00");

        const reject = await api()
            .patch(`/api/v1/orders/manage/${order.id}/failed`)
            .set("Cookie", admin.cookie)
            .send({ reason: "No payment with this TrxID on the statement" });
        expect(reject.status).toBe(200);
        const notes = (await notificationsOf(student.id)) as { title: string; message: string }[];
        const note = notes.find((n) => n.title === "We couldn't verify your payment");
        expect(note?.message).toContain("No payment with this TrxID on the statement");
        expect(await enrolment(student.id)).toBeUndefined();
    });
});
