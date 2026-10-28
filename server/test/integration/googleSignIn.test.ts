import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, createAccount, learningProfileOf, owner } from "../helpers/fixtures";
import type { GoogleIdentity } from "../../src/app/lib/google";

// Google is outside the test: a credential — or a popup code — here names one
// of these made-up Google accounts, and anything else is refused. A code is
// traded for an ID token of the same name.
const googleAccounts = vi.hoisted(() => new Map<string, GoogleIdentity>());
vi.mock("../../src/app/lib/google", async () => {
    const { default: AppError } = await import("../../src/app/errorHelpers/AppError");
    const verifyGoogleCredential = vi.fn(async (credential: string) => {
        const account = googleAccounts.get(credential);
        if (!account) {
            throw new AppError(401, "Signing in with Google didn't go through. Please try again.").setData({ code: "GOOGLE_INVALID" });
        }
        return account;
    });
    return {
        verifyGoogleCredential,
        exchangeGoogleCode: vi.fn(async (code: string) => ({ identity: await verifyGoogleCredential(code), idToken: code })),
    };
});

// The mailer is outside the test too: what would be sent is recorded instead.
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
 * Signing in — and up — with Google: a new account from a Google one, the
 * same account every time after, linking to an account that already has the
 * email, and the same refusals and device limit as a password sign-in.
 */

const code = (res: { body: { data?: { code?: string } } }) => res.body?.data?.code;
const sessionFrom = (res: { headers: Record<string, unknown> }) => {
    const cookies = ([] as string[]).concat((res.headers["set-cookie"] as string[] | string | undefined) ?? []);
    return cookies.find((value) => value.startsWith("halfcoders.session_token="))?.split(";")[0];
};
const lastCodeFor = (email: string) =>
    [...sent].reverse().find((entry) => entry.to === email && entry.templateName === "code")?.templateData.code as string | undefined;

const newEmail = () => `google-${randomUUID().slice(0, 8)}@example.test`;
let phoneCounter = 0;
const newPhone = () => `0181${String(1_000_000 + (phoneCounter += 1) + Math.floor(Math.random() * 8_000_000)).slice(-7)}`;

/** A Google account, and a credential that signs in as it. */
const googleAccount = (email = newEmail(), sub = `google-${randomUUID()}`) => {
    const credential = `credential-${randomUUID()}`;
    const account = { sub, email, name: "Google Learner", picture: "https://lh3.googleusercontent.com/a/photo" };
    googleAccounts.set(credential, account);
    return { credential, ...account };
};

const withGoogle = (credential: string, extra: { signOutAllDevices?: boolean } = {}) =>
    api().post("/api/v1/auth/google").send({ credential, ...extra });
/** What the web app sends: the code from Google's popup. */
const withGoogleCode = (code: string) => api().post("/api/v1/auth/google").send({ code });

const accountRow = async (email: string) =>
    (await owner.query(`SELECT id, role, "emailVerified", "googleId", "passwordHash", image FROM learning."user" WHERE email = $1`, [email]))
        .rows[0];

const signUpWithPassword = (email: string) =>
    api().post("/api/v1/auth/register").send({ name: "Email Learner", email, phone: newPhone(), password: "Learner#123" });

beforeEach(() => {
    sent.length = 0;
});

describe("signing up with Google", () => {
    it("makes a verified student account with no password, and signs them in", async () => {
        const google = googleAccount();
        const res = await withGoogle(google.credential);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            email: google.email,
            name: "Google Learner",
            role: "STUDENT",
            emailVerified: true,
            hasPassword: false,
            isNewAccount: true,
            image: google.picture,
        });
        expect(res.body.data).not.toHaveProperty("passwordHash");

        const row = await accountRow(google.email);
        expect(row).toMatchObject({ role: "STUDENT", emailVerified: true, googleId: google.sub, passwordHash: null });
        expect(await learningProfileOf(row.id)).not.toBeNull();
        // No code to verify: Google already has.
        expect(sent).toHaveLength(0);

        const me = await api().get("/api/v1/auth/me").set("Cookie", sessionFrom(res)!);
        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(google.email);
    });

    it("signs the same Google account into the same account every time — even after its address changes at Google", async () => {
        const google = googleAccount();
        const first = await withGoogle(google.credential);

        const again = await withGoogle(google.credential);
        expect(again.status).toBe(200);
        expect(again.body.data).toMatchObject({ id: first.body.data.id, isNewAccount: false });

        // A third device: past the two-device limit, so the others are signed out.
        const renamed = googleAccount(newEmail(), google.sub);
        const afterRename = await withGoogle(renamed.credential, { signOutAllDevices: true });
        expect(afterRename.status).toBe(200);
        expect(afterRename.body.data).toMatchObject({ id: first.body.data.id, email: google.email, isNewAccount: false });
        expect(await accountRow(renamed.email)).toBeUndefined();
    });

    it("signs up with the code from Google's popup, and wants exactly one of a code or a token", async () => {
        const google = googleAccount();
        const res = await withGoogleCode(google.credential);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ email: google.email, isNewAccount: true });
        expect(sessionFrom(res)).toBeDefined();

        expect((await api().post("/api/v1/auth/google").send({})).status).toBe(400);
        expect((await api().post("/api/v1/auth/google").send({ code: google.credential, credential: google.credential })).status).toBe(400);
    });

    it("refuses a bad token, and a disposable email", async () => {
        const bad = await withGoogle("not-a-google-token");
        expect(bad.status).toBe(401);
        expect(code(bad)).toBe("GOOGLE_INVALID");
        expect(sessionFrom(bad)).toBeUndefined();

        const throwaway = googleAccount(`someone-${randomUUID().slice(0, 6)}@mailinator.com`);
        expect((await withGoogle(throwaway.credential)).status).toBe(400);
        expect(await accountRow(throwaway.email)).toBeUndefined();
    });
});

