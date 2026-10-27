"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarPlus, Headphones } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { clock, dhakaDayKey, pad2, plural, weekdayOf } from "@/components/mentor/dashboard/time";
import WeekAgenda from "@/components/mentor/dashboard/WeekAgenda";
import { CourseReadiness, savedReadiness } from "@/components/mentor/course/CourseReadiness";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services";
import { curriculumAuthoring } from "@/services/curriculum";
import type { AdminCourseDetail } from "@/types/admin.types";
import type { CourseResults, MentorDashboard } from "@/types/mentor.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";
const PANEL = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/**
 * One course at a glance, for a mentor who teaches it: how many are enrolled
 * and what's waiting on them, the curriculum week by week, this course's week
 * ahead, whether the public page is ready, the marks so far and its support
 * sessions. Students are counted here, never listed.
 */
export default function MentorCourseOverview() {
    const { courseId } = useParams<{ courseId: string }>();
    const routes = staffCourseRoutes("mentor", courseId);
    const now = useNow(30_000);

    const detail = useQuery({ queryKey: ["staff", "course-detail", courseId], queryFn: () => curriculumAuthoring.getCourseDetail(courseId) });
    const dashboard = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    const results = useQuery({ queryKey: ["staff", "results", courseId], queryFn: () => curriculumAuthoring.getResults(courseId) });

    if (detail.isLoading || dashboard.isLoading) {
        return (
            <div className="container-page space-y-6 py-8">
                <Skeleton className="h-24 rounded-2xl" />
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <Skeleton className="h-96 rounded-2xl" />
                    <Skeleton className="h-96 rounded-2xl" />
                </div>
            </div>
        );
    }
    const course = detail.data;
    if (!course) return null;

    const stats = dashboard.data?.courses.find((entry) => entry.id === courseId)?.stats;
    const modules = course.milestones.flatMap((milestone) => milestone.modules);
    const liveModules = course.milestones.filter((m) => m.isPublished).flatMap((m) => m.modules.filter((x) => x.isPublished));
    const liveLessons = liveModules.reduce((sum, module) => sum + module._count.videos, 0);
    const agenda = dashboard.data && {
        ...dashboard.data.agenda,
        items: dashboard.data.agenda.items.filter((item) => item.course.id === courseId),
    };

    return (
        <div className="container-page space-y-6 py-8">
            {/* 1px gaps over the border colour draw the dividers at every column count. */}
            <ul aria-label="This course" className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm lg:grid-cols-4", RISE)}>
                <Figure label="Students enrolled" value={course._count.enrollments} hint={stats ? `${stats.active} learning · ${stats.completed} finished` : undefined} />
                <Figure
                    label="Hand-ins to review"
                    value={stats?.toReview ?? 0}
                    hint={stats?.toReview ? "Oldest first in the queue" : "All caught up"}
                    href={stats?.toReview ? `/mentor/reviews?course=${courseId}` : undefined}
                    tone={stats?.toReview ? "primary" : undefined}
                />
                <Figure label="Average progress" value={`${stats?.averageProgress ?? 0}%`} hint="Across everyone enrolled" />
                <Figure
                    label="Live content"
                    value={liveLessons}
                    hint={`lessons in ${liveModules.length} of ${modules.length} ${course.moduleLabel.toLowerCase()}s`}
                />
            </ul>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-w-0 space-y-6">
                    <div className={RISE} style={{ animationDelay: "60ms" }}>
                        <Curriculum course={course} modulesHref={routes.modules} />
                    </div>
                    {agenda && (
                        <div className={RISE} style={{ animationDelay: "120ms" }}>
                            <WeekAgenda agenda={agenda} now={now} />
                        </div>
                    )}
                </div>

                <aside className={cn("space-y-6", RISE)} style={{ animationDelay: "90ms" }}>
                    <CourseReadiness items={savedReadiness(course)} published={course.status === "PUBLISHED"} editHref={routes.coursePage} compact />
                    <Marks results={results.data} loading={results.isLoading} href={routes.results} />
                    {dashboard.data && <Support courseId={courseId} sessions={dashboard.data.upcomingSupport} now={now} />}
                </aside>
            </div>
        </div>
    );
}

