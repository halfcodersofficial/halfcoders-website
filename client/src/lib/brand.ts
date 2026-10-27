/**
 * The product's name — the logo, page titles and metadata, the footer, the
 * legal pages and running copy alike. The short name is the same two words;
 * it stays a separate constant for the places that only ever want the short
 * form (the footer's outline wordmark, the maintenance page).
 */
export const BRAND_NAME = "Half Coders";
export const BRAND_SHORT_NAME = "Half Coders";

/** The line under the logo, as the badge spells it out. */
export const BRAND_TAGLINE = "Learn. Build. Grow Together.";

/**
 * The domain printed where a picture needs one (the admission ticket's foot,
 * the sample certificate's verify page) and no request URL is at hand.
 * Placeholder until the real domain is settled.
 */
export const SITE_DOMAIN = "half-coders.tech";

/**
 * The picture a shared link shows (Facebook, LinkedIn, WhatsApp) when the page
 * has none of its own: the lockup on deep violet with a one-line Bangla tagline.
 * Relative, resolved against the root layout's `metadataBase`.
 */
export const DEFAULT_SOCIAL_IMAGE = {
    url: "/brand/social/og-default.png",
    width: 1200,
    height: 630,
    alt: BRAND_NAME,
};

/**
 * How to reach Half Coders — one inbox for everything, and the phone lines.
 * The footer, the contact page and every "write to us" link read these, so
 * change them here and nowhere else.
 *
 * Email is open every day. Calls are answered on working days only
 * (Sunday–Thursday), 10am to 7pm Bangladesh time, and not on government
 * holidays: list those dates in `GOVERNMENT_HOLIDAYS` and the contact page's
 * live "open now" line shows the line closed that day.
 */
export const SUPPORT_EMAIL = "halfcoders.official@gmail.com";
export const SUPPORT_PHONES = ["01329-453598", "01889-557133"] as const;
/** The calling hours, as the pages write them. */
export const SUPPORT_HOURS = "রবি – বৃহস্পতি, সকাল ১০টা – সন্ধ্যা ৭টা";
/** The same hours, in the form the live "open now" line reads (components/site/SupportStatus.tsx): days 0 = Sunday … 6 = Saturday, 24-hour clock. */
export const SUPPORT_SCHEDULE = { days: [0, 1, 2, 3, 4], opens: 10, closes: 19, opensLabel: "সকাল ১০টা", closesLabel: "সন্ধ্যা ৭টা" };
/** Government holidays (calls closed, email open), as "YYYY-MM-DD" in Bangladesh time. Add each year's list here. */
export const GOVERNMENT_HOLIDAYS: string[] = [];
/** Said wherever the calling hours are shown. */
export const SUPPORT_HOLIDAY_NOTE = "সরকারি ছুটির দিনে কল বন্ধ থাকে, তবে ইমেইল সবসময় খোলা।";

/** A WhatsApp chat with a support number — both are on WhatsApp: "01329-453598" → https://wa.me/8801329453598. */
export const whatsappLink = (phone: string) => `https://wa.me/88${phone.replace(/\D/g, "")}`;

/** Half Coders' social pages, and WhatsApp on each support number. */
export const SOCIAL_LINKS = [
    { network: "facebook", label: "Facebook", href: "https://www.facebook.com/share/1EFpAu3Cpv/" },
    ...SUPPORT_PHONES.map((phone) => ({ network: "whatsapp" as const, label: `WhatsApp ${phone}`, href: whatsappLink(phone) })),
    // Not set up yet. Once a page exists, uncomment its line with the real link,
    // and its icon in components/shared/Footer.tsx (SOCIAL_ICON).
    // { network: "instagram", label: "Instagram", href: "https://instagram.com/…" },
    // { network: "x", label: "X (Twitter)", href: "https://x.com/…" },
    // { network: "linkedin", label: "LinkedIn", href: "https://linkedin.com/company/…" },
] as const;

/**
 * How Half Coders takes payment: bKash, paid by the student to this merchant
 * account (scan the QR, or "Payment" to the number in the bKash app), then
 * checked by an admin against the merchant statement.
 */
export const BKASH = {
    number: "01329453598",
    display: "01329 453 598",
    qr: "/payments/bkash-qr.jpeg",
} as const;