describe("Google and an account that already has the email", () => {
    it("links to a verified account, keeping its password", async () => {
        const email = newEmail();
        await signUpWithPassword(email);
        await api().post("/api/v1/auth/verify-email").send({ email, code: lastCodeFor(email) });
        const before = await accountRow(email);

        const google = googleAccount(email);
        const res = await withGoogle(google.credential);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: before.id, isNewAccount: false, hasPassword: true });
        expect(await accountRow(email)).toMatchObject({ googleId: google.sub, passwordHash: before.passwordHash, image: google.picture });

        // A third device (verifying and Google each signed one in).
        expect((await api().post("/api/v1/auth/login").send({ email, password: "Learner#123", signOutAllDevices: true })).status).toBe(200);
    });

    it("verifies an account nobody had verified, and drops the password whoever signed up chose", async () => {
        const email = newEmail();
        await signUpWithPassword(email);

        const res = await withGoogle(googleAccount(email).credential);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ emailVerified: true, hasPassword: false, isNewAccount: false });
        expect(await accountRow(email)).toMatchObject({ emailVerified: true, passwordHash: null });

        const withOldPassword = await api().post("/api/v1/auth/login").send({ email, password: "Learner#123" });
        expect(withOldPassword.status).toBe(401);
    });

    it("refuses an email whose account is linked to a different Google account", async () => {
        const email = newEmail();
        await withGoogle(googleAccount(email).credential);

        const other = await withGoogle(googleAccount(email).credential);
        expect(other.status).toBe(409);
        expect(code(other)).toBe("GOOGLE_ACCOUNT_MISMATCH");
        expect(sessionFrom(other)).toBeUndefined();
    });

    it("refuses a blocked account, and doesn't link it", async () => {
        const blocked = await createAccount("STUDENT", { status: "BLOCKED" });
        const res = await withGoogle(googleAccount(blocked.email).credential);
        expect(res.status).toBe(403);
        expect(code(res)).toBe("ACCOUNT_INACTIVE");
        expect(await accountRow(blocked.email)).toMatchObject({ googleId: null });
    });
});

describe("a Google account's password and devices", () => {
    it("has no password to change, and is told how to set one", async () => {
        const google = googleAccount();
        const cookie = sessionFrom(await withGoogle(google.credential))!;
        const res = await api()
            .post("/api/v1/auth/change-password")
            .set("Cookie", cookie)
            .send({ currentPassword: "anything", newPassword: "Learner#456" });
        expect(res.status).toBe(400);
        expect(code(res)).toBe("NO_PASSWORD");
    });

    it("holds Google sign-ins to two devices too, and signs the others out when the person agrees", async () => {
        const google = googleAccount();
        const first = sessionFrom(await withGoogle(google.credential))!;
        const second = sessionFrom(await withGoogle(google.credential))!;

        const third = await withGoogle(google.credential);
        expect(third.status).toBe(409);
        expect(third.body.data).toMatchObject({ code: "DEVICE_LIMIT_EXCEEDED", maxDevices: 2 });
        expect(sessionFrom(third)).toBeUndefined();

        const agreed = await withGoogle(google.credential, { signOutAllDevices: true });
        expect(agreed.status).toBe(200);
        expect((await api().get("/api/v1/auth/me").set("Cookie", first)).status).toBe(401);
        expect((await api().get("/api/v1/auth/me").set("Cookie", second)).status).toBe(401);
        expect((await api().get("/api/v1/auth/me").set("Cookie", sessionFrom(agreed)!)).status).toBe(200);
    });

    it("hands a popup code's sign-in the ID token to continue with past the device limit, as a code works once", async () => {
        const google = googleAccount();
        await withGoogleCode(google.credential);
        await withGoogleCode(google.credential);

        const third = await withGoogleCode(google.credential);
        expect(third.status).toBe(409);
        expect(third.body.data).toMatchObject({ code: "DEVICE_LIMIT_EXCEEDED", credential: google.credential });

        const agreed = await withGoogle(third.body.data.credential, { signOutAllDevices: true });
        expect(agreed.status).toBe(200);
        expect(sessionFrom(agreed)).toBeDefined();
    });
});
