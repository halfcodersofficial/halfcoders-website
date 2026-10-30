"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, ExternalLink, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatusPill, statusLabel } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/httpClient";
import { privateFileHref } from "@/lib/privateFile";
import { cn, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { MentorReview, MentorReviewCourse } from "@/types/admin.types";
import { formatHours, hoursBetween } from "./format";

const PAGE_SIZE = 25;

const RESULTS = [
    { value: "", label: "All results" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "NEEDS_REVISION", label: "Needs revision" },
    { value: "REJECTED", label: "Rejected" },
    { value: "UNDER_REVIEW", label: "Under review" },
];

/** "88 / 100", against a late submission's cap when it had one. */
const marks = (review: MentorReview) => `${review.score} / ${review.maxScore ?? review.assignment.totalMarks}`;

interface MentorReviewsProps {
    mentorId: string;
    /** The courses they teach — the filter also lists any other course they marked in. */
    courses: { id: string; title: string }[];
}

/**
 * Every submission the mentor has marked: which student, which assignment in
 * which course, the marks and when they were given. Filter by course, result
 * or student; open a row for the feedback, the submitted work and each time
 * it was marked.
 */
export function MentorReviews({ mentorId, courses }: MentorReviewsProps) {
    const [courseId, setCourseId] = useState("");
    const [status, setStatus] = useState("");
    const [term, setTerm] = useState("");
    const [page, setPage] = useState(1);
    const search = useDebouncedValue(term.trim(), 300);

    const { data, isLoading, isError, error, isPlaceholderData } = useQuery({
        queryKey: ["admin", "mentor", mentorId, "reviews", { courseId, status, search, page }],
        queryFn: () =>
            adminService.mentorReviews(mentorId, {
                courseId: courseId || undefined,
                status: status || undefined,
                search: search || undefined,
                page,
                limit: PAGE_SIZE,
            }),
        // Keep the current rows on screen while the next filter or page loads.
        placeholderData: keepPreviousData,
    });

    const summary = data?.data.courses ?? [];
    const reviews = data?.data.reviews ?? [];
    const meta = data?.meta;
    const filtered = Boolean(courseId || status || search);

    // Courses they teach, plus any they marked in before being moved off them.
    const courseOptions = [
        ...courses,
        ...summary.filter((course) => !courses.some(({ id }) => id === course.id)),
    ];

    const pickCourse = (id: string) => {
        setCourseId(id);
        setPage(1);
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-20" />
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {getApiErrorMessage(error, "Couldn't load this mentor's marks.")}
            </p>
        );
    }

    if (summary.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
                <ClipboardCheck className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-medium">No submissions marked yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Every assignment this mentor marks shows up here, with the student, the marks and when they were given.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <CourseSummary courses={summary} selected={courseId} onSelect={(id) => pickCourse(id === courseId ? "" : id)} />

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-56 flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={term}
                        onChange={(event) => {
                            setTerm(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search student by name or email…"
                        aria-label="Search student by name or email"
                        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {term && (
                        <button
                            type="button"
                            onClick={() => {
                                setTerm("");
                                setPage(1);
                            }}
                            aria-label="Clear search"
                            className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
                <div className="w-full sm:w-60">
                    <Select value={courseId} onChange={(event) => pickCourse(event.target.value)} aria-label="Course">
                        <option value="">All courses</option>
                        {courseOptions.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.title}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="w-full sm:w-44">
                    <Select
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Result"
                    >
                        {RESULTS.map((result) => (
                            <option key={result.value} value={result.value}>
                                {result.label}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>

            {reviews.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {filtered ? "Nothing matches these filters." : "No submissions marked yet."}
                </p>
            ) : (
                <ul
                    className={cn(
                        "divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card transition-opacity",
                        isPlaceholderData && "opacity-60",
                    )}
                >
                    {reviews.map((review) => (
                        <ReviewRow key={review.id} review={review} />
                    ))}
                </ul>
            )}

            {meta && meta.total > 0 && (
                <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-label="Pagination">
                    <p>
                        {meta.totalPages > 1
                            ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
                            : `${meta.total} marked ${meta.total === 1 ? "submission" : "submissions"}`}
                    </p>
                    {meta.totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
                                <ChevronLeft /> Prev
                            </Button>
                            <span className="px-2 tabular-nums">
                                {meta.page} / {meta.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page >= meta.totalPages}
                                onClick={() => setPage(meta.page + 1)}
                            >
                                Next <ChevronRight />
                            </Button>
                        </div>
                    )}
                </nav>
            )}
        </div>
    );
}

/** One card per course they've marked in: how many, and the average marks. Picking one filters the list. */
function CourseSummary({
    courses,
    selected,
    onSelect,
}: {
    courses: MentorReviewCourse[];
    selected: string;
    onSelect: (courseId: string) => void;
}) {
    return (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
                const active = course.id === selected;
                return (
                    <li key={course.id}>
                        <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect(course.id)}
                            className={cn(
                                "w-full rounded-card border bg-card p-4 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                            )}
                        >
                            <p className="truncate text-sm font-medium" title={course.title}>
                                {course.title}
                            </p>
                            <p className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-bold">
                                    {course.averagePercent === null ? "—" : `${course.averagePercent}%`}
                                </span>
                                <span className="text-xs text-muted-foreground">average marks</span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {course.reviews} marked · {course.accepted} accepted
                            </p>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

function ReviewRow({ review }: { review: MentorReview }) {
    const late = review.maxScore !== null && review.maxScore < review.assignment.totalMarks;

    return (
        <li>
            <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-1 gap-3 px-4 py-3.5 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_8rem_minmax(0,1fr)_1.25rem] md:items-center [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={review.student.image} name={review.student.name} size={36} />
                        <div className="min-w-0">
                            <p className="truncate font-medium">{review.student.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                                {review.student.studentId ? `${review.student.studentId} · ` : ""}
                                {review.student.email}
                            </p>
                        </div>
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={review.assignment.title}>
                            {review.assignment.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={review.assignment.course.title}>
                            Week {review.assignment.milestone.order} · {review.assignment.course.title}
                        </p>
                    </div>

                    <div>
                        {review.score === null ? (
                            <p className="text-sm text-muted-foreground">No marks</p>
                        ) : (
                            <>
                                <p className="text-base font-semibold tabular-nums">{marks(review)}</p>
                                {review.percent !== null && (
                                    <p className="text-xs tabular-nums text-muted-foreground">{Math.round(review.percent)}%</p>
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <StatusPill kind="submission" value={review.status} />
                    </div>

                    <div className="min-w-0 text-sm">
                        <p className="whitespace-nowrap">{formatDateTime(review.reviewedAt)}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatHours(hoursBetween(review.submittedAt, review.reviewedAt))} after submission
                        </p>
                    </div>

                    <ChevronDown
                        className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-180 md:block"
                        aria-hidden
                    />
                </summary>

                <div className="grid gap-5 border-t border-border bg-secondary/20 px-4 py-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">Feedback</p>
                        {review.feedback ? (
                            <p className="whitespace-pre-line text-sm wrap-break-word">{review.feedback}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">No written feedback.</p>
                        )}
                    </div>

                    <div className="space-y-3 text-sm">
                        <dl className="space-y-1.5">
                            <Fact label="Submitted">{formatDateTime(review.submittedAt)}</Fact>
                            <Fact label="Deadline">
                                {review.assignment.deadline ? formatDateTime(review.assignment.deadline) : "None"}
                            </Fact>
                            <Fact label="Marked">{formatDateTime(review.reviewedAt)}</Fact>
                            <Fact label="Out of">
                                {late
                                    ? `${review.maxScore} (late — full marks are ${review.assignment.totalMarks})`
                                    : review.assignment.totalMarks}
                            </Fact>
                            <Fact label="Course">
                                <Link href={`/admin/courses/${review.assignment.course.id}`} className="hover:underline">
                                    {review.assignment.course.title}
                                </Link>
                            </Fact>
                        </dl>

                        {(review.submissionUrl || review.fileUrls.length > 0) && (
                            <div className="flex flex-wrap gap-2">
                                {review.submissionUrl && (
                                    <Button asChild variant="outline" size="sm">
                                        <a href={review.submissionUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink /> Submitted link
                                        </a>
                                    </Button>
                                )}
                                {review.fileUrls.map((url, index) => (
                                    <Button key={url} asChild variant="outline" size="sm">
                                        <a href={privateFileHref(url)} target="_blank" rel="noopener noreferrer">
                                            <FileText /> File {index + 1}
                                        </a>
                                    </Button>
                                ))}
                            </div>
                        )}

                        {review.history.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                                    Marked {review.history.length} {review.history.length === 1 ? "time" : "times"}
                                </p>
                                <ol className="space-y-1">
                                    {review.history.map((entry, index) => (
                                        <li key={index} className="flex flex-wrap gap-x-2 text-xs">
                                            <span className="tabular-nums text-muted-foreground">{formatDateTime(entry.at)}</span>
                                            <span>
                                                {entry.status ? statusLabel("submission", entry.status) : "Marked"}
                                                {entry.score !== null && ` · ${entry.score} marks`}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                </div>
            </details>
        </li>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 wrap-break-word">{children}</dd>
        </div>
    );
}
