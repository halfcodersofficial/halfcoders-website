import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, createAccount, learningProfileOf, owner, sessionCookie } from "../helpers/fixtures";

// The mailer is outside the test: what would be sent is recorded instead.
const sent = vi.hoisted(() => [] as { to: string; subject: string; templateName: string; templateData: Record<string, unknown> }[]);
vi.mock("../../src/app/utils/email", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/app/utils/email")>();
    return {
        ...original,
        sendEmail: vi.fn(async (email: (typeof sent)[number]) => void sent.push(email)),
        sendEmailAsync: vi.fn((email: (typeof sent)[number]) => sent.push(email)),
    };
});

/**
 * Half Coders' own accounts: signing up, verifying the email with a mailed
 * code, signing in and out, and the password flows — and that a session is
 * checked again on every request.
 */

const code = (res: { body: { data?: { code?: string } } }) => res.body?.data?.code;
const lastCodeFor = (email: string) => {
    const mail = [...sent].reverse().find((entry) => entry.to === email && entry.templateName === "code");
    return mail?.templateData.code as string | undefined;
};
const sessionFrom = (res: { headers: Record<string, unknown> }) => {
    const cookies = ([] as string[]).concat((res.headers["set-cookie"] as string[] | string | undefined) ?? []);
    const cookie = cookies.find((value) => value.startsWith("halfcoders.session_token="));
    return cookie?.split(";")[0];
};
/** Lets another code be asked for straight away (they're limited to one a minute). */
const ageCodes = (email: string) =>
    owner.query(
        `UPDATE learning.auth_code SET "createdAt" = "createdAt" - interval '2 minutes'
         WHERE "userId" = (SELECT id FROM learning."user" WHERE email = $1)`,
        [email],
    );

const newEmail = () => `learner-${randomUUID().slice(0, 8)}@example.test`;
let phoneCounter = 0;
const newPhone = () => `0171${String(1_000_000 + (phoneCounter += 1) + Math.floor(Math.random() * 8_000_000)).slice(-7)}`;
const signUp = (email: string, phone = newPhone(), password = "Learner#123") =>
    api().post("/api/v1/auth/register").send({ name: "New Learner", email, phone, password });

beforeEach(() => {
    sent.length = 0;
});

