import type { Metadata } from "next";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE, SOCIAL_LINKS, SUPPORT_EMAIL, SUPPORT_PHONES } from "@/lib/brand";
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

/** The organization's node in the structured data; a course's `provider` points here. */
export const ORGANIZATION_ID = `${envConfig.siteUrl}/#organization`;

/** "01329-453598" → "+880-1329-453598", the international form structured data asks for. */
const international = (phone: string) => `+880-${phone.replace(/^0/, "")}`;

/**
 * Who runs the site and what it's called, for search engines: the name and
 * logo Google shows beside a result, the social profiles tied to them, and
 * how to reach support. On every visitor page (the public layout).
 */
export const SITE_JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "EducationalOrganization",
            "@id": ORGANIZATION_ID,
            name: BRAND_NAME,
            url: envConfig.siteUrl,
            logo: `${envConfig.siteUrl}/brand/icon/icon.png`,
            image: `${envConfig.siteUrl}${DEFAULT_SOCIAL_IMAGE.url}`,
            description: "A learning community from Bangladesh: coding, engineering and career skills taught in Bangla, with live classes, mentor-reviewed assignments and verifiable certificates.",
            email: SUPPORT_EMAIL,
            address: { "@type": "PostalAddress", addressCountry: "BD" },
            // Profiles only: a WhatsApp chat link isn't a page about Half Coders.
            sameAs: SOCIAL_LINKS.filter((social) => social.network !== "whatsapp").map((social) => social.href),
            contactPoint: SUPPORT_PHONES.map((phone) => ({
                "@type": "ContactPoint",
                contactType: "customer support",
                telephone: international(phone),
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
            inLanguage: "bn-BD",
            publisher: { "@id": ORGANIZATION_ID },
        },
    ],
};
