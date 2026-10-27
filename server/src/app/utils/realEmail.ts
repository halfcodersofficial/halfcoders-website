import { promises as dns } from "dns";
import status from "http-status";
import AppError from "../errorHelpers/AppError";
import { logger } from "./logger";

/**
 * Half Coders reaches people by email — receipts, verifications, course news —
 * so the contact email has to be a real, lasting inbox: a personal address, a
 * university (.edu / .ac.bd) or a company one. Throwaway inboxes are refused:
 * by name for the common disposable services, and for anything else by
 * checking that the domain can receive mail at all.
 */

const DISPOSABLE_DOMAINS = new Set([
    "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com", "anonbox.net", "burnermail.io",
    "byom.de", "discard.email", "dispostable.com", "dropmail.me", "emailondeck.com", "emailfake.com",
    "emailtemporanea.com", "fakeinbox.com", "fakemail.net", "getairmail.com", "getnada.com", "guerrillamail.biz",
    "guerrillamail.com", "guerrillamail.de", "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
    "guerrillamailblock.com", "harakirimail.com", "inboxkitten.com", "incognitomail.org", "mail.tm", "mail-temp.com",
    "mailcatch.com", "maildrop.cc", "mailinator.com", "mailinator.net", "mailnesia.com", "mailpoof.com",
    "mailsac.com", "mintemail.com", "moakt.com", "mohmal.com", "mytemp.email", "nada.email", "nowmymail.com",
    "pokemail.net", "sharklasers.com", "spam4.me", "spambox.us", "spamgourmet.com", "temp-mail.io",
    "temp-mail.org", "tempail.com", "tempinbox.com", "tempmail.com", "tempmail.dev", "tempmail.net",
    "tempmailo.com", "tempmail.plus", "tempr.email", "throwawaymail.com", "trashmail.com", "trashmail.de",
    "trashmail.net", "yopmail.com", "yopmail.fr", "yopmail.net", "zetmail.com", "1secmail.com", "1secmail.net",
    "1secmail.org", "emltmp.com", "linshiyouxiang.net", "mailtemp.net", "cyclic.email", "tmail.ws", "tmpmail.net",
    "tmpmail.org", "fexpost.com", "fextemp.com", "wuuvo.com", "vomoto.com", "kzccv.com", "laafd.com",
]);

const isDisposable = (domain: string) =>
    [...DISPOSABLE_DOMAINS].some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));

const LOOKUP_TIMEOUT_MS = 4000;

const withTimeout = <T>(promise: Promise<T>) =>
    Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), LOOKUP_TIMEOUT_MS)),
    ]);

/** Whether the domain takes mail: MX records, or (by the mail RFCs' fallback) an address of its own. */
const canReceiveMail = async (domain: string): Promise<boolean> => {
    // Tests run offline, on made-up domains.
    if (process.env.NODE_ENV === "test") return true;
    try {
        const mx = await withTimeout(dns.resolveMx(domain));
        if (mx.some((record) => record.exchange && record.exchange !== ".")) return true;
    } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "ENOTFOUND") return false;
        if (code !== "ENODATA") {
            // DNS itself is having a bad moment — don't turn people away for it.
            logger.warn("Couldn't check an email domain's mail records", { domain, code });
            return true;
        }
    }
    try {
        return (await withTimeout(dns.resolve4(domain))).length > 0;
    } catch {
        return false;
    }
};

const REFUSED = "Please use a real email address you check — temporary or disposable addresses can't be used.";

/** Throws a 400 unless `email` looks like an inbox that will still be there next month. */
export const assertRealEmail = async (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || isDisposable(domain)) {
        throw new AppError(status.BAD_REQUEST, REFUSED);
    }
    if (!(await canReceiveMail(domain))) {
        throw new AppError(status.BAD_REQUEST, "This email address can't receive mail. Please check it, or use another one.");
    }
};
