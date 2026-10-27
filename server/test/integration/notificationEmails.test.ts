import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol } from "../helpers/learning";

// The mailer is outside the test: what would be sent is recorded instead.
const sent = vi.hoisted(() => [] as { to: string; subject: string; templateData: Record<string, unknown> }[]);
vi.mock("../../src/app/utils/email", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/app/utils/email")>();
    return { ...original, sendEmailsAsync: vi.fn((batch: typeof sent) => sent.push(...batch)) };
});

/**
 * What reaches a student's inbox: a mark, a new assignment — to everyone who
 * hasn't turned email off and can still use Half Coders.
 */
describe("notification emails", () => {
    let mentor: TestAccount;
    let keen: TestAccount;
    let optedOut: TestAccount;
    let blocked: TestAccount;
    let courseId: string;
    let milestoneId: string;

    beforeAll(async () => {
        mentor = await createAccount("MENTOR");
        [keen, optedOut, blocked] = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("STUDENT")]);
        const course = await createCourse();
        courseId = course.id;
        milestoneId = await createMilestone(courseId);
        await assignMentor(courseId, mentor.id);
        for (const student of [keen, optedOut, blocked]) {
            await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
            await enrol(student.id, courseId);
        }
        await api().patch("/api/v1/auth/me/preferences").set("Cookie", optedOut.cookie).send({ emailPreference: false });
        await owner.query(`UPDATE learning.learning_profiles SET status = 'BLOCKED' WHERE "userId" = $1`, [blocked.id]);
    });
    beforeEach(() => {
        sent.length = 0;
    });

    it("emails a new assignment to the students who want it — and only them", async () => {
        const res = await api()
            .post("/api/v1/assignments/manage")
            .set("Cookie", mentor.cookie)
            .send({ milestoneId, title: "Build a portfolio", description: "Make a one-page portfolio site.", isPublished: true });
        expect(res.status).toBe(201);
        // The cohort is told after the response, in the background.
        await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
        expect(sent.map((email) => email.to)).toEqual([keen.email]);
        expect(sent[0]).toMatchObject({ subject: "New assignment available" });
        expect(sent[0].templateData).toMatchObject({
            actionLabel: "Open the assignment",
            actionUrl: expect.stringContaining(`?assignment=${res.body.data.id}`),
            settingsUrl: expect.stringMatching(/\/settings$/),
        });
    });

    it("emails a student their mark", async () => {
        const assignmentId = await createAssignment(courseId, milestoneId, { title: "Marked one", order: 2 });
        const handIn = await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", keen.cookie).send({ content: "Done" });
        sent.length = 0;
        const res = await api()
            .patch(`/api/v1/assignments/submissions/${handIn.body.data.id}/review`)
            .set("Cookie", mentor.cookie)
            .send({ status: "ACCEPTED", score: 90 });
        expect(res.status).toBe(200);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ to: keen.email, subject: "Assignment reviewed: Marked one" });
        expect(sent[0].templateData.message).toMatch(/90\/100/);
    });

    it("keeps in-app-only notices out of email", async () => {
        const assignmentId = await createAssignment(courseId, milestoneId, { title: "Claimed one", order: 3 });
        const handIn = await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", keen.cookie).send({ content: "Done" });
        sent.length = 0;
        await api().post(`/api/v1/assignments/submissions/${handIn.body.data.id}/claim`).set("Cookie", mentor.cookie).send({});
        expect(sent).toHaveLength(0);
    });
});
