import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol } from "../helpers/learning";

/**
 * Marking rubrics: lines whose points add up to the assignment's marks; a
 * mark given with one is what its lines add up to (scaled down for a late
 * hand-in), and students see the lines before and the breakdown after.
 */
describe("marking rubrics", () => {
    let mentor: TestAccount;
    let stranger: TestAccount;
    let student: TestAccount;
    let late: TestAccount;
    let assignmentId: string;
    let lines: { id: string; title: string; maxPoints: number }[];

    beforeAll(async () => {
        [mentor, stranger, student, late] = await Promise.all([createAccount("MENTOR"), createAccount("MENTOR"), createAccount("STUDENT"), createAccount("STUDENT")]);
        const course = await createCourse();
        assignmentId = await createAssignment(course.id, await createMilestone(course.id), { title: "Portfolio", totalMarks: 100 });
        await assignMentor(course.id, mentor.id);
        await enrol(student.id, course.id);
        await enrol(late.id, course.id);
    });

    const setRubric = (account: TestAccount, criteria: object[]) =>
        api().put(`/api/v1/assignments/manage/${assignmentId}/rubric`).set("Cookie", account.cookie).send({ criteria });
    const handIn = async (account: TestAccount) =>
        (await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", account.cookie).send({ content: "My work" })).body.data.id as string;
    const review = (submissionId: string, body: object) =>
        api().patch(`/api/v1/assignments/submissions/${submissionId}/review`).set("Cookie", mentor.cookie).send(body);

    it("takes a rubric only when its lines add up to the marks", async () => {
        const wrong = await setRubric(mentor, [{ title: "Design", maxPoints: 40 }, { title: "Code", maxPoints: 40 }]);
        expect(wrong.status).toBe(400);
        expect(wrong.body.message).toMatch(/add up to 80, but the assignment is out of 100/);
        const res = await setRubric(mentor, [
            { title: "Design", maxPoints: 40 },
            { title: "Code quality", maxPoints: 40, description: "Readable, tested" },
            { title: "Write-up", maxPoints: 20 },
        ]);
        expect(res.status).toBe(200);
        lines = res.body.data.criteria;
        expect(lines.map((line) => line.title)).toEqual(["Design", "Code quality", "Write-up"]);
        expect((await setRubric(stranger, [])).status).toBe(403);
    });

    it("shows students how they'll be marked", async () => {
        const res = await api().get(`/api/v1/assignments/${assignmentId}`).set("Cookie", student.cookie);
        expect(res.body.data.rubric.map((line: { maxPoints: number }) => line.maxPoints)).toEqual([40, 40, 20]);
    });

    it("marks with the rubric: every line, the sum as the score", async () => {
        const submissionId = await handIn(student);
        expect((await review(submissionId, { status: "ACCEPTED", score: 90 })).body.message).toMatch(/score each line/);
        expect((await review(submissionId, { status: "ACCEPTED", rubric: [{ criterionId: lines[0].id, points: 30 }] })).status).toBe(400);
        expect(
            (await review(submissionId, { status: "ACCEPTED", rubric: lines.map((line) => ({ criterionId: line.id, points: line.maxPoints + 1 })) })).status,
        ).toBe(400);

        const res = await review(submissionId, {
            status: "ACCEPTED",
            rubric: [
                { criterionId: lines[0].id, points: 35 },
                { criterionId: lines[1].id, points: 30, comment: "Add tests next time" },
                { criterionId: lines[2].id, points: 18 },
            ],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.score).toBe(83);
        const mine = await api().get(`/api/v1/assignments/${assignmentId}`).set("Cookie", student.cookie);
        expect(mine.body.data.submission.rubricScores).toHaveLength(3);
        expect(mine.body.data.submission.rubricScores.find((s: { criterionId: string }) => s.criterionId === lines[1].id).comment).toBe("Add tests next time");
    });

    it("scales a late hand-in's rubric total to its window's marks", async () => {
        const submissionId = await handIn(late);
        await owner.query(`UPDATE learning.assignment_submission SET "maxScore" = 80 WHERE id = $1`, [submissionId]);
        const res = await review(submissionId, { status: "ACCEPTED", rubric: lines.map((line) => ({ criterionId: line.id, points: line.maxPoints / 2 })) });
        expect(res.body.data.score).toBe(40); // 50 of 100, as a mark out of 80
    });

    it("keeps the scores on lines that stay, and clears them on a resubmission", async () => {
        const kept = await setRubric(mentor, [
            { id: lines[0].id, title: "Design", maxPoints: 50 },
            { id: lines[1].id, title: "Code quality", maxPoints: 50 },
        ]);
        expect(kept.status).toBe(200);
        expect(kept.body.data.marked).toBe(true);
        const [submission] = (await owner.query(`SELECT id FROM learning.assignment_submission WHERE "studentId" = $1`, [student.id])).rows;
        const scores = (await owner.query(`SELECT "criterionId" FROM learning.rubric_score WHERE "submissionId" = $1`, [submission.id])).rows;
        expect(scores.map((row: { criterionId: string }) => row.criterionId).sort()).toEqual([lines[0].id, lines[1].id].sort());

        await review(submission.id, { status: "NEEDS_REVISION", feedback: "Polish the write-up" });
        await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", student.cookie).send({ content: "Better" });
        const after = (await owner.query(`SELECT count(*)::int AS n FROM learning.rubric_score WHERE "submissionId" = $1`, [submission.id])).rows[0];
        expect(after.n).toBe(0);
    });
});
