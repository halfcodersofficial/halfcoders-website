import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol, notificationsOf } from "../helpers/learning";

/**
 * Results, resubmission penalties and rechecks (utils/assignmentPenalties.ts):
 * the first hand-in is free; resubmitting before the results costs 3 marks
 * and 5 XP each time, and only when confirmed; a mark stays hidden until the
 * results are published, which closes resubmitting; a recheck costs 2 marks
 * at once — refunded when the mark goes up, followed by 3 more when it stands.
 * Every step is checked against the ledger as well as the student's view.
 */
describe("assignment results, penalties and rechecks", () => {
    let student: TestAccount;
    let other: TestAccount;
    let mentor: TestAccount;
    let courseId: string;
    let assignmentId: string;
    let submissionId: string;

    beforeAll(async () => {
        [student, other, mentor] = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("MENTOR")]);
        const course = await createCourse();
        courseId = course.id;
        assignmentId = await createAssignment(courseId, await createMilestone(courseId), { totalMarks: 100 });
        await enrol(student.id, courseId);
        await enrol(other.id, courseId);
        await assignMentor(courseId, mentor.id);
        // XP to take the penalty from.
        await owner.query(
            `INSERT INTO learning.course_xp (id, "studentId", "courseId", "totalXp", "updatedAt") VALUES ($1, $2, $3, 20, now())`,
            [randomUUID(), student.id, courseId],
        );
    });

    const submit = (account: TestAccount, body: object) =>
        api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", account.cookie).send(body);
    const view = async (account: TestAccount = student) => {
        const res = await api().get(`/api/v1/assignments/${assignmentId}`).set("Cookie", account.cookie);
        expect(res.status).toBe(200);
        return res.body.data;
    };
    const review = (id: string, body: object) =>
        api().patch(`/api/v1/assignments/submissions/${id}/review`).set("Cookie", mentor.cookie).send(body);
    const recheck = (reason = "Question 2 matches the expected output.") =>
        api().post(`/api/v1/assignments/${assignmentId}/recheck`).set("Cookie", student.cookie).send({ reason });
    const decide = (recheckId: string, body: object) =>
        api().patch(`/api/v1/assignments/rechecks/${recheckId}/decide`).set("Cookie", mentor.cookie).send(body);
    const xpOf = async () =>
        (await owner.query(`SELECT "totalXp" FROM learning.course_xp WHERE "studentId" = $1 AND "courseId" = $2`, [student.id, courseId])).rows[0]
            .totalXp as number;
    const adjustments = async () =>
        (
            await owner.query(`SELECT kind, marks FROM learning.submission_mark_adjustment WHERE "submissionId" = $1 ORDER BY "createdAt"`, [
                submissionId,
            ])
        ).rows as { kind: string; marks: number }[];

    it("takes nothing for the first hand-in, and says what a resubmission would cost", async () => {
        const res = await submit(student, { content: "First go" });
        expect(res.status).toBe(201);
        expect(res.body.data.penalty).toBeNull();
        submissionId = res.body.data.id;

        const data = await view();
        expect(data.canSubmit).toBe(true);
        expect(data.resubmitCost).toEqual({ marks: 3, xp: 5 });
        expect(await adjustments()).toEqual([]);
    });

    it("refuses a resubmission whose cost wasn't confirmed, taking nothing", async () => {
        const before = await xpOf();
        const res = await submit(student, { content: "Second go" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/costs 3 marks and 5 XP/);
        expect(await xpOf()).toBe(before);
        expect(await adjustments()).toEqual([]);
    });

    it("charges a confirmed resubmission once: 3 marks and 5 XP", async () => {
        const before = await xpOf();
        const res = await submit(student, { content: "Second go", acceptPenalty: true });
        expect(res.status).toBe(201);
        expect(res.body.data.penalty).toEqual({ marks: 3, xp: 5 });
        expect(await xpOf()).toBe(before - 5);
        expect(await adjustments()).toEqual([{ kind: "RESUBMIT_PENALTY", marks: -3 }]);

        const ledger = await owner.query(
            `SELECT points FROM learning.xp_transaction WHERE "studentId" = $1 AND source = 'ASSIGNMENT_RESUBMIT_PENALTY'`,
            [student.id],
        );
        expect(ledger.rows).toEqual([{ points: -5 }]);
        expect((await view()).submission).toMatchObject({ attempts: 2, markAdjustment: -3, xpDeducted: 5 });
    });

    it("keeps a mark from the student until the results are published", async () => {
        expect((await review(submissionId, { status: "ACCEPTED", score: 80, feedback: "Good" })).status).toBe(200);

        const { submission } = await view();
        expect(submission).toMatchObject({ status: "SUBMITTED", score: null, finalScore: null, feedback: null, resultHidden: true });
        expect((await notificationsOf(student.id)).some((n: { title: string }) => n.title.startsWith("Assignment reviewed"))).toBe(false);
    });

    it("publishes the results once: the mark shows after penalties, and resubmitting closes", async () => {
        const publish = () => api().post(`/api/v1/assignments/manage/${assignmentId}/publish-results`).set("Cookie", mentor.cookie);
        const res = await publish();
        expect(res.status).toBe(200);
        expect(res.body.data.notified).toBe(1);
        expect((await publish()).status).toBe(409);

        const data = await view();
        expect(data.submission).toMatchObject({ status: "ACCEPTED", score: 80, finalScore: 77, resultHidden: false });
        expect(data).toMatchObject({ canSubmit: false, canRecheck: true, resultsPublished: true });
        expect((await submit(student, { content: "Third go", acceptPenalty: true })).status).toBe(409);
        expect((await notificationsOf(student.id)).some((n: { title: string }) => n.title.startsWith("Results are out"))).toBe(true);
    });

    it("takes the recheck fee at once, and allows one open recheck at a time", async () => {
        expect((await recheck("too short")).status).toBe(400);
        expect((await recheck()).status).toBe(201);
        expect((await recheck()).status).toBe(409);

        const data = await view();
        expect(data.submission.finalScore).toBe(75);
        expect(data.canRecheck).toBe(false);
        // Marking over an open recheck would leave its fee hanging.
        expect((await review(submissionId, { status: "ACCEPTED", score: 95 })).status).toBe(409);
    });

    it("an invalid recheck keeps the mark and takes 3 more — once", async () => {
        const recheckId = (await view()).submission.rechecks[0].id;
        expect((await decide(recheckId, { outcome: "INVALID" })).status).toBe(400);
        expect((await decide(recheckId, { outcome: "INVALID", note: "Checked every question again." })).status).toBe(200);
        expect((await decide(recheckId, { outcome: "INVALID", note: "Again" })).status).toBe(409);

        const { submission } = await view();
        expect(submission).toMatchObject({ score: 80, finalScore: 72, recheckOpen: false });
        expect(submission.rechecks[0]).toMatchObject({ status: "INVALID", scoreBefore: 80, scoreAfter: 80 });
    });

    it("a valid recheck raises the mark and gives the fee back", async () => {
        expect((await recheck()).status).toBe(201);
        const recheckId = (await view()).submission.rechecks[0].id;
        expect((await decide(recheckId, { outcome: "VALID", score: 80 })).status).toBe(400); // not a raise
        expect((await decide(recheckId, { outcome: "VALID", score: 90 })).status).toBe(200);

        const { submission } = await view();
        // 90, less the resubmission (3) and the first recheck (2 + 3); the second's fee came back.
        expect(submission).toMatchObject({ score: 90, finalScore: 82, markAdjustment: -8 });
        expect(await adjustments()).toEqual([
            { kind: "RESUBMIT_PENALTY", marks: -3 },
            { kind: "RECHECK_FEE", marks: -2 },
            { kind: "RECHECK_PENALTY", marks: -3 },
            { kind: "RECHECK_FEE", marks: -2 },
            { kind: "RECHECK_REFUND", marks: 2 },
        ]);
    });

    it("keeps the running total equal to the ledger", async () => {
        const res = await owner.query(
            `SELECT s."markAdjustment" AS total, COALESCE(SUM(a.marks), 0)::int AS ledger
             FROM learning.assignment_submission s LEFT JOIN learning.submission_mark_adjustment a ON a."submissionId" = s.id
             WHERE s.id = $1 GROUP BY s.id`,
            [submissionId],
        );
        expect(res.rows[0].total).toBe(res.rows[0].ledger);
    });

    it("lets a student redo work the mentor sent back, free — even after the results", async () => {
        const first = await submit(other, { content: "My answer" });
        expect(first.status).toBe(201);
        const id = first.body.data.id;
        expect((await review(id, { status: "NEEDS_REVISION", feedback: "Fix the loop." })).status).toBe(200);

        const again = await submit(other, { content: "Fixed" });
        expect(again.status).toBe(201);
        expect(again.body.data.penalty).toBeNull();
        const rows = await owner.query(`SELECT count(*)::int AS n FROM learning.submission_mark_adjustment WHERE "submissionId" = $1`, [id]);
        expect(rows.rows[0].n).toBe(0);
    });
});
