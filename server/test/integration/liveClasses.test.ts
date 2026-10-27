import { beforeAll, describe, expect, it } from "vitest";
import { LiveClassService } from "../../src/app/module/liveClass/liveClass.service";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, enrol, notificationsOf } from "../helpers/learning";

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/**
 * A course's live classes: scheduled by its staff, announced to its
 * students, the meeting link handed out only around class time, a nudge just
 * before — and moves and cancellations announced too.
 */
describe("live classes", () => {
    let mentor: TestAccount;
    let stranger: TestAccount;
    let student: TestAccount;
    let outsider: TestAccount;
    let course: { id: string; slug: string };

    beforeAll(async () => {
        [mentor, stranger, student, outsider] = await Promise.all([
            createAccount("MENTOR"),
            createAccount("MENTOR"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        course = await createCourse({ title: "Live course" });
        await assignMentor(course.id, mentor.id);
        await enrol(student.id, course.id);
    });

    const schedule = (account: TestAccount, body: object) =>
        api().post(`/api/v1/live-classes/course/${course.id}`).set("Cookie", account.cookie).send(body);
    const titles = async () => (await notificationsOf(student.id)).map((n: { title: string }) => n.title);
    const learnerView = async (account = student) => api().get(`/api/v1/live-classes/learn/${course.slug}`).set("Cookie", account.cookie);

    it("schedules a class and tells the course", async () => {
        const res = await schedule(mentor, { title: "Recursion, live", startsAt: inMinutes(3 * 24 * 60), durationMinutes: 90, joinUrl: "https://meet.google.com/abc-defg-hij" });
        expect(res.status).toBe(201);
        expect(res.body.data.recipients).toBe(1);
        expect(await titles()).toContain("Live class: Recursion, live");
    });

    it("keeps the link back until shortly before the start", async () => {
        const later = (await learnerView()).body.data.classes.find((c: { title: string }) => c.title === "Recursion, live");
        expect(later).toMatchObject({ hasLink: true, joinUrl: null, isLive: false });

        await schedule(mentor, { title: "Starting soon", startsAt: inMinutes(10), joinUrl: "https://zoom.us/j/123" });
        const soon = (await learnerView()).body.data.classes.find((c: { title: string }) => c.title === "Starting soon");
        expect(soon.joinUrl).toBe("https://zoom.us/j/123");
    });

    it("lists a student's upcoming classes across their courses", async () => {
        const res = await api().get("/api/v1/live-classes/mine").set("Cookie", student.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.map((c: { title: string }) => c.title)).toEqual(["Starting soon", "Recursion, live"]);
        expect(res.body.data[0].course).toMatchObject({ slug: course.slug });
    });

    it("nudges the course once, about fifteen minutes before", async () => {
        await LiveClassService.remindStartingClasses();
        await LiveClassService.remindStartingClasses();
        expect((await titles()).filter((title: string) => title === "Starting soon: Starting soon")).toHaveLength(1);
    });

    it("announces a move and earns the new time its own reminder", async () => {
        const id = (await learnerView()).body.data.classes.find((c: { title: string }) => c.title === "Starting soon").id;
        const moved = await api().patch(`/api/v1/live-classes/${id}`).set("Cookie", mentor.cookie).send({ startsAt: inMinutes(12) });
        expect(moved.status).toBe(200);
        expect(await titles()).toContain("Live class moved: Starting soon");
        const row = (await owner.query(`SELECT "remindedAt" FROM learning.live_class WHERE id = $1`, [id])).rows[0];
        expect(row.remindedAt).toBeNull();
    });

    it("cancels, announces it, and shows students it's off", async () => {
        const id = (await learnerView()).body.data.classes.find((c: { title: string }) => c.title === "Recursion, live").id;
        expect((await api().delete(`/api/v1/live-classes/${id}`).set("Cookie", mentor.cookie)).status).toBe(409);
        const res = await api().post(`/api/v1/live-classes/${id}/cancel`).set("Cookie", mentor.cookie);
        expect(res.status).toBe(200);
        expect(await titles()).toContain("Live class cancelled: Recursion, live");
        const shown = (await learnerView()).body.data.classes.find((c: { id: string }) => c.id === id);
        expect(shown).toMatchObject({ status: "CANCELLED", joinUrl: null });
        expect((await api().delete(`/api/v1/live-classes/${id}`).set("Cookie", mentor.cookie)).status).toBe(200);
    });

    it("guards who can see and schedule, and what", async () => {
        expect((await learnerView(outsider)).status).toBe(403);
        expect((await schedule(stranger, { title: "Not mine", startsAt: inMinutes(60) })).status).toBe(403);
        expect((await schedule(mentor, { title: "In the past", startsAt: inMinutes(-60) })).status).toBe(400);
        expect((await schedule(mentor, { title: "Bad link", startsAt: inMinutes(60), joinUrl: "http://insecure.example" })).status).toBe(400);
        expect((await api().get(`/api/v1/live-classes/course/${course.id}`).set("Cookie", stranger.cookie)).status).toBe(403);
    });
});