function Figure({
    label,
    value,
    hint,
    href,
    tone,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    href?: string;
    tone?: "primary";
}) {
    const body = (
        <>
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span className={cn("mt-1 block text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]", tone === "primary" && "text-primary")}>
                {value}
            </span>
            {hint && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>}
        </>
    );
    return (
        <li className="min-w-0 bg-card">
            {href ? (
                <Link href={href} className="group block h-full px-5 py-4 transition-colors hover:bg-secondary/40">
                    {body}
                </Link>
            ) : (
                <div className="px-5 py-4">{body}</div>
            )}
        </li>
    );
}

/** The curriculum as its weeks: each a row with its modules drawn live or not, and what else it holds. */
function Curriculum({ course, modulesHref }: { course: AdminCourseDetail; modulesHref: string }) {
    const label = course.milestoneLabel;

    return (
        <section aria-labelledby="curriculum-title" className={PANEL}>
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <div>
                    <h2 id="curriculum-title" className="text-lg font-semibold tracking-tight">
                        Curriculum
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {plural(course.milestones.length, label.toLowerCase())} · students only see what&apos;s live
                    </p>
                </div>
                <Link href={modulesHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Module Manager <ArrowRight className="size-4" aria-hidden />
                </Link>
            </header>

            {course.milestones.length === 0 ? (
                <div className="px-6 py-12 text-center">
                    <p className="font-medium">Nothing built yet.</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        Add the first {label.toLowerCase()} and its {course.moduleLabel.toLowerCase()}s in the Module Manager.
                    </p>
                </div>
            ) : (
                <ol className="divide-y divide-border">
                    {course.milestones.map((milestone) => {
                        const live = milestone.modules.filter((module) => module.isPublished).length;
                        const lessons = milestone.modules.reduce((sum, module) => sum + module._count.videos, 0);
                        const extras = [
                            milestone.assignments.length > 0 && plural(milestone.assignments.length, "assignment"),
                            milestone.practiceDays.length > 0 && plural(milestone.practiceDays.length, "practice day"),
                            lessons > 0 && plural(lessons, "lesson"),
                        ].filter(Boolean);
                        return (
                            <li key={milestone.id}>
                                <Link
                                    href={modulesHref}
                                    className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:px-6"
                                >
                                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {label} {pad2(milestone.order)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold">{milestone.title}</span>
                                            {!milestone.isPublished && (
                                                <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[0.6875rem] font-medium text-secondary-foreground">
                                                    Hidden
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                            {extras.length > 0 ? extras.join(" · ") : "Empty so far"}
                                        </span>
                                    </span>
                                    {/* One mark per module: filled once it's live. */}
                                    <span className="flex items-center gap-2" title={`${live} of ${milestone.modules.length} live`}>
                                        <span className="hidden gap-1 sm:flex" aria-hidden>
                                            {milestone.modules.slice(0, 8).map((module) => (
                                                <span
                                                    key={module.id}
                                                    className={cn(
                                                        "size-2.5 rounded-full",
                                                        module.isPublished && milestone.isPublished ? "bg-primary" : "border border-muted-foreground/40",
                                                    )}
                                                />
                                            ))}
                                        </span>
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                            {live}/{milestone.modules.length}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

/** The marks so far, in two lines — the Results tab has the rest. */
function Marks({ results, loading, href }: { results?: CourseResults; loading: boolean; href: string }) {
    const assignments = results?.assignments ?? [];
    const quizzes = results?.quizzes ?? [];
    const accepted = assignments.reduce((sum, assignment) => sum + assignment.counts.accepted, 0);
    const handedIn = assignments.reduce((sum, assignment) => sum + assignment.handedIn, 0);
    const average = (values: (number | null)[]) => {
        const known = values.filter((value): value is number => value !== null);
        return known.length ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length) : null;
    };
    const assignmentAverage = average(assignments.map((assignment) => assignment.averagePercent));
    const quizAverage = average(quizzes.map((quiz) => quiz.averagePercent));

    return (
        <section aria-labelledby="marks-title" className={PANEL}>
            <header className="flex items-center justify-between gap-3 px-5 pt-4">
                <h2 id="marks-title" className="text-base font-semibold tracking-tight">
                    Marks
                </h2>
                <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Results <ArrowRight className="size-4" aria-hidden />
                </Link>
            </header>
            {loading ? (
                <div className="space-y-2 p-5">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : (
                <dl className="mt-3 divide-y divide-border border-t border-border">
                    <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                        <dt className="min-w-0 text-sm">
                            <span className="font-medium">Assignments</span>
                            <span className="block text-xs text-muted-foreground">
                                {assignments.length === 0 ? "None yet" : `${accepted} accepted of ${handedIn} handed in`}
                            </span>
                        </dt>
                        <dd className="text-xl font-bold tabular-nums">{assignmentAverage === null ? "—" : `${assignmentAverage}%`}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                        <dt className="min-w-0 text-sm">
                            <span className="font-medium">Quizzes</span>
                            <span className="block text-xs text-muted-foreground">
                                {quizzes.length === 0 ? "None yet" : `${quizzes.reduce((sum, quiz) => sum + quiz.attempts, 0)} attempts across ${plural(quizzes.length, "quiz", "quizzes")}`}
                            </span>
                        </dt>
                        <dd className="text-xl font-bold tabular-nums">{quizAverage === null ? "—" : `${quizAverage}%`}</dd>
                    </div>
                </dl>
            )}
            <p className="border-t border-border px-5 py-2.5 text-[0.6875rem] text-muted-foreground">Averages of accepted work and of each student&apos;s best quiz.</p>
        </section>
    );
}

/** This course's support sessions: the live or next one, and a way to schedule. */
function Support({ courseId, sessions, now }: { courseId: string; sessions: MentorDashboard["upcomingSupport"]; now: number }) {
    const mine = sessions.filter((session) => session.course.id === courseId && new Date(session.endTime).getTime() >= now);
    const next = mine[0];
    const live = next && new Date(next.startTime).getTime() <= now;

    return (
        <section aria-labelledby="support-title" className={PANEL}>
            <header className="flex items-center gap-2 px-5 pt-4">
                <Headphones className="size-4 text-muted-foreground" aria-hidden />
                <h2 id="support-title" className="text-base font-semibold tracking-tight">
                    Support
                </h2>
            </header>
            <div className="px-5 pb-4 pt-2">
                {next ? (
                    <Link href={`/mentor/support/${next.id}`} className="group block rounded-xl border border-border px-4 py-3 transition-colors hover:bg-secondary/40">
                        <span className={cn("text-xs font-semibold uppercase tracking-wider", live ? "text-success" : "text-primary")}>
                            {live ? "Live now" : "Next"}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold">{next.title || "Support session"}</span>
                        <span className="block text-xs text-muted-foreground">
                            {live
                                ? `until ${clock(next.endTime)} · ${next.queueStats?.waiting ?? 0} waiting`
                                : `${dhakaDayKey(next.startTime) === dhakaDayKey(now) ? "Today" : weekdayOf(dhakaDayKey(next.startTime), true)} ${clock(next.startTime)}${mine.length > 1 ? ` · ${mine.length - 1} more after` : ""}`}
                        </span>
                    </Link>
                ) : (
                    <p className="text-sm text-muted-foreground">No sessions scheduled for this course.</p>
                )}
                <Link
                    href={`/mentor/support?new=1&course=${courseId}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                    <CalendarPlus className="size-4" aria-hidden /> Schedule a session
                </Link>
            </div>
        </section>
    );
}
