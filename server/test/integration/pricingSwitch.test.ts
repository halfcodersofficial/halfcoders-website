import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, enrol } from "../helpers/learning";

/**
 * A course moves between free and paid at any time. Checkout always charges
 * the price as it is now; nobody's access changes; offers and bundles follow.
 */
describe("switching a course between free and paid", () => {
    let admin: TestAccount;
    let alice: TestAccount;
    let bob: TestAccount;

    beforeAll(async () => {
        [admin, alice, bob] = await Promise.all([createAccount("ADMIN"), createAccount("STUDENT"), createAccount("STUDENT")]);
        for (const student of [alice, bob]) await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    const edit = (courseId: string, body: object) => api().patch(`/api/v1/courses/manage/${courseId}`).set("Cookie", admin.cookie).send(body);
    const order = async (student: TestAccount, courseId: string) =>
        (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data;
    const myOrder = async (student: TestAccount, orderId: string) =>
        (await api().get(`/api/v1/orders/my/${orderId}`).set("Cookie", student.cookie)).body.data;
    const row = async (courseId: string) =>
        (await owner.query(`SELECT phase, pricing, price, "discountPrice", delivery, mode FROM learning.course WHERE id = $1`, [courseId])).rows[0];
    const enrolment = async (studentId: string, courseId: string) =>
        (await owner.query(`SELECT status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [studentId, courseId])).rows[0];

    it("re-prices an unpaid order at checkout when the price changes", async () => {
        const course = await createCourse({ title: "Re-priced course", price: 2000 });
        const pending = await order(alice, course.id);
        expect(pending).toMatchObject({ total: 2000, status: "PENDING" });

        expect((await edit(course.id, { price: 1800 })).status).toBe(200);
        expect(await myOrder(alice, pending.id)).toMatchObject({ amount: 1800, total: 1800, status: "PENDING" });
    });

    it("settles an unpaid order the moment its course is made free — and keeps everything else as it was", async () => {
        const course = await createCourse({ title: "Going free", price: 1500 });
        await owner.query(`UPDATE learning.course SET delivery = 'LIVE', mode = 'OFFLINE', phase = 'PREVIOUS' WHERE id = $1`, [course.id]);
        const pending = await order(bob, course.id);

        expect((await edit(course.id, { pricing: "FREE" })).status).toBe(200);
        expect(await row(course.id)).toEqual({ phase: "PREVIOUS", pricing: "FREE", price: 0, discountPrice: null, delivery: "LIVE", mode: "OFFLINE" });

        expect(await myOrder(bob, pending.id)).toMatchObject({ total: 0, status: "PAID" });
        expect((await enrolment(bob.id, course.id)).status).toBe("ACTIVE");
    });

    it("needs a price to go paid, and leaves free enrolments alone", async () => {
        const course = await createCourse({ title: "Going paid" });
        await enrol(alice.id, course.id);

        expect((await edit(course.id, { pricing: "PAID" })).status).toBe(400);
        expect((await edit(course.id, { pricing: "PAID", price: 900, discountPrice: 700 })).status).toBe(200);
        expect(await row(course.id)).toMatchObject({ pricing: "PAID", price: 900, discountPrice: 700 });
        expect((await enrolment(alice.id, course.id)).status).toBe("ACTIVE");

        // A new student now pays the sale price.
        expect(await order(bob, course.id)).toMatchObject({ amount: 900, total: 700, status: "PENDING" });
    });

    it("pauses a course's offer while it's free", async () => {
        const course = await createCourse({ title: "Offer course", price: 1200 });
        const gift = await createCourse({ title: "Offer gift", price: 600 });
        await api().put(`/api/v1/promotions/manage/courses/${course.id}/offer`).set("Cookie", admin.cookie).send({ courseIds: [gift.id] });
        expect((await api().get(`/api/v1/promotions/courses/${course.id}`)).body.data.offer).not.toBeNull();

        await edit(course.id, { pricing: "FREE" });
        expect((await api().get(`/api/v1/promotions/courses/${course.id}`)).body.data.offer).toBeNull();

        expect(await order(alice, course.id)).toMatchObject({ status: "PAID", total: 0 });
        expect(await enrolment(alice.id, gift.id)).toBeUndefined();
    });

    it("re-prices a bundle as its courses' prices change", async () => {
        const one = await createCourse({ title: "Bundle price one", price: 1000 });
        const two = await createCourse({ title: "Bundle price two", price: 1000 });
        const made = await api()
            .post("/api/v1/bundles/manage")
            .set("Cookie", admin.cookie)
            .send({ title: "Repriced bundle", pricing: "PERCENT", discountPercent: 10, courseIds: [one.id, two.id], isActive: true });
        const pending = (await api().post(`/api/v1/bundles/${made.body.data.id}/orders`).set("Cookie", bob.cookie)).body.data;
        expect(pending.total).toBe(1800);

        await edit(two.id, { pricing: "FREE" });
        const now = (await api().get(`/api/v1/bundles/orders/${pending.id}`).set("Cookie", bob.cookie)).body.data;
        expect(now).toMatchObject({ amount: 1000, total: 900, status: "PENDING" });
    });
});