describe("signing up", () => {
    it("creates a student with a learning profile, mails a code, and signs them in once verified", async () => {
        const email = newEmail();
        const phone = newPhone();
        const res = await signUp(email.toUpperCase(), phone);
        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({ email });
        expect(sessionFrom(res)).toBeUndefined();

        const { rows } = await owner.query(`SELECT id, role, "emailVerified", phone, "passwordHash" FROM learning."user" WHERE email = $1`, [email]);
        expect(rows[0]).toMatchObject({ role: "STUDENT", emailVerified: false, phone });
        expect(rows[0].passwordHash).toMatch(/^scrypt\$/);
        expect(await learningProfileOf(rows[0].id)).toMatchObject({ whatsapp: phone });

        const verified = await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) });
        expect(verified.status).toBe(200);
        expect(verified.body.data).toMatchObject({ email, role: "STUDENT", emailVerified: true });
        const cookie = sessionFrom(verified);
        expect(cookie).toBeDefined();

        const me = await api().get("/api/v1/auth/me").set("Cookie", cookie!);
        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(email);
    });

    it("refuses a disposable email, and an email or number already in use", async () => {
        expect((await signUp(`someone@mailinator.com`)).status).toBe(400);

        const existing = await createAccount("STUDENT");
        const taken = await signUp(existing.email);
        expect(taken.status).toBe(409);
        expect(code(taken)).toBe("EMAIL_TAKEN");

        const phone = newPhone();
        expect((await signUp(newEmail(), phone)).status).toBe(201);
        const samePhone = await signUp(newEmail(), phone);
        expect(samePhone.status).toBe(409);
        expect(code(samePhone)).toBe("PHONE_TAKEN");
    });

    it("refuses a weak password", async () => {
        const res = await signUp(newEmail(), newPhone(), "password");
        expect(res.status).toBe(400);
    });

    it("refuses a wrong code, and locks a code after five wrong tries", async () => {
        const email = newEmail();
        await signUp(email);
        const right = lastCodeFor(email)!;
        const wrong = right === "000000" ? "111111" : "000000";

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const res = await api().post("/api/v1/auth/verify-email").send({ email, code: wrong });
            expect(res.status).toBe(400);
        }
        const locked = await api().post("/api/v1/auth/verify-email").send({ email, code: right });
        expect(locked.status).toBe(400);
        expect(code(locked)).toBe("CODE_LOCKED");

        await ageCodes(email);
        expect((await api().post("/api/v1/auth/resend-verification").send({ email })).status).toBe(200);
        const fresh = await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) });
        expect(fresh.status).toBe(200);
    });

    it("won't sign anyone in through the verify step once the email is verified", async () => {
        const email = newEmail();
        await signUp(email);
        expect((await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) })).status).toBe(200);

        const again = await api().post("/api/v1/auth/verify-email").send({ email, code: "000000" });
        expect(again.status).toBe(400);
        expect(code(again)).toBe("INVALID_CODE");
        expect(sessionFrom(again)).toBeUndefined();
    });

    it("lets someone who never verified sign up again, with a new code", async () => {
        const email = newEmail();
        await signUp(email);
        const first = lastCodeFor(email);
        await ageCodes(email);
        expect((await signUp(email)).status).toBe(201);
        const second = lastCodeFor(email);
        expect(second).toBeDefined();
        if (first !== second) {
            expect((await api().post("/api/v1/auth/verify-email").send({ email, code: first })).status).toBe(400);
        }
        expect((await api().post("/api/v1/auth/verify-email").send({ email, code: second })).status).toBe(200);
    });
});

describe("signing in and out", () => {
    const verifiedLearner = async () => {
        const email = newEmail();
        await signUp(email);
        await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) });
        return email;
    };

    it("signs in with the right password, and refuses the wrong one the same way as an unknown email", async () => {
        const email = await verifiedLearner();
        const wrong = await api().post("/api/v1/auth/login").send({ email, password: "Wrong#123" });
        const unknown = await api().post("/api/v1/auth/login").send({ email: newEmail(), password: "Wrong#123" });
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.message).toBe(unknown.body.message);

        const ok = await api().post("/api/v1/auth/login").send({ email, password: "Learner#123" });
        expect(ok.status).toBe(200);
        expect(sessionFrom(ok)).toBeDefined();
    });

    it("sends an unverified account to verify instead", async () => {
        const email = newEmail();
        await signUp(email);
        await ageCodes(email);
        sent.length = 0;
        const res = await api().post("/api/v1/auth/login").send({ email, password: "Learner#123" });
        expect(res.status).toBe(403);
        expect(res.body.data).toMatchObject({ code: "EMAIL_NOT_VERIFIED", email });
        expect(lastCodeFor(email)).toBeDefined();
    });

    it("ends the session on sign-out, at once", async () => {
        const email = await verifiedLearner();
        const cookie = sessionFrom(await api().post("/api/v1/auth/login").send({ email, password: "Learner#123" }))!;
        expect((await api().get("/api/v1/auth/me").set("Cookie", cookie)).status).toBe(200);

        const out = await api().post("/api/v1/auth/logout").set("Cookie", cookie);
        expect(out.status).toBe(200);
        expect((await api().get("/api/v1/auth/me").set("Cookie", cookie)).status).toBe(401);
    });
});

