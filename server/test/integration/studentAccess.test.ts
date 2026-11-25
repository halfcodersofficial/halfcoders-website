import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createAttempt, createCourse, createLesson, createMilestone, createModule, createQuiz, enrol } from "../helpers/learning";

// The mailer is outside the test: the verification code is read from what would be sent.
const sent = vi.hoisted(() => [] as { to: string; templateName: string; templateData: Record<string, unknown> }[]);
vi.mock("../../src/app/utils/email", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/app/utils/email")>();
    return {
        ...original,
        sendEmail: vi.fn(async (email: (typeof sent)[number]) => void sent.push(email)),
        sendEmailAsync: vi.fn((email: (typeof sent)[number]) => sent.push(email)),
    };
});

/**
 * The admin's view of where a student's account is used from — every
 * sign-in kept after its device signs out, the ones the device limit refused,
 * the devices signed in now (and signing one out) — plus the student's
 * activity feed and their quizzes course by course.
 */

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";
const PHONE = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

const sessionFrom = (res: { headers: Record<string, unknown> }) => {
    const cookies = ([] as string[]).concat((res.headers["set-cookie"] as string[] | string | undefined) ?? []);
    return cookies.find((value) => value.startsWith("halfcoders.session_token="))?.split(";")[0];
};
const lastCodeFor = (email: string) =>
    [...sent].reverse().find((entry) => entry.to === email && entry.templateName === "code")?.templateData.code as string | undefined;

let phoneCounter = 0;
/** A student who signed up and verified on Chrome: one device signed in. */
const newStudent = async () => {
    const email = `access-${randomUUID().slice(0, 8)}@example.test`;
    phoneCounter += 1;
    const phone = `0181${String(2_000_000 + phoneCounter + Math.floor(Math.random() * 7_000_000)).slice(-7)}`;
    await api().post("/api/v1/auth/register").send({ name: "Access Learner", email, phone, password: "Learner#123" });
    const verified = await api()
        .post("/api/v1/auth/verify-email")
        .set("User-Agent", CHROME)
        .send({ email, code: lastCodeFor(email) });
    const { rows } = await owner.query(`SELECT id FROM learning."user" WHERE email = $1`, [email]);
    return { id: rows[0].id as string, email, first: sessionFrom(verified)! };
};
const login = (email: string, userAgent: string, extra: Record<string, unknown> = {}) =>
    api()
        .post("/api/v1/auth/login")
        .set("User-Agent", userAgent)
        .send({ email, password: "Learner#123", ...extra });

let admin: TestAccount;
beforeAll(async () => {
    admin = await createAccount("ADMIN");
});

const asAdmin = (path: string) => api().get(path).set("Cookie", admin.cookie);

