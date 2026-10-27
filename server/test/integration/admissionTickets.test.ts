import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { createCourse, enrol } from "../helpers/learning";

const TICKET = {
    headline: "CONGRATULATIONS",
    subheadline: "YOUR SEAT IS CONFIRMED",
    ticketTitle: "YOUR NEXT JOURNEY",
    badge: "ACCESS CONFIRMED",
    learnerLabel: "LEARNER",
    courseLabel: "COURSE",
    courseName: "",
    fields: [
        { label: "START HERE", value: "Fundamentals" },
        { label: "DESTINATION", value: "Job ready" },
    ],
    stubLabel: "BATCH",
    stubValue: "03",
    taglineLead: "You earned your place.",
    taglineAccent: "Now build what's next.",
    footerText: "BEGIN YOUR NEXT CHAPTER",
};

/**
 * Each course's admission ticket: written by an admin, course by course, and
 * handed to that course's own students — with their name and photo — only
 * while it's switched on.
 */
describe("admission tickets", () => {
    let admin: TestAccount;
    let mentor: TestAccount;
    let student: TestAccount;
    let outsider: TestAccount;
    let dropped: TestAccount;
    let courseId: string;

    beforeAll(async () => {
        [admin, mentor, student, outsider, dropped] = await Promise.all([
            createAccount("ADMIN"),
            createAccount("MENTOR"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        courseId = (await createCourse({ title: "Ticket Test Bootcamp" })).id;
        await enrol(student.id, courseId);
        await enrol(dropped.id, courseId, "CANCELLED");
    });

    const manage = (path = "") => `/api/v1/admission-tickets/manage/courses${path}`;
    const mine = (account: TestAccount) => api().get(`/api/v1/admission-tickets/mine/${courseId}`).set("Cookie", account.cookie);
    const save = (body: object) => api().put(manage(`/${courseId}`)).set("Cookie", admin.cookie).send(body);

    it("lists every course without a ticket until one is written, counting who would get it", async () => {
        const res = await api().get(manage()).set("Cookie", admin.cookie);
        expect(res.status).toBe(200);
        const row = res.body.data.find((entry: { course: { id: string } }) => entry.course.id === courseId);
        expect(row).toMatchObject({ ticket: null, students: 1 });
    });

    it("is for admins only", async () => {
        expect((await api().get(manage()).set("Cookie", mentor.cookie)).status).toBe(403);
        expect((await api().put(manage(`/${courseId}`)).set("Cookie", student.cookie).send(TICKET)).status).toBe(403);
    });

    it("gives a student nothing before the course has a ticket", async () => {
        expect((await mine(student)).status).toBe(404);
    });

    it("saves a ticket, blank lines as not set", async () => {
        const res = await save(TICKET);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ headline: "CONGRATULATIONS", courseName: null, stubValue: "03", isActive: true });
        expect(res.body.data.fields).toHaveLength(2);

        const one = await api().get(manage(`/${courseId}`)).set("Cookie", admin.cookie);
        expect(one.body.data.ticket).toMatchObject({ badge: "ACCESS CONFIRMED", showPhoto: true });
    });

    it("refuses what the picture has no room for", async () => {
        expect((await save({ ...TICKET, headline: "" })).status).toBe(400);
        expect((await save({ ...TICKET, stubValue: "TOO-LONG-VALUE" })).status).toBe(400);
        const four = Array.from({ length: 4 }, (_, index) => ({ label: `L${index}`, value: "v" }));
        expect((await save({ ...TICKET, fields: four })).status).toBe(400);
    });

    it("hands the course's own student their ticket, with their name", async () => {
        const res = await mine(student);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            ticket: { headline: "CONGRATULATIONS", stubLabel: "BATCH" },
            course: { id: courseId, title: "Ticket Test Bootcamp" },
        });
        expect(res.body.data.learner.name).toBeTruthy();
        expect(res.body.data.enrolledAt).toBeTruthy();
    });

    it("gives none to a student who isn't on the course, or whose enrolment was cancelled", async () => {
        expect((await mine(outsider)).status).toBe(404);
        expect((await mine(dropped)).status).toBe(404);
    });

    it("stops handing it out while switched off, and once removed", async () => {
        await save({ ...TICKET, isActive: false });
        expect((await mine(student)).status).toBe(404);

        await save(TICKET);
        expect((await mine(student)).status).toBe(200);

        expect((await api().delete(manage(`/${courseId}`)).set("Cookie", admin.cookie)).status).toBe(200);
        expect((await mine(student)).status).toBe(404);
    });
});
