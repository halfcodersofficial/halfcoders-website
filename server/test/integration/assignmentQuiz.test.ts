import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol } from "../helpers/learning";

/**
 * An assignment can have a quiz, the way a module does: written by its
 * staff, one at most, live with its assignment, and taken once — with none
 * of a module quiz's waiting on lessons, since an assignment has no lesson
 * progress of its own.
 */
describe("an assignment's quiz", () => {
    let student: TestAccount;
    let mentor: TestAccount;
    let slug: string;
    let assignmentId: string;
    let quizId: string;
    let question: { id: string; optionIds: string[] };

    beforeAll(async () => {
        [student, mentor] = await Promise.all([createAccount("STUDENT"), createAccount("MENTOR")]);
        await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
        const course = await createCourse({ courseType: "TRADITIONAL" });
        slug = course.slug;
        assignmentId = await createAssignment(course.id, await createMilestone(course.id), { isPublished: false });
        await enrol(student.id, course.id);
        await assignMentor(course.id, mentor.id);
    });

    const createQuiz = (body: object) => api().post("/api/v1/quizzes/manage").set("Cookie", mentor.cookie).send(body);
    const learning = async () => {
        const res = await api().get(`/api/v1/learning/courses/${slug}`).set("Cookie", student.cookie);
        expect(res.status).toBe(200);
        return res.body.data;
    };

    it("is written by its staff — one per assignment, and for a module or an assignment, never both", async () => {
        expect((await createQuiz({ title: "Week 1 check" })).status).toBe(400);
        expect((await createQuiz({ title: "Week 1 check", moduleId: "x", assignmentId })).status).toBe(400);

        const res = await createQuiz({ assignmentId, title: "Week 1 check" });
        expect(res.status).toBe(201);
        quizId = res.body.data.id;
        expect((await createQuiz({ assignmentId, title: "Another" })).status).toBe(409);

        const added = await api()
            .post(`/api/v1/quizzes/manage/${quizId}/questions`)
            .set("Cookie", mentor.cookie)
            .send({ question: "2 + 2?", options: [{ text: "3" }, { text: "4", isCorrect: true }] });
        expect(added.status).toBe(201);
        question = { id: added.body.data.id, optionIds: added.body.data.options.map((option: { id: string }) => option.id) };

        const found = await api().get(`/api/v1/quizzes/manage/assignment/${assignmentId}`).set("Cookie", mentor.cookie);
        expect(found.status).toBe(200);
        expect(found.body.data.id).toBe(quizId);
    });

    it("can't go live before its assignment, and goes live with it", async () => {
        const early = await api().patch(`/api/v1/quizzes/manage/${quizId}`).set("Cookie", mentor.cookie).send({ isPublished: true });
        expect(early.status).toBe(400);
        expect(early.body.message).toContain("assignment");

        const publish = await api().patch(`/api/v1/assignments/manage/${assignmentId}`).set("Cookie", mentor.cookie).send({ isPublished: true });
        expect(publish.status).toBe(200);
        const row = await owner.query(`SELECT "isPublished" FROM learning.quiz WHERE id = $1`, [quizId]);
        expect(row.rows[0].isPublished).toBe(true);
    });

    it("is on the student's assignment, opens without any lessons done, and is taken once", async () => {
        const before = await learning();
        expect(before.curriculum[0].assignments[0].quiz).toMatchObject({ id: quizId, isCompleted: false, bestScore: null });

        expect((await api().get(`/api/v1/quizzes/${quizId}`).set("Cookie", student.cookie)).status).toBe(200);
        const submit = () =>
            api()
                .post(`/api/v1/quizzes/${quizId}/submit`)
                .set("Cookie", student.cookie)
                .send({ answers: [{ questionId: question.id, selectedOptionId: question.optionIds[1] }] });
        expect((await submit()).status).toBe(201);
        expect((await submit()).status).toBe(409);

        const after = await learning();
        expect(after.curriculum[0].assignments[0].quiz).toMatchObject({ isCompleted: true, bestScore: 100 });
    });

    it("comes down with its assignment", async () => {
        await api().patch(`/api/v1/assignments/manage/${assignmentId}`).set("Cookie", mentor.cookie).send({ isPublished: false });
        const row = await owner.query(`SELECT "isPublished" FROM learning.quiz WHERE id = $1`, [quizId]);
        expect(row.rows[0].isPublished).toBe(false);
        expect((await api().get(`/api/v1/quizzes/${quizId}`).set("Cookie", student.cookie)).status).toBe(404);
    });
});
