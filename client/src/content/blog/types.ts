/*
 * The shape of a blog post. Posts are plain TypeScript files in
 * content/blog/posts/, one per post, listed in content/blog/index.ts. Text is
 * written as strings and may use three marks inline:
 *
 *   **bold**   `code`   [link text](/courses/some-course)   [link text](https://…)
 *
 * A link starting with "/" stays on the site; an https:// link opens in a new
 * tab. Nothing else is interpreted, so a post can never inject markup.
 *
 * HOW A POST GOES LIVE
 * Every new post starts as `status: "draft"`: it shows while developing
 * (npm run dev), marked as a draft, and is left out of the production site
 * entirely — no page, no listing, no sitemap entry. To publish one, after it
 * has been read and approved:
 *   1. set `status: "approved"`,
 *   2. set `published` to the day it goes live ("YYYY-MM-DD"),
 *   3. put the reviewing mentor's name in `reviewedBy` (a real person from
 *      the About page's team) — or leave it out to credit the team,
 *   4. deploy.
 * Every fact about Half Coders in a post must be true on the day it goes live
 * (fees, course contents, support): check the course pages before approving.
 */

/** One block of a section's body. */
export type PostBlock =
    | { type: "p"; text: string }
    | { type: "list"; items: string[]; ordered?: boolean }
    /** Code, shown as it is (never interpreted). `lang` is a label only: "c", "cpp", "python". */
    | { type: "code"; lang: string; code: string; caption?: string }
    /** A highlighted aside: a tip, a warning, the short answer. */
    | { type: "note"; title?: string; text: string }
    | { type: "table"; head: string[]; rows: string[][]; caption?: string };

export interface PostSection {
    /** The anchor for the contents list (#id). Latin letters, digits and dashes. */
    id: string;
    /** The section's heading, shown as an h2 and in the contents list. */
    heading: string;
    blocks: PostBlock[];
}

export interface BlogPost {
    /** The address: /blog/<slug>. Latin letters, digits and dashes; never change it once live. */
    slug: string;
    status: "draft" | "approved";
    /** The headline on the page (h1). */
    title: string;
    /** The title in search results and on shared links: the main keyword first, under ~60 characters. */
    seoTitle: string;
    /** The search snippet and the line under the headline: ~150 characters, says what the reader gets. */
    description: string;
    /** The keyword the post is written for, then close variants (from the keyword sheet). For the team; not shown. */
    keywords: string[];
    /** A word or two above the headline: "শুরু করা", "ক্যারিয়ার". */
    topic: string;
    /** The day it went live, "YYYY-MM-DD". Empty while a draft. */
    published?: string;
    /** The day its facts were last checked or its text last changed, "YYYY-MM-DD". */
    updated: string;
    /** The mentor who reviewed it (a real name from the team). Left out, it is credited to the team. */
    reviewedBy?: string;
    /** The opening paragraph, under the headline. */
    lead: string;
    sections: PostSection[];
    /** Questions answered at the end (also given to search engines as FAQ data). */
    faqs?: { q: string; a: string }[];
    /** The one course the post leads to: its slug and why it fits this reader. */
    course?: { slug: string; name: string; pitch: string };
}
