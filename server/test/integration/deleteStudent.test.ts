import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse } from "../helpers/learning";

/**
 * Deleting a student from the admin console removes them for good: the
 * account and every row about them — payments included — in one go. The
 * database still refuses a plain `DELETE` of such an account
 * (deleteProtection.test.ts); this is the one deliberate way through.
 */
describe("deleting a student", () => {
    let superAdmin: TestAccount;
    let admin: TestAccount;
    let student: TestAccount;
    let bystander: TestAccount;
    let courseId: string;
    let orderId: string;

    /** Every `learning` table with a row whose studentId or userId is `userId`. */
    const tablesHolding = async (userId: string) => {
        const { rows: columns } = await owner.query<{ table_name: string; column_name: string }>(
            `SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = 'learning' AND column_name IN ('studentId', 'userId')`,
        );
        const found: string[] = [];
        for (const { table_name: table, column_name: column } of columns) {
            const { rows } = await owner.query(`SELECT count(*)::int AS n FROM learning."${table}" WHERE "${column}"::text = $1`, [userId]);
            if (rows[0].n > 0) found.push(`${table}.${column}`);
        }
        return found;
    };

    beforeAll(async () => {
        [superAdmin, admin, student, bystander] = await Promise.all([
            createAccount("SUPER_ADMIN"),
            createAccount("ADMIN"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        for (const account of [student, bystander]) await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
        courseId = (await createCourse({ title: "Deletable", price: 2000 })).id;

        // A paid order: the order, its payment and the enrolment it opened.
        orderId = (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data.id;
        const paid = await api().patch(`/api/v1/orders/manage/${orderId}/paid`).set("Cookie", superAdmin.cookie).send({ gateway: "MANUAL" });
        expect(paid.status).toBe(200);

        const asked = await api()
            .post("/api/v1/refund-requests")
            .set("Cookie", student.cookie)
            .send({ orderId, reason: "Changed my mind about the schedule." });
        expect(asked.status).toBe(201);

        const enrollmentId = (await owner.query(`SELECT id FROM learning.enrollment WHERE "studentId" = $1`, [student.id])).rows[0].id;
        await owner.query(
            `INSERT INTO learning.certificate (id, "certificateNo", "studentId", "courseId", "enrollmentId", "studentName", "courseName", "completionDate")
             VALUES ($1, $2, $3, $4, $5, 'Student', 'Deletable', now())`,
            [randomUUID(), `CERT-${randomUUID().slice(0, 8)}`, student.id, courseId, enrollmentId],
        );
        await owner.query(
            `INSERT INTO learning.testimonial (id, "studentId", name, quote, "updatedAt") VALUES ($1, $2, 'Student', 'Great course.', now())`,
            [randomUUID(), student.id],
        );
        await owner.query(
            `INSERT INTO learning.notification (id, "userId", title, message, type) VALUES ($1, $2, 'Hi', '…', 'SYSTEM'::learning."NotificationType")`,
            [randomUUID(), student.id],
        );

        expect(await tablesHolding(student.id)).toEqual(
            expect.arrayContaining(["order.studentId", "enrollment.studentId", "certificate.studentId", "refund_request.studentId"]),
        );
    });

    it("is for super admins only", async () => {
        expect((await api().delete(`/api/v1/users/students/${student.id}`).set("Cookie", admin.cookie)).status).toBe(403);
    });

    it("only deletes students, and never the person asking", async () => {
        const mentor = await createAccount("MENTOR");
        expect((await api().delete(`/api/v1/users/students/${mentor.id}`).set("Cookie", superAdmin.cookie)).status).toBe(403);
        expect((await api().delete(`/api/v1/users/students/${admin.id}`).set("Cookie", superAdmin.cookie)).status).toBe(403);
        expect((await api().delete(`/api/v1/users/students/${superAdmin.id}`).set("Cookie", superAdmin.cookie)).status).toBe(400);
    });

    it("removes the student and everything about them, payments included", async () => {
        const res = await api().delete(`/api/v1/users/students/${student.id}`).set("Cookie", superAdmin.cookie);
        expect(res.status).toBe(200);

        expect((await owner.query(`SELECT 1 FROM learning."user" WHERE id = $1`, [student.id])).rowCount).toBe(0);
        expect((await owner.query(`SELECT 1 FROM learning.payment WHERE "orderId" = $1`, [orderId])).rowCount).toBe(0);
        expect(await tablesHolding(student.id)).toEqual([]);

        // Signed out everywhere, and gone from the register.
        expect((await api().get("/api/v1/auth/me").set("Cookie", student.cookie)).status).toBe(401);
        expect((await api().get(`/api/v1/users/students/${student.id}`).set("Cookie", superAdmin.cookie)).status).toBe(404);
    });

    it("leaves other students alone", async () => {
        expect((await api().get(`/api/v1/users/students/${bystander.id}`).set("Cookie", superAdmin.cookie)).status).toBe(200);
        expect((await api().delete(`/api/v1/users/students/${student.id}`).set("Cookie", superAdmin.cookie)).status).toBe(404);
    });
});
