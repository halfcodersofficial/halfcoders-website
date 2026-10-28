"use client";

import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    Award,
    BookOpen,
    BookOpenText,
    CalendarCheck2,
    CheckCircle2,
    ClipboardCheck,
    Flame,
    Headphones,
    Link2,
    ListTree,
    Play,
    Video,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AdmissionTicketButton } from "@/components/shared/AdmissionTicket";
import ProgressRing from "@/components/shared/ProgressRing";
import RoleGuard from "@/components/shared/RoleGuard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENT_ROLES } from "@/lib/access";
import { cn, formatDate } from "@/lib/utils";
import { dashboardService } from "@/services";
import { liveClassService } from "@/services/conceptual";
import type { Enrollment, LessonType, StudentDashboard, UpNextPlan } from "@/types/domain.types";

const COURSE_FILTERS = [
    { value: "", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "COMPLETED", label: "Completed" },
];

const pickOne = <T,>(pool: T[]): T => pool[Math.floor(Math.random() * pool.length)];

/**
 * What shows under the name when there's no course to resume. A streak in
 * progress gets called out by name — everything else rotates through a small
 * pool so it doesn't read as the same canned line every single visit.
 */
const NEXT_COURSE_PROMPT_POOL = [
    "Ready to start your next course?",
    "What do you want to learn today?",
    "Your next course is just a click away.",
    "Let's pick up something new today.",
];

const nextCoursePromptFor = (streakDays: number, fallback: string) =>
    streakDays > 0 ? `Keep your ${streakDays}-day streak going — start a new course!` : fallback;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Page-load rise, staggered with `delay-*`; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/** Only students have a learning home. The surrounding layout applies the same rule. */
export default function StudentDashboardPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <StudentDashboardView />
        </RoleGuard>
    );
}

