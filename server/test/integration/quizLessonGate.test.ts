import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, createLesson, createMilestone, createModule, createQuiz, enrol } from "../helpers/learning";

type Quiz = Awaited<ReturnType<typeof createQuiz>>;

/**
 * A module's quiz opens once every lesson before it is complete — the ones up
 * to where staff placed it, not the ones after — so the "new quiz"
 * notification link (or a direct call) can't open it early. And it's a step,
 * not an extra: no lesson after it can be finished until it's taken.
 */
describe("a quiz waits for the lessons before it", () => {
    let student: TestAccount;
    let lessons: string[];
    let quiz: Quiz;
    // A second module, its quiz at the end, and a third module after it.
    let secondModuleLesson: string;
    let endQuiz: Quiz;
    let thirdModuleLesson: string;

    const open = () => api().get(`/api/v1/quizzes/${quiz.quizId}`).set("Cookie", student.cookie);
    const submit = (target: Quiz = quiz) =>
        api()
            .post(`/api/v1/quizzes/${target.quizId}/submit`)
            .set("Cookie", student.cookie)
            .send({ answers: [{ questionId: target.questions[0].questionId, selectedOptionId: target.questions[0].optionIds[1] }] });
    const complete = (lessonId: string) => api().post(`/api/v1/progress/videos/${lessonId}/complete`).set("Cookie", student.cookie);

    beforeAll(async () => {
        student = await createAccount("STUDENT");
        await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
        const course = await createCourse({ courseType: "TRADITIONAL" });
        const milestoneId = await createMilestone(course.id);
        const moduleId = await createModule(course.id, milestoneId);
        lessons = [await createLesson(course.id, moduleId, 1), await createLesson(course.id, moduleId, 2), await createLesson(course.id, moduleId, 3)];
        quiz = await createQuiz(course.id, moduleId, [["2 + 2?", ["3", "4"], 1]]);
        // After lesson 2, before lesson 3.
        await owner.query(`UPDATE learning.quiz SET position = 2 WHERE id = $1`, [quiz.quizId]);

        const secondModule = await createModule(course.id, milestoneId, 2);
        secondModuleLesson = await createLesson(course.id, secondModule, 1);
        endQuiz = await createQuiz(course.id, secondModule, [["3 + 3?", ["5", "6"], 1]]);
        thirdModuleLesson = await createLesson(course.id, await createModule(course.id, milestoneId, 3), 1);

        await enrol(student.id, course.id);
    });

    it("stays shut, and refuses a submission, while a lesson before it is unfinished", async () => {
        const res = await open();
        expect(res.status).toBe(403);
        expect(res.body.message).toContain("Lesson 1");
        expect((await submit()).status).toBe(403);

        expect((await complete(lessons[0])).status).toBe(200);
        const stillShut = await open();
        expect(stillShut.status).toBe(403);
        expect(stillShut.body.message).toContain("Lesson 2");
    });

    it("opens once those lessons are done, without the ones after it", async () => {
        expect((await complete(lessons[1])).status).toBe(200);
        expect((await open()).status).toBe(200);
    });

    it("holds back the lessons after it until it's taken", async () => {
        const early = await complete(lessons[2]);
        expect(early.status).toBe(403);
        expect(early.body.message).toContain("Take the quiz");

        expect((await submit()).status).toBe(201);
        expect((await complete(lessons[2])).status).toBe(200);
        expect((await complete(secondModuleLesson)).status).toBe(200);
    });

    it("holds back the next module when it sits at the end of its own", async () => {
        expect((await complete(thirdModuleLesson)).status).toBe(403);
        expect((await submit(endQuiz)).status).toBe(201);
        expect((await complete(thirdModuleLesson)).status).toBe(200);
    });
});
