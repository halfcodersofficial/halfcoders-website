import { postPath, publishedPosts } from "@/lib/blog";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { getPublicJson, listedCourses, type Listed } from "@/lib/listedCourses";
import { snippet } from "@/lib/seo";

/** Rebuilt at most hourly, like the sitemap: a new course is listed within the hour. */
export const revalidate = 3600;

const link = (title: string, path: string, about?: string | null) =>
    `- [${title}](${envConfig.siteUrl}${path})${about ? `: ${snippet(about, 200)}` : ""}`;

/**
 * /llms.txt: the site in a few lines of Markdown for AI assistants and
 * AI search (llmstxt.org) — what Half Coders is, every listed course and
 * bundle with a line on each, and where to read more. The same catalogue
 * the sitemap lists; nothing behind a sign-in.
 */
export async function GET() {
    const [courses, bundles] = await Promise.all([listedCourses(), getPublicJson<Listed[]>("/bundles")]);
    const listedBundles = bundles?.data ?? [];
    const posts = publishedPosts();

    const text = [
        `# ${BRAND_NAME}`,
        "",
        "> A learning community from Bangladesh: coding, engineering and career skills taught in Bangla (Bengali), with recorded lessons (live classes in some courses), mentor-reviewed assignments and certificates anyone can verify online.",
        "",
        "Courses are taught in Bangla. Every assignment is reviewed by a mentor, and every certificate carries an ID that can be checked on the site. Payment is by bKash.",
        "",
        "## Courses",
        "",
        link("All courses", "/courses", "the full catalogue, with running, upcoming and recorded courses"),
        ...courses.map((course) => link(course.title ?? course.slug, `/courses/${course.slug}`, course.subtitle ?? course.description)),
        ...(listedBundles.length > 0
            ? [
                  "",
                  "## Bundles",
                  "",
                  ...listedBundles.map((bundle) => link(bundle.title ?? bundle.slug, `/bundles/${bundle.slug}`, bundle.description)),
              ]
            : []),
        "",
        "## About",
        "",
        link("Home", "/home", "what Half Coders is and how learning here works"),
        link("About", "/about", "the team behind Half Coders"),
        link("Questions and answers", "/faq", "how courses run, fees and bKash payment, refunds, mentor support, certificates and careers"),
        link("Contact and support", "/contact", `email ${SUPPORT_EMAIL}, phone lines and calling hours`),
        link("Verify a certificate", "/certificate", "check a Half Coders certificate by its ID"),
        ...(posts.length > 0 ? ["", "## Blog", "", ...posts.map((post) => link(post.title, postPath(post), post.description))] : []),
        "",
        "## Optional",
        "",
        link("Terms of use", "/terms"),
        link("Privacy policy", "/privacy-policy"),
        link("Refund policy", "/refund-policy", "how to request a refund within 48 hours of buying a course"),
        "",
    ].join("\n");

    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
