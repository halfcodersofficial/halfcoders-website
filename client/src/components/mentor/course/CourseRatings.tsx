"use client";

import { useQuery } from "@tanstack/react-query";
import { Stars } from "@/components/shared/CourseRatingSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { courseReviewService } from "@/services";

const STATUS = {
    PENDING: { label: "Waiting for an admin", tone: "text-amber-700 dark:text-amber-400" },
    PUBLISHED: { label: "On the course page", tone: "text-success" },
    HIDDEN: { label: "Hidden", tone: "text-muted-foreground" },
} as const;

/**
 * What students think of the course: the average over every rating, and
 * each review — by name only, as everywhere a mentor sees students. Admins
 * decide which reach the course page.
 */
export default function CourseRatings({ courseId }: { courseId: string }) {
    const { data, isLoading } = useQuery({ queryKey: ["staff", "course-reviews", courseId], queryFn: () => courseReviewService.forCourse(courseId) });

    return (
        <section aria-labelledby="ratings-title" className="space-y-3">
            <h3 id="ratings-title" className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
                Ratings <span className="text-sm font-normal text-muted-foreground">{data?.summary.count ?? 0}</span>
            </h3>
            {isLoading ? (
                <Skeleton className="h-32 rounded-2xl" />
            ) : !data || data.summary.count === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                    No ratings yet. Students rate the course from its learning page.
                </p>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-5 py-4 sm:px-6">
                        <p className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold tabular-nums">{data.summary.average}</span>
                            <Stars value={data.summary.average ?? 0} />
                        </p>
                        <p className="text-sm text-muted-foreground">
                            from {data.summary.count} {data.summary.count === 1 ? "student" : "students"} · {data.published} on the course page
                        </p>
                    </div>
                    <ul className="divide-y divide-border">
                        {data.reviews.map((review) => (
                            <li key={review.id} className="px-5 py-3.5 sm:px-6">
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                    <span className="font-medium">{review.student.name}</span>
                                    <Stars value={review.rating} />
                                    <span className={cn("text-xs", STATUS[review.status].tone)}>{STATUS[review.status].label}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                                </p>
                                {review.comment && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{review.comment}</p>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
