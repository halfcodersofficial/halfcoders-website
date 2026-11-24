import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createAssignment, createCourse, createMilestone, enrol } from "../helpers/learning";

/**
 * When assignments stop taking work (utils/lateWindows.ts): late windows
 * lower the marks, and past the last one a hand-in is still taken — out of
 * that last window's marks (or the full marks, with no windows). Only the
 * batch ending — the course moved to Previous (recorded) — closes them, and
 * then nothing more goes in: no hand-ins, resubmissions or rechecks.
 */
describe("assignment windows", () => {
    let student: TestAccount;
    let courseId: string;
    let milestoneId: string;

    beforeAll(async () => {
        student = await createAccount("STUDENT");
        courseId = (await createCourse()).id;
        milestoneId = await createMilestone(courseId);
        await enrol(student.id, courseId);
    });

    const DAY = 86_400_000;
    const pastDue = async (lateTiers: { until: Date; maxMarks: number }[], order: number) => {
        const id = await createAssignment(courseId, milestoneId, { order });
        await owner.query(`UPDATE learning.assignment SET deadline = $2, "lateTiers" = $3 WHERE id = $1`, [
            id,
            new Date(Date.now() - 3 * DAY),
            JSON.stringify(lateTiers.map((tier) => ({ until: tier.until.toISOString(), maxMarks: tier.maxMarks }))),
        ]);
        return id;
    };
    const view = async (id: string) => (await api().get(`/api/v1/assignments/${id}`).set("Cookie", student.cookie)).body.data;
    const submit = (id: string) => api().post(`/api/v1/assignments/${id}/submit`).set("Cookie", student.cookie).send({ content: "My answer" });

    it("still takes a first hand-in after the last late window, out of that window's marks", async () => {
        const id = await pastDue(
            [
                { until: new Date(Date.now() - 2 * DAY), maxMarks: 90 },
                { until: new Date(Date.now() - DAY), maxMarks: 80 },
            ],
            1,
        );
        const before = await view(id);
        expect(before).toMatchObject({ canSubmit: true, batchEnded: false, window: { status: "LATE", maxScore: 80, until: null } });

        const res = await submit(id);
        expect(res.status).toBe(201);
        expect(res.body.data.maxScore).toBe(80);
    });

    it("takes a late hand-in with no windows set, out of the full marks", async () => {
        const id = await pastDue([], 2);
        expect((await view(id)).window).toMatchObject({ status: "LATE", maxScore: 100, until: null });

        const res = await submit(id);
        expect(res.status).toBe(201);
        expect(res.body.data.maxScore).toBeNull();
    });

    it("closes every assignment once the course moves to Previous (recorded)", async () => {
        const id = await pastDue([], 3);
        await owner.query(`UPDATE learning.course SET phase = 'PREVIOUS'::learning."CoursePhase" WHERE id = $1`, [courseId]);

        expect(await view(id)).toMatchObject({ batchEnded: true, canSubmit: false, canRecheck: false, window: { status: "CLOSED" } });
        const res = await submit(id);
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/batch has ended/);
    });
});
