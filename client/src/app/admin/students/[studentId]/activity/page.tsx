"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CalendarSearch, History, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ACTIVITY_FILTERS, ActivityRow } from "@/components/admin/studentDetail/ActivityRow";
import { ActivityCalendar } from "@/components/admin/studentDetail/ActivityCalendar";
import { QuizAttemptReview } from "@/components/admin/studentDetail/QuizAttemptReview";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { StudentActivityEntry, StudentActivitySummary } from "@/types/admin.types";

const PAGE_SIZE = 25;

const dayHeading = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
};

/** The feed from the end of a day (in Dhaka, as the calendar counts days) back. */
const endOfDay = (date: string) => `${new Date(`${date}T23:59:59.999+06:00`).toISOString()}|￿`;

/**
 * Everything a student did, newest first, on a page of its own — the student
 * page's overview shows only the latest few. Half a year of learning as a
 * calendar on top (a day opens the feed from there), then the feed by day:
 * lessons, assignments and marks, quizzes (each opens their answers),
 * practice, support, enrolments and payments, and every sign-in with its
 * device and place. Filter by kind or by course.
 */
export default function StudentActivityPage() {
    const { studentId } = useParams<{ studentId: string }>();
    const [filter, setFilter] = useState("all");
    const [courseId, setCourseId] = useState("");
    const [day, setDay] = useState<string | null>(null);
    const [review, setReview] = useState<{ attemptId: string; title: string } | null>(null);

    // The same query the student page uses, so coming from there it's already here.
    const overview = useQuery({
        queryKey: ["admin", "student", studentId, "overview"],
        queryFn: () => adminService.studentOverview(studentId),
    });
    const summary = useQuery({
        queryKey: ["admin", "student", studentId, "activity-summary"],
        queryFn: () => adminService.studentActivitySummary(studentId),
    });

    const kinds = ACTIVITY_FILTERS.find((option) => option.id === filter)?.kinds ?? [];
    const feed = useInfiniteQuery({
        queryKey: ["admin", "student", studentId, "activity", { filter, courseId, day }],
        queryFn: ({ pageParam }) =>
            adminService.studentActivity(studentId, {
                before: pageParam ?? (day ? endOfDay(day) : undefined),
                limit: PAGE_SIZE,
                kinds: kinds.length ? kinds.join(",") : undefined,
                courseId: courseId || undefined,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

    const entries = feed.data?.pages.flatMap((page) => page.data) ?? [];
    const groups: { heading: string; entries: StudentActivityEntry[] }[] = [];
    for (const entry of entries) {
        const heading = dayHeading(entry.at);
        const last = groups[groups.length - 1];
        if (last?.heading === heading) last.entries.push(entry);
        else groups.push({ heading, entries: [entry] });
    }

    const student = overview.data?.student;
    const counts = summary.data?.counts;
    const countFor = (option: (typeof ACTIVITY_FILTERS)[number]) =>
        counts ? (option.kinds.length ? option.kinds : (Object.keys(counts) as (keyof typeof counts)[])).reduce((sum, kind) => sum + counts[kind], 0) : null;

    return (
        <div className="space-y-6">
            <BackButton href={`/admin/students/${studentId}`} label={student ? student.name : "Student"} />

            {/* Who, and the figures over the calendar. */}
            <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <div className="editor relative overflow-hidden border-b border-editor-line px-5 py-4 sm:px-6">
                    <span className="bg-grid bg-grid-fade absolute inset-0" aria-hidden />
                    <div className="relative flex flex-wrap items-center gap-4">
                        {student ? <Avatar src={student.image} name={student.name} size={52} /> : <Skeleton className="size-13 rounded-full" />}
                        <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-syn-comment">{"// "}Activity</p>
                            <h1 className="truncate text-xl font-bold text-editor-fg sm:text-2xl">{student?.name ?? "Loading…"}</h1>
                            <p className="text-sm text-editor-muted">
                                {student?.studentId && <span className="font-mono">{student.studentId} · </span>}
                                {overview.data?.stats.lastActivityAt
                                    ? `last active ${formatDistanceToNow(new Date(overview.data.stats.lastActivityAt), { addSuffix: true })}`
                                    : "Everything they did, newest first"}
                            </p>
                        </div>
                    </div>
                </div>

                <SummaryStrip summary={summary.data} />

                <div className="border-t border-border p-5 sm:px-6">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-semibold">Last 26 weeks</h2>
                        <p className="text-xs text-muted-foreground">Lessons, submissions, quizzes and practice days. Click a day to read from there.</p>
                    </div>
                    {summary.isLoading ? (
                        <Skeleton className="h-32" />
                    ) : summary.isError || !summary.data ? (
                        <p className="text-sm text-muted-foreground">{getApiErrorMessage(summary.error, "Couldn't load the calendar.")}</p>
                    ) : (
                        <ActivityCalendar days={summary.data.calendar} selected={day} onSelect={setDay} />
                    )}
                </div>
            </section>

            {/* What to show. */}
            <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div role="group" aria-label="Show" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                        {ACTIVITY_FILTERS.map((option) => {
                            const count = countFor(option);
                            const noCourse = option.id === "signins" && Boolean(courseId);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={filter === option.id}
                                    disabled={noCourse}
                                    title={noCourse ? "Sign-ins don't belong to a course — choose “All courses” to see them." : undefined}
                                    onClick={() => setFilter(option.id)}
                                    className={cn(
                                        "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                                        filter === option.id
                                            ? "border-primary bg-primary/10 text-primary-ink"
                                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {option.label}
                                    {count !== null && <span className="font-mono text-xs tabular-nums opacity-80">{count.toLocaleString()}</span>}
                                </button>
                            );
                        })}
                    </div>
                    {summary.data && summary.data.courses.length > 0 && (
                        <div className="w-full shrink-0 lg:w-72">
                            <Select
                                value={courseId}
                                onChange={(event) => {
                                    setCourseId(event.target.value);
                                    if (event.target.value && filter === "signins") setFilter("all");
                                }}
                                aria-label="Course"
                            >
                                <option value="">All courses</option>
                                {summary.data.courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}
                </div>

                {day && (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                        <CalendarSearch className="size-4 text-muted-foreground" aria-hidden />
                        Reading from <span className="font-medium">{formatDate(`${day}T00:00:00`)}</span> back
                        <Button variant="ghost" size="sm" onClick={() => setDay(null)}>
                            <X /> Back to the latest
                        </Button>
                    </p>
                )}
            </div>

            {/* The feed, by day. */}
            {feed.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 rounded-card" />
                    ))}
                </div>
            ) : feed.isError ? (
                <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {getApiErrorMessage(feed.error, "Couldn't load their activity.")}
                </p>
            ) : entries.length === 0 ? (
                <div className="rounded-card border border-dashed border-border p-10 text-center">
                    <History className="mx-auto size-6 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">Nothing here.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {filter !== "all" || courseId || day ? "Try another filter, or all courses." : "They haven't done anything yet."}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <section key={group.heading + group.entries[0].id} className="space-y-2">
                            <h3 className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {group.heading}
                                <span className="h-px flex-1 bg-border" aria-hidden />
                            </h3>
                            <ol className="divide-y divide-border rounded-card border border-border bg-card px-2 shadow-card">
                                {group.entries.map((entry) => (
                                    <li key={entry.id}>
                                        <ActivityRow entry={entry} onOpenQuiz={(attemptId, title) => setReview({ attemptId, title })} />
                                    </li>
                                ))}
                            </ol>
                        </section>
                    ))}

                    <div className="flex justify-center">
                        {feed.hasNextPage ? (
                            <Button variant="outline" onClick={() => void feed.fetchNextPage()} isLoading={feed.isFetchingNextPage}>
                                Show older activity
                            </Button>
                        ) : (
                            <p className="font-mono text-xs text-syn-comment">{"// "}That&apos;s everything — nothing older.</p>
                        )}
                    </div>
                </div>
            )}

            <QuizAttemptReview attemptId={review?.attemptId ?? null} title={review?.title} onClose={() => setReview(null)} />
        </div>
    );
}

