import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse } from "../helpers/learning";

/**
 * Coupons: admins make codes — for every course or chosen ones, with a cap,
 * a minimum price, a limit in all and per student, and dates; a student
 * applies one to their unpaid order, which is re-priced from the course; a
 * code that covers everything enrols them on the spot. A limited code's use
 * is held while a student pays, so a crowd can't overrun it. Each refusal
 * says why.
 */
describe("coupons", () => {
    let admin: TestAccount;
    let alice: TestAccount;
    let bob: TestAccount;
    let carol: TestAccount;
    let crowd: TestAccount[];
    let course: { id: string; slug: string };
    let other: { id: string; slug: string };
    let third: { id: string; slug: string };

    beforeAll(async () => {
        [admin, alice, bob, carol] = await Promise.all([createAccount("ADMIN"), createAccount("STUDENT"), createAccount("STUDENT"), createAccount("STUDENT")]);
        crowd = await Promise.all(Array.from({ length: 5 }, () => createAccount("STUDENT")));
        course = await createCourse({ title: "Paid course", price: 2000 });
        await owner.query(`UPDATE learning.course SET "discountPrice" = 1500 WHERE id = $1`, [course.id]);
        other = await createCourse({ title: "Other course", price: 1000 });
        third = await createCourse({ title: "Third course", price: 600 });
        for (const student of [alice, bob, carol, ...crowd]) await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    const make = (body: object) => api().post("/api/v1/coupons/manage").set("Cookie", admin.cookie).send(body);
    const edit = (couponId: string, body: object) => api().patch(`/api/v1/coupons/manage/${couponId}`).set("Cookie", admin.cookie).send(body);
    const order = async (student: TestAccount, courseId = course.id) =>
        (await api().post("/api/v1/orders").set("Cookie", student.cookie).send({ courseId })).body.data;
    const apply = (student: TestAccount, orderId: string, code: string) =>
        api().post(`/api/v1/orders/${orderId}/coupon`).set("Cookie", student.cookie).send({ code });
    const unapply = (student: TestAccount, orderId: string) => api().delete(`/api/v1/orders/${orderId}/coupon`).set("Cookie", student.cookie);
    const reasonFor = async (student: TestAccount, courseId: string, code: string) => (await apply(student, (await order(student, courseId)).id, code)).body.message;
    const cancelPending = (student: TestAccount) =>
        owner.query(`UPDATE learning."order" SET status = 'CANCELLED' WHERE "studentId" = $1 AND status = 'PENDING'`, [student.id]);

    it("lets admins make codes, upper-cased and unique", async () => {
        const res = await make({ code: "eid-20", kind: "PERCENT", value: 20, label: "Eid campaign" });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ code: "EID-20", label: "Eid campaign", allCourses: true, perStudentLimit: 1, courses: [] });
        expect((await make({ code: "EID-20", kind: "FIXED", value: 100 })).status).toBe(409);
        expect((await make({ code: "TOO-MUCH", kind: "PERCENT", value: 120 })).status).toBe(400);
        expect((await make({ code: "NO-COURSES", kind: "PERCENT", value: 10, allCourses: false, courseIds: [] })).status).toBe(400);
        expect((await api().post("/api/v1/coupons/manage").set("Cookie", alice.cookie).send({ code: "MINE", kind: "FIXED", value: 1 })).status).toBe(403);
        // A cap only means something on a percentage.
        const fixed = await make({ code: "FLAT-CAP", kind: "FIXED", value: 100, maxDiscount: 50 });
        expect(fixed.body.data.maxDiscount).toBeNull();
    });

    it("takes a percentage off the sale price, records its share, and comes off again", async () => {
        const pending = await order(alice);
        expect(pending).toMatchObject({ amount: 2000, discount: 500, total: 1500, status: "PENDING" });

        const applied = await apply(alice, pending.id, "eid-20");
        expect(applied.status).toBe(200);
        expect(applied.body.data).toMatchObject({ couponCode: "EID-20", couponDiscount: 300, discount: 800, total: 1200, coupon: { label: "Eid campaign" } });

        const removed = await unapply(alice, pending.id);
        expect(removed.body.data).toMatchObject({ couponCode: null, couponDiscount: 0, discount: 500, total: 1500, coupon: null });
    });

    it("says why a code can't be used", async () => {
        await make({ code: "OTHER-ONLY", kind: "FIXED", value: 100, allCourses: false, courseIds: [other.id] });
        await make({ code: "OLD", kind: "FIXED", value: 100, endsAt: new Date(Date.now() - 3_600_000).toISOString() });
        await make({ code: "LATER", kind: "FIXED", value: 100, startsAt: new Date(Date.now() + 3_600_000).toISOString() });
        await make({ code: "OFF", kind: "FIXED", value: 100, isActive: false });
        await make({ code: "BIG-ONLY", kind: "PERCENT", value: 10, minAmount: 1800 });
        const pending = await order(alice);
        const reason = async (code: string) => (await apply(alice, pending.id, code)).body.message;
        expect(await reason("NOPE")).toBe("That code isn't valid.");
        expect(await reason("OFF")).toBe("That code isn't valid.");
        expect(await reason("OTHER-ONLY")).toBe("That code is for a different course.");
        expect(await reason("OLD")).toBe("That code has expired.");
        expect(await reason("LATER")).toBe("That code isn't open yet.");
        // The minimum is on the sale price (৳1,500 here), not the list price.
        expect(await reason("BIG-ONLY")).toBe("That code works on courses of ৳1,800 or more.");
        expect((await apply(bob, pending.id, "EID-20")).status).toBe(404);
    });

    it("works on any of its chosen courses, and only those", async () => {
        await make({ code: "TWO-COURSES", kind: "FIXED", value: 100, allCourses: false, courseIds: [course.id, other.id], perStudentLimit: null });
        const onCourse = await apply(bob, (await order(bob)).id, "TWO-COURSES");
        expect(onCourse.body.data).toMatchObject({ couponCode: "TWO-COURSES", total: 1400 });
        const onOther = await apply(bob, (await order(bob, other.id)).id, "TWO-COURSES");
        expect(onOther.body.data).toMatchObject({ couponCode: "TWO-COURSES", total: 900 });
        expect(await reasonFor(bob, third.id, "TWO-COURSES")).toBe("That code is for a different course.");
        await cancelPending(bob);
    });

    it("caps a percentage at its most", async () => {
        await make({ code: "HALF-CAPPED", kind: "PERCENT", value: 50, maxDiscount: 300 });
        const applied = await apply(carol, (await order(carol)).id, "HALF-CAPPED");
        // 50% of the ৳1,500 sale price is ৳750 — the cap holds it to ৳300.
        expect(applied.body.data).toMatchObject({ couponDiscount: 300, total: 1200 });
        await cancelPending(carol);
    });

    it("enrols on the spot when a code covers the lot — and then counts as used", async () => {
        await make({ code: "FULL", kind: "PERCENT", value: 100, maxRedemptions: 1 });
        const pending = await order(alice);
        const res = await apply(alice, pending.id, "FULL");
        expect(res.body.data).toMatchObject({ status: "PAID", total: 0, couponCode: "FULL", payment: { gateway: "FREE" } });
        const enrolment = (await owner.query(`SELECT status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [alice.id, course.id])).rows[0];
        expect(enrolment.status).toBe("ACTIVE");

        const bobs = await order(bob);
        expect((await apply(bob, bobs.id, "FULL")).body.message).toBe("That code has been used up.");
        await cancelPending(bob);
    });

    it("lets a student use a code once by default", async () => {
        await make({ code: "ONCE", kind: "FIXED", value: 5000 });
        const first = await order(bob, other.id);
        expect((await apply(bob, first.id, "ONCE")).body.data.status).toBe("PAID");
        expect(await reasonFor(bob, course.id, "ONCE")).toBe("You've already used that code.");
        await cancelPending(bob);
    });

    it("lets each student use a code as many times as the admin allows", async () => {
        await make({ code: "TWICE", kind: "FIXED", value: 5000, perStudentLimit: 2 });
        expect((await apply(carol, (await order(carol, other.id)).id, "TWICE")).body.data.status).toBe("PAID");
        expect((await apply(carol, (await order(carol, third.id)).id, "TWICE")).body.data.status).toBe("PAID");
        expect(await reasonFor(carol, course.id, "TWICE")).toBe("You've already used that code 2 times — that's as many as it allows.");
        await cancelPending(carol);
    });

    it("holds a limited code's use for a student who is paying, and lets it go", async () => {
        const made = await make({ code: "ONE-SEAT", kind: "PERCENT", value: 10, maxRedemptions: 1 });
        const seat = await createCourse({ title: "Seat course", price: 1000 });
        const alicesOrder = await order(alice, seat.id);
        expect((await apply(alice, alicesOrder.id, "ONE-SEAT")).body.data).toMatchObject({ couponCode: "ONE-SEAT", status: "PENDING", total: 900 });

        const bobsOrder = await order(bob, seat.id);
        expect((await apply(bob, bobsOrder.id, "ONE-SEAT")).body.message).toBe(
            "Every use of that code is taken by someone paying right now — try again in a few minutes.",
        );

        // The admin sees it held.
        const detail = (await api().get(`/api/v1/coupons/manage/${made.body.data.id}`).set("Cookie", admin.cookie)).body.data;
        expect(detail).toMatchObject({ used: 0, held: 1, holdMinutes: 30 });
        expect(detail.redemptions[0]).toMatchObject({ orderNumber: alicesOrder.orderNumber, held: true, student: { id: alice.id } });

        // Taking it off gives the use back at once.
        await unapply(alice, alicesOrder.id);
        expect((await apply(bob, bobsOrder.id, "ONE-SEAT")).body.data.couponCode).toBe("ONE-SEAT");

        // A hold left past its time lapses: Alice can have it again, and Bob's
        // order, read now, finds the code taken and drops it.
        await owner.query(`UPDATE learning."order" SET "couponAppliedAt" = (now() AT TIME ZONE 'UTC') - interval '31 minutes' WHERE id = $1`, [bobsOrder.id]);
        expect((await apply(alice, alicesOrder.id, "ONE-SEAT")).body.data.couponCode).toBe("ONE-SEAT");
        const bobNow = await api().get(`/api/v1/orders/my/${bobsOrder.id}`).set("Cookie", bob.cookie);
        expect(bobNow.body.data).toMatchObject({ couponCode: null, couponDiscount: 0, total: 1000 });
        await cancelPending(alice);
        await cancelPending(bob);
    });

    it("won't let one student hold a once-only code on two unpaid orders", async () => {
        await make({ code: "ONE-EACH", kind: "PERCENT", value: 10 });
        const [first, second] = await Promise.all([createCourse({ title: "First of two", price: 800 }), createCourse({ title: "Second of two", price: 800 })]);
        expect((await apply(carol, (await order(carol, first.id)).id, "ONE-EACH")).body.data.couponCode).toBe("ONE-EACH");
        expect(await reasonFor(carol, second.id, "ONE-EACH")).toBe(
            "That code is on another of your unpaid orders — pay for that one, or take the code off it, first.",
        );
        await cancelPending(carol);
    });

    it("hands the last use to exactly one of a crowd applying at once", async () => {
        await make({ code: "LAST-ONE", kind: "PERCENT", value: 20, maxRedemptions: 1 });
        const orders = await Promise.all(crowd.map((student) => order(student, other.id)));
        const results = await Promise.all(crowd.map((student, index) => apply(student, orders[index].id, "LAST-ONE")));
        expect(results.filter((res) => res.status === 200)).toHaveLength(1);
        expect(results.filter((res) => res.status === 400).every((res) => /taken by someone paying/.test(res.body.message))).toBe(true);
        for (const student of crowd) await cancelPending(student);
    });

    it("gives a use back when its order is refunded", async () => {
        await make({ code: "REFUNDABLE", kind: "PERCENT", value: 100, maxRedemptions: 1 });
        const free = await createCourse({ title: "Refund test course", price: 700 });
        const paid = (await apply(alice, (await order(alice, free.id)).id, "REFUNDABLE")).body.data;
        expect(paid.status).toBe("PAID");
        expect(await reasonFor(bob, free.id, "REFUNDABLE")).toBe("That code has been used up.");
        await cancelPending(bob);
        expect((await api().patch(`/api/v1/orders/manage/${paid.id}/refund`).set("Cookie", admin.cookie).send({})).status).toBe(200);
        expect((await apply(bob, (await order(bob, free.id)).id, "REFUNDABLE")).body.data.status).toBe("PAID");
    });

    it("won't take a bKash payment at a price the student didn't see", async () => {
        const made = await make({ code: "VANISHING", kind: "FIXED", value: 200 });
        const fresh = await createCourse({ title: "Pay test course", price: 900 });
        const pending = (await apply(bob, (await order(bob, fresh.id)).id, "VANISHING")).body.data;
        expect(pending.total).toBe(700);
        await edit(made.body.data.id, { endsAt: new Date(Date.now() - 60_000).toISOString(), startsAt: null });
        const pay = await api()
            .post(`/api/v1/orders/${pending.id}/bkash`)
            .set("Cookie", bob.cookie)
            .send({ transactionId: "VAN1SH1NG0", senderNumber: "01711111111" });
        expect(pay.status).toBe(409);
        expect(pay.body.message).toBe("The code VANISHING can't be used any more, so it came off — the total is now ৳900. Check it before you pay.");
        await cancelPending(bob);
    });

    it("tells anyone with a code what it does, and a student what it does for them", async () => {
        await make({ code: "EDEN-25", kind: "PERCENT", value: 25, label: "Eden Mohila College programme", allCourses: false, courseIds: [course.id, other.id] });
        const anonymous = await api().get(`/api/v1/coupons/check?code=eden-25&courseId=${course.id}`);
        expect(anonymous.status).toBe(200);
        expect(anonymous.body.data).toMatchObject({
            code: "EDEN-25",
            usable: true,
            label: "Eden Mohila College programme",
            allCourses: false,
            preview: { courseId: course.id, salePrice: 1500, off: 375, total: 1125 },
        });
        expect(anonymous.body.data.courses.map((entry: { id: string }) => entry.id).sort()).toEqual([course.id, other.id].sort());
        expect((await api().get(`/api/v1/coupons/check?code=EDEN-25&courseId=${third.id}`)).body.data).toMatchObject({ usable: false, reason: "That code is for a different course." });
        expect((await api().get("/api/v1/coupons/check?code=NOPE")).body.data).toEqual({ code: "NOPE", usable: false, reason: "That code isn't valid." });
        // A student who has used ONCE is told so; a visitor isn't.
        expect((await api().get("/api/v1/coupons/check?code=ONCE").set("Cookie", bob.cookie)).body.data).toMatchObject({ usable: false, reason: "You've already used that code." });
        expect((await api().get("/api/v1/coupons/check?code=ONCE")).body.data.usable).toBe(true);
    });

    it("moves a code between every course and chosen ones", async () => {
        const made = (await make({ code: "MOVER", kind: "FIXED", value: 50 })).body.data;
        const chosen = await edit(made.id, { allCourses: false, courseIds: [third.id] });
        expect(chosen.body.data).toMatchObject({ allCourses: false, courses: [{ id: third.id }] });
        expect((await edit(made.id, { allCourses: false, courseIds: [] })).status).toBe(400);
        const everywhere = await edit(made.id, { allCourses: true });
        expect(everywhere.body.data).toMatchObject({ allCourses: true, courses: [] });
    });

    it("shows admins who used a code, and exports it", async () => {
        const list = (await api().get("/api/v1/coupons/manage").set("Cookie", admin.cookie)).body.data;
        const twice = list.find((c: { code: string }) => c.code === "TWICE");
        expect(twice).toMatchObject({ used: 2, held: 0, refunded: 0, discountGiven: 1600, revenue: 0 });

        const detail = (await api().get(`/api/v1/coupons/manage/${twice.id}`).set("Cookie", admin.cookie)).body.data;
        expect(detail.redemptions).toHaveLength(2);
        expect(detail.redemptions.every((entry: { status: string; student: { id: string } }) => entry.status === "PAID" && entry.student.id === carol.id)).toBe(true);

        const csv = await api().get(`/api/v1/coupons/manage/${twice.id}/export`).set("Cookie", admin.cookie);
        expect(csv.status).toBe(200);
        expect(csv.headers["content-type"]).toMatch(/text\/csv/);
        expect(csv.text.split("\r\n")).toHaveLength(3);
        expect((await api().get(`/api/v1/coupons/manage/${twice.id}`).set("Cookie", carol.cookie)).status).toBe(403);
    });

    it("still enrols straight away on a free course, no code needed", async () => {
        const free = await createCourse({ title: "Free course", price: 0 });
        const placed = await order(alice, free.id);
        expect(placed).toMatchObject({ status: "PAID", total: 0, payment: { gateway: "FREE" } });
        const enrolment = (await owner.query(`SELECT status FROM learning.enrollment WHERE "studentId" = $1 AND "courseId" = $2`, [alice.id, free.id])).rows[0];
        expect(enrolment.status).toBe("ACTIVE");
    });

    it("keeps a used code for the record: no renaming, no deleting", async () => {
        const list = (await api().get("/api/v1/coupons/manage").set("Cookie", admin.cookie)).body.data;
        const full = list.find((c: { code: string }) => c.code === "FULL");
        expect(full.used).toBe(1);
        expect((await edit(full.id, { code: "FULL-2" })).status).toBe(409);
        expect((await api().delete(`/api/v1/coupons/manage/${full.id}`).set("Cookie", admin.cookie)).status).toBe(409);
        expect((await edit(full.id, { isActive: false })).status).toBe(200);
        const unused = list.find((c: { code: string }) => c.code === "LATER");
        expect((await api().delete(`/api/v1/coupons/manage/${unused.id}`).set("Cookie", admin.cookie)).status).toBe(200);
    });
});
