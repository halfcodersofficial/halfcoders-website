"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Assignments now open inline in the course player (`/learn/[slug]`,
 * `?assignment=<id>`) instead of this standalone page, so old links —
 * bookmarks, notifications, anything cached — land here and get forwarded
 * rather than 404ing or showing a dead layout.
 */
export default function LegacyAssignmentRedirect() {
    const { slug, assignmentId } = useParams<{ slug: string; assignmentId: string }>();
    const router = useRouter();

    useEffect(() => {
        router.replace(`/learn/${slug}?assignment=${assignmentId}`);
    }, [router, slug, assignmentId]);

    return null;
}
