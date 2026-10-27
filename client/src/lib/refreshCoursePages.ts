"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { ApiResponse, Role } from "@/types/api.types";
import { STAFF_ROLES } from "./access";
import { COURSE_PAGE_TAG } from "./coursePageCache";
import envConfig from "./envConfig";

/**
 * Drops the cached public course pages, so the next visit reads the course
 * afresh — call it after a change the page shows: its content, its status,
 * who teaches it, or a mentor's profile.
 *
 * A server action is a public endpoint, so the caller's session is checked
 * with the API first: only staff may clear the cache. Never throws — the
 * change itself is already saved, and the page catches up on its own within
 * minutes regardless.
 */
export async function refreshCoursePages(): Promise<void> {
    try {
        const cookie = (await cookies()).toString();
        if (!cookie) return;

        const res = await fetch(`${envConfig.apiBaseUrl}/auth/me`, {
            headers: { cookie },
            cache: "no-store",
        });
        if (!res.ok) return;

        const body = (await res.json()) as ApiResponse<{ role: Role }>;
        if (!STAFF_ROLES.includes(body.data.role)) return;

        revalidateTag(COURSE_PAGE_TAG);
    } catch {
        // Unreachable API or a bad answer: leave the cache to expire.
    }
}