describe("sign-in history", () => {
    it("keeps every sign-in with its device and how they got in, and the ones the device limit refused", async () => {
        const student = await newStudent();
        expect((await login(student.email, PHONE)).status).toBe(200);
        expect((await login(student.email, FIREFOX)).status).toBe(409);

        const history = await asAdmin(`/api/v1/users/students/${student.id}/sign-ins`);
        expect(history.status).toBe(200);
        expect(history.body.meta.total).toBe(3);
        const [refused, phone, first] = history.body.data;
        expect(refused).toMatchObject({ outcome: "DEVICE_LIMIT_REFUSED", browser: "Firefox 131", os: "Linux", live: false });
        expect(phone).toMatchObject({ outcome: "SIGNED_IN", method: "PASSWORD", deviceType: "mobile", live: true, newDevice: true });
        expect(first).toMatchObject({ outcome: "SIGNED_IN", method: "EMAIL_CODE", browser: "Chrome 128", live: true, newDevice: false });

        const refusedOnly = await api().get(`/api/v1/users/students/${student.id}/sign-ins?outcome=DEVICE_LIMIT_REFUSED`).set("Cookie", admin.cookie);
        expect(refusedOnly.body.data).toHaveLength(1);

        const access = await asAdmin(`/api/v1/users/students/${student.id}/devices`);
        expect(access.status).toBe(200);
        expect(access.body.data.maxDevices).toBe(2);
        expect(access.body.data.live).toHaveLength(2);
        expect(access.body.data.window).toMatchObject({ signIns: 2, refused: 1, devices: 3 });
        expect(access.body.data.risk.signs.map((sign: { id: string }) => sign.id)).toContain("refused");
        expect(access.body.data.devices).toHaveLength(3);
    });

    it("stamps when a device signed out — itself, or by an admin — and counts the devices a sign-in pushed out", async () => {
        const student = await newStudent();
        const phone = sessionFrom(await login(student.email, PHONE))!;

        const access = await asAdmin(`/api/v1/users/students/${student.id}/devices`);
        const phoneSession = (access.body.data.live as { id: string; deviceType: string }[]).find((device) => device.deviceType === "mobile")!;

        const signedOut = await api().delete(`/api/v1/users/students/${student.id}/devices/${phoneSession.id}`).set("Cookie", admin.cookie);
        expect(signedOut.status).toBe(200);
        expect((await api().get("/api/v1/auth/me").set("Cookie", phone)).status).toBe(401);
        expect((await api().get("/api/v1/auth/me").set("Cookie", student.first)).status).toBe(200);
        expect((await api().delete(`/api/v1/users/students/${student.id}/devices/${phoneSession.id}`).set("Cookie", admin.cookie)).status).toBe(404);

        await api().post("/api/v1/auth/logout").set("Cookie", student.first);
        const { rows: ended } = await owner.query(`SELECT "endedAt" FROM learning.sign_in_event WHERE "userId" = $1 AND outcome = 'SIGNED_IN'`, [student.id]);
        expect(ended.every((row) => row.endedAt !== null)).toBe(true);

        // Two devices again, then a third that signs both out.
        await login(student.email, CHROME);
        await login(student.email, PHONE);
        expect((await login(student.email, FIREFOX, { signOutAllDevices: true })).status).toBe(200);
        const { rows } = await owner.query(`SELECT "signedOutOthers" FROM learning.sign_in_event WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [
            student.id,
        ]);
        expect(rows[0].signedOutOthers).toBe(2);
    });

    it("reads a refusal followed by signing the others out as a device switch, not a sign of sharing", async () => {
        const student = await newStudent();
        await login(student.email, PHONE);
        expect((await login(student.email, FIREFOX)).status).toBe(409);
        expect((await login(student.email, FIREFOX, { signOutAllDevices: true })).status).toBe(200);

        const access = await asAdmin(`/api/v1/users/students/${student.id}/devices`);
        expect(access.body.data.window).toMatchObject({ refused: 1, gaveUp: 0, kickouts: 1 });
        expect(access.body.data.risk.signs.map((sign: { id: string }) => sign.id)).not.toContain("refused");
        expect(access.body.data.risk.level).toBe("low");
    });

    it("is for admins only", async () => {
        const student = await newStudent();
        const mentor = await createAccount("MENTOR");
        expect((await api().get(`/api/v1/users/students/${student.id}/devices`).set("Cookie", mentor.cookie)).status).toBe(403);
        expect((await api().get(`/api/v1/users/students/${student.id}/devices`).set("Cookie", student.first)).status).toBe(403);
    });
});

describe("activity and quizzes", () => {
    it("pages the activity feed without skipping or repeating, filters it, and shows four on the overview", async () => {
        const student = await newStudent();
        const course = await createCourse();
        const week = await createMilestone(course.id);
        const courseModule = await createModule(course.id, week);
        const enrollmentId = await enrol(student.id, course.id);
        for (let order = 1; order <= 7; order += 1) {
            const videoId = await createLesson(course.id, courseModule, order);
            await owner.query(
                `INSERT INTO learning.video_progress (id, "enrollmentId", "studentId", "videoId", "moduleId", "isCompleted", "completedAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, true, now() - ($6 || ' minutes')::interval, now())`,
                [randomUUID(), enrollmentId, student.id, videoId, courseModule, String(order)],
            );
        }

        const seen: string[] = [];
        let before: string | null = null;
        do {
            const page = await asAdmin(`/api/v1/users/students/${student.id}/activity?limit=3${before ? `&before=${encodeURIComponent(before)}` : ""}`);
            expect(page.status).toBe(200);
            seen.push(...page.body.data.data.map((entry: { id: string }) => entry.id));
            before = page.body.data.nextCursor;
        } while (before);
        // Seven lessons, the enrolment and the sign-in.
        expect(seen).toHaveLength(9);
        expect(new Set(seen).size).toBe(9);

        const lessonsOnly = await asAdmin(`/api/v1/users/students/${student.id}/activity?kinds=lesson&limit=50`);
        expect(lessonsOnly.body.data.data).toHaveLength(7);
        expect(lessonsOnly.body.data.data[0]).toMatchObject({ kind: "lesson", title: "Lesson 1", course: { id: course.id } });

        // A course filter leaves out sign-ins, which belong to no course.
        const inCourse = await asAdmin(`/api/v1/users/students/${student.id}/activity?courseId=${course.id}&limit=50`);
        expect(inCourse.body.data.data.some((entry: { kind: string }) => entry.kind === "signin")).toBe(false);

        const overview = await asAdmin(`/api/v1/users/students/${student.id}/overview`);
        expect(overview.body.data.feed).toHaveLength(4);
        expect(overview.body.data.moreActivity).toBe(true);

        const summary = await asAdmin(`/api/v1/users/students/${student.id}/activity/summary`);
        expect(summary.status).toBe(200);
        expect(summary.body.data.counts).toMatchObject({ lesson: 7, enrolled: 1, signin: 1 });
        expect(summary.body.data.calendar).toHaveLength(182);
        expect(summary.body.data.streak.current).toBeGreaterThanOrEqual(1);
    });

    it("lists each course's quizzes, taken or not, and lets an admin read an attempt's answers", async () => {
        const student = await newStudent();
        const course = await createCourse();
        const week = await createMilestone(course.id);
        const first = await createModule(course.id, week, 1);
        const second = await createModule(course.id, week, 2);
        const enrollmentId = await enrol(student.id, course.id);
        const taken = await createQuiz(course.id, first, [
            ["2 + 2?", ["3", "4"], 1],
            ["3 + 3?", ["6", "7"], 0],
        ]);
        await createQuiz(course.id, second, [["1 + 1?", ["2", "3"], 0]]);
        const attemptId = await createAttempt(taken, student.id, enrollmentId, [1, 1], [1, 0]);

        const res = await asAdmin(`/api/v1/users/students/${student.id}/quizzes`);
        expect(res.status).toBe(200);
        const [entry] = res.body.data;
        expect(entry.course.id).toBe(course.id);
        expect(entry.stats).toMatchObject({ total: 2, taken: 1, averagePercent: 50 });
        expect(entry.quizzes.map((quiz: { module: { order: number } }) => quiz.module.order)).toEqual([1, 2]);
        expect(entry.quizzes[0]).toMatchObject({ bestPercent: 50, attempts: [{ id: attemptId }] });
        expect(entry.quizzes[1]).toMatchObject({ bestPercent: null, attempts: [] });

        const review = await asAdmin(`/api/v1/quizzes/attempts/${attemptId}`);
        expect(review.status).toBe(200);
        expect(review.body.data.questions.map((question: { isCorrect: boolean }) => question.isCorrect)).toEqual([true, false]);
    });
});
