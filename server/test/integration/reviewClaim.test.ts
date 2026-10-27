import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol, notificationsOf } from "../helpers/learning";

/**
 * "I'm reviewing this": a waiting hand-in goes into review under one
 * reviewer's name, so a co-mentor sees it's taken, can take it over when
 * needed, and the student can't swap the work mid-review.
 */
describe("claiming a hand-in for review", () => {
    let student: TestAccount;
    let lead: TestAccount;
    let coMentor: TestAccount;
    let outsider: TestAccount;
    let assignmentId: string;
    let courseId: string;
    let submissionId: string;

    beforeAll(async () => {
        [student, lead, coMentor, outsider] = await Promise.all([
            createAccount("STUDENT"),
            createAccount("MENTOR"),
            createAccount("MENTOR"),
            createAccount("MENTOR"),
        ]);
        const course = await createCourse();
        courseId = course.id;
        assignmentId = await createAssignment(course.id, await createMilestone(course.id));
        await enrol(student.id, course.id);
        await assignMentor(course.id, lead.id);
        await assignMentor(course.id, coMentor.id, "CO_MENTOR");
        const res = await api()
            .post(`/api/v1/assignments/${assignmentId}/submit`)
            .set("Cookie", student.cookie)
            .send({ content: "My answer" });
        expect(res.status).toBe(201);
        submissionId = res.body.data.id;
    });

    const claim = (account: TestAccount, body: object = {}) =>
        api().post(`/api/v1/assignments/submissions/${submissionId}/claim`).set("Cookie", account.cookie).send(body);
    const release = (account: TestAccount) =>
        api().delete(`/api/v1/assignments/submissions/${submissionId}/claim`).set("Cookie", account.cookie);
    const inReviewNotices = async () => (await notificationsOf(student.id)).filter((n: { title: string }) => n.title.startsWith("In review:"));

    it("puts it in review under the mentor's name and tells the student once", async () => {
        const res = await claim(lead);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ status: "UNDER_REVIEW", reviewedBy: { id: lead.id } });
        expect(await claim(lead).then((again) => again.status)).toBe(200);
        expect(await inReviewNotices()).toHaveLength(1);
    });

    it("shows co-mentors who has it, in the queue", async () => {
        const res = await api()
            .get(`/api/v1/assignments/submissions/queue?courseId=${courseId}&status=UNDER_REVIEW`)
            .set("Cookie", coMentor.cookie);
        const row = res.body.data.find((item: { id: string }) => item.id === submissionId);
        expect(row.reviewedBy).toEqual({ id: lead.id, name: expect.any(String) });
        expect(Object.keys(row.student).sort()).toEqual(["id", "name"]);
    });

    it("refuses a co-mentor's claim, naming who has it — unless they take it over", async () => {
        const refused = await claim(coMentor);
        expect(refused.status).toBe(409);
        expect(refused.body.message).toMatch(/is already reviewing this/);

        const taken = await claim(coMentor, { takeOver: true });
        expect(taken.status).toBe(200);
        expect(taken.body.data.reviewedBy.id).toBe(coMentor.id);
        expect(await inReviewNotices()).toHaveLength(1); // changing hands isn't news to the student
    });

    it("stops the student resubmitting while it's in review", async () => {
        const res = await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", student.cookie).send({ content: "Swapped" });
        expect(res.status).toBe(409);
    });

    it("lets only the reviewer put it back in line", async () => {
        expect((await release(lead)).status).toBe(403);
        const res = await release(coMentor);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("SUBMITTED");
        expect((await release(coMentor)).status).toBe(409);
    });

    it("refuses a mentor who doesn't teach the course", async () => {
        expect((await claim(outsider)).status).toBe(403);
    });

    it("no longer takes 'in review' as a verdict, and won't claim marked work", async () => {
        const verdict = (body: object) =>
            api().patch(`/api/v1/assignments/submissions/${submissionId}/review`).set("Cookie", lead.cookie).send(body);
        expect((await verdict({ status: "UNDER_REVIEW" })).status).toBe(400);
        expect((await verdict({ status: "ACCEPTED", score: 80 })).status).toBe(200);

        const res = await claim(lead);
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already been marked/);
    });
});