describe("passwords", () => {
    it("resets a forgotten password with a mailed code, ending every old session", async () => {
        const account = await createAccount("STUDENT");
        const forgot = await api().post("/api/v1/auth/forgot-password").send({ email: account.email });
        expect(forgot.status).toBe(200);

        const reset = await api()
            .post("/api/v1/auth/reset-password")
            .send({ email: account.email, code: lastCodeFor(account.email), password: "Brand#New123" });
        expect(reset.status).toBe(200);
        expect(sessionFrom(reset)).toBeDefined();
        expect((await api().get("/api/v1/auth/me").set("Cookie", account.cookie)).status).toBe(401);

        const login = await api().post("/api/v1/auth/login").send({ email: account.email, password: "Brand#New123" });
        expect(login.status).toBe(200);
    });

    it("answers a reset request for an unknown email the same way, and mails nothing", async () => {
        const res = await api().post("/api/v1/auth/forgot-password").send({ email: newEmail() });
        expect(res.status).toBe(200);
        expect(sent).toHaveLength(0);
    });

    it("changes the password from inside the account, signing out other sessions only", async () => {
        const email = newEmail();
        await signUp(email);
        // Two devices: verifying signs in, and so does signing in.
        const elsewhere = sessionFrom(await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) }))!;
        const here = sessionFrom(await api().post("/api/v1/auth/login").send({ email, password: "Learner#123" }))!;

        const wrong = await api()
            .post("/api/v1/auth/change-password")
            .set("Cookie", here)
            .send({ currentPassword: "Nope#1234", newPassword: "Changed#123" });
        expect(wrong.status).toBe(400);

        const res = await api()
            .post("/api/v1/auth/change-password")
            .set("Cookie", here)
            .send({ currentPassword: "Learner#123", newPassword: "Changed#123" });
        expect(res.status).toBe(200);
        expect((await api().get("/api/v1/auth/me").set("Cookie", here)).status).toBe(200);
        expect((await api().get("/api/v1/auth/me").set("Cookie", elsewhere)).status).toBe(401);
    });
});

describe("two devices at most", () => {
    const login = (email: string, extra: Record<string, unknown> = {}, userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36") =>
        api().post("/api/v1/auth/login").set("User-Agent", userAgent).send({ email, password: "Learner#123", ...extra });
    const isSignedIn = async (cookie: string) => (await api().get("/api/v1/auth/me").set("Cookie", cookie)).status === 200;
    const onTwoDevices = async () => {
        const email = newEmail();
        await signUp(email);
        const first = sessionFrom(await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) }))!;
        const second = sessionFrom(await login(email))!;
        return { email, first, second };
    };

    it("refuses a third device, says which two it's on, and leaves both signed in", async () => {
        const { email, first, second } = await onTwoDevices();

        const third = await login(email);
        expect(third.status).toBe(409);
        expect(third.body.data).toMatchObject({ code: "DEVICE_LIMIT_EXCEEDED", maxDevices: 2 });
        expect(third.body.data.devices).toHaveLength(2);
        expect(third.body.data.devices[0]).toMatchObject({ browser: "Chrome 128", os: "Windows", deviceType: "desktop" });
        expect(sessionFrom(third)).toBeUndefined();
        expect(await isSignedIn(first)).toBe(true);
        expect(await isSignedIn(second)).toBe(true);
    });

    it("checks the password before anything else, so a wrong one signs nobody out", async () => {
        const { email, first } = await onTwoDevices();

        const wrong = await api().post("/api/v1/auth/login").send({ email, password: "Wrong#123", signOutAllDevices: true });
        expect(wrong.status).toBe(401);
        expect(await isSignedIn(first)).toBe(true);
    });

    it("signs the other devices out when the person agrees, and signs this one in", async () => {
        const { email, first, second } = await onTwoDevices();

        const third = await login(email, { signOutAllDevices: true });
        expect(third.status).toBe(200);
        expect(await isSignedIn(first)).toBe(false);
        expect(await isSignedIn(second)).toBe(false);
        expect(await isSignedIn(sessionFrom(third)!)).toBe(true);
    });

    it("lists the account's devices, marking the one asking", async () => {
        const { second } = await onTwoDevices();

        const res = await api().get("/api/v1/auth/me/devices").set("Cookie", second);
        expect(res.status).toBe(200);
        expect(res.body.data.maxDevices).toBe(2);
        const devices = res.body.data.devices as { current: boolean }[];
        expect(devices).toHaveLength(2);
        expect(devices.filter((device) => device.current)).toHaveLength(1);
        expect(devices.find((device) => device.current)).toMatchObject({ browser: "Chrome 128", os: "Windows" });
    });

    it("signs one other device out, but not the one asking, nor someone else's", async () => {
        const { first, second } = await onTwoDevices();
        const devices = (await api().get("/api/v1/auth/me/devices").set("Cookie", second)).body.data.devices as { id: string; current: boolean }[];
        const here = devices.find((device) => device.current)!;
        const other = devices.find((device) => !device.current)!;

        expect((await api().delete(`/api/v1/auth/me/devices/${here.id}`).set("Cookie", second)).status).toBe(400);
        const stranger = await createAccount("STUDENT");
        expect((await api().delete(`/api/v1/auth/me/devices/${other.id}`).set("Cookie", stranger.cookie)).status).toBe(404);
        expect(await isSignedIn(first)).toBe(true);

        expect((await api().delete(`/api/v1/auth/me/devices/${other.id}`).set("Cookie", second)).status).toBe(200);
        expect(await isSignedIn(first)).toBe(false);
        expect(await isSignedIn(second)).toBe(true);
    });

    it("signs every other device out at once, making room for a new one", async () => {
        const { email, first, second } = await onTwoDevices();

        const res = await api().post("/api/v1/auth/me/devices/sign-out-others").set("Cookie", second);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ signedOut: 1 });
        expect(await isSignedIn(first)).toBe(false);
        expect(await isSignedIn(second)).toBe(true);
        expect((await login(email)).status).toBe(200);
    });
});