function SummaryStrip({ summary }: { summary: StudentActivitySummary | undefined }) {
    const cells: { label: string; value: ReactNode; hint: string }[] = summary
        ? [
              { label: "Active days", value: summary.activeDays.last30, hint: "of the last 30" },
              {
                  label: "Days in a row",
                  value: summary.streak.current,
                  hint: summary.streak.current ? "up to today" : "no run going",
              },
              { label: "Longest run", value: summary.streak.longest, hint: "in 26 weeks" },
              { label: "Lessons", value: summary.counts.lesson.toLocaleString(), hint: "finished in all" },
              { label: "Quizzes", value: summary.counts.quiz, hint: "submitted" },
              {
                  label: "Sign-ins",
                  value: summary.counts.signin,
                  hint: summary.counts.refused ? `${summary.counts.refused} turned away` : "none turned away",
              },
          ]
        : [];

    if (!summary) {
        return (
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="bg-card px-4 py-4">
                        <Skeleton className="h-10" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
            {cells.map((cell) => (
                <div key={cell.label} className="flex min-w-0 flex-col bg-card px-4 py-3.5">
                    <dt className="order-1 truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{cell.label}</dt>
                    <dd className="order-2 mt-1 text-2xl font-bold tabular-nums leading-none">{cell.value}</dd>
                    <dd
                        className={cn(
                            "order-3 mt-1 truncate text-xs text-muted-foreground",
                            cell.label === "Sign-ins" && summary.counts.refused > 0 && "text-destructive",
                        )}
                    >
                        {cell.hint}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
