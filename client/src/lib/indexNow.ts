import envConfig from "@/lib/envConfig";
import type { ApiResponse } from "@/types/api.types";

/**
 * The site's IndexNow key (indexnow.org): public by design. The same text is
 * served at /<key>.txt (public/), which is how Bing and the rest know the
 * site is ours. A new key needs a new file of that name, and the old removed.
 */
export const INDEXNOW_KEY = "a46a737bd423bb5f481ceceac7601668";

/** Only the real site announces itself — not local dev, nor a build pointed at localhost. */
const liveSite = (): URL | null => {
    try {
        const site = new URL(envConfig.siteUrl);
        return site.protocol === "https:" && !["localhost", "127.0.0.1"].includes(site.hostname) ? site : null;
    } catch {
        return null;
    }
};

/**
 * Tells the search engines that take IndexNow (Bing — and through it
 * ChatGPT search and Copilot — Yandex, Naver, Seznam) that the catalogue and
 * the course pages just changed, so they come and read them now instead of
 * on their next round. Google doesn't take IndexNow; it has the sitemap.
 *
 * The course list is read fresh, so a course published a moment ago is
 * included. Best effort: never throws, and a failure only means the
 * engines find the change on their own, as before.
 */
export async function announceCoursePages(): Promise<void> {
    const site = liveSite();
    if (!site) return;
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}/courses?page=1&limit=48`, { cache: "no-store" });
        const courses = res.ok ? ((await res.json()) as ApiResponse<{ slug: string }[]>).data : [];
        await fetch("https://api.indexnow.org/indexnow", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            cache: "no-store",
            body: JSON.stringify({
                host: site.hostname,
                key: INDEXNOW_KEY,
                keyLocation: `${site.origin}/${INDEXNOW_KEY}.txt`,
                urlList: [`${site.origin}/courses`, ...courses.map((course) => `${site.origin}/courses/${course.slug}`)],
            }),
        });
    } catch {
        // The engines will find the change on their next crawl.
    }
}