function StudentDashboardView() {
    const [courseFilter, setCourseFilter] = useState("");
    // Picked once per visit, so the line doesn't re-roll on every refetch.
    const [nextCoursePromptPick] = useState(() => pickOne(NEXT_COURSE_PROMPT_POOL));

    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", "student"],
        queryFn: dashboardService.student,
    });

    if (isLoading || !data) {
        return (
            <div className="container-page space-y-8 py-8 sm:py-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-8">
                        <Skeleton className="h-64 rounded-panel" />
                        <Skeleton className="h-72 rounded-card" />
                    </div>
                    <Skeleton className="h-96 rounded-card" />
                </div>
            </div>
        );
    }

    const { continueLearning, enrollments } = data;

    // Streaks are per course (Bootcamp and Traditional earn them under
    // different rules), so there's no single number: the course being
    // resumed shows its own, else whichever course's streak is longest.
    const bestStreak = Math.max(0, ...enrollments.map((e) => e.streak?.currentStreakDays ?? 0));
    const streakEnrollment =
        enrollments.find((e) => e.id === continueLearning?.id && e.streak) ??
        [...enrollments].sort((a, b) => (b.streak?.currentStreakDays ?? 0) - (a.streak?.currentStreakDays ?? 0))[0];

    const filteredEnrollments = courseFilter
        ? enrollments.filter((enrollment) => enrollment.status === courseFilter)
        : enrollments;

    return (
        <div className="container-page space-y-8 py-8 sm:py-10">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My learning</h1>
                {bestStreak > 0 && (
                    <p className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-sm">
                        <Flame className="size-4 text-syn-number" aria-hidden />
                        <span className="font-semibold">{bestStreak}-day</span> streak
                    </p>
                )}
            </header>

            {/* Up next and the courses on the left, the week beside them —
                on a phone: up next, the week, then the courses. */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
                <div className={cn(RISE, "min-w-0 lg:col-start-1 lg:row-start-1")}>
                    {continueLearning ? (
                        <UpNext enrollment={continueLearning} />
                    ) : (
                        <NothingToResume
                            hasCourses={enrollments.length > 0}
                            prompt={nextCoursePromptFor(bestStreak, nextCoursePromptPick)}
                        />
                    )}
                </div>

                <aside className={cn(RISE, "delay-100 space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start")}>
                    {streakEnrollment?.streak && streakEnrollment.streak.history.length > 0 && (
                        <StreakWeek enrollment={streakEnrollment} />
                    )}
                    <ComingUp data={data} />
                </aside>

                {enrollments.length > 0 && (
                    <section className={cn(RISE, "delay-200 min-w-0 lg:col-start-1 lg:row-start-2")}>
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
                                <span aria-hidden className="h-5 w-1 rounded-full bg-primary" />
                                My courses
                                <span className="text-base font-normal text-muted-foreground">({enrollments.length})</span>
                            </h2>

                            <div role="group" aria-label="Filter courses" className="flex border-b border-border">
                                {COURSE_FILTERS.map((filter) => {
                                    const isActive = courseFilter === filter.value;
                                    return (
                                        <button
                                            key={filter.value || "all"}
                                            type="button"
                                            aria-pressed={isActive}
                                            onClick={() => setCourseFilter(filter.value)}
                                            className={cn(
                                                "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors",
                                                isActive
                                                    ? "border-primary text-foreground"
                                                    : "border-transparent text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {filter.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {filteredEnrollments.length === 0 ? (
                            <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                                No {courseFilter.toLowerCase()} courses.
                            </p>
                        ) : (
                            <div className="grid gap-5 sm:grid-cols-2">
                                {filteredEnrollments.map((enrollment) => (
                                    <CourseTile key={enrollment.id} enrollment={enrollment} />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

/** "Week 01 · Programming fundamentals", in the course's own words for its milestones and modules. */
const whereAt = (enrollment: Enrollment) => {
    const parts: string[] = [];
    if (enrollment.currentMilestone) {
        parts.push(
            `${enrollment.course.milestoneLabel ?? "Milestone"} ${pad2(enrollment.currentMilestone.order)} · ${enrollment.currentMilestone.title}`,
        );
    }
    if (enrollment.currentModule) {
        parts.push(`${enrollment.course.moduleLabel ?? "Module"} ${pad2(enrollment.currentModule.order)} · ${enrollment.currentModule.title}`);
    }
    return parts;
};

/** "12 min", "1 h 5 min" — never "0 min" for a lesson that has a length at all. */
const minutesLabel = (seconds: number) => {
    const total = Math.max(1, Math.round(seconds / 60));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

const LESSON_KIND: Record<LessonType, { label: string; verb: string; icon: typeof Play }> = {
    VIDEO: { label: "Video", verb: "Play", icon: Play },
    TEXT: { label: "Reading", verb: "Read", icon: BookOpenText },
    RESOURCE: { label: "Resource", verb: "Open", icon: Link2 },
};

/**
 * The course to go back to, on the same dark stage as the player's play
 * cover: the thumbnail glowing behind, the very lesson the player will open,
 * and a play button ringed by how much of that lesson is already watched.
 * The play button's link covers the whole stage, so anywhere on it goes in.
 * Underneath, the course as a route of its milestones, filled as far as the
 * student has come.
 */
function UpNext({ enrollment }: { enrollment: Enrollment & { upNext?: UpNextPlan } }) {
    const href = `/learn/${enrollment.course.slug}`;
    const plan = enrollment.upNext;
    const lesson = plan?.nextLesson ?? null;
    const started = enrollment.progress > 0 || (plan?.completedLessons ?? 0) > 0;
    const place = whereAt(enrollment);

    const kind = lesson ? LESSON_KIND[lesson.type] : null;
    const timed = Boolean(lesson && lesson.type === "VIDEO" && lesson.duration > 0);
    const watched = lesson && timed ? Math.min(lesson.watchedSeconds, lesson.duration) : 0;
    // A few seconds in is an accidental click, not somewhere to resume from.
    const midLesson = Boolean(lesson) && watched >= 10;

    const verb = midLesson ? "Resume" : (kind?.verb ?? (started ? "Resume" : "Start"));
    const KindIcon = kind?.icon;

    // What's left of a half-watched video; its full length is in the meta line.
    const left = lesson && midLesson ? `${minutesLabel(lesson.duration - watched)} left` : null;

    // With a lesson to open, the ring is that lesson; without one, the course.
    const ringValue = lesson ? (midLesson ? (watched / lesson.duration) * 100 : 0) : enrollment.progress;

    let eyebrow = started ? "Pick up where you left off" : "Ready when you are";
    if (lesson && !midLesson) eyebrow = started ? "Up next" : "Your first lesson";

    return (
        <section className="editor group/stage relative isolate overflow-hidden rounded-panel border border-editor-line shadow-panel">
            <SafeImage
                src={enrollment.course.thumbnail}
                alt=""
                fill
                sizes="900px"
                className="-z-10 scale-125 object-cover opacity-50 blur-3xl saturate-150 transition-opacity duration-500 group-hover/stage:opacity-65"
                fallback={null}
            />
            <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-editor via-editor/90 to-editor/50" />
            <p className="flex items-center justify-between gap-3 border-b border-editor-line bg-editor-panel/80 px-5 py-2 text-xs font-semibold text-editor-muted">
                <span>Continue learning</span>
                <span className="text-syn-string">{enrollment.progress}% complete</span>
            </p>

            <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:grid-cols-[12rem_1fr_auto]">
                <div className="relative hidden aspect-video overflow-hidden rounded-md bg-white/5 shadow-2xl ring-1 ring-white/10 lg:block">
                    <SafeImage
                        src={enrollment.course.thumbnail}
                        alt=""
                        fill
                        sizes="192px"
                        className="object-cover transition-transform duration-500 group-hover/stage:scale-105"
                        fallback={<BookOpen className="size-7 text-white/50" />}
                    />
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-syn-func">{eyebrow}</p>

                    {lesson ? (
                        <>
                            <h2 className="mt-2 line-clamp-2 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                                {lesson.title}
                            </h2>
                            <p className="mt-2 truncate text-sm font-medium text-white/75">{enrollment.course.title}</p>
                            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
                                {KindIcon && (
                                    <span className="inline-flex items-center gap-1.5 font-medium text-white/80">
                                        <KindIcon className="size-3.5 text-syn-func" aria-hidden />
                                        <span className="tabular-nums">
                                            {kind?.label}
                                            {lesson.duration > 0 && ` · ${minutesLabel(lesson.duration)}`}
                                        </span>
                                    </span>
                                )}
                                <span aria-hidden className="size-1 rounded-full bg-white/25" />
                                <span className="tabular-nums">
                                    {enrollment.course.moduleLabel ?? "Module"} {pad2(lesson.module.order)} · {lesson.module.title}
                                </span>
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                                {enrollment.course.title}
                            </h2>
                            {place.length > 0 && (
                                <ul className="mt-3 space-y-1 text-sm text-white/70">
                                    {place.map((line) => (
                                        <li key={line} className="flex items-center gap-2">
                                            <span aria-hidden className="size-1.5 shrink-0 rounded-[1px] bg-syn-func" />
                                            <span className="truncate">{line}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                <Link
                    href={href}
                    aria-label={`${verb} ${lesson ? `“${lesson.title}”, ${enrollment.course.title}` : enrollment.course.title}`}
                    className="group flex items-center gap-4 justify-self-start rounded-full outline-none after:absolute after:inset-0 after:rounded-panel after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-violet-400/80 md:flex-col md:gap-2 md:justify-self-center"
                >
                    <ProgressRing
                        value={ringValue}
                        size={132}
                        stroke={6}
                        fillIn
                        trackClassName="stroke-white/10"
                        className="max-md:-m-4 max-md:scale-75"
                    >
                        <span className="grid size-24 place-items-center rounded-full bg-primary shadow-[0_12px_40px_-8px_rgb(116_50_240/0.8)] transition-transform duration-300 group-hover:scale-105">
                            {lesson && lesson.type !== "VIDEO" && KindIcon ? (
                                <KindIcon className="size-9 text-white" aria-hidden />
                            ) : (
                                <svg viewBox="0 0 24 24" className="ml-1 size-9 fill-white" aria-hidden>
                                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                                </svg>
                            )}
                        </span>
                    </ProgressRing>
                    <span className="text-sm font-semibold md:text-xs">
                        {lesson ? verb : `${enrollment.progress}% complete`}
                        {left && <span className="font-medium tabular-nums text-white/60"> · {left}</span>}
                    </span>
                </Link>
            </div>

            {plan && plan.totalLessons > 0 && plan.milestones.length > 0 && (
                <CourseRoute
                    plan={plan}
                    milestoneLabel={enrollment.course.milestoneLabel ?? "Milestone"}
                    progress={enrollment.progress}
                />
            )}
        </section>
    );
}

/**
 * The course as a row of its milestones, each filled by the share of its
 * lessons done, with a marker where the next lesson sits. Pointer-transparent,
 * so the stage's link still takes the click.
 */
function CourseRoute({ plan, milestoneLabel, progress }: { plan: UpNextPlan; milestoneLabel: string; progress: number }) {
    const currentId = plan.nextLesson?.milestone.id;
    const current = plan.milestones.find((m) => m.id === currentId);

    return (
        <div className="pointer-events-none border-t border-white/10 px-6 pb-6 pt-5 sm:px-8">
            <div className="flex items-baseline justify-between gap-4 text-xs">
                <p className="min-w-0 truncate text-white/55">
                    {current ? (
                        <>
                            <span className="font-semibold text-white/90">
                                {milestoneLabel} {pad2(current.order)}
                            </span>{" "}
                            of {pad2(plan.milestones.length)} · {current.title}
                        </>
                    ) : (
                        `${pad2(plan.milestones.length)} ${milestoneLabel.toLowerCase()}s`
                    )}
                </p>
                <p className="shrink-0 tabular-nums text-white/55">
                    <span className="font-semibold text-white/90">{plan.completedLessons}</span>/{plan.totalLessons} lessons
                    <span className="mx-1.5 text-white/25">·</span>
                    {progress}%
                </p>
            </div>

            <ol className="mt-3 flex gap-1" aria-label={`${plan.completedLessons} of ${plan.totalLessons} lessons done`}>
                {plan.milestones.map((milestone, index) => {
                    const share = milestone.totalLessons ? milestone.completedLessons / milestone.totalLessons : 0;
                    const isCurrent = milestone.id === currentId;
                    return (
                        <li key={milestone.id} className="relative h-1.5 flex-1 rounded-full bg-white/10">
                            {share > 0 && (
                                <span
                                    className="up-next-fill absolute inset-y-0 left-0 rounded-full bg-syn-string"
                                    style={{ width: `${share * 100}%`, animationDelay: `${300 + index * 70}ms` }}
                                />
                            )}
                            {isCurrent && (
                                <span
                                    aria-hidden
                                    className="up-next-marker absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                                    style={{ left: `${share * 100}%`, animationDelay: `${450 + index * 70}ms` }}
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

function NothingToResume({ hasCourses, prompt }: { hasCourses: boolean; prompt: string }) {
    return (
        <section className="editor relative isolate overflow-hidden rounded-panel border border-editor-line p-6 shadow-panel sm:p-10">
            <span aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
            <p className="text-xs font-semibold uppercase tracking-wider text-syn-func">{hasCourses ? "All caught up" : "Start learning"}</p>
            <h2 className="mt-2 max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {hasCourses ? "You've finished every course you're enrolled in." : "Your first course is waiting."}
            </h2>
            <p className="mt-2 text-editor-muted">{prompt}</p>
            <Button asChild size="lg" variant="brand" className="mt-6 px-7">
                <Link href="/courses">
                    Browse courses <ArrowRight />
                </Link>
            </Button>
        </section>
    );
}

/**
 * The last seven streak days of one course as a row of cells — lit with a
 * flame where the student was active. Traditional courses count calendar
 * days; bootcamps count module releases, so their cells are dated.
 */
function StreakWeek({ enrollment }: { enrollment: Enrollment }) {
    const streak = enrollment.streak!;
    const days = streak.currentStreakDays;
    const isBootcamp = streak.courseType === "BOOTCAMP";

    return (
        <section className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-muted-foreground">Streak</p>
                    <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold tracking-tight">
                        <Flame className={cn("size-5", days > 0 ? "text-syn-number" : "text-muted-foreground/50")} />
                        {days}
                        <span className="text-base font-normal text-muted-foreground">{days === 1 ? "day" : "days"}</span>
                    </p>
                </div>
                <Link href="/dashboard/streak" className="text-xs font-semibold text-primary hover:underline">
                    Calendar
                </Link>
            </div>

            <ol className="mt-4 grid grid-cols-7 gap-1.5">
                {streak.history.slice(-7).map((day) => {
                    const date = new Date(day.date);
                    return (
                        <li key={day.date} className="flex flex-col items-center gap-1.5">
                            <span
                                title={`${formatDate(date)} — ${day.isActive ? "active" : "missed"}`}
                                className={cn(
                                    "grid aspect-square w-full place-items-center rounded-sm",
                                    day.isActive ? "bg-syn-number text-white" : "border border-dashed border-border bg-secondary/50",
                                )}
                            >
                                {day.isActive && <Flame className="size-4" aria-hidden />}
                            </span>
                            <span className="text-[0.625rem] font-medium uppercase text-muted-foreground">
                                {isBootcamp
                                    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                    : date.toLocaleDateString("en-GB", { weekday: "narrow" })}
                            </span>
                        </li>
                    );
                })}
            </ol>

            <p className="mt-3 truncate text-xs text-muted-foreground">
                {isBootcamp ? "Last module releases" : "Last 7 days"} · {enrollment.course.title}
            </p>
        </section>
    );
}

type AgendaItem = {
    key: string;
    at: Date;
    kind: "session" | "assignment" | "class";
    title: string;
    courseTitle: string;
    href: string;
    isLive?: boolean;
    detail: ReactNode;
};

const dayLabel = (date: Date) => {
    const today = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((startOf(date) - startOf(today)) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

const timeOf = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

/**
 * What's ahead, as one agenda: support sessions, live classes and assignment
 * deadlines together, by day. Whatever's on now leads, with its Join button.
 */
function ComingUp({ data }: { data: StudentDashboard }) {
    const liveClasses = useQuery({ queryKey: ["learning", "live-classes", "mine"], queryFn: liveClassService.mine });
    const items: AgendaItem[] = [
        ...(liveClasses.data ?? []).map((liveClass): AgendaItem => ({
            key: `class:${liveClass.id}`,
            at: new Date(liveClass.startsAt),
            kind: "class",
            title: liveClass.title,
            courseTitle: liveClass.course?.title ?? "",
            href: `/learn/${liveClass.course?.slug}/conceptual`,
            isLive: liveClass.isLive,
            detail: `Live class · ${liveClass.durationMinutes} min${liveClass.topic ? ` · ${liveClass.topic.title}` : ""}`,
        })),
        ...data.upcomingSupport.map((session): AgendaItem => ({
            key: `session:${session.id}`,
            at: new Date(session.startTime),
            kind: "session",
            title: session.title ?? "Support session",
            courseTitle: session.course.title,
            href: `/learn/${session.course.slug}/support`,
            isLive: session.isLive,
            detail: (
                <span className="inline-flex items-center gap-1.5">
                    <Avatar src={session.mentor.image} name={session.mentor.name} size={16} />
                    {session.mentor.name}
                </span>
            ),
        })),
        ...data.upcomingAssignments
            .filter((assignment) => assignment.deadline)
            .map((assignment): AgendaItem => ({
                key: `assignment:${assignment.id}`,
                at: new Date(assignment.deadline!),
                kind: "assignment",
                title: assignment.title,
                courseTitle: assignment.course.title,
                href: `/learn/${assignment.course.slug}?assignment=${assignment.id}`,
                detail: `${assignment.totalMarks} marks`,
            })),
    ].sort((a, b) => Number(Boolean(b.isLive)) - Number(Boolean(a.isLive)) || a.at.getTime() - b.at.getTime());

    const groups: { label: string; items: AgendaItem[] }[] = [];
    for (const item of items) {
        const label = item.isLive ? "Now" : dayLabel(item.at);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(item);
        else groups.push({ label, items: [item] });
    }

    return (
        <section className="rounded-card border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="font-semibold">Coming up</h2>
                <span className="text-xs text-muted-foreground">Sessions, classes & deadlines</span>
            </div>

            {groups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <span className="grid size-11 place-items-center rounded-md border border-success/30 bg-success/5 text-success">
                        <CalendarCheck2 className="size-5" />
                    </span>
                    <p className="font-medium">You&apos;re all caught up</p>
                    <p className="text-sm text-muted-foreground">No sessions, classes or deadlines ahead right now.</p>
                </div>
            ) : (
                <div className="space-y-5 px-5 py-4">
                    {groups.map((group) => (
                        <div key={group.label}>
                            <p
                                className={cn(
                                    "mb-2 text-xs font-semibold uppercase tracking-[0.12em]",
                                    group.label === "Now" ? "text-success" : "text-muted-foreground",
                                )}
                            >
                                {group.label}
                            </p>
                            <ul className="space-y-2">
                                {group.items.map((item) => (
                                    <li key={item.key}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "group flex items-start gap-3 rounded-md border p-3 transition-colors",
                                                item.isLive
                                                    ? "border-success/30 bg-success/5 hover:bg-success/10"
                                                    : "border-transparent hover:border-border hover:bg-secondary/50",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "relative grid size-9 shrink-0 place-items-center rounded-md",
                                                    item.isLive
                                                        ? "bg-success text-white"
                                                        : item.kind === "assignment"
                                                            ? "bg-syn-number/10 text-syn-number"
                                                            : "bg-primary/10 text-primary",
                                                )}
                                            >
                                                {item.isLive && (
                                                    <span className="absolute inset-0 animate-ping rounded-md bg-success opacity-40 motion-reduce:animate-none" />
                                                )}
                                                {item.kind === "session" ? (
                                                    <Headphones className="relative size-4" />
                                                ) : item.kind === "class" ? (
                                                    <Video className="relative size-4" />
                                                ) : (
                                                    <ClipboardCheck className="relative size-4" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline justify-between gap-2">
                                                    <span className="truncate text-sm font-semibold">{item.title}</span>
                                                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                                                        {item.isLive ? (
                                                            <span className="font-semibold text-success">Join now</span>
                                                        ) : item.kind === "assignment" ? (
                                                            `Due ${timeOf(item.at)}`
                                                        ) : (
                                                            timeOf(item.at)
                                                        )}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {item.courseTitle}
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/** One enrolled course: its thumbnail framed with a progress ring, where the student is, and the way back in. */
function CourseTile({ enrollment }: { enrollment: Enrollment }) {
    const href = `/learn/${enrollment.course.slug}`;
    const isCompleted = enrollment.status === "COMPLETED";
    const streakDays = enrollment.streak?.currentStreakDays ?? 0;
    const place = whereAt(enrollment)[0];

    return (
        <article className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-card-hover">
            <Link href={href} tabIndex={-1} aria-hidden className="relative aspect-video overflow-hidden bg-secondary">
                <SafeImage
                    src={enrollment.course.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 420px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    fallback={<BookOpen className="size-8 text-muted-foreground" />}
                />
                {/* Dark glass, so it reads over any thumbnail, and always labelled —
                    an empty ring alone looked like a blank disc. */}
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-2 rounded-sm bg-editor/85 py-1 pl-1 pr-2.5 text-xs font-semibold text-editor-fg shadow-lg">
                    {isCompleted ? (
                        <span className="grid size-7 place-items-center rounded-full bg-success">
                            <CheckCircle2 className="size-4" />
                        </span>
                    ) : (
                        <ProgressRing value={enrollment.progress} size={28} stroke={3} fillIn trackClassName="stroke-white/25">
                            <span aria-hidden />
                        </ProgressRing>
                    )}
                    <span className="tabular-nums">
                        {isCompleted ? "Done" : enrollment.progress > 0 ? `${enrollment.progress}%` : "Not started"}
                    </span>
                </span>
                {streakDays > 0 && (
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-sm bg-background/90 px-2 py-0.5 text-xs font-semibold">
                        <Flame className="size-3.5 text-syn-number" />
                        {streakDays}-day streak
                    </span>
                )}
            </Link>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                <p className="truncate text-xs font-medium text-muted-foreground">
                    {isCompleted && enrollment.completedAt
                        ? `Completed ${formatDate(enrollment.completedAt)}`
                        : place ?? `Enrolled ${formatDate(enrollment.startedAt)}`}
                </p>
                <h3 className="mt-1.5 line-clamp-2 font-bold leading-snug tracking-tight">
                    <Link href={href} className="transition-colors hover:text-primary">
                        {enrollment.course.title}
                    </Link>
                </h3>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <Button asChild size="sm" className="px-4">
                        <Link href={href}>
                            {isCompleted ? "Review course" : enrollment.progress > 0 ? "Continue" : "Start course"}
                        </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <Link href={`${href}/outline`}>
                            <ListTree /> Outline
                        </Link>
                    </Button>
                    {enrollment.hasAdmissionTicket && <AdmissionTicketButton courseId={enrollment.courseId} />}
                    {enrollment.certificate && (
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/certificate/${enrollment.certificate.certificateNo}`}>
                                <Award /> Certificate
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}
