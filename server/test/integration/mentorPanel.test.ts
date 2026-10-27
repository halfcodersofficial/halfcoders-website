import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import {
    assignMentor,
    createAssignment,
    createCourse,
    createMilestone,
    createSupportSession,
    enrol,
    joinLine,
    notificationsOf,
} from "../helpers/learning";

/**
 * The mentor panel's API: students by name only, a course's results and the
 * review queue's counts, co-mentors' sessions, past sessions with how their
 * line went, and the notices that go out on a hand-in or a session change.
 */
describe("mentor panel", () => {
    let lead: TestAccount;
    let coMentor: TestAccount;
    let stranger: TestAccount;
    let admin: TestAccount;
    let students: TestAccount[];
    let courseId: string;
    let otherCourseId: string;
    let assignmentId: string;

    beforeAll(async () => {
        [lead, coMentor, stranger, admin] = await Promise.all([
            createAccount("MENTOR"),
            createAccount("MENTOR"),
            createAccount("MENTOR"),
            createAccount("ADMIN"),
        ]);
        students = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("STUDENT")]);
        const course = await createCourse({ title: "Shared course" });
        courseId = course.id;
        otherCourseId = (await createCourse({ title: "Stranger's course" })).id;
        assignmentId = await createAssignment(courseId, await createMilestone(courseId));
        await assignMentor(courseId, lead.id);
        await assignMentor(courseId, coMentor.id, "CO_MENTOR");
        await assignMentor(otherCourseId, stranger.id);
        for (const student of students) await enrol(student.id, courseId);
        for (const student of students.slice(0, 2)) {
            const res = await api().post(`/api/v1/assignments/${assignmentId}/submit`).set("Cookie", student.cookie).send({ content: "Done" });
            expect(res.status).toBe(201);
        }
    });

    describe("student privacy", () => {
        it("keeps the course's student list from mentors", async () => {
            expect((await api().get(`/api/v1/enrollments/course/${courseId}`).set("Cookie", lead.cookie)).status).toBe(403);
            expect((await api().get(`/api/v1/enrollments/course/${courseId}`).set("Cookie", admin.cookie)).status).toBe(200);
        });

        it("names students on their work, and nothing more, for mentors only", async () => {
            const queue = (account: TestAccount) =>
                api().get(`/api/v1/assignments/submissions/queue?courseId=${courseId}`).set("Cookie", account.cookie);
            const forMentor = await queue(lead);
            expect(forMentor.body.data).toHaveLength(2);
            for (const row of forMentor.body.data) expect(Object.keys(row.student).sort()).toEqual(["id", "name"]);
            const forAdmin = await queue(admin);
            expect(forAdmin.body.data[0].student.email).toMatch(/@example\.test$/);
        });

        it("won't search the queue by email for a mentor", async () => {
            const res = await api()
                .get(`/api/v1/assignments/submissions/queue?courseId=${courseId}&searchTerm=${encodeURIComponent(students[0].email)}`)
                .set("Cookie", lead.cookie);
            expect(res.body.data).toHaveLength(0);
        });

        it("sends results with names only, and enrolment as a count", async () => {
            const res = await api().get(`/api/v1/courses/staff/${courseId}/results`).set("Cookie", lead.cookie);
            expect(res.status).toBe(200);
            expect(res.body.data.learners).toBe(3);
            const [assignment] = res.body.data.assignments;
            expect(assignment.handedIn).toBe(2);
            for (const row of assignment.submissions) expect(Object.keys(row.student).sort()).toEqual(["id", "name"]);
            expect(JSON.stringify(res.body)).not.toMatch(/@example\.test/);
            expect((await api().get(`/api/v1/courses/staff/${courseId}/results`).set("Cookie", stranger.cookie)).status).toBe(403);
        });
    });

    it("counts the queue by status within the mentor's courses", async () => {
        const res = await api().get(`/api/v1/assignments/submissions/queue/counts?courseId=${courseId}`).set("Cookie", lead.cookie);
        expect(res.body.data).toMatchObject({ SUBMITTED: 2, UNDER_REVIEW: 0, ACCEPTED: 0 });
        const elsewhere = await api().get(`/api/v1/assignments/submissions/queue/counts?courseId=${courseId}`).set("Cookie", stranger.cookie);
        expect(elsewhere.body.data.SUBMITTED).toBe(0);
    });

    it("tells the course's mentors about a hand-in", async () => {
        for (const mentor of [lead, coMentor]) {
            const notices = await notificationsOf(mentor.id);
            expect(notices.some((n: { link: string | null }) => n.link?.includes(assignmentId))).toBe(true);
        }
        expect((await notificationsOf(stranger.id)).length).toBe(0);
    });

    describe("support sessions", () => {
        let colleagueSession: string;
        let strangerSession: string;

        beforeAll(async () => {
            colleagueSession = await createSupportSession(courseId, coMentor.id, { startsInMinutes: 90, title: "Co-mentor hours" });
            strangerSession = await createSupportSession(otherCourseId, stranger.id, { startsInMinutes: 90 });
            await createSupportSession(courseId, lead.id, { startsInMinutes: 30, title: "Lead hours" });
            const held = await createSupportSession(courseId, lead.id, { startsInMinutes: -180, minutes: 60, status: "ENDED", title: "Held" });
            await joinLine(held, students[0].id, 1, "COMPLETED");
            await joinLine(held, students[1].id, 2, "SKIPPED");
        });

        it("shows a mentor their co-mentors' sessions on shared courses — and no one else's", async () => {
            const res = await api().get("/api/v1/dashboard/mentor").set("Cookie", lead.cookie);
            expect(res.status).toBe(200);
            const ids = res.body.data.colleagueSessions.map((session: { id: string }) => session.id);
            expect(ids).toContain(colleagueSession);
            expect(ids).not.toContain(strangerSession);
            const colleague = res.body.data.colleagueSessions.find((session: { id: string }) => session.id === colleagueSession);
            expect(colleague.mentor).toEqual({ id: coMentor.id, name: expect.any(String) });
            expect(res.body.data.upcomingSupport.every((session: { mentorId: string }) => session.mentorId === lead.id)).toBe(true);
        });

        it("marks a co-mentor's session on the week by whose it is", async () => {
            const res = await api().get("/api/v1/dashboard/mentor").set("Cookie", lead.cookie);
            const sessions = res.body.data.agenda.items.filter((item: { kind: string }) => item.kind === "session");
            const theirs = sessions.find((item: { id: string }) => item.id === colleagueSession);
            const mine = sessions.find((item: { title: string }) => item.title === "Lead hours");
            // The week runs from today's Dhaka midnight for seven days, so both are always on it.
            expect(theirs.host).toEqual({ id: coMentor.id, name: expect.any(String) });
            expect(mine.host).toBeNull();
            expect(sessions.some((item: { id: string }) => item.id === strangerSession)).toBe(false);
        });

        it("lets a co-mentor open a colleague's board", async () => {
            expect((await api().get(`/api/v1/support/manage/${colleagueSession}/queue`).set("Cookie", lead.cookie)).status).toBe(200);
            expect((await api().get(`/api/v1/support/manage/${colleagueSession}/queue`).set("Cookie", stranger.cookie)).status).toBe(403);
        });

        it("lists a mentor's past sessions with how the line went, as counts", async () => {
            const res = await api().get("/api/v1/support/manage/mine/past").set("Cookie", lead.cookie);
            expect(res.status).toBe(200);
            const [held] = res.body.data;
            expect(held.title).toBe("Held");
            expect(held.attendance).toEqual({ joined: 2, helped: 1, skipped: 1, left: 0 });
        });

        it("tells the course's students when a session moves or is called off", async () => {
            const id = await createSupportSession(courseId, lead.id, { startsInMinutes: 300, title: "Movable" });
            const start = new Date(Date.now() + 360 * 60_000);
            const moved = await api()
                .patch(`/api/v1/support/manage/${id}`)
                .set("Cookie", lead.cookie)
                .send({ startTime: start.toISOString(), endTime: new Date(start.getTime() + 3_600_000).toISOString() });
            expect(moved.status).toBe(200);
            const cancelled = await api().patch(`/api/v1/support/manage/${id}/status`).set("Cookie", lead.cookie).send({ status: "CANCELLED" });
            expect(cancelled.status).toBe(200);

            for (const student of students) {
                const titles = (await notificationsOf(student.id)).map((n: { title: string }) => n.title);
                expect(titles).toContain("Support session moved");
                expect(titles).toContain("Support session cancelled");
            }
        });
    });
});
