import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, enrol, notificationsOf } from "../helpers/learning";

/**
 * A course's notice board: its mentors (and admins) post, every student who
 * can open the course reads it and is told — nobody else.
 */
describe("course announcements", () => {
    let lead: TestAccount;
    let coMentor: TestAccount;
    let stranger: TestAccount;
    let student: TestAccount;
    let dropped: TestAccount;
    let outsider: TestAccount;
    let course: { id: string; slug: string };
    let firstId: string;

    beforeAll(async () => {
        [lead, coMentor, stranger] = await Promise.all([createAccount("MENTOR"), createAccount("MENTOR"), createAccount("MENTOR")]);
        [student, dropped, outsider] = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("STUDENT")]);
        course = await createCourse();
        await assignMentor(course.id, lead.id);
        await assignMentor(course.id, coMentor.id, "CO_MENTOR");
        await enrol(student.id, course.id);
        await enrol(dropped.id, course.id, "CANCELLED");
    });

    const post = (account: TestAccount, body: object) =>
        api().post(`/api/v1/announcements/course/${course.id}`).set("Cookie", account.cookie).send(body);

    it("posts to the course and tells every student who can open it", async () => {
        const res = await post(lead, { title: "Class moved", body: "Thursday's class moves to Friday 8 pm." });
        expect(res.status).toBe(201);
        firstId = res.body.data.id;
        expect(res.body.data.recipients).toBe(1);

        const [notice] = (await notificationsOf(student.id)).filter((n: { title: string }) => n.title.endsWith("Class moved"));
        expect(notice.link).toBe(`/learn/${course.slug}/announcements#${firstId}`);
        expect(notice.message).toBe("Thursday's class moves to Friday 8 pm.");
        expect(await notificationsOf(dropped.id)).toHaveLength(0);
    });

    it("lets a student on the course read the board, and no one else", async () => {
        const res = await api().get(`/api/v1/announcements/learn/${course.slug}`).set("Cookie", student.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.course).toMatchObject({ id: course.id, slug: course.slug });
        expect(res.body.data.announcements[0]).toMatchObject({ title: "Class moved", author: { id: lead.id } });
        expect(Object.keys(res.body.data.announcements[0].author).sort()).toEqual(["id", "image", "name"]);

        expect((await api().get(`/api/v1/announcements/learn/${course.slug}`).set("Cookie", outsider.cookie)).status).toBe(403);
        expect((await api().get(`/api/v1/announcements/learn/${course.slug}`).set("Cookie", dropped.cookie)).status).toBe(403);
    });

    it("keeps pinned posts on top, and lets a co-mentor edit a colleague's post", async () => {
        await post(coMentor, { title: "Week 2 resources", body: "Slides are up." });
        const pinned = await api().patch(`/api/v1/announcements/${firstId}`).set("Cookie", coMentor.cookie).send({ isPinned: true, title: "Class moved to Friday" });
        expect(pinned.status).toBe(200);

        const list = await api().get(`/api/v1/announcements/course/${course.id}`).set("Cookie", lead.cookie);
        expect(list.body.data.map((a: { title: string }) => a.title)).toEqual(["Class moved to Friday", "Week 2 resources"]);
        // An edit isn't news: no second notice.
        expect((await notificationsOf(student.id)).filter((n: { title: string }) => n.title.includes("Class moved"))).toHaveLength(1);
    });

    it("refuses mentors of other courses, and students, a pen", async () => {
        expect((await post(stranger, { title: "Hello there", body: "Not my course." })).status).toBe(403);
        expect((await post(student, { title: "Hello there", body: "Students can't post." })).status).toBe(403);
        expect((await api().patch(`/api/v1/announcements/${firstId}`).set("Cookie", stranger.cookie).send({ isPinned: false })).status).toBe(403);
        expect((await api().get(`/api/v1/announcements/course/${course.id}`).set("Cookie", stranger.cookie)).status).toBe(403);
    });

    it("checks what's posted", async () => {
        const res = await post(lead, { title: "Hi", body: "" });
        expect(res.status).toBe(400);
    });

    it("deletes a post", async () => {
        expect((await api().delete(`/api/v1/announcements/${firstId}`).set("Cookie", lead.cookie)).status).toBe(200);
        const list = await api().get(`/api/v1/announcements/course/${course.id}`).set("Cookie", lead.cookie);
        expect(list.body.data.map((a: { id: string }) => a.id)).not.toContain(firstId);
    });
});
