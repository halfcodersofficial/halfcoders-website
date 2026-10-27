import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import type { MentorCourse } from "@/types/mentor.types";
import { clock, DAY_MS, elapsed, pad2 } from "./time";

const ROLE_LABEL: Record<string, string> = { LEAD: "Lead mentor", CO_MENTOR: "Co-mentor", SUPPORT: "Support mentor" };
const TYPE_LABEL = { BOOTCAMP: "Bootcamp", TRADITIONAL: "Traditional" } as const;
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", ARCHIVED: "Unpublished" };
const COLUMNS = "md:grid-cols-[minmax(0,1fr)_5rem_8.5rem_5.5rem_1rem]";

/** "Week 02 · Day 01 goes out Sat 9:00 PM" — or a date, when it's more than a week off. */
function nextOut(course: MentorCourse, now: number) {
    const next = course.stats.nextRelease;
    if (!next) return null;
    const week = `${course.milestoneLabel} ${pad2(next.milestoneOrder)}`;
    const what =
        next.itemType === "MODULE"
            ? `${week} · ${course.moduleLabel} ${pad2(next.order ?? 0)}`
            : `${week} ${next.itemType === "ASSIGNMENT" ? "assignment" : "practice day"}`;
    const at = new Date(next.at);
    const when =
        at.getTime() - now < 6 * DAY_MS
            ? `${at.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Dhaka" })} ${clock(at)}`
            : at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
    return `${what} goes out ${when}`;
}

/**
 * Every course the mentor teaches, as a row of what they'd check first: how
 * many are learning, how far they've got on average and what's waiting on a
 * review. The row opens the course; the review count opens those hand-ins.
 */
export default function CourseRows({ courses, now }: { courses: MentorCourse[]; now: number }) {
    return (
        <section aria-labelledby="courses-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <h2 id="courses-title" className="text-lg font-semibold tracking-tight">
                    Your courses <span className="font-normal text-muted-foreground">{courses.length}</span>
                </h2>
                <Link href="/mentor/courses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    All courses <ArrowRight className="size-4" aria-hidden />
                </Link>
            </header>

            <div className={cn("hidden gap-4 border-b border-border px-6 py-2 text-xs font-medium text-muted-foreground md:grid", COLUMNS)} aria-hidden>
                <span>Course</span>
                <span className="text-right">Students</span>
                <span>Avg. progress</span>
                <span className="text-right">To review</span>
                <span />
            </div>

            <ul className="divide-y divide-border">
                {courses.map((course) => {
                    const { stats } = course;
                    const release = nextOut(course, now);
                    const waited = stats.oldestWaitingAt ? elapsed(stats.oldestWaitingAt, now) : null;
                    return (
                        <li
                            key={course.id}
                            className={cn("group relative grid gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-secondary/40 sm:px-6 md:items-center", COLUMNS)}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary">
                                    <SafeImage
                                        src={course.thumbnail}
                                        alt=""
                                        fill
                                        sizes="80px"
                                        className="object-cover"
                                        fallback={<BookOpen className="size-5 text-muted-foreground" />}
                                    />
                                </span>
                                <span className="min-w-0">
                                    {/* The whole row is this link; the counts beside it sit above it. */}
                                    <Link
                                        href={`/mentor/courses/${course.id}`}
                                        className="block truncate text-sm font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                                    >
                                        {course.title}
                                    </Link>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {ROLE_LABEL[course.role] ?? course.role} · {TYPE_LABEL[course.courseType]}
                                        {STATUS_LABEL[course.status] && (
                                            <span className="ml-1.5 rounded bg-secondary px-1.5 py-px font-medium text-secondary-foreground">
                                                {STATUS_LABEL[course.status]}
                                            </span>
                                        )}
                                    </span>
                                    {release && <span className="mt-0.5 block truncate text-xs text-primary">{release}</span>}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:contents">
                                <Figure label="Students" className="md:text-right">
                                    <span className="font-semibold tabular-nums">{stats.students}</span>
                                    {stats.completed > 0 && (
                                        <span className="block text-xs text-muted-foreground">{stats.completed} finished</span>
                                    )}
                                </Figure>

                                <Figure label="Progress">
                                    <span className="flex items-center gap-2">
                                        <span className="hidden h-1.5 w-full max-w-20 overflow-hidden rounded-full bg-secondary md:block" aria-hidden>
                                            <span className="block h-full rounded-full bg-brand" style={{ width: `${stats.averageProgress}%` }} />
                                        </span>
                                        <span className="font-semibold tabular-nums">{stats.averageProgress}%</span>
                                    </span>
                                </Figure>

                                <Figure label="To review" className="md:text-right">
                                    {stats.toReview > 0 ? (
                                        <Link
                                            href={`/mentor/reviews?course=${course.id}`}
                                            title={waited ? `Oldest waiting ${waited.text}` : undefined}
                                            className={cn(
                                                "relative z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums transition-colors",
                                                waited && waited.days >= 2
                                                    ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                                                    : "bg-primary/10 text-primary hover:bg-primary/15",
                                            )}
                                        >
                                            {stats.toReview}
                                            <ArrowRight className="size-3" aria-hidden />
                                            <span className="sr-only"> waiting for review — open them</span>
                                        </Link>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </Figure>

                            </div>

                            <ChevronRight
                                className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block"
                                aria-hidden
                            />
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** A figure, labelled on a phone; the header row labels it from md up. */
function Figure({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn("min-w-0 text-sm", className)}>
            <span className="mb-0.5 block text-[0.6875rem] text-muted-foreground md:hidden">{label}</span>
            {children}
        </div>
    );
}
