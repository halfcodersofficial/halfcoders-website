import { POSTS } from "@/content/blog";
import type { BlogPost } from "@/content/blog/types";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { ORGANIZATION_ID } from "@/lib/seo";

/**
 * A draft is for the team: it shows while developing and nowhere in
 * production — no page, no listing, no sitemap entry (content/blog/types.ts
 * says how a post goes live).
 */
export const isVisible = (post: BlogPost) => post.status === "approved" || !envConfig.isProduction;

/** The posts this build shows, newest first (a draft, having no date yet, by its last update). */
export const visiblePosts = (): BlogPost[] => POSTS.filter(isVisible).sort((a, b) => (b.published ?? b.updated).localeCompare(a.published ?? a.updated));

/** Approved posts only: what search engines and AI crawlers are told about, whatever the build. */
export const publishedPosts = (): BlogPost[] => visiblePosts().filter((post) => post.status === "approved");

export const postBySlug = (slug: string): BlogPost | undefined => visiblePosts().find((post) => post.slug === slug);

/** Inline marks (`**bold**`, `` `code` ``, `[text](href)`) taken out, for search snippets and structured data. */
export const plainText = (text: string) =>
    text
        .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");

/** Every word the reader reads, for the reading time. */
const allText = (post: BlogPost) =>
    [
        post.lead,
        ...post.sections.flatMap((section) => [
            section.heading,
            ...section.blocks.flatMap((block) => {
                switch (block.type) {
                    case "p":
                    case "note":
                        return [block.text];
                    case "list":
                        return block.items;
                    case "code":
                        return [block.code];
                    case "table":
                        return [...block.head, ...block.rows.flat()];
                }
            }),
        ]),
        ...(post.faqs ?? []).flatMap((faq) => [faq.q, faq.a]),
    ].join(" ");

/** Minutes to read, at a gentle 180 words a minute (Bangla reads slower than English), never under one. */
export const readingMinutes = (post: BlogPost) => Math.max(1, Math.round(allText(post).split(/\s+/).filter(Boolean).length / 180));

/** "2026-11-17" → "১৭ নভেম্বর ২০২৬". */
export const banglaDate = (iso: string) =>
    new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(`${iso}T00:00:00+06:00`));

export const postPath = (post: BlogPost) => `/blog/${post.slug}`;

/**
 * The post for search engines: an Article by Half Coders (or the mentor who
 * reviewed it), about the course it leads to. Every field is on the page.
 */
export const articleJsonLd = (post: BlogPost) => {
    const url = `${envConfig.siteUrl}${postPath(post)}`;
    return {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        inLanguage: "bn-BD",
        ...(post.published && { datePublished: post.published }),
        dateModified: post.updated,
        image: `${envConfig.siteUrl}${DEFAULT_SOCIAL_IMAGE.url}`,
        author: post.reviewedBy ? { "@type": "Person", name: post.reviewedBy, worksFor: { "@id": ORGANIZATION_ID } } : { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@type": "Blog", name: `${BRAND_NAME} Blog`, url: `${envConfig.siteUrl}/blog` },
        keywords: post.keywords.join(", "),
        wordCount: allText(post).split(/\s+/).filter(Boolean).length,
        ...(post.course && { mentions: { "@id": `${envConfig.siteUrl}/courses/${post.course.slug}#course` } }),
    };
};
