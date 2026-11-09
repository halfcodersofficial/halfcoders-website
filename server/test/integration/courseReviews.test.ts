import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, enrol, notificationsOf } from "../helpers/learning";

/**
 * Course ratings: students on a course rate it, once; an admin publishes a
 * review before the course page shows it; the course's mentors read them all
 * by name only.
 */
describe("course reviews", () => {
    let admin: TestAccount;
    let mentor: TestAccount;
    let fan: TestAccount;
    let critic: TestAccount;
    let outsider: TestAccount;
    let latecomer: TestAccount;
    let course: { id: string; slug: string };

    beforeAll(async () => {
        [admin, mentor] = await Promise.all([createAccount("ADMIN"), createAccount("MENTOR")]);
        [fan, critic, outsider, latecomer] = await Promise.all([
            createAccount("STUDENT"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        course = await createCourse({ title: "Rated course" });
        await assignMentor(course.id, mentor.id);
        await enrol(fan.id, course.id);
        await enrol(critic.id, course.id, "COMPLETED");
        await enrol(latecomer.id, course.id);
    });

    const rate = (account: TestAccount, body: object) => api().put(`/api/v1/course-reviews/mine/${course.id}`).set("Cookie", account.cookie).send(body);
    const publicPage = async () => (await api().get(`/api/v1/course-reviews/public/${course.slug}`)).body.data;
    const adminList = async (status = "PENDING") =>
        (await api().get(`/api/v1/course-reviews/manage?status=${status}&courseId=${course.id}`).set("Cookie", admin.cookie)).body.data;

    it("takes a student's rating and keeps it off the page until an admin publishes it", async () => {
        expect((await rate(fan, { rating: 5, comment: "Loved the projects." })).status).toBe(200);
        expect((await rate(critic, { rating: 3 })).status).toBe(200);
        expect(await publicPage()).toMatchObject({ summary: { count: 0, average: null }, reviews: [] });
        expect((await notificationsOf(admin.id)).some((n: { title: string }) => n.title === "New review: Rated course")).toBe(true);
    });

    it("publishes reviews, then the page shows them with the average", async () => {
        for (const review of await adminList()) {
            expect((await api().patch(`/api/v1/course-reviews/manage/${review.id}`).set("Cookie", admin.cookie).send({ status: "PUBLISHED" })).status).toBe(200);
        }
        const page = await publicPage();
        expect(page.summary).toMatchObject({ count: 2, average: 4 });
        expect(page.summary.spread.find((row: { stars: number }) => row.stars === 5).count).toBe(1);
        expect(page.reviews[0].student).toHaveProperty("name");
    });

    it("takes one rating per student — it can't be changed or taken back", async () => {
        expect((await rate(critic, { rating: 1, comment: "Changed my mind." })).status).toBe(409);
        expect((await api().delete(`/api/v1/course-reviews/mine/${course.id}`).set("Cookie", critic.cookie)).status).toBe(404);
        expect((await publicPage()).summary).toMatchObject({ count: 2, average: 4 });
        const mine = await api().get(`/api/v1/course-reviews/mine/${course.id}`).set("Cookie", critic.cookie);
        expect(mine.body.data).toMatchObject({ canReview: true, review: { status: "PUBLISHED", rating: 3 } });

        // A newcomer's first rating still goes through, then waits for approval.
        expect((await rate(latecomer, { rating: 4 })).status).toBe(200);
        expect((await rate(latecomer, { rating: 5 })).status).toBe(409);
    });

    it("shows the course's mentor every review, names only", async () => {
        const res = await api().get(`/api/v1/course-reviews/course/${course.id}`).set("Cookie", mentor.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.reviews).toHaveLength(3);
        for (const review of res.body.data.reviews) expect(Object.keys(review.student).sort()).toEqual(["id", "name"]);
    });

    it("lets only students on the course rate it, 1 to 5", async () => {
        expect((await rate(outsider, { rating: 4 })).status).toBe(403);
        expect((await rate(fan, { rating: 6 })).status).toBe(400);
        expect((await api().get("/api/v1/course-reviews/manage").set("Cookie", mentor.cookie)).status).toBe(403);
    });

    it("counts reviews by state for the moderation tabs", async () => {
        const res = await api().get("/api/v1/course-reviews/manage/counts").set("Cookie", admin.cookie);
        expect(res.body.data.PENDING).toBeGreaterThanOrEqual(1);
        expect(res.body.data.PUBLISHED).toBeGreaterThanOrEqual(1);
    });
});
