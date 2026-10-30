"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import DataShell from "@/components/admin/DataShell";
import { Stars } from "@/components/shared/CourseRatingSummary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminCourseReview } from "@/types/admin.types";

const TONE: Record<AdminCourseReview["status"], string> = {
    PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    PUBLISHED: "bg-success/10 text-success",
    HIDDEN: "bg-secondary text-muted-foreground",
};
const LABEL: Record<AdminCourseReview["status"], string> = { PENDING: "Waiting", PUBLISHED: "On the page", HIDDEN: "Hidden" };

export default function AdminReviewsPage() {
    return (
        <Suspense>
            <Reviews />
        </Suspense>
    );
}

/**
 * Students' ratings of their courses. Nothing reaches a course page until
 * it's published here — the page says only what staff chose to show — and a
 * student's edit comes back to "Waiting".
 */
function Reviews() {
    const queryClient = useQueryClient();
    const params = useSearchParams();
    const [status, setStatus] = useState(params.get("status") ?? "PENDING");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "course-reviews", { status, searchTerm, page }],
        queryFn: () => adminService.courseReviews({ status: status || undefined, searchTerm: searchTerm || undefined, page, limit: 20 }),
    });
    const counts = useQuery({ queryKey: ["admin", "course-reviews", "counts"], queryFn: adminService.courseReviewCounts });

    const moderate = useMutation({
        mutationFn: ({ review, next }: { review: AdminCourseReview; next: AdminCourseReview["status"] }) => adminService.moderateCourseReview(review.id, next),
        onSuccess: (_, { next }) => {
            toast.success(next === "PUBLISHED" ? "Published — it's on the course page." : next === "HIDDEN" ? "Hidden from the course page." : "Back to waiting.");
            void queryClient.invalidateQueries({ queryKey: ["admin", "course-reviews"] });
            void refreshCoursePages();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that review.")),
    });
    const busy = (id: string) => moderate.isPending && moderate.variables?.review.id === id;

    const reviews = data?.data ?? [];

    return (
        <DataShell
            title="Course reviews"
            description="Students' ratings of their courses. Publish one to put it on the course page, with the student's name; hide it to keep it off."
            searchPlaceholder="Search by student, course or words…"
            onSearch={(term) => {
                setSearchTerm(term);
                setPage(1);
            }}
            filters={[
                { value: "PENDING", label: "Waiting", count: counts.data?.PENDING },
                { value: "PUBLISHED", label: "On the page", count: counts.data?.PUBLISHED },
                { value: "HIDDEN", label: "Hidden", count: counts.data?.HIDDEN },
                { value: "", label: "All" },
            ]}
            activeFilter={status}
            onFilter={(value) => {
                setStatus(value);
                setPage(1);
            }}
            isLoading={isLoading}
            isEmpty={reviews.length === 0}
            emptyMessage={status === "PENDING" ? "Nothing waiting" : "No reviews here"}
            emptyHint={status === "PENDING" ? "New reviews from students land here for you to publish." : "Try another tab."}
            meta={data?.meta}
            onPage={setPage}
        >
            <ul className="space-y-3">
                {reviews.map((review) => (
                    <li key={review.id} className="rounded-card border border-border bg-card p-4 shadow-card sm:p-5">
                        <div className="flex flex-wrap items-start gap-3">
                            <Avatar src={review.student.image} name={review.student.name} size={36} />
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium">{review.student.name}</span>
                                    <Stars value={review.rating} />
                                    <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", TONE[review.status])}>{LABEL[review.status]}</span>
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    <Link href={`/admin/courses/${review.course.id}`} className="hover:underline">
                                        {review.course.title}
                                    </Link>{" "}
                                    · {formatDate(review.updatedAt)}
                                    {review.moderatedBy && review.status !== "PENDING" && ` · ${LABEL[review.status].toLowerCase()} by ${review.moderatedBy.name}`}
                                </p>
                                {review.comment ? (
                                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{review.comment}</p>
                                ) : (
                                    <p className="mt-2 text-sm italic text-muted-foreground">A rating, no words — it counts toward the average only.</p>
                                )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                                {review.status !== "PUBLISHED" && (
                                    <Button size="sm" isLoading={busy(review.id) && moderate.variables?.next === "PUBLISHED"} onClick={() => moderate.mutate({ review, next: "PUBLISHED" })}>
                                        <Eye /> Publish
                                    </Button>
                                )}
                                {review.status !== "HIDDEN" && (
                                    <Button size="sm" variant="outline" isLoading={busy(review.id) && moderate.variables?.next === "HIDDEN"} onClick={() => moderate.mutate({ review, next: "HIDDEN" })}>
                                        <EyeOff /> Hide
                                    </Button>
                                )}
                                {review.status === "HIDDEN" && (
                                    <Button size="sm" variant="ghost" aria-label="Back to waiting" onClick={() => moderate.mutate({ review, next: "PENDING" })}>
                                        <RotateCcw />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </DataShell>
    );
}
