import type { Metadata } from "next";
import { BRAND_NAME, BRAND_TAGLINE, DEFAULT_SOCIAL_IMAGE, SOCIAL_LINKS, SUPPORT_EMAIL, SUPPORT_PHONES } from "@/lib/brand";
import envConfig from "@/lib/envConfig";

type SocialImage = string | { url: string; width?: number; height?: number; alt?: string };

/**
 * A visitor page's metadata: title and description, the canonical address,
 * and the card a shared link shows (Facebook, LinkedIn, WhatsApp, X). A
 * page's own `openGraph` replaces the root layout's wholesale, so every field
 * the card needs is set here — left to the root's, a shared /about would show
 * the site's default title.
 *
 * `path` is relative ("/about"), resolved against the root layout's
 * `metadataBase`. The canonical leaves out any query string the visitor came
 * with (/courses?category=…), so every filtered view counts as the one page.
 */
export const pageMetadata = ({
    title,
    description,
    path,
    image = DEFAULT_SOCIAL_IMAGE,
}: {
    title: string | { absolute: string };
    description: string;
    path: string;
    image?: SocialImage;
}): Metadata => {
    const shareTitle = typeof title === "string" ? title : title.absolute;
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            siteName: BRAND_NAME,
            locale: "bn_BD",
            title: shareTitle,
            description,
            url: path,
            images: [image],
        },
        twitter: { card: "summary_large_image", title: shareTitle, description, images: [image] },
    };
};

/**
 * Free text cut to a search snippet's length at a word break, with an
 * ellipsis, never mid-word. For text admins write (a course's description
 * standing in for a missing subtitle), which runs long.
 */
export const snippet = (text: string, max = 160): string => {
    const flat = text.replace(/\s+/g, " ").trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    // One very long "word" (a URL) is cut where it falls.
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:।—–-]+$/, "")}…`;
};

/** A course's `language` as admins write it ("Bangla", the default) → the BCP 47 code structured data expects. */
const LANGUAGE_CODES: Record<string, string> = { bangla: "bn", bengali: "bn", "বাংলা": "bn", english: "en" };
export const languageCode = (language: string) => LANGUAGE_CODES[language.trim().toLowerCase()] ?? language;

/** Seconds as an ISO 8601 duration, the form structured data wants: 37800 → "PT10H30M". */
export const secondsToIso = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `PT${hours ? `${hours}H` : ""}${minutes || !hours ? `${minutes}M` : ""}`;
};

/** A unit as admins write it, in English or Bangla (a prefix, so "মাসের" and "months" count) → its ISO 8601 form. */
const DURATION_UNITS: [RegExp, (amount: string) => string][] = [
    [/^(?:min|মিনিট)/i, (amount) => `PT${amount}M`],
    [/^(?:h|ঘণ্টা|ঘন্টা)/i, (amount) => `PT${amount}H`],
    [/^(?:day|দিন)/i, (amount) => `P${amount}D`],
    [/^(?:week|wk|সপ্তাহ)/i, (amount) => `P${amount}W`],
    [/^(?:month|mo|মাস)/i, (amount) => `P${amount}M`],
    [/^(?:year|yr|বছর)/i, (amount) => `P${amount}Y`],
];

/**
 * A course's `duration` as an admin wrote it ("2-3 Months", "74 Minutes",
 * "৩ মাস") → an ISO 8601 duration ("P3M", "PT74M"); a range counts as its
 * longer end. Null when it doesn't read as a number and a unit.
 */
export const durationToIso = (text: string): string | null => {
    const latinDigits = text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
    const match = latinDigits.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to|থেকে)\s*(\d+(?:\.\d+)?))?\s*([^\s\d.,()]+)/i);
    if (!match) return null;
    const unit = DURATION_UNITS.find(([pattern]) => pattern.test(match[3]));
    return unit ? unit[1](match[2] ?? match[1]) : null;
};

/** The organization's node in the structured data; a course's `provider` points here. */
export const ORGANIZATION_ID = `${envConfig.siteUrl}/#organization`;

/** "01604-997837" → "+880-1604-997837", the international form structured data asks for. */
const international = (phone: string) => `+880-${phone.replace(/^0/, "")}`;

/**
 * Who runs the site and what it's called, for search engines: the name and
 * logo Google shows beside a result, the social profiles tied to them, what
 * it teaches and in which languages, and how to reach support. On every
 * visitor page (the public layout).
 */
export const SITE_JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "EducationalOrganization",
            "@id": ORGANIZATION_ID,
            name: BRAND_NAME,
            alternateName: "HalfCoders",
            url: envConfig.siteUrl,
            logo: {
                "@type": "ImageObject",
                "@id": `${envConfig.siteUrl}/#logo`,
                url: `${envConfig.siteUrl}/brand/icon/icon.png`,
                width: 512,
                height: 512,
                caption: BRAND_NAME,
            },
            image: `${envConfig.siteUrl}${DEFAULT_SOCIAL_IMAGE.url}`,
            description: "A learning community from Bangladesh: coding, engineering and career skills taught in Bangla, with live classes, mentor-reviewed assignments and verifiable certificates.",
            slogan: BRAND_TAGLINE,
            // The subjects the courses and the About page cover.
            knowsAbout: [
                "Computer programming",
                "C and C++",
                "Data structures and algorithms",
                "Mathematics for programming",
                "AI tools",
                "Career development",
                "Interview preparation",
                "Resume writing",
            ],
            knowsLanguage: ["bn", "en"],
            email: SUPPORT_EMAIL,
            address: { "@type": "PostalAddress", addressCountry: "BD" },
            // Profiles only: a WhatsApp chat link isn't a page about Half Coders.
            sameAs: SOCIAL_LINKS.filter((social) => social.network !== "whatsapp").map((social) => social.href),
            contactPoint: SUPPORT_PHONES.map((phone) => ({
                "@type": "ContactPoint",
                contactType: "customer support",
                telephone: international(phone.number),
                email: SUPPORT_EMAIL,
                areaServed: "BD",
                availableLanguage: ["Bengali", "English"],
            })),
        },
        {
            "@type": "WebSite",
            "@id": `${envConfig.siteUrl}/#website`,
            url: envConfig.siteUrl,
            name: BRAND_NAME,
            alternateName: ["HalfCoders", "half-coders.tech"],
            description: "Coding, engineering and career courses in Bangla, with mentors who review your work and certificates anyone can verify.",
            inLanguage: "bn-BD",
            publisher: { "@id": ORGANIZATION_ID },
        },
    ],
};

/**
 * A page's visible questions and answers as FAQPage structured data. Google
 * keeps FAQ results for a few kinds of site now, but Bing and AI answer
 * engines still read them. Only for questions the page shows.
 */
export const faqJsonLd = (items: { q: string; a: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
});

/**
 * A course page's title as people search for it. Students here type
 * "… bangla" after what they want to learn ("c programming bangla"), so a
 * course taught in Bangla whose title doesn't say so gets "in Bangla" added.
 * A title already in Bangla, or one that names the language, is left as is.
 */
export const courseSearchTitle = (title: string, language: string) =>
    languageCode(language) === "bn" && !/[ঀ-৿]/.test(title) && !/\b(bangla|bengali)\b/i.test(title) ? `${title} in Bangla` : title;
