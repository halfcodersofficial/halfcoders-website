"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ClipboardList, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { CourseWeekList } from "@/components/admin/studentDetail/StudentCourses";
import { marksLabel, percentLabel, percentTone, weekLabel } from "@/components/admin/studentDetail/format";
import ProgressRing from "@/components/shared/ProgressRing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { enrollmentService } from "@/services";
import type { StudentCourseItem, StudentCourseQuiz } from "@/types/admin.types";
import type { CourseStudentRecord as StudentRecord } from "@/types/mentor.types";

/** Below this best score, a quiz reads as one they struggled with. */
const WEAK_QUIZ = 50;

const SUBMISSION_STATE: Partial<{ [status: string]: { label: string; tone: string } }> = {
    SUBMITTED: { label: "Waiting for marks", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    UNDER_REVIEW: { label: "Being marked", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    ACCEPTED: { label: "Marked", tone: "bg-success/10 text-success" },
    NEEDS_REVISION: { label: "Changes asked", tone: "bg-secondary text-secondary-foreground" },
    REJECTED: { label: "Rejected", tone: "bg-destructive/10 text-destructive" },
};

/**
 * One student's whole record on a course, for its mentor: where they are and
 * how far they've got, every quiz (taken or not, and how it went), every
 * assignment (handed in or not, and its marks), then the course week by week
 * — each lesson, quiz attempt, submission and practice day. The name and
 * photo, never contact details.
 */
export default function CourseStudentRecord({ courseId, studentId }: { courseId: string; studentId: string }) {
    const routes = staffCourseRoutes("mentor", courseId);
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["staff", "students", courseId, "record", studentId],
        queryFn: () => enrollmentService.courseStudent(courseId, studentId),
    });

    const back = (
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href={routes.students}>
                <ArrowLeft /> All students
            </Link>
        </Button>
    );

    if (isLoading) {
        return (
            <div className="w-full space-y-6">
                {back}
                <Skeleton className="h-44 rounded-card" />
                <Skeleton className="h-64 rounded-card" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="w-full space-y-6">
                {back}
                <div className="py-16 text-center">
                    <p className="font-medium">Couldn&apos;t open this student.</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again in a moment.")}</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {back}
            <Summary record={data} />
            <Quizzes record={data} />
            <Assignments record={data} />
            <section aria-labelledby="weeks-title" className="space-y-3">
                <h3 id="weeks-title" className="text-lg font-semibold">
                    {data.course.milestoneLabel} by {data.course.milestoneLabel.toLowerCase()}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">open any row for its detail</span>
                </h3>
                <CourseWeekList weeks={data.weeks} course={data.course} courseHref={null} />
            </section>
        </div>
    );
}

type Placed<T> = T & { where: string };

/** Everything in the record, counted and listed in course order. */
function tally(record: StudentRecord) {
    const { milestoneLabel, moduleLabel } = record.course;
    const items = record.weeks.flatMap((week) => week.items.map((item) => ({ item, week: weekLabel(milestoneLabel, week.order) })));
    const modules = items.filter((entry): entry is { item: Extract<StudentCourseItem, { kind: "module" }>; week: string } => entry.item.kind === "module");
    const assignments = items.filter(
        (entry): entry is { item: Extract<StudentCourseItem, { kind: "assignment" }>; week: string } => entry.item.kind === "assignment",
    );
    const practice = items.filter((entry) => entry.item.kind === "practice");

    const quizzes: Placed<StudentCourseQuiz>[] = items.flatMap(({ item, week }) =>
        item.kind !== "practice" && item.quiz
            ? [{ ...item.quiz, where: `${week} · ${item.kind === "module" ? `${moduleLabel} ${String(item.order).padStart(2, "0")}` : item.title}` }]
            : [],
    );
    const taken = quizzes.filter((quiz) => quiz.bestPercent !== null);
    const marks = assignments.flatMap(({ item }) => (item.submission?.percent != null ? [item.submission.percent] : []));
    const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

    return {
        lessons: {
            done: modules.reduce((sum, { item }) => sum + item.completedLessons, 0),
            total: modules.reduce((sum, { item }) => sum + item.lessons.length, 0),
        },
        modules: {
            done: modules.filter(({ item }) => item.completedAt !== null || (item.lessons.length > 0 && item.completedLessons === item.lessons.length)).length,
            total: modules.length,
        },
        assignments: {
            list: assignments,
            handedIn: assignments.filter(({ item }) => item.submission).length,
            waiting: assignments.filter(({ item }) => item.submission && ["SUBMITTED", "UNDER_REVIEW"].includes(item.submission.status)).length,
            missed: assignments.filter(({ item }) => item.missed).length,
            average: mean(marks),
        },
        quizzes: {
            list: quizzes,
            taken: taken.length,
            weak: taken.filter((quiz) => (quiz.bestPercent ?? 0) < WEAK_QUIZ).length,
            average: mean(taken.map((quiz) => quiz.bestPercent ?? 0)),
        },
        practice: {
            done: practice.filter(({ item }) => item.kind === "practice" && item.completion).length,
            total: practice.length,
        },
    };
}

function Summary({ record }: { record: StudentRecord }) {
    const counts = tally(record);
    const { milestoneLabel, moduleLabel } = record.course;
    const now =
        record.status === "COMPLETED"
            ? `Finished the course${record.completedAt ? ` on ${formatDate(record.completedAt)}` : ""}`
            : record.currentMilestone
              ? [
                    weekLabel(milestoneLabel, record.currentMilestone.order),
                    record.currentModule && `${moduleLabel} ${String(record.currentModule.order).padStart(2, "0")} — ${record.currentModule.title}`,
                ]
                    .filter(Boolean)
                    .join(" · ")
              : null;

    return (
        <section className="overflow-hidden rounded-card border border-border bg-card shadow-card animate-in fade-in duration-500 motion-reduce:animate-none">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
                <Avatar src={record.student.image} name={record.student.name} size={64} />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{record.student.name}</h2>
                        <StatusPill kind="enrollment" value={record.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {now ? (
                            <>
                                Now on <span className="font-medium text-foreground">{now}</span>
                            </>
                        ) : (
                            "Hasn't started a lesson yet"
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Joined {formatDate(record.createdAt)}
                        {record.lastActivityAt && ` · last active ${formatDistanceToNow(new Date(record.lastActivityAt), { addSuffix: true })}`}
                        {record.expiresAt && ` · access until ${formatDate(record.expiresAt)}`}
                    </p>
                </div>
                <ProgressRing value={record.progress} size={84} stroke={6} fillIn className="self-start sm:self-center">
                    <span className="text-lg">{Math.round(record.progress)}%</span>
                </ProgressRing>
            </div>

            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
                <Cell label="Lessons" value={`${counts.lessons.done} / ${counts.lessons.total}`} />
                <Cell label={`${moduleLabel}s done`} value={`${counts.modules.done} / ${counts.modules.total}`} />
                <Cell
                    label="Assignments"
                    value={`${counts.assignments.handedIn} / ${counts.assignments.list.length}`}
                    hint={[
                        counts.assignments.average !== null && `${percentLabel(counts.assignments.average)} avg. marks`,
                        counts.assignments.waiting > 0 && `${counts.assignments.waiting} waiting`,
                        counts.assignments.missed > 0 && `${counts.assignments.missed} missed`,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                />
                <Cell
                    label="Quizzes"
                    value={`${counts.quizzes.taken} / ${counts.quizzes.list.length}`}
                    hint={[
                        counts.quizzes.average !== null && `${percentLabel(counts.quizzes.average)} avg. best`,
                        counts.quizzes.weak > 0 && `${counts.quizzes.weak} below ${WEAK_QUIZ}%`,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                />
                <Cell label="Practice days" value={`${counts.practice.done} / ${counts.practice.total}`} />
                <Cell label="XP earned" value={record.xp.toLocaleString()} />
            </dl>
        </section>
    );
}

function Cell({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <div className="min-w-0 bg-card px-4 py-3">
            <dt className="text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-1 truncate text-base font-semibold tabular-nums">{value}</dd>
            {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

/** A titled list with its count. */
function Panel({ id, icon: Icon, title, aside, children }: { id: string; icon: typeof ListChecks; title: string; aside: ReactNode; children: ReactNode }) {
    return (
        <section aria-labelledby={id} className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-3">
                <Icon className="size-4 text-primary" aria-hidden />
                <h3 id={id} className="font-semibold">
                    {title}
                </h3>
                <span className="ml-auto text-xs text-muted-foreground">{aside}</span>
            </header>
            {children}
        </section>
    );
}

/** Every quiz in the course, in order: taken or not, the best score and how many they got right. */
function Quizzes({ record }: { record: StudentRecord }) {
    const { quizzes } = tally(record);
    if (quizzes.list.length === 0) return null;

    return (
        <Panel
            id="quizzes-title"
            icon={ListChecks}
            title="Quizzes"
            aside={`${quizzes.taken} of ${quizzes.list.length} taken${quizzes.weak ? ` · ${quizzes.weak} below ${WEAK_QUIZ}%` : ""}`}
        >
            <ul className="divide-y divide-border">
                {quizzes.list.map((quiz) => {
                    const completed = quiz.attempts.filter((attempt) => attempt.status === "COMPLETED");
                    const best = completed.reduce<(typeof completed)[number] | null>(
                        (top, attempt) => (!top || attempt.percentage > top.percentage ? attempt : top),
                        null,
                    );
                    const state =
                        quiz.bestPercent === null
                            ? { label: "Not taken", tone: "bg-secondary text-muted-foreground" }
                            : quiz.bestPercent >= 80
                              ? { label: "Did well", tone: "bg-success/10 text-success" }
                              : quiz.bestPercent >= WEAK_QUIZ
                                ? { label: "Okay", tone: "bg-primary/10 text-primary" }
                                : { label: "Struggled", tone: "bg-destructive/10 text-destructive" };
                    return (
                        <li key={quiz.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                            <div className="min-w-0 flex-1 basis-56">
                                <p className="truncate text-sm font-medium">{quiz.title}</p>
                                <p className="truncate text-xs text-muted-foreground">{quiz.where}</p>
                            </div>
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {best ? (
                                    <>
                                        <span className={cn("text-sm font-semibold", percentTone(best.percentage))}>{best.percentage}%</span> ·{" "}
                                        {best.correctCount}/{best.totalQuestions} right
                                        {quiz.attempts.length > 1 && ` · ${quiz.attempts.length} tries`}
                                    </>
                                ) : quiz.attempts.length > 0 ? (
                                    "Started, not finished"
                                ) : (
                                    `${quiz.questions} questions`
                                )}
                            </p>
                            <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", state.tone)}>{state.label}</span>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

/** Every assignment in the course, in order: handed in or not, and how it was marked. */
function Assignments({ record }: { record: StudentRecord }) {
    const { assignments } = tally(record);
    if (assignments.list.length === 0) return null;

    return (
        <Panel id="assignments-title" icon={ClipboardList} title="Assignments" aside={`${assignments.handedIn} of ${assignments.list.length} handed in`}>
            <ul className="divide-y divide-border">
                {assignments.list.map(({ item, week }) => {
                    const { submission } = item;
                    const state = submission
                        ? (SUBMISSION_STATE[submission.status] ?? { label: submission.status, tone: "bg-secondary" })
                        : item.missed
                          ? { label: "Missed", tone: "bg-destructive/10 text-destructive" }
                          : { label: "Not handed in", tone: "bg-secondary text-muted-foreground" };
                    return (
                        <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                            <div className="min-w-0 flex-1 basis-56">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {week}
                                    {submission
                                        ? ` · handed in ${formatDateTime(submission.submittedAt)}`
                                        : item.missed
                                          ? " · the batch ended"
                                          : item.deadline
                                            ? ` · due ${formatDateTime(item.deadline)}`
                                            : ""}
                                </p>
                            </div>
                            {submission?.score !== null && submission?.score !== undefined && (
                                <p className="text-xs tabular-nums text-muted-foreground">
                                    <span className="text-sm font-semibold text-foreground">{marksLabel(submission)}</span>
                                    <span className={cn("ml-1.5", percentTone(submission.percent))}>{percentLabel(submission.percent)}</span>
                                </p>
                            )}
                            <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", state.tone)}>{state.label}</span>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}
