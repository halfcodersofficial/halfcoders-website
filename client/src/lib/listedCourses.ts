import envConfig from "@/lib/envConfig";
import type { ApiResponse } from "@/types/api.types";

/**
 * The catalogue as search engines get it: the sitemap's course and bundle
 * pages, and the course list in /courses's structured data. Read on the
 * server, at most hourly, so a newly published course shows up within the hour.
 */
const REVALIDATE = 3600;

/** The API's page-size cap for the public catalogue. */
const PAGE_SIZE = 48;

export type Listed = { slug: string; updatedAt?: string };

/** A public API read; null when the API can't be reached or says no. */
export const getPublicJson = async <T,>(path: string): Promise<ApiResponse<T> | null> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}${path}`, { next: { revalidate: REVALIDATE } });
        return res.ok ? ((await res.json()) as ApiResponse<T>) : null;
    } catch {
        return null;
    }
};

/**
 * Every course listed in the catalogue (the API leaves out drafts and the
 * batches hidden from /courses, which are noindex). An unreachable API (the
 * first Docker build, before the site is up) gives none, until the hourly
 * regeneration.
 */
export const listedCourses = async (): Promise<Listed[]> => {
    const courses: Listed[] = [];
    for (let page = 1; ; page++) {
        const body = await getPublicJson<Listed[]>(`/courses?page=${page}&limit=${PAGE_SIZE}`);
        if (!body) break;
        courses.push(...body.data);
        if (page >= (body.meta?.totalPages ?? 1)) break;
    }
    return courses;
};
