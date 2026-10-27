"use client";

import { Suspense } from "react";
import SupportDesk from "@/components/mentor/support/SupportDesk";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The mentor's support sessions. Links in with `?new=1` (and `&course=<id>`)
 * to schedule one, or `?edit=<session id>` to edit one — from the dashboard,
 * a course, or this page's own stage.
 */
export default function MentorSupportPage() {
    return (
        <Suspense
            fallback={
                <div className="container-page py-10">
                    <Skeleton className="h-72 rounded-3xl" />
                </div>
            }
        >
            <SupportDesk />
        </Suspense>
    );
}
