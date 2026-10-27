import { emailField } from "@/lib/validation";

/**
 * The common throwaway-inbox services, refused at sign-up before the round
 * trip. The API checks again — this list and more, plus whether the domain can
 * receive mail at all (server utils/realEmail.ts).
 */
const DISPOSABLE_DOMAINS = [
    "10minutemail.com", "20minutemail.com", "33mail.com", "burnermail.io", "discard.email", "dispostable.com",
    "dropmail.me", "emailondeck.com", "fakeinbox.com", "getnada.com", "guerrillamail.com", "guerrillamail.net",
    "guerrillamail.org", "mail.tm", "maildrop.cc", "mailinator.com", "mailnesia.com", "mailsac.com", "moakt.com",
    "mohmal.com", "sharklasers.com", "temp-mail.io", "temp-mail.org", "tempail.com", "tempmail.com", "tempmail.dev",
    "tempmail.net", "tempmailo.com", "throwawaymail.com", "trashmail.com", "yopmail.com", "1secmail.com",
];

export const isDisposableEmail = (email: string) => {
    const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
    return DISPOSABLE_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
};

/** `emailField`, refusing throwaway inboxes. */
export const realEmailField = emailField.refine((email) => !isDisposableEmail(email), {
    message: "Please use a real email you check — temporary or disposable emails can't be used",
});
