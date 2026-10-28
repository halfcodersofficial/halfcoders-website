import ejs from "ejs";
import nodemailer from "nodemailer";
import path from "path";
import { envVars, frontendIsLocal } from "../config/env";
import { logger } from "./logger";

export interface ISendEmailOptions {
    to: string;
    subject: string;
    templateName: "notification" | "code";
    templateData: Record<string, unknown>;
    attachments?: { filename: string; content: Buffer }[];
}

/**
 * Mail goes one of two ways: Brevo's HTTPS API when EMAIL_SENDER_BREVO_API_KEY
 * is set — for hosts that block the SMTP ports, as Render's and Railway's free
 * plans do — and SMTP otherwise.
 */
const brevoApiKey = envVars.EMAIL_SENDER.BREVO_API_KEY;

const from = envVars.EMAIL_SENDER.SMTP_FROM || envVars.EMAIL_SENDER.SMTP_USER || "";

// Seconds, not minutes: a stuck send has to fail while the person is still on
// the page waiting for their code — two tries stay inside the 30s request limit.
const BREVO_TIMEOUT_MS = 12_000;

/** Failures before the request went out: safe to try once more, no risk of a mail sent twice. */
const CONNECT_FAILURES = new Set(["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"]);

/** Calls Brevo's API; a refusal throws with Brevo's own message and the HTTP status. */
const callBrevo = async (endpoint: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<unknown> => {
    let response: Response;
    try {
        response = await fetch(`https://api.brevo.com/v3${endpoint}`, {
            method: init.method ?? "GET",
            headers: { "api-key": brevoApiKey as string, accept: "application/json", "content-type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
        });
    } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause?.code;
        if (retry && cause && CONNECT_FAILURES.has(cause)) return callBrevo(endpoint, init, false);
        throw error;
    }
    if (!response.ok) {
        const reply = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
        throw Object.assign(new Error(`Brevo ${response.status}: ${reply.message ?? response.statusText}`), {
            status: response.status,
            code: reply.code,
        });
    }
    return response.json();
};

/** `Half Coders <no-reply@half-coders.tech>` → Brevo's `{ name, email }`; a bare address works too. */
const parseAddress = (value: string) => {
    const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
    return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: value.trim() };
};

const smtpConfigured = Boolean(
    envVars.EMAIL_SENDER.SMTP_HOST &&
    envVars.EMAIL_SENDER.SMTP_USER &&
    envVars.EMAIL_SENDER.SMTP_PASS,
);

const transporter = !brevoApiKey && smtpConfigured
    ? nodemailer.createTransport({
        host: envVars.EMAIL_SENDER.SMTP_HOST,
        port: Number(envVars.EMAIL_SENDER.SMTP_PORT || 587),
        secure: Number(envVars.EMAIL_SENDER.SMTP_PORT) === 465,
        auth: {
            user: envVars.EMAIL_SENDER.SMTP_USER,
            pass: envVars.EMAIL_SENDER.SMTP_PASS,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    })
    : null;

/**
 * Real mail with localhost links: whoever gets it can't open them. Only
 * reachable in development — production refuses to boot that way (config/env).
 */
const warnIfLinksAreLocal = () => {
    if (frontendIsLocal) {
        logger.warn(
            `Emails will link to ${envVars.FRONTEND_URL}, which opens only on this computer. ` +
            "When real people get this mail, set FRONTEND_URL to the live site (https://half-coders.tech) — the local site keeps working.",
        );
    }
};

/**
 * Checks the mail setup once, at boot — Brevo's API key, or the SMTP login —
 * so a setup that can't send shows in the logs straight away instead of as
 * codes that never arrive.
 */
export const checkEmailTransport = async () => {
    if (brevoApiKey) {
        try {
            await callBrevo("/account");
            logger.info("Email ready", { via: "brevo", from });
            warnIfLinksAreLocal();
        } catch (error) {
            const hint =
                (error as { status?: number }).status === 401
                    ? "Brevo refused the API key — check EMAIL_SENDER_BREVO_API_KEY, and that Brevo's Security → Authorised IPs isn't blocking this server"
                    : "Brevo's API can't be reached";
            logger.error(`Email not working, none will be sent: ${hint}`, error);
        }
        return;
    }
    if (!transporter) return;
    try {
        await transporter.verify();
        logger.info("Email ready", { via: "smtp", host: envVars.EMAIL_SENDER.SMTP_HOST, port: envVars.EMAIL_SENDER.SMTP_PORT });
        warnIfLinksAreLocal();
    } catch (error) {
        const hint =
            (error as { code?: string }).code === "EAUTH"
                ? "the SMTP server refused the login — check EMAIL_SENDER_SMTP_USER and EMAIL_SENDER_SMTP_PASS (Gmail needs an App Password)"
                : "the SMTP server can't be reached — check the host and port, and that the host allows outbound SMTP (Render's and Railway's free plans block it; set EMAIL_SENDER_BREVO_API_KEY instead)";
        logger.error(`Email not working, none will be sent: ${hint}`, error);
    }
};

const templateDir = path.resolve(process.cwd(), "src/app/templates");

export const sendEmail = async ({ to, subject, templateName, templateData, attachments }: ISendEmailOptions) => {
    // Mail is optional in local development — log the payload instead of
    // failing so the signup/OTP flows stay testable without a mail account.
    if (!brevoApiKey && !transporter) {
        logger.warn(`Email not configured — email not sent`, { to, subject, templateName, templateData });
        return;
    }

    const html = (await ejs.renderFile(path.join(templateDir, `${templateName}.ejs`), templateData)) as string;

    if (brevoApiKey) {
        await callBrevo("/smtp/email", {
            method: "POST",
            body: {
                sender: parseAddress(from),
                to: [{ email: to }],
                subject,
                htmlContent: html,
                attachment: attachments?.length
                    ? attachments.map((file) => ({ name: file.filename, content: file.content.toString("base64") }))
                    : undefined,
            },
        });
    } else {
        await transporter!.sendMail({ from, to, subject, html, attachments });
    }

    logger.info("Email sent", { to, subject });
};

/** At most this many emails in flight from one batch — a cohort's worth mustn't flood the mail server. */
const BATCH_CONCURRENCY = 4;

/**
 * Fire-and-forget for many emails — a whole course's students — sent a few at
 * a time in the background. A failure is logged and the rest carry on.
 */
export const sendEmailsAsync = (batch: ISendEmailOptions[], context?: string) => {
    if (batch.length === 0) return;
    const queue = [...batch];
    const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
            await sendEmail(next).catch((err) => logger.error(`Email send failed${context ? ` (${context})` : ""}`, err));
        }
    };
    void Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, worker));
};

/**
 * Fire-and-forget variant. Used wherever a failed email must not fail the
 * request that triggered it (welcome mail after verification, notifications).
 */
export const sendEmailAsync = (options: ISendEmailOptions, context?: string) => {
    void sendEmail(options).catch((err) => {
        logger.error(`Email send failed${context ? ` (${context})` : ""}`, err);
    });
};
