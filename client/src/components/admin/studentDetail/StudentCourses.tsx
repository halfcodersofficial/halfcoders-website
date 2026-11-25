"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    Award,
    BookOpen,
    Check,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    CircleDashed,
    ClipboardList,
    Dumbbell,
    ExternalLink,
    FileText,
    Link2,
    ListChecks,
    PlayCircle,
    Receipt,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import ProgressRing from "@/components/shared/ProgressRing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDate, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { StudentCourseBreakdown, StudentCourseItem, StudentCourseQuiz, StudentEnrollment } from "@/types/admin.types";
import { CoursePicker } from "./CoursePicker";
import { clockLabel, percentLabel, percentTone, weekLabel } from "./format";
import { QuizAttemptReview } from "./QuizAttemptReview";
import { Marks, MarkedBy, SubmissionDetail } from "./StudentSubmissions";

const LESSON_ICON: Record<string, LucideIcon> = { VIDEO: PlayCircle, TEXT: FileText, RESOURCE: Link2 };

type Week = StudentCourseBreakdown["weeks"][number];

/** "Now on Week 03 · Module 2", or how it ended. */
const whereNow = (enrollment: StudentEnrollment) => {
    const { course } = enrollment;
    if (enrollment.status === "COMPLETED") return enrollment.completedAt ? `Finished ${formatDate(enrollment.completedAt)}` : "Finished";
    const now = [
        enrollment.currentMilestone && weekLabel(course.milestoneLabel, enrollment.currentMilestone.order),
        enrollment.currentModule && `${course.moduleLabel} ${enrollment.currentModule.order}`,
    ]
        .filter(Boolean)
        .join(" · ");
    return now ? `Now on ${now}` : "Hasn't started yet";
};

/**
 * One of the student's courses, opened up: a card per course to choose from,
 * where they are and their figures, a strip of the weeks to jump between,
 * then every week in the order they see it — each module's lessons and quiz
 * (a quiz attempt opens their answers), each assignment with its marks and
 * who gave them, each practice day.
 */
