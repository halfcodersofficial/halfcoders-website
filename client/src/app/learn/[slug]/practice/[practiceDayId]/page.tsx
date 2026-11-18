"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Practice days now open inside the course player (`/learn/[slug]`,
 * `?practice=<id>`) — their lessons one at a time, like a module's — instead
 * of this standalone page, so old links (bookmarks, anything cached) land
 * here and get forwarded rather than 404ing.
 */
export default function LegacyPracticeDayRedirect() {
    const { slug, practiceDayId } = useParams<{ slug: string; practiceDayId: string }>();
    const router = useRouter();

    useEffect(() => {
        router.replace(`/learn/${slug}?practice=${practiceDayId}`);
    }, [router, slug, practiceDayId]);

    return null;
}
