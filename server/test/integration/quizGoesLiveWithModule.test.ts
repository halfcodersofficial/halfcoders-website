import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, createLesson, createMilestone, createModule, createQuiz, enrol, notificationsOf } from "../helpers/learning";

/**
 * A module's quiz has no release of its own: it goes live when its module
 * does, comes down with it, and is never announced separately — the
 * "New module available" notification covers it.
 */
describe("a quiz goes live with its module", () => {
    let admin: TestAccount;
    let student: TestAccount;
    let moduleId: string;
    let quiz: Awaited<ReturnType<typeof createQuiz>>;

    const quizIsLive = async () => (await owner.query(`SELECT "isPublished" FROM learning.quiz WHERE id = $1`, [quiz.quizId])).rows[0].isPublished;
    const setModuleLive = (isPublished: boolean) => api().patch(`/api/v1/modules/${moduleId}`).set("Cookie", admin.cookie).send({ isPublished });

    beforeAll(async () => {
        admin = await createAccount("ADMIN");
        student = await createAccount("STUDENT");
        const course = await createCourse({ courseType: "TRADITIONAL" });
        moduleId = await createModule(course.id, await createMilestone(course.id));
        await createLesson(course.id, moduleId, 1);
        quiz = await createQuiz(course.id, moduleId, [["2 + 2?", ["3", "4"], 1]]);
        // A module still being built, its quiz written but not out.
        await owner.query(`UPDATE learning.course_module SET "isPublished" = false WHERE id = $1`, [moduleId]);
        await owner.query(`UPDATE learning.quiz SET "isPublished" = false WHERE id = $1`, [quiz.quizId]);
        await enrol(student.id, course.id);
    });

    it("can't go live ahead of its module", async () => {
        const res = await api().patch(`/api/v1/quizzes/manage/${quiz.quizId}`).set("Cookie", admin.cookie).send({ isPublished: true });
        expect(res.status).toBe(400);
        expect(await quizIsLive()).toBe(false);
    });

    it("goes live when the module does, with only the module announced", async () => {
        expect((await setModuleLive(true)).status).toBe(200);
        expect(await quizIsLive()).toBe(true);

        // The announcement goes out after the response; give it a moment.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const titles = (await notificationsOf(student.id)).map((row: { title: string }) => row.title);
        expect(titles).toContain("New module available");
        expect(titles).not.toContain("New quiz available");
    });

    it("comes down with the module", async () => {
        expect((await setModuleLive(false)).status).toBe(200);
        expect(await quizIsLive()).toBe(false);
    });
});
