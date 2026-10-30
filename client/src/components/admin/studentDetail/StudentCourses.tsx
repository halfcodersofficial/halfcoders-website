"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    Award,
    BookOpen,
    Check,
    ChevronDown,
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
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import ProgressRing from "@/components/shared/ProgressRing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDate, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { StudentCourseItem, StudentEnrollment } from "@/types/admin.types";
import { clockLabel, percentLabel, percentTone, weekLabel } from "./format";
import { Marks, MarkedBy, SubmissionDetail } from "./StudentSubmissions";

const LESSON_ICON: Record<string, LucideIcon> = { VIDEO: PlayCircle, TEXT: FileText, RESOURCE: Link2 };

/**
 * One of the student's courses, opened up: where they are, then every week
 * in the order they see it — each module's lessons and quiz, each assignment
 * with its marks and who gave them, each practice day.
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

    if (!enrollment) {
        return (
            <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Not enrolled in any course yet.
            </p>
        );
    }

    return (
        <div className="space-y-5">
            {enrollments.length > 1 && (
                <div role="group" aria-label="Course" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {enrollments.map((row) => {
                        const active = row.courseId === enrollment.courseId;
                        return (
                            <button
                                key={row.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onCourse(row.courseId)}
                                className={cn(
                                    "flex max-w-72 shrink-0 items-center gap-2.5 rounded-card border bg-card py-2 pl-2 pr-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                                )}
                            >
                                <ProgressRing value={row.progress} size={34} stroke={3} />
                                <span className="truncate font-medium">{row.course.title}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <CourseHeader enrollment={enrollment} />
            <CourseWeeks studentId={studentId} enrollment={enrollment} />
        </div>
    );
}

function CourseHeader({ enrollment }: { enrollment: StudentEnrollment }) {
    const { course } = enrollment;
    const now = [
        enrollment.currentMilestone && weekLabel(course.milestoneLabel, enrollment.currentMilestone.order),
        enrollment.currentModule && `${course.moduleLabel} ${enrollment.currentModule.order} — ${enrollment.currentModule.title}`,
    ].filter(Boolean).join(" · ");

    return (
        <section className="rounded-card border border-border bg-card shadow-card">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                <ProgressRing value={enrollment.progress} size={84} stroke={6} fillIn className="self-start sm:self-center">
                    <span className="text-lg">{enrollment.progress}%</span>
                </ProgressRing>

                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold leading-snug">{course.title}</h2>
                        <StatusPill kind="enrollment" value={enrollment.status} />
                        <Badge variant="outline">{course.courseType === "BOOTCAMP" ? "Bootcamp" : "Self-paced"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {enrollment.status === "COMPLETED" && enrollment.completedAt
                            ? `Finished ${formatDate(enrollment.completedAt)}`
                            : now
                                ? <>Now on <span className="font-medium text-foreground">{now}</span></>
                                : "Hasn't started a lesson yet"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Enrolled {formatDate(enrollment.createdAt)}
                        {enrollment.expiresAt && ` · access until ${formatDate(enrollment.expiresAt)}`}
                        {enrollment.lastActivityAt &&
                            ` · last active ${formatDistanceToNow(new Date(enrollment.lastActivityAt), { addSuffix: true })}`}
                    </p>
                </div>

                <Button asChild variant="outline" size="sm" className="self-start">
                    <Link href={`/admin/courses/${course.id}`}>
                        <ExternalLink /> Open course
                    </Link>
                </Button>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-card border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
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
                        ) : "—"
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

function CourseWeeks({ studentId, enrollment }: { studentId: string; enrollment: StudentEnrollment }) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "student", studentId, "course", enrollment.courseId],
        queryFn: () => adminService.studentCourse(studentId, enrollment.courseId),
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-36 rounded-card" />
                ))}
            </div>
        );
    }

    if (isError || !data) {
        return (
            <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {getApiErrorMessage(error, "Couldn't load this course's progress.")}
            </p>
        );
    }

    if (data.weeks.length === 0) {
        return (
            <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nothing in this course has been released yet.
            </p>
        );
    }

    const { milestoneLabel, moduleLabel } = data.enrollment.course;

    return (
        <ol className="space-y-4">
            {data.weeks.map((week) => {
                const done = week.completedAt !== null;
                return (
                    <li
                        key={week.id}
                        className={cn(
                            "overflow-hidden rounded-card border bg-card shadow-card",
                            week.isCurrent ? "border-primary/50" : "border-border",
                        )}
                    >
                        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3">
                            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                                {weekLabel(milestoneLabel, week.order)}
                            </span>
                            <h3 className="min-w-0 flex-1 truncate font-semibold" title={week.title}>
                                {week.title}
                            </h3>
                            {week.isCurrent && <Badge>Current</Badge>}
                            <div className="flex w-full items-center gap-2.5 sm:w-48">
                                <Progress value={week.progress} className="h-1.5" barClassName="bg-brand" />
                                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{week.progress}%</span>
                            </div>
                            {done && (
                                <span className="text-xs text-muted-foreground">Finished {formatDate(week.completedAt as string)}</span>
                            )}
                        </header>

                        {week.items.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-muted-foreground">Nothing released in this {milestoneLabel.toLowerCase()} yet.</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {week.items.map((item) => (
                                    <li key={`${item.kind}-${item.id}`}>
                                        <WeekItem item={item} moduleLabel={moduleLabel} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function WeekItem({ item, moduleLabel }: { item: StudentCourseItem; moduleLabel: string }) {
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
                        {!item.quiz ? (
                            <p className="text-sm text-muted-foreground">This {moduleLabel.toLowerCase()} has no quiz.</p>
                        ) : item.quiz.attempts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Not taken yet.</p>
                        ) : (
                            <ol className="space-y-1.5">
                                {item.quiz.attempts.map((attempt, index) => (
                                    <li key={attempt.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2 text-sm">
                                        <span>
                                            Attempt {index + 1}
                                            <span className="block text-xs text-muted-foreground">
                                                {formatDateTime(attempt.completedAt ?? attempt.startedAt)}
                                            </span>
                                        </span>
                                        {attempt.status === "COMPLETED" ? (
                                            <span className="text-right">
                                                <span className={cn("font-semibold tabular-nums", percentTone(attempt.percentage))}>
                                                    {attempt.percentage}%
                                                </span>
                                                <span className="block text-xs tabular-nums text-muted-foreground">
                                                    {attempt.correctCount}/{attempt.totalQuestions} correct
                                                </span>
                                            </span>
                                        ) : (
                                            <Badge variant="secondary">Unfinished</Badge>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </Expandable>
        );
    }

    if (item.kind === "assignment") {
        const { submission } = item;
        return (
            <Expandable
                icon={ClipboardList}
                state={submission ? (submission.status === "ACCEPTED" ? "done" : "partial") : item.missed ? "missed" : "none"}
                title={item.title}
                subtitle={`Assignment · ${item.totalMarks} marks${item.deadline ? ` · due ${formatDateTime(item.deadline)}` : ""}`}
                aside={
                    submission ? (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <Marks submission={submission} />
                            <StatusPill kind="submission" value={submission.status} />
                            <div className="min-w-44">
                                <MarkedBy submission={submission} />
                            </div>
                        </div>
                    ) : item.missed ? (
                        <p className="text-sm font-medium text-destructive">
                            Missed — closed {formatDateTime(item.closesAt as string)}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Not submitted{item.closesAt ? ` · open until ${formatDateTime(item.closesAt)}` : ""}
                        </p>
                    )
                }
            >
                {submission ? (
                    <SubmissionDetail submission={submission} />
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
