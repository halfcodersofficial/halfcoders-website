import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createNotification, createNotificationsFor } from "../../src/app/module/notification/notification.service";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, enrol, notificationsOf } from "../helpers/learning";

/**
 * Reward courses: courses an admin gives with a main course — to one
 * student, a group, or everyone who has it (later buyers too). They ride on
 * the main course (lost with it, back with it) and never earn a certificate
 * of their own. And, alongside: what a mentor's bell may hold.
 */
describe("reward courses", () => {
    let admin: TestAccount;
    let alice: TestAccount;
    let bob: TestAccount;
    let carol: TestAccount;

    beforeAll(async () => {
        [admin, alice, bob, carol] = await Promise.all([
            createAccount("ADMIN"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        for (const student of [alice, bob, carol]) await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    const enrolment = async (studentId: string, courseId: string) =>
        (await owner.query(`SELECT id, status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [studentId, courseId]))
            .rows[0] as { id: string; status: string } | undefined;
    const give = (mainCourseId: string, body: object, as = admin) =>
        api().post(`/api/v1/promotions/manage/courses/${mainCourseId}/reward-courses`).set("Cookie", as.cookie).send(body);
    const detail = async (mainCourseId: string) =>
        (await api().get(`/api/v1/promotions/manage/courses/${mainCourseId}`).set("Cookie", admin.cookie)).body.data;
    const buy = async (student: TestAccount, courseId: string) =>
        (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data;
    const confirm = (orderId: string) =>
        api().patch(`/api/v1/orders/manage/${orderId}/paid`).set("Cookie", admin.cookie).send({ gateway: "MANUAL" });

    describe("given to picked students", () => {
        let main: { id: string };
        let extra: { id: string };

        beforeAll(async () => {
            main = await createCourse({ title: "Main course", price: 1000 });
            extra = await createCourse({ title: "Extra course", price: 500 });
            await enrol(alice.id, main.id);
        });

        it("only by an admin, and only to students who have the main course", async () => {
            expect((await give(main.id, { courseIds: [extra.id], audience: "STUDENTS", studentIds: [alice.id] }, alice)).status).toBe(403);
            expect((await give(main.id, { courseIds: [extra.id], audience: "STUDENTS" })).status).toBe(400);
            expect((await give(main.id, { courseIds: [main.id], audience: "STUDENTS", studentIds: [alice.id] })).status).toBe(400);

            const outsider = await give(main.id, { courseIds: [extra.id], audience: "STUDENTS", studentIds: [bob.id] });
            expect(outsider.status).toBe(400);
            expect(outsider.body.message).toMatch(/doesn't have/);
            expect(await enrolment(bob.id, extra.id)).toBeUndefined();
        });

        it("opens the course for them once, however often it's given", async () => {
            const res = await give(main.id, { courseIds: [extra.id], audience: "STUDENTS", studentIds: [alice.id] });
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ students: 1, alreadyHad: 0, forEveryone: false });
            expect((await enrolment(alice.id, extra.id))?.status).toBe("ACTIVE");
            expect((await notificationsOf(alice.id)).some((row) => row.title === "A reward course is yours 🎁")).toBe(true);

            const again = await give(main.id, { courseIds: [extra.id], audience: "STUDENTS", studentIds: [alice.id] });
            expect(again.body.data).toEqual({ students: 0, alreadyHad: 1, forEveryone: false });

            const { bonuses, bonusGrants } = await detail(main.id);
            expect(bonuses).toMatchObject([{ forEveryone: false, holders: 1, course: { id: extra.id } }]);
            expect(bonusGrants).toHaveLength(1);
        });

        it("shows on the dashboard as a reward with the main course", async () => {
            const res = await api().get("/api/v1/dashboard/student").set("Cookie", alice.cookie);
            const rows = res.body.data.enrollments as { courseId: string; rewardWith: { id: string; title: string } | null }[];
            expect(rows.find((row) => row.courseId === extra.id)?.rewardWith).toMatchObject({ id: main.id, title: "Main course" });
            expect(rows.find((row) => row.courseId === main.id)?.rewardWith).toBeNull();
        });

        it("has no certificate of its own — not even issued by hand", async () => {
            const eligibility = await api().get(`/api/v1/certificates/eligibility/${extra.id}`).set("Cookie", alice.cookie);
            expect(eligibility.body.data.eligible).toBe(false);
            expect(eligibility.body.data.blockers[0]).toMatch(/reward course with "Main course"/);

            const issued = await api()
                .post("/api/v1/certificates/manage/issue")
                .set("Cookie", admin.cookie)
                .send({ enrollmentId: (await enrolment(alice.id, extra.id))!.id });
            expect(issued.status).toBe(400);
            expect(issued.body.message).toMatch(/Issue the certificate for "Main course"/);
        });

        it("goes when an admin cancels the main enrolment, and comes back when it's reopened", async () => {
            const mainEnrolment = (await enrolment(alice.id, main.id))!.id;
            expect((await api().patch(`/api/v1/enrollments/manage/${mainEnrolment}/cancel`).set("Cookie", admin.cookie)).status).toBe(200);
            expect((await enrolment(alice.id, extra.id))?.status).toBe("CANCELLED");

            expect((await api().patch(`/api/v1/enrollments/manage/${mainEnrolment}/reactivate`).set("Cookie", admin.cookie)).status).toBe(200);
            expect((await enrolment(alice.id, extra.id))?.status).toBe("ACTIVE");
        });

        it("can be taken back from one student, for good", async () => {
            const [{ id: bonusId }] = (await detail(main.id)).bonuses;
            const res = await api().delete(`/api/v1/promotions/manage/reward-courses/${bonusId}/students/${alice.id}`).set("Cookie", admin.cookie);
            expect(res.status).toBe(200);
            expect((await enrolment(alice.id, extra.id))?.status).toBe("CANCELLED");

            // Losing and regaining the main course doesn't bring back what an admin took.
            const mainEnrolment = (await enrolment(alice.id, main.id))!.id;
            await api().patch(`/api/v1/enrollments/manage/${mainEnrolment}/cancel`).set("Cookie", admin.cookie);
            await api().patch(`/api/v1/enrollments/manage/${mainEnrolment}/reactivate`).set("Cookie", admin.cookie);
            expect((await enrolment(alice.id, extra.id))?.status).toBe("CANCELLED");
        });
    });

    describe("given to everyone who has the main course", () => {
        let main: { id: string };
        let bonus: { id: string };
        let carolsOrder: string;

        beforeAll(async () => {
            main = await createCourse({ title: "Popular course", price: 800 });
            bonus = await createCourse({ title: "Bonus course", price: 300 });
            await enrol(bob.id, main.id);
        });

        it("reaches everyone who has it now", async () => {
            const res = await give(main.id, { courseIds: [bonus.id], audience: "EVERYONE" });
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ students: 1, alreadyHad: 0, forEveryone: true });
            expect((await enrolment(bob.id, bonus.id))?.status).toBe("ACTIVE");
        });

        it("and whoever buys the main course later", async () => {
            const order = await buy(carol, main.id);
            carolsOrder = order.id;
            expect(await enrolment(carol.id, bonus.id)).toBeUndefined();
            expect((await confirm(order.id)).status).toBe(200);
            expect((await enrolment(carol.id, bonus.id))?.status).toBe("ACTIVE");
        });

        it("is taken back with a refund of the main course, and given again with a new purchase", async () => {
            const refunded = await api().patch(`/api/v1/orders/manage/${carolsOrder}/refund`).set("Cookie", admin.cookie).send({ reason: "Test" });
            expect(refunded.status).toBe(200);
            expect((await enrolment(carol.id, bonus.id))?.status).toBe("CANCELLED");

            const again = await buy(carol, main.id);
            await confirm(again.id);
            expect((await enrolment(carol.id, bonus.id))?.status).toBe("ACTIVE");
        });

        it("stops reaching later buyers once switched off", async () => {
            const [{ id: bonusId }] = (await detail(main.id)).bonuses;
            const off = await api().patch(`/api/v1/promotions/manage/reward-courses/${bonusId}`).set("Cookie", admin.cookie).send({ forEveryone: false });
            expect(off.status).toBe(200);

            await enrol(alice.id, main.id);
            const mainEnrolment = (await enrolment(alice.id, main.id))!.id;
            await api().patch(`/api/v1/enrollments/manage/${mainEnrolment}/reactivate`).set("Cookie", admin.cookie);
            expect(await enrolment(alice.id, bonus.id)).toBeUndefined();
            // Those who have it keep it.
            expect((await enrolment(bob.id, bonus.id))?.status).toBe("ACTIVE");
        });

        it("is taken back from everyone when removed", async () => {
            const [{ id: bonusId }] = (await detail(main.id)).bonuses;
            const res = await api().delete(`/api/v1/promotions/manage/reward-courses/${bonusId}`).set("Cookie", admin.cookie);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ takenBack: 2 });
            expect((await enrolment(bob.id, bonus.id))?.status).toBe("CANCELLED");
            expect((await enrolment(carol.id, bonus.id))?.status).toBe("CANCELLED");
            expect((await detail(main.id)).bonuses).toEqual([]);
        });
    });

    describe("a mentor's notifications", () => {
        let mentor: TestAccount;

        beforeAll(async () => {
            mentor = await createAccount("MENTOR");
        });

        it("are never handed a payment or anything that opens the admin console", async () => {
            expect(await createNotification({ userId: mentor.id, title: "Payment received", message: "…", type: "PAYMENT" })).toBeNull();
            expect(await createNotification({ userId: mentor.id, title: "New order", message: "…", link: "/admin/orders" })).toBeNull();
            expect(await createNotificationsFor([mentor.id, admin.id], { title: "Bundle sold", message: "…", type: "PAYMENT" })).toBe(1);
            expect(await createNotification({ userId: mentor.id, title: "A hand-in", message: "…", type: "ASSIGNMENT", link: "/mentor/reviews" })).not.toBeNull();

            expect((await notificationsOf(mentor.id)).map((row) => row.title)).toEqual(["A hand-in"]);
            expect((await notificationsOf(admin.id)).some((row) => row.title === "Bundle sold")).toBe(true);
        });

        it("hide any from before they were a mentor", async () => {
            // As a student made mentor would still have in the table.
            for (const [title, type, link] of [
                ["Payment received", "PAYMENT", null],
                ["Order to check", "COURSE", "/admin/orders"],
            ]) {
                await owner.query(
                    `INSERT INTO learning.notification (id, "userId", title, message, type, link) VALUES ($1, $2, $3, '…', $4::learning."NotificationType", $5)`,
                    [randomUUID(), mentor.id, title, type, link],
                );
            }

            const list = await api().get("/api/v1/notifications").set("Cookie", mentor.cookie);
            expect((list.body.data as { title: string }[]).map((row) => row.title)).toEqual(["A hand-in"]);
            const unread = await api().get("/api/v1/notifications/unread-count").set("Cookie", mentor.cookie);
            expect(unread.body.data.count).toBe(1);
        });
    });
});
