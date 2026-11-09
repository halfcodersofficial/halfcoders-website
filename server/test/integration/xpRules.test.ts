import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createAssignment, createCourse, createLesson, createMilestone, createModule, enrol } from "../helpers/learning";

/**
 * XP comes from two things only: finishing a module (2 within 24 hours of its
 * clock starting, 1 after) and handing an assignment in by its deadline (3).
 * A module's clock starts at its release on a bootcamp, and at the student's
 * first lesson in it on a self-paced course.
 */
describe("XP rules", () => {
    let student: TestAccount;

    const complete = (lessonId: string) =>
        api().post(`/api/v1/progress/videos/${lessonId}/complete`).set("Cookie", student.cookie);
    const xpOn = async (courseId: string) =>
        (await owner.query(`SELECT "totalXp" FROM learning.course_xp WHERE "studentId" = $1 AND "courseId" = $2`, [student.id, courseId]))
            .rows[0]?.totalXp ?? 0;
    const awards = async (courseId: string) =>
        (
            await owner.query(
                `SELECT source, points FROM learning.xp_transaction WHERE "studentId" = $1 AND "courseId" = $2 ORDER BY "createdAt"`,
                [student.id, courseId],
            )
        ).rows;

    beforeAll(async () => {
        student = await createAccount("STUDENT");
        await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    describe("on a self-paced course", () => {
        let courseId: string;
        let quick: string[];
        let slow: string;

        beforeAll(async () => {
            courseId = (await createCourse({ courseType: "TRADITIONAL" })).id;
            const milestoneId = await createMilestone(courseId);
            const quickModule = await createModule(courseId, milestoneId, 1);
            const slowModule = await createModule(courseId, milestoneId, 2);
            quick = [await createLesson(courseId, quickModule, 1), await createLesson(courseId, quickModule, 2)];
            slow = await createLesson(courseId, slowModule, 1);
            const enrollmentId = await enrol(student.id, courseId);

            // Started the second module 30 hours ago and left it.
            await owner.query(
                `INSERT INTO learning.video_progress (id, "enrollmentId", "studentId", "videoId", "moduleId", "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, now() - interval '30 hours', now())`,
                [randomUUID(), enrollmentId, student.id, slow, slowModule],
            );
        });

        it("gives nothing for a lesson on its own", async () => {
            expect((await complete(quick[0])).status).toBe(200);
            expect(await xpOn(courseId)).toBe(0);
        });

        it("gives 2 for a module finished within 24 hours of starting it", async () => {
            expect((await complete(quick[1])).status).toBe(200);
            expect(await xpOn(courseId)).toBe(2);
        });

        it("gives 1 for a module finished later, and nothing else for finishing the course", async () => {
            expect((await complete(slow)).status).toBe(200);
            expect(await awards(courseId)).toEqual([
                { source: "MODULE_COMPLETE", points: 2 },
                { source: "MODULE_COMPLETE", points: 1 },
            ]);
            expect(await xpOn(courseId)).toBe(3);
        });
    });

    describe("on a bootcamp", () => {
        it("counts a module's 24 hours from its release", async () => {
            const courseId = (await createCourse({ courseType: "BOOTCAMP" })).id;
            const milestoneId = await createMilestone(courseId);
            const fresh = await createModule(courseId, milestoneId, 1);
            const old = await createModule(courseId, milestoneId, 2);
            await owner.query(`UPDATE learning.course_module SET "publishedAt" = now() - interval '1 hour' WHERE id = $1`, [fresh]);
            await owner.query(`UPDATE learning.course_module SET "publishedAt" = now() - interval '30 hours' WHERE id = $1`, [old]);
            const freshLesson = await createLesson(courseId, fresh, 1);
            const oldLesson = await createLesson(courseId, old, 1);
            await enrol(student.id, courseId);

            expect((await complete(freshLesson)).status).toBe(200);
            // Started just now, but released 30 hours ago: late.
            expect((await complete(oldLesson)).status).toBe(200);
            expect((await awards(courseId)).map((row: { points: number }) => row.points)).toEqual([2, 1]);
        });
    });

    describe("assignments", () => {
        let courseId: string;
        let milestoneId: string;

        beforeAll(async () => {
            courseId = (await createCourse({ courseType: "BOOTCAMP" })).id;
            milestoneId = await createMilestone(courseId);
            await enrol(student.id, courseId);
        });

        const handIn = (assignmentId: string) =>
            api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", student.cookie).send({ content: "Done" });

        it("gives 3 for a hand-in by the deadline, once", async () => {
            const assignmentId = await createAssignment(courseId, milestoneId, { order: 1 });
            await owner.query(`UPDATE learning.assignment SET deadline = now() + interval '1 day' WHERE id = $1`, [assignmentId]);

            expect((await handIn(assignmentId)).status).toBe(201);
            expect(await xpOn(courseId)).toBe(3);
            expect((await handIn(assignmentId)).status).toBe(201);
            expect(await xpOn(courseId)).toBe(3);
        });

        it("gives nothing for a late hand-in", async () => {
            const assignmentId = await createAssignment(courseId, milestoneId, { order: 2 });
            await owner.query(
                `UPDATE learning.assignment SET deadline = now() - interval '1 day', "lateTiers" = $2 WHERE id = $1`,
                [assignmentId, JSON.stringify([{ until: new Date(Date.now() + 86_400_000).toISOString(), maxMarks: 50 }])],
            );

            expect((await handIn(assignmentId)).status).toBe(201);
            expect(await xpOn(courseId)).toBe(3);
        });
    });
});
