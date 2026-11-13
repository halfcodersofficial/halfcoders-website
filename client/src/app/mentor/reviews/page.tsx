"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ReviewDesk, { tabFor } from "@/components/mentor/reviews/ReviewDesk";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewQueuePage() {
    return (
        <Suspense
            fallback={
                <div className="w-full">
                    <Skeleton className="h-96" />
                </div>
            }
        >
            <ReviewQueue />
        </Suspense>
    );
}

/**
 * The dashboard, inbox, course results and notifications link in with
 * `?course=`, `?assignment=`, `?status=`, `?sort=desc` and `?focus=<hand-in>`,
 * which opens that hand-in ready to mark — and `?recheck=open`, the
 * "Rechecks" tab a recheck request links to.
 */
function ReviewQueue() {
    const params = useSearchParams();
    return (
        <ReviewDesk
            initial={{
                tab: params.get("recheck") === "open" ? "RECHECK" : tabFor(params.get("status")),
                courseId: params.get("course") ?? "",
                assignmentId: params.get("assignment") ?? "",
                sort: params.get("sort") === "desc" ? "desc" : "asc",
                focus: params.get("focus"),
            }}
        />
    );
}