describe("session and account checks", () => {
    it("refuses an unknown token", async () => {
        const res = await api().get("/api/v1/auth/me").set("Cookie", sessionCookie("not-a-real-token"));
        expect(res.status).toBe(401);
        expect(code(res)).toBe("INVALID_SESSION");
    });

    it("refuses a deleted session immediately", async () => {
        const account = await createAccount("STUDENT");
        await owner.query(`DELETE FROM learning.session WHERE "userId" = $1`, [account.id]);
        expect((await api().get("/api/v1/auth/me").set("Cookie", account.cookie)).status).toBe(401);
    });

    it("refuses a blocked account", async () => {
        const account = await createAccount("STUDENT", { status: "BLOCKED" });
        const res = await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
        expect(res.status).toBe(403);
        expect(code(res)).toBe("ACCOUNT_INACTIVE");
    });

    it("refuses a learner blocked from learning only", async () => {
        const account = await createAccount("STUDENT");
        await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
        await owner.query(`UPDATE learning.learning_profiles SET status = 'BLOCKED' WHERE "userId" = $1`, [account.id]);
        const res = await api().get("/api/v1/auth/me").set("Cookie", account.cookie);
        expect(res.status).toBe(403);
        expect(code(res)).toBe("LEARNING_BLOCKED");
    });

    it("accepts the session token as a bearer token too", async () => {
        const account = await createAccount("MENTOR");
        const res = await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${account.token}`);
        expect(res.status).toBe(200);
    });

    it.each([
        ["/api/v1/dashboard/student", "STUDENT"],
        ["/api/v1/dashboard/mentor", "MENTOR"],
        ["/api/v1/dashboard/admin", "ADMIN"],
    ] as const)("lets only the matching role reach %s", async (path, role) => {
        for (const other of ["STUDENT", "MENTOR", "ADMIN"] as const) {
            const account = await createAccount(other);
            const res = await api().get(path).set("Cookie", account.cookie);
            expect(res.status).toBe(other === role ? 200 : 403);
        }
    });
});
