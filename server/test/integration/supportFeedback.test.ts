import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, createSupportSession, enrol, joinLine, notificationsOf } from "../helpers/learning";

const MEET = "https://meet.google.com/abc-defg-hij";

/** A student's turns in a session, oldest first, straight from the database. */
const turnsOf = async (sessionId: string, studentId: string) =>
    (
        await owner.query(
            `SELECT * FROM learning.support_queue WHERE "sessionId" = $1 AND "studentId" = $2 ORDER BY "queueNumber"`,
            [sessionId, studentId],
        )
    ).rows;

/**
 * A support session end to end: the board and its meeting link for students
 * on the course, a finished turn rated before the next number (and another
 * number in the same session after that), and staff moving any turn by hand.
 */
describe("support: feedback, turns and the board", () => {
    let mentor: TestAccount;
    let stranger: TestAccount;
    let admin: TestAccount;
    let outsider: TestAccount;
    let courseId: string;
    let slug: string;
    let live: string;

    /** A new student on the course. */
    const newStudent = async () => {
        const student = await createAccount("STUDENT");
        await enrol(student.id, courseId);
        return student;
    };

    beforeAll(async () => {
        [mentor, stranger, admin, outsider] = await Promise.all([
            createAccount("MENTOR"),
            createAccount("MENTOR"),
            createAccount("ADMIN"),
            createAccount("STUDENT"),
        ]);
        ({ id: courseId, slug } = await createCourse({ title: "Support course" }));
        await assignMentor(courseId, mentor.id);
        // On now: started five minutes ago, an hour long, with its room.
        live = await createSupportSession(courseId, mentor.id, { startsInMinutes: -5, minutes: 60 });
        await owner.query(`UPDATE learning.support_session SET "meetingLink" = $1 WHERE id = $2`, [MEET, live]);
    });

    it("shows a student on the course the board, with the meeting link while the session is on", async () => {
        const student = await newStudent();
        const res = await api().get(`/api/v1/support/${live}/board`).set("Cookie", student.cookie);
        expect(res.status).toBe(200);
        expect(res.body.data.meetingLink).toBe(MEET);
        expect(res.body.data.isLive).toBe(true);

        // Not on the course: no board.
        expect((await api().get(`/api/v1/support/${live}/board`).set("Cookie", outsider.cookie)).status).toBeGreaterThanOrEqual(400);
    });

    it("asks for feedback on a finished turn before the next number, then lets the student join the same session again", async () => {
        const student = await newStudent();
        const join = () => api().post(`/api/v1/support/${live}/join`).set("Cookie", student.cookie).send({ topic: "My loop never stops" });

        const first = await join();
        expect(first.status).toBe(201);
        const firstNumber = first.body.data.queueNumber;

        // The mentor calls them, then finishes with them.
        expect((await api().post(`/api/v1/support/manage/${live}/serve-next`).set("Cookie", mentor.cookie).send({})).status).toBe(200);
        expect((await api().post(`/api/v1/support/manage/${live}/complete`).set("Cookie", mentor.cookie).send({})).status).toBe(200);

        const pending = await api().get("/api/v1/support/feedback/pending").set("Cookie", student.cookie);
        expect(pending.status).toBe(200);
        expect(pending.body.data.id).toBe(first.body.data.id);
        expect(pending.body.data.session.course.slug).toBe(slug);

        // No new number until it's rated.
        expect((await join()).status).toBe(409);

        // Scores are 1–5, and only the student whose turn it was can give them.
        const rate = (who: TestAccount, body: object) =>
            api().post(`/api/v1/support/feedback/${first.body.data.id}`).set("Cookie", who.cookie).send(body);
        expect((await rate(student, { rating: 6, solved: 2 })).status).toBe(400);
        expect((await rate(student, { rating: 4 })).status).toBe(400);
        expect((await rate(await newStudent(), { rating: 4, solved: 2 })).status).toBe(404);
        expect((await rate(student, { rating: 4, solved: 2 })).status).toBe(200);
        // A second submission changes nothing.
        expect((await rate(student, { rating: 1, solved: 1 })).status).toBe(200);

        const [rated] = await turnsOf(live, student.id);
        expect(rated.feedbackRating).toBe(4);
        expect(rated.feedbackSolved).toBe(2);
        expect(rated.feedbackAt).not.toBeNull();
        expect((await api().get("/api/v1/support/feedback/pending").set("Cookie", student.cookie)).body.data).toBeNull();

        // Another number in the same session, at the back of the line — and a second click keeps it.
        const again = await join();
        expect(again.status).toBe(201);
        expect(again.body.data.queueNumber).toBeGreaterThan(firstNumber);
        expect((await join()).body.data.queueNumber).toBe(again.body.data.queueNumber);
        expect(await turnsOf(live, student.id)).toHaveLength(2);

        // Their own standing is the new turn.
        const position = await api().get(`/api/v1/support/${live}/my-position`).set("Cookie", student.cookie);
        expect(position.body.data.inQueue).toBe(true);
        expect(position.body.data.myQueueNumber).toBe(again.body.data.queueNumber);

        // Staff see what they said.
        const history = await api().get(`/api/v1/support/manage/${live}/history`).set("Cookie", mentor.cookie);
        const entry = history.body.data.find((row: { id: string }) => row.id === first.body.data.id);
        expect(entry.feedbackRating).toBe(4);
        expect(entry.feedbackSolved).toBe(2);
    });

    it("asks only about the latest finished turn, and never about a skipped one", async () => {
        const student = await newStudent();
        const past = await createSupportSession(courseId, mentor.id, { startsInMinutes: -3 * 24 * 60, minutes: 60, status: "ENDED" });
        const later = await createSupportSession(courseId, mentor.id, { startsInMinutes: -2 * 24 * 60, minutes: 60, status: "ENDED" });
        await joinLine(past, student.id, 1, "COMPLETED");
        await joinLine(later, student.id, 1, "COMPLETED");
        await owner.query(`UPDATE learning.support_queue SET "completedAt" = now() - interval '3 days' WHERE "sessionId" = $1`, [past]);
        await owner.query(
            `UPDATE learning.support_queue SET "completedAt" = now() - interval '2 days', "feedbackRating" = 5, "feedbackSolved" = 5, "feedbackAt" = now()
             WHERE "sessionId" = $1`,
            [later],
        );
        const skippedIn = await createSupportSession(courseId, mentor.id, { startsInMinutes: -24 * 60, minutes: 60, status: "ENDED" });
        await joinLine(skippedIn, student.id, 1, "SKIPPED");

        expect((await api().get("/api/v1/support/feedback/pending").set("Cookie", student.cookie)).body.data).toBeNull();
        expect((await api().post(`/api/v1/support/${live}/join`).set("Cookie", student.cookie).send({})).status).toBe(201);
    });

    it("lets staff move any turn by hand — call, helped, back in line — and keeps a student in line once", async () => {
        const [first, second] = [await newStudent(), await newStudent()];
        const a = (await api().post(`/api/v1/support/${live}/join`).set("Cookie", first.cookie).send({})).body.data;
        const b = (await api().post(`/api/v1/support/${live}/join`).set("Cookie", second.cookie).send({})).body.data;
        const move = (who: TestAccount, queueId: string, status: string) =>
            api().patch(`/api/v1/support/manage/queue/${queueId}/status`).set("Cookie", who.cookie).send({ status });

        // Someone who doesn't teach the course can't.
        expect((await move(stranger, a.id, "SERVING")).status).toBe(403);
        expect((await move(admin, a.id, "BOGUS")).status).toBe(400);

        // An admin calls the first; calling the second finishes the first.
        expect((await move(admin, a.id, "SERVING")).status).toBe(200);
        expect((await turnsOf(live, first.id))[0].status).toBe("SERVING");
        const called = (await notificationsOf(first.id)).find((notice) => notice.title.startsWith("It's your turn"));
        expect(called?.link).toBe(`/learn/${slug}/support`);

        expect((await move(mentor, b.id, "SERVING")).status).toBe(200);
        const [firstTurn] = await turnsOf(live, first.id);
        expect(firstTurn.status).toBe("COMPLETED");
        expect(firstTurn.completedAt).not.toBeNull();

        // Put back in line at their own number.
        expect((await move(mentor, b.id, "WAITING")).status).toBe(200);
        const [back] = await turnsOf(live, second.id);
        expect(back.status).toBe("WAITING");
        expect(back.servedAt).toBeNull();
        expect(back.queueNumber).toBe(b.queueNumber);

        // The first student owes feedback now; rated, they take another number — and then their
        // earlier turn can't be put back in line beside it.
        expect((await api().post(`/api/v1/support/feedback/${a.id}`).set("Cookie", first.cookie).send({ rating: 3, solved: 3 })).status).toBe(200);
        expect((await api().post(`/api/v1/support/${live}/join`).set("Cookie", first.cookie).send({})).status).toBe(201);
        expect((await move(admin, a.id, "WAITING")).status).toBe(409);
    });

    it("only lets a turn be called or put back in line while the session is on", async () => {
        const student = await newStudent();
        const over = await createSupportSession(courseId, mentor.id, { startsInMinutes: -120, minutes: 60, status: "ENDED" });
        await joinLine(over, student.id, 1, "LEFT");
        const [turn] = await turnsOf(over, student.id);

        const move = (status: string) =>
            api().patch(`/api/v1/support/manage/queue/${turn.id}/status`).set("Cookie", admin.cookie).send({ status });
        expect((await move("WAITING")).status).toBe(400);
        expect((await move("SERVING")).status).toBe(400);
        // Correcting the record is fine any time.
        expect((await move("COMPLETED")).status).toBe(200);
        expect((await turnsOf(over, student.id))[0].status).toBe("COMPLETED");
    });
});