export function StudentCourses({
    studentId,
    enrollments,
    courseId,
    onCourse,
}: {
    studentId: string;
    enrollments: StudentEnrollment[];
    courseId: string;
    onCourse: (courseId: string) => void;
}) {
    const enrollment = enrollments.find((row) => row.courseId === courseId) ?? enrollments[0];
    const [review, setReview] = useState<{ attemptId: string; title: string } | null>(null);
    const [openWeeks, setOpenWeeks] = useState<{ courseId: string; ids: Set<string> } | null>(null);

    const breakdown = useQuery({
        queryKey: ["admin", "student", studentId, "course", enrollment?.courseId],
        queryFn: () => adminService.studentCourse(studentId, enrollment!.courseId),
        enabled: Boolean(enrollment),
    });

    if (!enrollment) {
        return (
            <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Not enrolled in any course yet.
            </p>
        );
    }

    const weeks = breakdown.data?.weeks ?? [];
    // Open weeks belong to the course they were opened in; a new course starts from its defaults.
    const open = openWeeks?.courseId === enrollment.courseId ? openWeeks.ids : defaultOpenWeeks(weeks);
    const setOpen = (ids: Set<string>) => setOpenWeeks({ courseId: enrollment.courseId, ids });

    const jumpTo = (weekId: string) => {
        setOpen(new Set([...open, weekId]));
        window.requestAnimationFrame(() => document.getElementById(`week-${weekId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    return (
        <div className="space-y-5">
            <CoursePicker
                items={enrollments.map((row) => ({
                    id: row.courseId,
                    title: row.course.title,
                    thumbnail: row.course.thumbnail,
                    progress: row.progress,
                    hint: whereNow(row),
                }))}
                value={enrollment.courseId}
                onChange={onCourse}
            />

            <CourseHeader enrollment={enrollment} weeks={weeks} loading={breakdown.isLoading} onWeek={jumpTo} />

            {breakdown.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 rounded-card" />
                    ))}
                </div>
            ) : breakdown.isError || !breakdown.data ? (
                <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {getApiErrorMessage(breakdown.error, "Couldn't load this course's progress.")}
                </p>
            ) : (
                <CourseWeekList
                    weeks={weeks}
                    course={breakdown.data.enrollment.course}
                    open={open}
                    onOpenChange={setOpen}
                    onOpenQuizAttempt={(attemptId, title) => setReview({ attemptId, title })}
                />
            )}

            <QuizAttemptReview attemptId={review?.attemptId ?? null} title={review?.title} onClose={() => setReview(null)} />
        </div>
    );
}

function CourseHeader({
    enrollment,
    weeks,
    loading,
    onWeek,
}: {
    enrollment: StudentEnrollment;
    weeks: Week[];
    loading: boolean;
    onWeek: (weekId: string) => void;
}) {
    const { course } = enrollment;
    const weeksDone = weeks.filter((week) => week.completedAt !== null).length;

    return (
        <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                <div className="relative self-start sm:self-center">
                    <span className="relative grid aspect-video w-36 place-items-center overflow-hidden rounded-md bg-secondary">
                        <SafeImage
                            src={course.thumbnail}
                            alt=""
                            fill
                            sizes="144px"
                            className="object-cover"
                            fallback={<BookOpen className="size-6 text-muted-foreground" />}
                        />
                    </span>
                    <span className="absolute -bottom-3 -right-3 rounded-full bg-card p-0.5 shadow-card">
                        <ProgressRing value={enrollment.progress} size={48} stroke={4} fillIn>
                            <span className="text-[0.625rem]">{enrollment.progress}%</span>
                        </ProgressRing>
                    </span>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold leading-snug">{course.title}</h2>
                        <StatusPill kind="enrollment" value={enrollment.status} />
                        <Badge variant="outline">{course.courseType === "BOOTCAMP" ? "Bootcamp" : "Self-paced"}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{whereNow(enrollment)}</p>
                    <p className="text-xs text-muted-foreground">
                        Enrolled {formatDate(enrollment.createdAt)}
                        {enrollment.expiresAt && ` · access until ${formatDate(enrollment.expiresAt)}`}
                        {enrollment.lastActivityAt && ` · last active ${formatDistanceToNow(new Date(enrollment.lastActivityAt), { addSuffix: true })}`}
                    </p>
                </div>

                <Button asChild variant="outline" size="sm" className="self-start">
                    <Link href={`/admin/courses/${course.id}`}>
                        <ExternalLink /> Open course
                    </Link>
                </Button>
            </div>

            {/* The weeks at a glance: a block each, filled as far as they've got. */}
            <div className="border-t border-border px-5 py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">{course.milestoneLabel}s</span>
                    {!loading && weeks.length > 0 && (
                        <span className="text-muted-foreground">
                            {weeksDone} of {weeks.length} finished · click one to jump to it
                        </span>
                    )}
                </div>
                {loading ? (
                    <Skeleton className="h-9" />
                ) : weeks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing released yet.</p>
                ) : (
                    <ol className="flex gap-1">
                        {weeks.map((week) => (
                            <li key={week.id} className="min-w-0 flex-1">
                                <button
                                    type="button"
                                    onClick={() => onWeek(week.id)}
                                    title={`${weekLabel(course.milestoneLabel, week.order)} — ${week.title}: ${week.progress}%`}
                                    className={cn(
                                        "group block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "relative block h-2.5 overflow-hidden rounded-sm bg-secondary transition-transform group-hover:-translate-y-px",
                                            week.isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                                        )}
                                    >
                                        <span
                                            className={cn("absolute inset-y-0 left-0", week.progress >= 100 ? "bg-success" : "bg-brand")}
                                            style={{ width: `${Math.min(100, week.progress)}%` }}
                                        />
                                    </span>
                                    <span
                                        className={cn(
                                            "mt-1 block truncate text-center font-mono text-[10px] tabular-nums",
                                            week.isCurrent ? "font-semibold text-primary-ink" : "text-muted-foreground",
                                        )}
                                    >
                                        {String(week.order).padStart(2, "0")}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
                <Cell label="Lessons" value={`${enrollment.lessons.completed} / ${enrollment.lessons.total}`} />
                <Cell
                    label="Assignments"
                    value={`${enrollment.assignments.submitted} / ${enrollment.assignments.total}`}
                    hint={
                        enrollment.assignments.averagePercent !== null
                            ? `${percentLabel(enrollment.assignments.averagePercent)} avg. marks`
                            : enrollment.assignments.missed > 0
                              ? `${enrollment.assignments.missed} missed`
                              : undefined
                    }
                />
                <Cell
                    label="Quizzes"
                    value={`${enrollment.quizzes.taken} / ${enrollment.quizzes.total}`}
                    hint={enrollment.quizzes.averagePercent !== null ? `${percentLabel(enrollment.quizzes.averagePercent)} avg. best` : undefined}
                />
                <Cell label="Practice days" value={`${enrollment.practice.completed} / ${enrollment.practice.total}`} />
                <Cell label="XP earned" value={enrollment.xp.toLocaleString()} />
                <Cell
                    label="Certificate"
                    value={
                        enrollment.certificate ? (
                            <span className="flex items-center gap-1.5">
                                <Award className="size-4 text-primary" aria-hidden />
                                <span className="truncate font-mono text-sm">{enrollment.certificate.certificateNo}</span>
                            </span>
                        ) : (
                            "—"
                        )
                    }
                    hint={enrollment.certificate?.status === "REVOKED" ? "Revoked" : undefined}
                />
            </dl>

            {enrollment.order && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                    <Receipt className="size-3.5" aria-hidden />
                    Order <span className="font-mono text-foreground">{enrollment.order.orderNumber}</span>·
                    <span className="tabular-nums text-foreground">{formatBDT(enrollment.order.total)}</span>
                    <StatusPill kind="order" value={enrollment.order.status} />
                </p>
            )}
        </section>
    );
}

function Cell({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <div className="min-w-0 bg-card px-4 py-3">
            <dt className="text-[11px] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-1 truncate text-base font-semibold tabular-nums">{value}</dd>
            {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

/** Which weeks start open: where they are now and any half-done; failing those, the first unfinished one. */
const defaultOpenWeeks = (weeks: Week[]) => {
    const open = weeks.filter((week) => week.isCurrent || (week.progress > 0 && week.progress < 100)).map((week) => week.id);
    if (open.length === 0) {
        const next = weeks.find((week) => week.progress < 100);
        if (next) open.push(next.id);
    }
    return new Set(open);
};

/** A week's items, tallied: how many of each kind there are and how many are done. */
const tallyWeek = (items: StudentCourseItem[]) => {
    const count = (kind: StudentCourseItem["kind"], done: (item: StudentCourseItem) => boolean) => {
        const ofKind = items.filter((item) => item.kind === kind);
        return { total: ofKind.length, done: ofKind.filter(done).length };
    };
    const quizzes = items.map((item) => (item.kind === "practice" ? null : item.quiz)).filter((quiz): quiz is StudentCourseQuiz => quiz !== null);
    return {
        modules: count("module", (item) => item.kind === "module" && item.lessons.length > 0 && item.completedLessons === item.lessons.length),
        assignments: count("assignment", (item) => item.kind === "assignment" && item.submission !== null),
        practice: count("practice", (item) => item.kind === "practice" && item.completion !== null),
        quizzes: { total: quizzes.length, done: quizzes.filter((quiz) => quiz.bestPercent !== null).length },
        missed: items.filter((item) => item.kind === "assignment" && item.missed).length,
    };
};

/**
 * A student's course week by week, in the order they see it — each module's
 * lessons and quiz, each assignment (its quiz, marks, feedback and who gave
 * them), each practice day. Each week folds: its header tallies what's done,
 * and the week they're on starts open. Shared by the admin's student page and
 * the mentor's student record; `courseHref` is where a submission's course
 * links to (null: no link — the reader is already on that course).
 *
 * Which weeks are open can be held by the caller (`open`, `onOpenChange`) —
 * the admin page opens one from its week strip — or left to the list.
 * `onOpenQuizAttempt` makes each quiz attempt open its answers.
 */
export function CourseWeekList({
    weeks,
    course,
    courseHref,
    open: controlledOpen,
    onOpenChange,
    onOpenQuizAttempt,
}: {
    weeks: StudentCourseBreakdown["weeks"];
    course: { milestoneLabel: string; moduleLabel: string };
    courseHref?: string | null;
    open?: Set<string>;
    onOpenChange?: (open: Set<string>) => void;
    onOpenQuizAttempt?: (attemptId: string, title: string) => void;
}) {
    const [ownOpen, setOwnOpen] = useState<Set<string> | null>(null);
    const open = controlledOpen ?? ownOpen ?? defaultOpenWeeks(weeks);
    const setOpen = onOpenChange ?? setOwnOpen;

    if (weeks.length === 0) {
        return (
            <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nothing in this course has been released yet.
            </p>
        );
    }

    const { milestoneLabel, moduleLabel } = course;
    const allOpen = weeks.every((week) => open.has(week.id));
    const toggle = (id: string) => {
        const next = new Set(open);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOpen(next);
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(weeks.map((week) => week.id)))}>
                    {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
                    {allOpen ? `Fold every ${milestoneLabel.toLowerCase()}` : `Open every ${milestoneLabel.toLowerCase()}`}
                </Button>
            </div>

            <ol className="space-y-3">
                {weeks.map((week) => {
                    const done = week.completedAt !== null;
                    const isOpen = open.has(week.id);
                    const tally = tallyWeek(week.items);
                    const chips = [
                        tally.modules.total > 0 && `${moduleLabel}s ${tally.modules.done}/${tally.modules.total}`,
                        tally.quizzes.total > 0 && `Quizzes ${tally.quizzes.done}/${tally.quizzes.total}`,
                        tally.assignments.total > 0 && `Assignments ${tally.assignments.done}/${tally.assignments.total}`,
                        tally.practice.total > 0 && `Practice ${tally.practice.done}/${tally.practice.total}`,
                    ].filter((chip): chip is string => Boolean(chip));

                    return (
                        <li
                            key={week.id}
                            id={`week-${week.id}`}
                            className={cn(
                                "scroll-mt-4 overflow-hidden rounded-card border bg-card shadow-card",
                                week.isCurrent ? "border-primary/50" : "border-border",
                            )}
                        >
                            <h3>
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    aria-controls={`week-body-${week.id}`}
                                    onClick={() => toggle(week.id)}
                                    className={cn(
                                        "flex w-full flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                        isOpen && "border-b border-border",
                                    )}
                                >
                                    <StateMark state={done ? "done" : week.progress > 0 ? "partial" : tally.missed > 0 ? "missed" : "none"} />
                                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                                        {weekLabel(milestoneLabel, week.order)}
                                    </span>
                                    <span className="min-w-0 flex-1 basis-40">
                                        <span className="block truncate font-semibold" title={week.title}>
                                            {week.title}
                                        </span>
                                        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                                            {chips.map((chip) => (
                                                <span key={chip}>{chip}</span>
                                            ))}
                                            {tally.missed > 0 && <span className="text-destructive">{tally.missed} missed</span>}
                                        </span>
                                    </span>
                                    {week.isCurrent && <Badge>They&apos;re here</Badge>}
                                    <span className="flex w-full items-center gap-2.5 sm:w-44">
                                        <Progress value={week.progress} className="h-1.5" barClassName={done ? "bg-success" : "bg-brand"} />
                                        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{week.progress}%</span>
                                    </span>
                                    {done && (
                                        <span className="hidden text-xs text-muted-foreground lg:inline">Finished {formatDate(week.completedAt as string)}</span>
                                    )}
                                    <ChevronDown
                                        className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform sm:ml-0", isOpen && "rotate-180")}
                                        aria-hidden
                                    />
                                </button>
                            </h3>

                            {isOpen && (
                                <div id={`week-body-${week.id}`}>
                                    {week.items.length === 0 ? (
                                        <p className="px-4 py-4 text-sm text-muted-foreground">Nothing released in this {milestoneLabel.toLowerCase()} yet.</p>
                                    ) : (
                                        <ul className="divide-y divide-border">
                                            {week.items.map((item) => (
                                                <li key={`${item.kind}-${item.id}`}>
                                                    <WeekItem item={item} moduleLabel={moduleLabel} courseHref={courseHref} onOpenQuizAttempt={onOpenQuizAttempt} />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

function WeekItem({
    item,
    moduleLabel,
    courseHref,
    onOpenQuizAttempt,
}: {
    item: StudentCourseItem;
    moduleLabel: string;
    courseHref?: string | null;
    onOpenQuizAttempt?: (attemptId: string, title: string) => void;
}) {
    if (item.kind === "module") {
        const done = item.lessons.length > 0 && item.completedLessons === item.lessons.length;
        return (
            <Expandable
                icon={BookOpen}
                state={done ? "done" : item.completedLessons > 0 ? "partial" : "none"}
                title={item.title}
                subtitle={`${moduleLabel} ${item.order}${item.isCurrent ? " · where they are now" : ""}`}
                aside={
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-2">
                            <Progress
                                value={item.lessons.length ? (item.completedLessons / item.lessons.length) * 100 : 0}
                                className="h-1.5 w-16"
                                barClassName="bg-brand"
                            />
                            <span className="tabular-nums text-muted-foreground">
                                {item.completedLessons}/{item.lessons.length} lessons
                            </span>
                        </span>
                        {item.quiz && (
                            <span className="flex items-center gap-1">
                                <ListChecks className="size-3.5 text-muted-foreground" aria-hidden />
                                <span className="text-muted-foreground">Quiz</span>
                                <span className={cn("font-semibold tabular-nums", percentTone(item.quiz.bestPercent))}>
                                    {item.quiz.bestPercent === null ? "not taken" : percentLabel(item.quiz.bestPercent)}
                                </span>
                            </span>
                        )}
                    </div>
                }
            >
                <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <p className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">Lessons</p>
                        {item.lessons.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No lessons released.</p>
                        ) : (
                            <ol className="space-y-1.5">
                                {item.lessons.map((lesson) => {
                                    const Icon = LESSON_ICON[lesson.type] ?? PlayCircle;
                                    return (
                                        <li key={lesson.id} className="flex items-start gap-2.5 text-sm">
                                            <StateMark state={lesson.completed ? "done" : lesson.watchedSeconds > 0 ? "partial" : "none"} small />
                                            <div className="min-w-0 flex-1">
                                                <p className={cn("flex items-center gap-1.5", !lesson.completed && "text-muted-foreground")}>
                                                    <Icon className="size-3.5 shrink-0" aria-hidden />
                                                    <span className="truncate">{lesson.title}</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {lesson.completedAt
                                                        ? `Completed ${formatDateTime(lesson.completedAt)}`
                                                        : lesson.watchedSeconds > 0
                                                            ? `Watched to ${clockLabel(lesson.watchedSeconds)}${lesson.duration ? ` of ${clockLabel(lesson.duration)}` : ""}`
                                                            : "Not opened"}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                            {item.quiz ? `Quiz · ${item.quiz.questions} questions` : "Quiz"}
                        </p>
                        {item.quiz ? (
                            <QuizAttempts quiz={item.quiz} onOpen={onOpenQuizAttempt} />
                        ) : (
                            <p className="text-sm text-muted-foreground">This {moduleLabel.toLowerCase()} has no quiz.</p>
                        )}
                    </div>
                </div>
            </Expandable>
        );
    }

    if (item.kind === "assignment") {
        const { submission, quiz } = item;
        return (
            <Expandable
                icon={ClipboardList}
                state={submission ? (submission.status === "ACCEPTED" ? "done" : "partial") : item.missed ? "missed" : "none"}
                title={item.title}
                subtitle={`Assignment · ${item.totalMarks} marks${item.deadline ? ` · due ${formatDateTime(item.deadline)}` : ""}`}
                aside={
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {quiz && (
                            <span className="flex items-center gap-1 text-xs">
                                <ListChecks className="size-3.5 text-muted-foreground" aria-hidden />
                                <span className="text-muted-foreground">Quiz</span>
                                <span className={cn("font-semibold tabular-nums", percentTone(quiz.bestPercent))}>
                                    {quiz.bestPercent === null ? "not taken" : percentLabel(quiz.bestPercent)}
                                </span>
                            </span>
                        )}
                        {submission ? (
                            <>
                                <Marks submission={submission} />
                                <StatusPill kind="submission" value={submission.status} />
                                <div className="min-w-44">
                                    <MarkedBy submission={submission} />
                                </div>
                            </>
                        ) : item.missed ? (
                            <p className="text-sm font-medium text-destructive">Missed — the batch ended</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not submitted · open until the batch ends</p>
                        )}
                    </div>
                }
            >
                {quiz && (
                    <div className="border-b border-border px-4 py-4">
                        <p className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                            Quiz · {quiz.questions} questions
                        </p>
                        <QuizAttempts quiz={quiz} onOpen={onOpenQuizAttempt} />
                    </div>
                )}
                {submission ? (
                    <SubmissionDetail submission={submission} courseHref={courseHref} />
                ) : (
                    <p className="px-4 py-4 text-sm text-muted-foreground">Nothing handed in for this assignment.</p>
                )}
            </Expandable>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <StateMark state={item.completion ? "done" : "none"} />
            <Dumbbell className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                    Practice day{item.completion?.note ? ` · “${item.completion.note}”` : ""}
                </p>
            </div>
            <p className={cn("w-full pl-17 text-sm sm:w-auto sm:pl-0", !item.completion && "text-muted-foreground")}>
                {item.completion ? `Done ${formatDateTime(item.completion.completedAt)}` : "Not done"}
            </p>
        </div>
    );
}

/** Every attempt at a quiz, with its score and how many were right. With `onOpen`, a finished one opens their answers. */
function QuizAttempts({ quiz, onOpen }: { quiz: StudentCourseQuiz; onOpen?: (attemptId: string, title: string) => void }) {
    if (quiz.attempts.length === 0) return <p className="text-sm text-muted-foreground">Not taken yet.</p>;
    return (
        <ol className="space-y-1.5">
            {quiz.attempts.map((attempt, index) => {
                const finished = attempt.status === "COMPLETED";
                const body = (
                    <>
                        <span>
                            {quiz.attempts.length > 1 ? `Attempt ${index + 1}` : "Their attempt"}
                            <span className="block text-xs text-muted-foreground">{formatDateTime(attempt.completedAt ?? attempt.startedAt)}</span>
                        </span>
                        {finished ? (
                            <span className="flex items-center gap-3 text-right">
                                <span>
                                    <span className={cn("font-semibold tabular-nums", percentTone(attempt.percentage))}>{attempt.percentage}%</span>
                                    <span className="block text-xs tabular-nums text-muted-foreground">
                                        {attempt.correctCount}/{attempt.totalQuestions} right
                                    </span>
                                </span>
                                {onOpen && <span className="text-xs font-medium text-primary-ink group-hover:underline">See answers</span>}
                            </span>
                        ) : (
                            <Badge variant="secondary">Unfinished</Badge>
                        )}
                    </>
                );
                return (
                    <li key={attempt.id}>
                        {onOpen && finished ? (
                            <button
                                type="button"
                                onClick={() => onOpen(attempt.id, quiz.title)}
                                className="group flex w-full items-center justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {body}
                            </button>
                        ) : (
                            <div className="flex items-center justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2 text-sm">{body}</div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

type ItemState = "done" | "partial" | "none" | "missed";

/** A tick when finished, a half-ring when started, an empty dashed ring before, a cross when missed. */
function StateMark({ state, small = false }: { state: ItemState; small?: boolean }) {
    const size = small ? "size-4" : "size-5";
    const label = { done: "Done", partial: "Started", none: "Not started", missed: "Missed" }[state];

    if (state === "done") {
        return (
            <span className={cn("grid shrink-0 place-items-center rounded-full bg-brand text-white", size)} title={label}>
                <Check className={small ? "size-2.5" : "size-3"} strokeWidth={3} aria-hidden />
                <span className="sr-only">{label}</span>
            </span>
        );
    }
    if (state === "partial") {
        return (
            <span
                className={cn("shrink-0 rounded-full border-2 border-primary border-r-transparent border-b-transparent", size)}
                title={label}
            >
                <span className="sr-only">{label}</span>
            </span>
        );
    }
    if (state === "missed") {
        return (
            <span className={cn("shrink-0 rounded-full border-2 border-destructive/70", size)} title={label}>
                <span className="sr-only">{label}</span>
            </span>
        );
    }
    return (
        <CircleDashed className={cn("shrink-0 text-muted-foreground/60", size)} aria-label={label} />
    );
}

/** A week item that opens for its detail. */
function Expandable({
    icon: Icon,
    state,
    title,
    subtitle,
    aside,
    children,
}: {
    icon: LucideIcon;
    state: ItemState;
    title: string;
    subtitle: string;
    aside: ReactNode;
    children: ReactNode;
}) {
    return (
        <details className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <StateMark state={state} />
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium" title={title}>{title}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="w-full pl-17 sm:w-auto sm:pl-0">{aside}</div>
                <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 sm:ml-0" aria-hidden />
            </summary>
            <div className="border-t border-border bg-secondary/20">{children}</div>
        </details>
    );
}
