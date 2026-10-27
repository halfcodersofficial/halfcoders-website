"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ReviewDesk, { tabFor } from "@/components/mentor/reviews/ReviewDesk";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewQueuePage() {
    return (
        <Suspense
            fallback={
                <div className="container-page py-10">
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
 * which opens that hand-in ready to mark.
 */
function ReviewQueue() {
    const params = useSearchParams();
    return (
        <ReviewDesk
            initial={{
                tab: tabFor(params.get("status")),
                courseId: params.get("course") ?? "",
                assignmentId: params.get("assignment") ?? "",
                sort: params.get("sort") === "desc" ? "desc" : "asc",
                focus: params.get("focus"),
            }}
        />
    );
}
