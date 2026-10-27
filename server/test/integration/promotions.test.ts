import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, createLesson, createMilestone, createModule, enrol } from "../helpers/learning";

/**
 * Delivery mode, and the three promotions: free courses with a purchase,
 * rewards for finishing in time, and bundles sold in one checkout. Every
 * course given or sold here is given once, whatever repeats.
 */
describe("promotions", () => {
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
    const buy = async (student: TestAccount, courseId: string) =>
        (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data;
    const confirm = (orderId: string) =>
        api().patch(`/api/v1/orders/manage/${orderId}/paid`).set("Cookie", admin.cookie).send({ gateway: "MANUAL" });
    const promotionsOf = (courseId: string, student?: TestAccount) => {
        const request = api().get(`/api/v1/promotions/courses/${courseId}`);
        return student ? request.set("Cookie", student.cookie) : request;
    };
    /** A published course with one lesson, so finishing it is one click. */
    const courseWithLesson = async (title: string) => {
        const course = await createCourse({ title, price: 500 });
        const milestone = await createMilestone(course.id);
        const lesson = await createLesson(course.id, await createModule(course.id, milestone));
        return { ...course, lesson };
    };

    describe("delivery mode", () => {
        const create = (body: object) => api().post("/api/v1/courses/manage").set("Cookie", admin.cookie).send(body);
        const base = { description: "A course to test delivery modes.", phase: "PRESENT", pricing: "PAID", delivery: "LIVE", price: 900 };

        it("is chosen when a course is made, and only an offline course keeps a venue", async () => {
            const none = await create({ ...base, title: "No mode" });
            expect(none.status).toBe(400);
            expect(none.body.message).toMatch(/online, offline or both/);

            const online = await create({ ...base, title: "Online course", mode: "ONLINE", venue: "Dhaka office" });
            expect(online.status).toBe(201);
            expect(online.body.data).toMatchObject({ mode: "ONLINE", venue: null });

            const offline = await create({ ...base, title: "Offline course", mode: "OFFLINE", venue: "Banani, Dhaka" });
            expect(offline.body.data).toMatchObject({ mode: "OFFLINE", venue: "Banani, Dhaka" });

            const moved = await api()
                .patch(`/api/v1/courses/manage/${offline.body.data.id}`)
                .set("Cookie", admin.cookie)
                .send({ mode: "ONLINE" });
            expect(moved.status).toBe(200);
            const row = (await owner.query(`SELECT mode, venue FROM learning.course WHERE id = $1`, [offline.body.data.id])).rows[0];
            expect(row).toEqual({ mode: "ONLINE", venue: null });
        });

        it("filters the catalogue", async () => {
            const inPerson = await createCourse({ title: "In person", price: 500 });
            await owner.query(`UPDATE learning.course SET mode = 'OFFLINE' WHERE id = $1`, [inPerson.id]);
            const res = await api().get("/api/v1/courses?mode=OFFLINE&limit=48");
            expect(res.status).toBe(200);
            const listed = res.body.data as { id: string; mode: string }[];
            expect(listed.map((course) => course.id)).toContain(inPerson.id);
            // A course that runs both lists here too.
            expect(listed.every((course) => course.mode === "OFFLINE" || course.mode === "BOTH")).toBe(true);
        });
    });

    describe("buy one, get more free", () => {
        let paid: { id: string };
        let inbox: { id: string };
        let linkedin: { id: string };
        let bobsOrder: string;

        const saveOffer = (courseId: string, body: object) =>
            api().put(`/api/v1/promotions/manage/courses/${courseId}/offer`).set("Cookie", admin.cookie).send(body);

        beforeAll(async () => {
            paid = await createCourse({ title: "ResumeCraft", price: 1500 });
            inbox = await createCourse({ title: "InboxPro", price: 800 });
            linkedin = await createCourse({ title: "LinkedIn Elevate", price: 700 });
        });

        it("is set on a paid course, with other courses", async () => {
            expect((await saveOffer(paid.id, { courseIds: [paid.id] })).status).toBe(400);
            const free = await createCourse({ title: "A free course" });
            expect((await saveOffer(free.id, { courseIds: [inbox.id] })).status).toBe(400);
            expect((await api().put(`/api/v1/promotions/manage/courses/${paid.id}/offer`).set("Cookie", alice.cookie).send({ courseIds: [inbox.id] })).status).toBe(403);

            const res = await saveOffer(paid.id, { courseIds: [inbox.id, linkedin.id] });
            expect(res.status).toBe(200);
            expect(res.body.data.freeCourses.map((item: { courseId: string }) => item.courseId)).toEqual([inbox.id, linkedin.id]);
        });

        it("shows on the course page", async () => {
            const res = await promotionsOf(paid.id);
            expect(res.body.data.offer.courses.map((course: { title: string }) => course.title)).toEqual(["InboxPro", "LinkedIn Elevate"]);
        });

        it("gives the free courses once the purchase is paid — and only once", async () => {
            await enrol(bob.id, linkedin.id);
            const order = await buy(bob, paid.id);
            bobsOrder = order.id;
            expect(order.status).toBe("PENDING");
            expect(await enrolment(bob.id, inbox.id)).toBeUndefined();

            expect((await confirm(order.id)).status).toBe(200);
            expect((await confirm(order.id)).status).toBe(200);

            expect((await enrolment(bob.id, inbox.id))?.status).toBe("ACTIVE");
            const grants = (
                await owner.query(`SELECT "courseId", source, "orderId" FROM learning.course_grant WHERE "studentId" = $1`, [bob.id])
            ).rows;
            // LinkedIn Elevate he had already, so it wasn't given again.
            expect(grants).toEqual([{ courseId: inbox.id, source: "OFFER", orderId: order.id }]);
        });

        it("takes the free courses back with a refund", async () => {
            const res = await api().patch(`/api/v1/orders/manage/${bobsOrder}/refund`).set("Cookie", admin.cookie).send({ reason: "Changed his mind" });
            expect(res.status).toBe(200);
            expect((await enrolment(bob.id, inbox.id))?.status).toBe("CANCELLED");
            expect((await enrolment(bob.id, linkedin.id))?.status).toBe("ACTIVE");
        });

        it("gives nothing while the offer is switched off", async () => {
            await saveOffer(paid.id, { courseIds: [inbox.id], isActive: false });
            const order = await buy(carol, paid.id);
            await confirm(order.id);
            expect((await enrolment(carol.id, paid.id))?.status).toBe("ACTIVE");
            expect(await enrolment(carol.id, inbox.id)).toBeUndefined();
            expect((await promotionsOf(paid.id)).body.data.offer).toBeNull();
        });
    });

    describe("rewards for finishing in time", () => {
        let prize: { id: string };

        const saveReward = (courseId: string, body: object) =>
            api().put(`/api/v1/promotions/manage/courses/${courseId}/reward`).set("Cookie", admin.cookie).send(body);
        const finish = (student: TestAccount, lesson: string) =>
            api().post(`/api/v1/progress/videos/${lesson}/complete`).set("Cookie", student.cookie);

        beforeAll(async () => {
            prize = await createCourse({ title: "Prize course", price: 900 });
        });

        it("gives the reward course to a student who finishes in time", async () => {
            const course = await courseWithLesson("Short course");
            expect((await saveReward(course.id, { courseIds: [prize.id], condition: "COURSE_COMPLETE", withinDays: 30 })).status).toBe(200);
            await enrol(alice.id, course.id);

            const before = (await promotionsOf(course.id, alice)).body.data.reward;
            expect(before).toMatchObject({ withinDays: 30, earned: false });
            expect(before.yourDeadline).toBeTruthy();

            expect((await finish(alice, course.lesson)).status).toBe(200);
            expect((await enrolment(alice.id, prize.id))?.status).toBe("ACTIVE");
            expect((await promotionsOf(course.id, alice)).body.data.reward.earned).toBe(true);
        });

        it("gives nothing to a student who finishes after the deadline", async () => {
            const course = await courseWithLesson("Late course");
            await saveReward(course.id, { courseIds: [prize.id], condition: "COURSE_COMPLETE", withinDays: 7 });
            const enrollmentId = await enrol(carol.id, course.id);
            await owner.query(`UPDATE learning.enrollment SET "startedAt" = (now() AT TIME ZONE 'UTC') - interval '10 days' WHERE id = $1`, [
                enrollmentId,
            ]);

            expect((await finish(carol, course.lesson)).status).toBe(200);
            expect(await enrolment(carol.id, prize.id)).toBeUndefined();
        });

        it("can ask for the certificate instead", async () => {
            const course = await courseWithLesson("Certificate course");
            await saveReward(course.id, { courseIds: [prize.id], condition: "CERTIFICATE" });
            const enrollmentId = await enrol(bob.id, course.id);

            // Finishing isn't enough on its own…
            expect((await finish(bob, course.lesson)).status).toBe(200);
            expect(await enrolment(bob.id, prize.id)).toBeUndefined();

            // …the certificate is.
            const issued = await api().post("/api/v1/certificates/manage/issue").set("Cookie", admin.cookie).send({ enrollmentId });
            expect(issued.status).toBeLessThan(300);
            expect((await enrolment(bob.id, prize.id))?.status).toBe("ACTIVE");
        });
    });

    describe("bundles", () => {
        let one: { id: string };
        let two: { id: string };
        let three: { id: string };
        let bundleId: string;
        let bundleOrderId: string;

        const make = (body: object) => api().post("/api/v1/bundles/manage").set("Cookie", admin.cookie).send(body);

        beforeAll(async () => {
            one = await createCourse({ title: "Bundle course one", price: 1000 });
            two = await createCourse({ title: "Bundle course two", price: 2000 });
            three = await createCourse({ title: "Bundle course three", price: 500 });
            await owner.query(`UPDATE learning.course SET "discountPrice" = 1500 WHERE id = $1`, [two.id]);
        });

        it("is made from two or more courses, at a real saving", async () => {
            expect((await make({ title: "Too small", pricing: "PERCENT", discountPercent: 10, courseIds: [one.id] })).status).toBe(400);
            // One by one they cost 1000 + 1500 + 500 = 3000.
            expect((await make({ title: "No deal", pricing: "FIXED", price: 3000, courseIds: [one.id, two.id, three.id] })).status).toBe(400);

            const res = await make({ title: "Starter pack", pricing: "PERCENT", discountPercent: 20, courseIds: [one.id, two.id, three.id], isActive: true });
            expect(res.status).toBe(201);
            expect(res.body.data.slug).toBe("starter-pack");
            bundleId = res.body.data.id;
        });

        it("shows the saving on the bundles page", async () => {
            const res = await api().get("/api/v1/bundles");
            const bundle = res.body.data.find((entry: { id: string }) => entry.id === bundleId);
            expect(bundle.quote).toMatchObject({ combined: 3000, bundlePrice: 2400, savings: 600, total: 2400, ownsAll: false });
        });

        it("costs a student who owns some of it a matching part of the price", async () => {
            await enrol(alice.id, two.id);
            const res = await api().get("/api/v1/bundles/starter-pack").set("Cookie", alice.cookie);
            // She owns 1500 of the 3000, so pays half of 2400.
            expect(res.body.data.quote).toMatchObject({ total: 1200, ownedCount: 1 });
        });

        it("sells in one checkout — an order per course, the shares adding up", async () => {
            const created = await api().post(`/api/v1/bundles/${bundleId}/orders`).set("Cookie", alice.cookie);
            expect(created.status).toBe(201);
            expect(created.body.data).toMatchObject({ amount: 1500, discount: 300, total: 1200, status: "PENDING" });
            expect(created.body.data.orderNumber).toMatch(/^HCB-\d{4}-\d{6}$/);
            bundleOrderId = created.body.data.id;

            const again = await api().post(`/api/v1/bundles/${bundleId}/orders`).set("Cookie", alice.cookie);
            expect(again.body.data.id).toBe(bundleOrderId);

            const settle = () => api().patch(`/api/v1/bundles/manage/orders/${bundleOrderId}/paid`).set("Cookie", admin.cookie);
            expect((await settle()).body.data.status).toBe("PAID");
            expect((await settle()).status).toBe(200);

            const children = (
                await owner.query(`SELECT "courseId", total, status FROM learning."order" WHERE "bundleOrderId" = $1 ORDER BY total`, [bundleOrderId])
            ).rows;
            expect(children).toEqual([
                { courseId: three.id, total: 400, status: "PAID" },
                { courseId: one.id, total: 800, status: "PAID" },
            ]);
            expect((await enrolment(alice.id, one.id))?.status).toBe("ACTIVE");
            expect((await enrolment(alice.id, three.id))?.status).toBe("ACTIVE");

            const nothingLeft = await api().post(`/api/v1/bundles/${bundleId}/orders`).set("Cookie", alice.cookie);
            expect(nothingLeft.status).toBe(409);
        });

        it("refunds as a whole", async () => {
            const res = await api().patch(`/api/v1/bundles/manage/orders/${bundleOrderId}/refund`).set("Cookie", admin.cookie).send({ reason: "Test" });
            expect(res.body.data.status).toBe("REFUNDED");
            expect((await enrolment(alice.id, one.id))?.status).toBe("CANCELLED");
            expect((await enrolment(alice.id, three.id))?.status).toBe("CANCELLED");
            expect((await enrolment(alice.id, two.id))?.status).toBe("ACTIVE");
        });

        it("can't be deleted once it has orders — only switched off", async () => {
            expect((await api().delete(`/api/v1/bundles/manage/${bundleId}`).set("Cookie", admin.cookie)).status).toBe(409);
            const off = await api().patch(`/api/v1/bundles/manage/${bundleId}`).set("Cookie", admin.cookie).send({ isActive: false });
            expect(off.status).toBe(200);
            expect((await api().get("/api/v1/bundles/starter-pack")).status).toBe(404);
        });
    });
});
