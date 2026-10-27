import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAttempt, createCourse, createMilestone, createModule, createQuiz, enrol } from "../helpers/learning";

/**
 * A quiz's results for its course's staff: every finished attempt — the
 * student by name only — and how each question went, option by option.
 */
describe("quiz results for mentors", () => {
    let mentor: TestAccount;
    let otherMentor: TestAccount;
    let quiz: Awaited<ReturnType<typeof createQuiz>>;
    let attemptIds: string[];

    beforeAll(async () => {
        const [a, b] = [await createAccount("STUDENT"), await createAccount("STUDENT")];
        [mentor, otherMentor] = [await createAccount("MENTOR"), await createAccount("MENTOR")];
        const course = await createCourse();
        const moduleId = await createModule(course.id, await createMilestone(course.id));
        await assignMentor(course.id, mentor.id);
        quiz = await createQuiz(course.id, moduleId, [
            ["2 + 2?", ["3", "4", "5"], 1],
            ["Capital of Bangladesh?", ["Dhaka", "Khulna"], 0],
        ]);
        const [ea, eb] = [await enrol(a.id, course.id), await enrol(b.id, course.id)];
        attemptIds = [
            await createAttempt(quiz, a.id, ea, [1, 0], [1, 0]), // both right
            await createAttempt(quiz, b.id, eb, [2, 0], [1, 0]), // first wrong (picked 5)
        ];
    });

    it("lists every finished attempt with the student's name only", async () => {
        const res = await api().get(`/api/v1/quizzes/manage/${quiz.quizId}/results`).set("Cookie", mentor.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.attempts).toHaveLength(2);
        for (const attempt of res.body.data.attempts) {
            expect(Object.keys(attempt.student).sort()).toEqual(["id", "name"]);
        }
        expect(res.body.data.attempts.map((a: { percentage: number }) => a.percentage).sort()).toEqual([100, 50]);
    });

    it("says how each question went and which wrong answer drew people", async () => {
        const res = await api().get(`/api/v1/quizzes/manage/${quiz.quizId}/results`).set("Cookie", mentor.cookie);
        const [first, second] = res.body.data.questions;
        expect(first).toMatchObject({ answered: 2, correct: 1, percentCorrect: 50 });
        expect(first.options.map((o: { text: string; picked: number }) => [o.text, o.picked])).toEqual([["3", 0], ["4", 1], ["5", 1]]);
        expect(second).toMatchObject({ answered: 2, correct: 2, percentCorrect: 100 });
    });

    it("lets the course's mentor open an attempt, answers revealed", async () => {
        const res = await api().get(`/api/v1/quizzes/attempts/${attemptIds[1]}`).set("Cookie", mentor.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.questions[0]).toMatchObject({ isCorrect: false, selectedOptionId: quiz.questions[0].optionIds[2] });
    });

    it("refuses a mentor who doesn't teach the course", async () => {
        expect((await api().get(`/api/v1/quizzes/manage/${quiz.quizId}/results`).set("Cookie", otherMentor.cookie)).status).toBe(403);
        expect((await api().get(`/api/v1/quizzes/attempts/${attemptIds[0]}`).set("Cookie", otherMentor.cookie)).status).toBe(403);
    });
});
