import ejs from "ejs";
import nodemailer from "nodemailer";
import path from "path";
import { envVars } from "../config/env";
import { logger } from "./logger";

export interface ISendEmailOptions {
    to: string;
    subject: string;
    templateName: "notification" | "code";
    templateData: Record<string, unknown>;
    attachments?: { filename: string; content: Buffer }[];
}

const smtpConfigured = Boolean(
    envVars.EMAIL_SENDER.SMTP_HOST &&
    envVars.EMAIL_SENDER.SMTP_USER &&
    envVars.EMAIL_SENDER.SMTP_PASS,
);

const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: envVars.EMAIL_SENDER.SMTP_HOST,
        port: Number(envVars.EMAIL_SENDER.SMTP_PORT || 587),
        secure: Number(envVars.EMAIL_SENDER.SMTP_PORT) === 465,
        auth: {
            user: envVars.EMAIL_SENDER.SMTP_USER,
            pass: envVars.EMAIL_SENDER.SMTP_PASS,
        },
    })
    : null;

const templateDir = path.resolve(process.cwd(), "src/app/templates");

export const sendEmail = async ({ to, subject, templateName, templateData, attachments }: ISendEmailOptions) => {
    // SMTP is optional in local development — log the payload instead of
    // failing so the signup/OTP flows stay testable without a mail account.
    if (!transporter) {
        logger.warn(`SMTP not configured — email not sent`, { to, subject, templateName, templateData });
        return;
    }

    const html = await ejs.renderFile(path.join(templateDir, `${templateName}.ejs`), templateData);

    await transporter.sendMail({
        from: envVars.EMAIL_SENDER.SMTP_FROM || envVars.EMAIL_SENDER.SMTP_USER,
        to,
        subject,
        html: html as string,
        attachments,
    });

    logger.info("Email sent", { to, subject });
};

/** At most this many emails in flight from one batch — a cohort's worth mustn't flood the SMTP server. */
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
