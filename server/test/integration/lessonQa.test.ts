import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, createLesson, createMilestone, createModule, enrol, notificationsOf } from "../helpers/learning";

/**
 * Questions on a lesson: students on the course ask and answer, its mentors
 * answer (marked as mentors) from an inbox of what's still open — everyone
 * in the thread by name only.
 */
describe("lesson questions", () => {
    let mentor: TestAccount;
    let stranger: TestAccount;
    let asker: TestAccount;
    let classmate: TestAccount;
    let outsider: TestAccount;
    let courseId: string;
    let videoId: string;
    let questionId: string;

    beforeAll(async () => {
        [mentor, stranger] = await Promise.all([createAccount("MENTOR"), createAccount("MENTOR")]);
        [asker, classmate, outsider] = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("STUDENT")]);
        const course = await createCourse();
        courseId = course.id;
        const moduleId = await createModule(courseId, await createMilestone(courseId));
        videoId = await createLesson(courseId, moduleId, 1, "Closures");
        await assignMentor(courseId, mentor.id);
        await enrol(asker.id, courseId);
        await enrol(classmate.id, courseId);
    });

    const thread = (account: TestAccount) => api().get(`/api/v1/lesson-questions/lesson/${videoId}`).set("Cookie", account.cookie);

    it("lets a student ask, and tells the course's mentors", async () => {
        const res = await api().post(`/api/v1/lesson-questions/lesson/${videoId}`).set("Cookie", asker.cookie).send({ body: "Why does the counter keep its value?" });
        expect(res.status).toBe(201);
        questionId = res.body.data.id;
        const [notice] = await notificationsOf(mentor.id);
        expect(notice).toMatchObject({ title: "Question on “Closures”", link: `/mentor/questions?focus=${questionId}` });
        expect(await notificationsOf(stranger.id)).toHaveLength(0);
    });

    it("lets a classmate and a mentor answer — the mentor marked as one, names only", async () => {
        expect((await api().post(`/api/v1/lesson-questions/${questionId}/answers`).set("Cookie", classmate.cookie).send({ body: "It's captured by the inner function." })).status).toBe(201);
        expect((await api().post(`/api/v1/lesson-questions/${questionId}/answers`).set("Cookie", mentor.cookie).send({ body: "Right — the closure keeps the variable alive." })).status).toBe(201);

        const res = await thread(asker);
        expect(res.status).toBe(200);
        const [question] = res.body.data;
        expect(question.isMine).toBe(true);
        expect(question.answers.map((a: { author: { isStaff: boolean } }) => a.author.isStaff)).toEqual([false, true]);
        for (const person of [question.author, ...question.answers.map((a: { author: object }) => a.author)]) {
            expect(Object.keys(person).sort()).toEqual(["id", "isStaff", "name"]);
        }
        const titles = (await notificationsOf(asker.id)).map((n: { title: string }) => n.title);
        expect(titles).toContain("A mentor answered your question");
    });

    it("gives mentors an inbox of open questions on their courses", async () => {
        const res = await api().get("/api/v1/lesson-questions/manage").set("Cookie", mentor.cookie);
        expect(res.status).toBe(200);
        expect(res.body.meta.open).toBe(1);
        expect(res.body.data[0]).toMatchObject({ id: questionId, video: { title: "Closures" }, course: { id: courseId } });
        const elsewhere = await api().get("/api/v1/lesson-questions/manage").set("Cookie", stranger.cookie);
        expect(elsewhere.body.data).toHaveLength(0);
        expect((await api().get(`/api/v1/lesson-questions/manage?courseId=${courseId}`).set("Cookie", stranger.cookie)).status).toBe(403);
    });

    it("lets whoever asked mark it answered, and moves it out of the open inbox", async () => {
        expect((await api().patch(`/api/v1/lesson-questions/${questionId}`).set("Cookie", classmate.cookie).send({ isResolved: true })).status).toBe(403);
        expect((await api().patch(`/api/v1/lesson-questions/${questionId}`).set("Cookie", asker.cookie).send({ isResolved: true })).status).toBe(200);
        const open = await api().get("/api/v1/lesson-questions/manage").set("Cookie", mentor.cookie);
        expect(open.body.meta.open).toBe(0);
        const resolved = await api().get("/api/v1/lesson-questions/manage?status=resolved").set("Cookie", mentor.cookie);
        expect(resolved.body.data.map((q: { id: string }) => q.id)).toContain(questionId);
    });

    it("keeps the thread to the course", async () => {
        expect((await thread(outsider)).status).toBe(403);
        expect((await thread(stranger)).status).toBe(403);
        expect((await api().post(`/api/v1/lesson-questions/lesson/${videoId}`).set("Cookie", outsider.cookie).send({ body: "Can I ask?" })).status).toBe(403);
        expect((await api().post(`/api/v1/lesson-questions/${questionId}/answers`).set("Cookie", stranger.cookie).send({ body: "Not my course" })).status).toBe(403);
    });

    it("won't let someone take down a question that has answers, unless they're staff", async () => {
        expect((await api().delete(`/api/v1/lesson-questions/${questionId}`).set("Cookie", asker.cookie)).status).toBe(409);
        expect((await api().delete(`/api/v1/lesson-questions/${questionId}`).set("Cookie", classmate.cookie)).status).toBe(403);
        expect((await api().delete(`/api/v1/lesson-questions/${questionId}`).set("Cookie", mentor.cookie)).status).toBe(200);
    });
});
