import type { MetadataRoute } from "next";
import envConfig from "@/lib/envConfig";
import type { ApiResponse } from "@/types/api.types";

/** Rebuilt at most hourly: a newly published course shows up within the hour. */
export const revalidate = 3600;

/** The API's page-size cap for the public catalogue. */
const PAGE_SIZE = 48;

type Listed = { slug: string; updatedAt?: string };

const getJson = async <T,>(path: string): Promise<ApiResponse<T> | null> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}${path}`, { next: { revalidate } });
        return res.ok ? ((await res.json()) as ApiResponse<T>) : null;
    } catch {
        return null;
    }
};

/**
 * Every course listed in the catalogue (the API leaves out drafts and the
 * batches hidden from /courses, which are noindex). An unreachable API (the
 * first Docker build, before the site is up) gives the static pages only,
 * until the hourly regeneration.
 */
const listedCourses = async (): Promise<Listed[]> => {
    const courses: Listed[] = [];
    for (let page = 1; ; page++) {
        const body = await getJson<Listed[]>(`/courses?page=${page}&limit=${PAGE_SIZE}`);
        if (!body) break;
        courses.push(...body.data);
        if (page >= (body.meta?.totalPages ?? 1)) break;
    }
    return courses;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const url = (path: string) => `${envConfig.siteUrl}${path}`;
    const [courses, bundles] = await Promise.all([listedCourses(), getJson<Listed[]>("/bundles")]);

    return [
        { url: url("/courses"), changeFrequency: "daily", priority: 1 },
        { url: url("/home"), changeFrequency: "weekly", priority: 0.8 },
        { url: url("/bundles"), changeFrequency: "weekly", priority: 0.7 },
        { url: url("/about"), changeFrequency: "monthly", priority: 0.5 },
        { url: url("/contact"), changeFrequency: "monthly", priority: 0.4 },
        { url: url("/certificate"), changeFrequency: "yearly", priority: 0.3 },
        { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
        { url: url("/privacy-policy"), changeFrequency: "yearly", priority: 0.2 },
        { url: url("/refund-policy"), changeFrequency: "yearly", priority: 0.2 },
        ...courses.map((course) => ({
            url: url(`/courses/${course.slug}`),
            lastModified: course.updatedAt,
            changeFrequency: "weekly" as const,
            priority: 0.9,
        })),
        ...(bundles?.data ?? []).map((bundle) => ({
            url: url(`/bundles/${bundle.slug}`),
            changeFrequency: "weekly" as const,
            priority: 0.6,
        })),
    ];
}
