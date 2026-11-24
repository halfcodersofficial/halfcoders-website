"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    Check,
    ChevronRight,
    CornerDownLeft,
    ExternalLink,
    Eye,
    Hand,
    History,
    Megaphone,
    MessageSquareWarning,
    Scale,
    Send,
    Undo2,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { elapsed, pad2 } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { numericField, optionalTextField } from "@/lib/validation";
import { assignmentService } from "@/services";
import type { SubmissionStatus } from "@/types/api.types";
import type { ReviewQueueItem } from "@/types/mentor.types";
import { eventTitle, historyEvents, type HistoryEvent } from "./handInHistory";
import RecheckPanel from "./RecheckPanel";
import SentWork from "./SentWork";

export const STATUS_META: Record<SubmissionStatus, { label: string; tone: string }> = {
    SUBMITTED: { label: "Waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    UNDER_REVIEW: { label: "In review", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    ACCEPTED: { label: "Accepted", tone: "bg-success/10 text-success" },
    NEEDS_REVISION: { label: "Changes asked", tone: "bg-secondary text-secondary-foreground" },
    REJECTED: { label: "Rejected", tone: "bg-destructive/10 text-destructive" },
};

const DECISIONS: { value: SubmissionStatus; label: string; icon: LucideIcon; hint: (published: boolean) => string }[] = [
    {
        value: "ACCEPTED",
        label: "Accept",
        icon: Check,
        hint: (published) => (published ? "Gives the mark — they see it straight away." : "Gives the mark — they see it when you publish the results."),
    },
    { value: "NEEDS_REVISION", label: "Ask for changes", icon: MessageSquareWarning, hint: () => "They can edit and resubmit, free." },
    { value: "REJECTED", label: "Reject", icon: X, hint: () => "Not accepted — they can resubmit, free." },
];

/**
 * Mirrors `reviewSubmissionZodSchema` on the API, including both of its
 * conditional rules: pick "Accept" and the score becomes required (within the
 * late cap); pick either of the others and the feedback does.
 */
const reviewSchema = (maxScore: number, isLate: boolean, hasRubric: boolean) =>
    z
        .object({
            status: z.string().min(1, "Choose what happens to this hand-in"),
            score: optionalTextField({ label: "Score" }),
            feedback: optionalTextField({ label: "Feedback", max: 5000 }),
        })
        .superRefine((data, ctx) => {
            // With a rubric the mark is its lines' sum — checked on the lines themselves.
            if (data.status === "ACCEPTED" && hasRubric) return;
            if (data.status === "ACCEPTED") {
                const result = numericField({ label: "Score", min: 0, max: maxScore }).safeParse(data.score);
                if (!result.success) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["score"],
                        message:
                            data.score === ""
                                ? `Give a score out of ${maxScore} when accepting`
                                : isLate
                                  ? `This came in late, so the most it can score is ${maxScore}`
                                  : result.error.issues[0].message,
                    });
                }
                return;
            }
            // Sending work back without saying why leaves the student with nothing to act on — the API refuses it too.
            if (data.status && !data.feedback) {
                ctx.addIssue({
                    code: "custom",
                    path: ["feedback"],
                    message: data.status === "NEEDS_REVISION" ? "Explain what needs fixing before returning this" : "Explain why this isn't accepted",
                });
            }
        });

/** Full marks, then a few round steps down — never above the cap. */
const quickScores = (max: number) => [...new Set([1, 0.9, 0.8, 0.7, 0.6, 0.5].map((share) => Math.round(max * share)))].filter((value) => value <= max);

/** The save button says what it will do. */
const SAVE_LABEL: Record<string, string> = {
    ACCEPTED: "Accept and save",
    NEEDS_REVISION: "Send back for changes",
    REJECTED: "Reject and save",
};

/** One numbered step of marking: "1 Check their work", "2 Decide", "3 …". */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
    return (
        <section aria-label={title} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[0.6875rem] font-bold text-primary">
                    {n}
                </span>
                {title}
            </h3>
            {children}
        </section>
    );
}

/**
 * One hand-in, ready to mark, top to bottom in the order it's done: who (by
 * name, nothing more) and the assignment it answers; who's marking it; then
 * three numbered steps — check their work, decide, give the mark and
 * feedback — with the save button kept in reach. Ctrl/⌘ + Enter saves.
 */
export default function MarkingPane({
    submission,
    onSaved,
    onClaimChange,
    onDirtyChange,
    compact = false,
}: {
    submission: ReviewQueueItem;
    onSaved: (submission: ReviewQueueItem) => void;
    /** After it's been taken into review, taken over or put back — the queue refreshes. */
    onClaimChange: () => void;
    onDirtyChange: (dirty: boolean) => void;
    compact?: boolean;
}) {
    const now = useNow(60_000);
    const { assignment } = submission;
    const total = assignment.totalMarks;
    // A late hand-in is marked out of its window's marks, fixed when it first came in.
    const isLate = submission.maxScore !== null;
    const maxScore = submission.maxScore ?? total;
    const pending = submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW";
    const wait = elapsed(submission.submittedAt, now);
    const { user } = useSession();
    // In review: by this reviewer, or by a colleague — who then has it until they finish or hand it over.
    const reviewer = submission.status === "UNDER_REVIEW" ? submission.reviewedBy : null;
    const mine = Boolean(reviewer && user && reviewer.id === user.id);
    const colleagues = Boolean(reviewer && !mine);

    const claim = useMutation({
        mutationFn: (action: "claim" | "takeOver" | "release") =>
            action === "release" ? assignmentService.release(submission.id) : assignmentService.claim(submission.id, action === "takeOver"),
        onSuccess: (_, action) => {
            toast.success(action === "release" ? "Put back in the queue." : action === "takeOver" ? "It's yours now." : "You're reviewing this.");
            onClaimChange();
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, "Couldn't do that. Try again."));
            onClaimChange();
        },
    });
    const takeOver = async () => {
        const ok = await confirmAction({
            title: `Take this over from ${reviewer?.name ?? "them"}?`,
            text: "They'll see it's yours when they come back to it.",
            confirmText: "Take it over",
            tone: "default",
        });
        if (ok) claim.mutate("takeOver");
    };

    // The assignment's results: hidden from every student until published, all at once.
    const published = Boolean(assignment.resultsPublishedAt);
    const publish = useMutation({
        mutationFn: () => assignmentService.publishResults(assignment.id),
        onSuccess: (result) => {
            toast.success(
                `Results published — ${result.notified} ${result.notified === 1 ? "student" : "students"} notified.${
                    result.waiting ? ` ${result.waiting} still unmarked will show as soon as they're marked.` : ""
                }`,
            );
            onClaimChange();
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, "Couldn't publish the results."));
            onClaimChange();
        },
    });
    const publishResults = async () => {
        const ok = await confirmAction({
            title: `Publish the results of “${assignment.title}”?`,
            text: "Every marked hand-in's mark and feedback go to its student now. Resubmitting closes for everyone, and rechecks open. This can't be undone.",
            confirmText: "Publish results",
            tone: "default",
        });
        if (ok) publish.mutate();
    };
    const final = submission.score === null ? null : Math.max(0, submission.score + submission.markAdjustment);

    // The rubric's lines, scored one by one — the mark is their sum (scaled to a late window's marks).
    const rubric = assignment.rubric ?? [];
    const [points, setPoints] = useState<Record<string, string>>(() =>
        Object.fromEntries(rubric.map((line) => [line.id, String(submission.rubricScores?.find((score) => score.criterionId === line.id)?.points ?? "")])),
    );
    const [lineNotes, setLineNotes] = useState<Record<string, string>>(() =>
        Object.fromEntries(rubric.map((line) => [line.id, submission.rubricScores?.find((score) => score.criterionId === line.id)?.comment ?? ""])),
    );
    const rubricFilled =
        rubric.length > 0 && rubric.every((line) => points[line.id] !== "" && Number(points[line.id]) >= 0 && Number(points[line.id]) <= line.maxPoints);
    const rubricSum = rubric.reduce((sum, line) => sum + (Number(points[line.id]) || 0), 0);
    const rubricScore = maxScore === total ? rubricSum : Math.round((rubricSum * maxScore) / total);

    const review = useMutation({
        mutationFn: (values: { status: string; score: string; feedback: string }) =>
            assignmentService.review(submission.id, {
                status: values.status as SubmissionStatus,
                score: values.status === "ACCEPTED" && rubric.length === 0 ? Number(values.score) : undefined,
                feedback: values.feedback || undefined,
                rubric: rubricFilled
                    ? rubric.map((line) => ({ criterionId: line.id, points: Number(points[line.id]), comment: lineNotes[line.id]?.trim() || undefined }))
                    : undefined,
            }),
        onSuccess: () => {
            toast.success("Review saved — the student has been notified.");
            onSaved(submission);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your review.")),
    });

    const form = useZodForm({
        schema: useMemo(() => reviewSchema(maxScore, isLate, rubric.length > 0), [maxScore, isLate, rubric.length]),
        initialValues: {
            status: "",
            score: submission.score === null ? "" : String(submission.score),
            feedback: submission.feedback ?? "",
        },
        onSubmit: (values) => {
            if (values.status === "ACCEPTED" && rubric.length > 0 && !rubricFilled) {
                toast.error("Score every line of the rubric — each within its points.");
                return;
            }
            review.mutate(values);
        },
    });

    useEffect(() => onDirtyChange(form.isDirty), [form.isDirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
        // Locked while a colleague has it — the shortcut too.
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !colleagues) {
            event.preventDefault();
            form.submit();
        }
    };

    const decision = form.values.status;

    return (
        <article aria-label={`${submission.student.name}'s hand-in`} className="animate-in fade-in duration-300 motion-reduce:animate-none">
            {/* Who and when, and the assignment it answers. A name, and nothing more: no photo, no contact details, no profile to open. */}
            <header className={cn(!compact && "border-b border-border px-6 py-5")}>
                <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={submission.student.name} size={compact ? 36 : 44} />
                    <div className="min-w-0 flex-1">
                        <h2 className={cn("truncate font-semibold", compact ? "text-base" : "text-lg")}>{submission.student.name}</h2>
                        <p className="text-xs text-muted-foreground">
                            Handed in {formatDateTime(submission.submittedAt)}
                            {pending && <span className={cn(wait.days >= 2 && "font-medium text-amber-700 dark:text-amber-400")}> · waiting {wait.text}</span>}
                            {submission.attempts > 1 && <span> · sent {submission.attempts} times</span>}
                        </p>
                    </div>
                    {submission.recheckOpen ? (
                        <span className="rounded-sm bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Recheck</span>
                    ) : (
                        <span className={cn("rounded-sm px-2.5 py-0.5 text-xs font-semibold", STATUS_META[submission.status].tone)}>
                            {STATUS_META[submission.status].label}
                        </span>
                    )}
                </div>

                <div className="mt-4 rounded-card border border-border bg-secondary/30 px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-semibold">{assignment.title}</span>
                        <span className="text-xs text-muted-foreground">
                            out of {total}
                            {assignment.deadline && ` · due ${formatDateTime(assignment.deadline)}`}
                        </span>
                        {isLate && (
                            <span className="rounded-sm bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Late — at most {maxScore}
                            </span>
                        )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {assignment.course.title} · {assignment.course.milestoneLabel} {pad2(assignment.milestone.order)}
                    </p>
                    {/* The results, for the whole assignment: hidden until published, then out for everyone. */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        {/* A new tab, so the place in the queue isn't lost. */}
                        <Link
                            href={`/mentor/courses/${assignment.course.id}/assignments/${assignment.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                            Read the brief <ExternalLink className="size-3" aria-hidden />
                        </Link>
                        {published ? (
                            <span className="text-muted-foreground">
                                <span className="font-medium text-success">Results published</span> — students see their marks
                            </span>
                        ) : (
                            <>
                                <span className="min-w-0 flex-1 text-muted-foreground">
                                    <span className="font-medium text-foreground">Results not published</span> — students don&apos;t see marks yet
                                </span>
                                <Button type="button" size="sm" variant="brand-outline" onClick={() => void publishResults()} isLoading={publish.isPending}>
                                    {!publish.isPending && <Megaphone />} Publish results
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Who's marking it — first, so two mentors don't mark the same work. */}
                {pending && !submission.recheckOpen && (
                    <div
                        className={cn(
                            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border px-3.5 py-2.5",
                            colleagues ? "border-amber-500/40 bg-amber-500/5" : mine ? "border-primary/30 bg-primary/5" : "border-dashed border-border",
                        )}
                    >
                        {colleagues ? (
                            <Eye className="size-4 shrink-0 text-amber-600" aria-hidden />
                        ) : mine ? (
                            <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
                                <span className="absolute size-2 animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />
                                <span className="size-2 rounded-full bg-primary" />
                            </span>
                        ) : (
                            <Hand className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                            {colleagues ? (
                                <>
                                    <span className="font-semibold text-foreground">{reviewer?.name}</span> is marking this ·{" "}
                                    {elapsed(submission.updatedAt, now).text}
                                </>
                            ) : mine ? (
                                <>
                                    <span className="font-semibold text-foreground">You&apos;re marking this</span> · {elapsed(submission.updatedAt, now).text}
                                </>
                            ) : (
                                "Marking it now? Claim it, so a co-mentor doesn't mark it too."
                            )}
                        </p>
                        {colleagues ? (
                            <Button type="button" size="sm" variant="brand-outline" onClick={() => void takeOver()} isLoading={claim.isPending}>
                                Take over
                            </Button>
                        ) : mine ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => claim.mutate("release")} isLoading={claim.isPending}>
                                {!claim.isPending && <Undo2 />} Put back
                            </Button>
                        ) : (
                            <Button type="button" size="sm" variant="brand-outline" onClick={() => claim.mutate("claim")} isLoading={claim.isPending}>
                                Start marking
                            </Button>
                        )}
                    </div>
                )}
            </header>

            <div className={cn("space-y-5", compact ? "mt-5" : "px-6 py-5")}>
                <Step n={1} title="Check their work">
                    <SentWork content={submission.content} submissionUrl={submission.submissionUrl} fileUrls={submission.fileUrls} />
                </Step>

                {/* The latest marking, with the mark as it stands now — after every penalty and refund, as the student sees it. */}
                {!pending && submission.reviewedAt ? (
                    <section aria-label="The latest review" className="rounded-card border border-dashed border-border px-4 py-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                            Latest review · {formatDateTime(submission.reviewedAt)} —{" "}
                            <span className="font-medium text-foreground">{STATUS_META[submission.status].label}</span>
                        </p>
                        {final !== null && (
                            <p className="mt-1">
                                Mark now{" "}
                                <span className="font-semibold tabular-nums">
                                    {final} / {total}
                                </span>
                                {(submission.markAdjustment !== 0 || submission.xpDeducted > 0) && (
                                    <span className="text-xs text-muted-foreground">
                                        {" "}
                                        · {submission.score} given
                                        {submission.markAdjustment !== 0 &&
                                            `, ${submission.markAdjustment > 0 ? "+" : "−"}${Math.abs(submission.markAdjustment)} for resubmitting and rechecks`}
                                        {submission.xpDeducted > 0 && ` · −${submission.xpDeducted} XP`}
                                    </span>
                                )}
                            </p>
                        )}
                        {submission.feedback && <p className="mt-1.5 whitespace-pre-line text-muted-foreground">“{submission.feedback}”</p>}
                    </section>
                ) : (
                    (submission.markAdjustment !== 0 || submission.xpDeducted > 0) && (
                        <p className="rounded-card bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
                            Taken so far for resubmitting:{" "}
                            <span className="font-semibold tabular-nums text-foreground">
                                {submission.markAdjustment > 0 ? "+" : "−"}
                                {Math.abs(submission.markAdjustment)} marks
                            </span>
                            {submission.xpDeducted > 0 && <span className="tabular-nums"> · −{submission.xpDeducted} XP</span>}
                        </p>
                    )
                )}

                {/* Everything before now — every version, marking and recheck — a click from its full detail. */}
                <HistoryList submission={submission} />
            </div>

            {submission.recheckOpen ? (
                <RecheckPanel submission={submission} onSaved={onSaved} onDirtyChange={onDirtyChange} compact={compact} />
            ) : (
                <form className={cn("border-t border-border", compact && "mt-5")} noValidate onSubmit={form.handleSubmit} onKeyDown={onKeyDown}>
                    {/* Locked while a colleague has it. */}
                    <fieldset
                        disabled={colleagues}
                        className={cn("space-y-6 transition-opacity", compact ? "pt-5" : "px-6 py-5", colleagues && "pointer-events-none opacity-50")}
                    >
                        <Step n={2} title={pending ? "Decide" : "Change the decision"}>
                            <fieldset>
                                <legend className="sr-only">{pending ? "Your decision" : "Change the decision"}</legend>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {DECISIONS.map((option) => {
                                        const selected = decision === option.value;
                                        return (
                                            <label
                                                key={option.value}
                                                className={cn(
                                                    "flex cursor-pointer flex-col gap-1 rounded-card border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                                    selected
                                                        ? option.value === "ACCEPTED"
                                                            ? "border-primary bg-primary/5"
                                                            : option.value === "REJECTED"
                                                              ? "border-destructive/60 bg-destructive/5"
                                                              : "border-amber-500/60 bg-amber-500/5"
                                                        : "border-border hover:bg-secondary/40",
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`decision-${submission.id}`}
                                                    value={option.value}
                                                    checked={selected}
                                                    onChange={() => form.setValue("status", option.value)}
                                                    className="sr-only"
                                                />
                                                <span className="flex items-center gap-2 text-sm font-semibold">
                                                    <option.icon
                                                        className={cn(
                                                            "size-4",
                                                            selected
                                                                ? option.value === "ACCEPTED"
                                                                    ? "text-primary"
                                                                    : option.value === "REJECTED"
                                                                      ? "text-destructive"
                                                                      : "text-amber-600"
                                                                : "text-muted-foreground",
                                                        )}
                                                        aria-hidden
                                                    />
                                                    {option.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{option.hint(published)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {form.errorFor("status") && <p className="mt-1.5 text-xs text-destructive">{form.errorFor("status")}</p>}
                            </fieldset>
                        </Step>

                        {/* The mark and the words — only once there's a decision to go with them. */}
                        {decision && (
                            <Step n={3} title={decision === "ACCEPTED" ? "Give the mark and feedback" : "Tell them why"}>
                                {rubric.length > 0 && (
                                    <fieldset className="overflow-hidden rounded-card border border-border">
                                        <legend className="sr-only">Rubric</legend>
                                        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-3.5 py-2 text-xs">
                                            <span className="font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                                                Rubric
                                                {decision === "ACCEPTED" ? (
                                                    <span className="text-destructive"> *</span>
                                                ) : (
                                                    <span className="font-normal normal-case tracking-normal"> · optional</span>
                                                )}
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {rubricSum} / {total}
                                                {isLate && rubricFilled && (
                                                    <span className="font-normal text-muted-foreground">
                                                        {" "}
                                                        → {rubricScore} / {maxScore} late
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <ul className="divide-y divide-border">
                                            {rubric.map((line) => (
                                                <li key={line.id} className="grid gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem] sm:items-start">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium">{line.title}</p>
                                                        {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                                                        <input
                                                            value={lineNotes[line.id] ?? ""}
                                                            onChange={(event) => setLineNotes((current) => ({ ...current, [line.id]: event.target.value }))}
                                                            placeholder="A note on this line (optional)"
                                                            aria-label={`Note on ${line.title}`}
                                                            maxLength={500}
                                                            className="mt-1.5 w-full rounded-md border border-transparent bg-transparent px-0 py-0.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-border focus:px-2"
                                                        />
                                                    </div>
                                                    <label className="flex items-center gap-1.5 text-sm">
                                                        <Input
                                                            type="number"
                                                            inputMode="numeric"
                                                            min={0}
                                                            max={line.maxPoints}
                                                            value={points[line.id] ?? ""}
                                                            onChange={(event) => setPoints((current) => ({ ...current, [line.id]: event.target.value }))}
                                                            aria-label={`${line.title}, out of ${line.maxPoints}`}
                                                            className={cn(
                                                                "h-9 w-16 text-right tabular-nums",
                                                                Number(points[line.id]) > line.maxPoints && "border-destructive",
                                                            )}
                                                        />
                                                        <span className="text-muted-foreground">/ {line.maxPoints}</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </fieldset>
                                )}

                                {decision === "ACCEPTED" && rubric.length === 0 && (
                                    <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
                                        <FormField
                                            form={form}
                                            name="score"
                                            label="Score"
                                            required
                                            hint={isLate ? `Out of ${total} — at most ${maxScore} (late)` : `Out of ${total}`}
                                        >
                                            <Input type="number" inputMode="numeric" min={0} max={maxScore} autoFocus />
                                        </FormField>
                                        <div className="sm:pt-7">
                                            <p className="sr-only">Quick scores</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {quickScores(maxScore).map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => form.setValue("score", String(value))}
                                                        className={cn(
                                                            "rounded-sm border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                                                            form.values.score === String(value)
                                                                ? "border-primary bg-primary/10 text-primary"
                                                                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                                                        )}
                                                    >
                                                        {value === maxScore ? `${value} · full` : value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <FormField
                                    form={form}
                                    name="feedback"
                                    label="Feedback"
                                    required={decision === "NEEDS_REVISION" || decision === "REJECTED"}
                                    optional={decision === "ACCEPTED"}
                                    counterMax={5000}
                                >
                                    <Textarea
                                        rows={compact ? 3 : 4}
                                        placeholder={
                                            decision === "NEEDS_REVISION"
                                                ? "What to fix, specifically — they'll edit and resubmit…"
                                                : decision === "REJECTED"
                                                  ? "Why this isn't accepted…"
                                                  : "What they did well, and what to try next…"
                                        }
                                    />
                                </FormField>
                            </Step>
                        )}
                    </fieldset>

                    {/* Save, kept in reach at the foot of the pane while the feedback is written. */}
                    <div
                        className={cn(
                            "flex flex-wrap items-center justify-between gap-3 border-t border-border",
                            compact ? "pt-4" : "sticky bottom-0 z-10 bg-card/95 px-6 py-3 backdrop-blur",
                        )}
                    >
                        <p className="text-xs text-muted-foreground">
                            {decision ? (
                                <span className="hidden items-center gap-1 sm:inline-flex">
                                    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.6875rem]">Ctrl</kbd>
                                    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.6875rem]">
                                        <CornerDownLeft className="inline size-3" aria-label="Enter" />
                                    </kbd>
                                    saves and opens the next one
                                </span>
                            ) : (
                                "Choose a decision to save."
                            )}
                        </p>
                        <Button
                            type="submit"
                            isLoading={review.isPending}
                            disabled={!decision || colleagues}
                            variant={decision === "REJECTED" ? "destructive" : "default"}
                        >
                            {!review.isPending && <Send />} {SAVE_LABEL[decision] ?? "Save review"}
                        </Button>
                    </div>
                </form>
            )}
        </article>
    );
}

const HISTORY_ICON: Record<HistoryEvent["kind"], LucideIcon> = {
    version: Send,
    review: Check,
    recheckAsked: Scale,
    recheckDecided: Scale,
};

/**
 * The hand-in's history in brief, newest first: every version sent, every
 * marking and recheck. Each opens the history page at that point, in full.
 */
function HistoryList({ submission }: { submission: ReviewQueueItem }) {
    // Under `["reviews"]`, so saving a review here refreshes it too.
    const { data, isLoading } = useQuery({
        queryKey: ["reviews", "history", submission.id],
        queryFn: () => assignmentService.submissionHistory(submission.id),
    });
    const events = data ? historyEvents(data) : [];
    const href = `/mentor/reviews/${submission.id}`;
    const shown = events.slice(0, 6);

    return (
        <section aria-labelledby={`history-${submission.id}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <h3 id={`history-${submission.id}`} className="flex items-center gap-2 text-sm font-semibold">
                    <History className="size-4 text-primary" aria-hidden /> History
                </h3>
                {events.length > 0 && (
                    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        See it all <ArrowRight className="size-3" aria-hidden />
                    </Link>
                )}
            </div>
            {isLoading ? (
                <Skeleton className="h-24 rounded-card" />
            ) : events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
            ) : (
                <ol className="divide-y divide-border overflow-hidden rounded-card border border-border">
                    {shown.map((event) => {
                        const Icon = HISTORY_ICON[event.kind];
                        return (
                            <li key={event.id}>
                                <Link
                                    href={`${href}#${event.id}`}
                                    className="group flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-secondary/40"
                                >
                                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="min-w-0 flex-1 truncate">{eventTitle(event, submission.assignment.totalMarks)}</span>
                                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(event.at)}</span>
                                    <ChevronRight
                                        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                        aria-hidden
                                    />
                                </Link>
                            </li>
                        );
                    })}
                    {events.length > shown.length && (
                        <li>
                            <Link href={href} className="block px-3.5 py-2 text-center text-xs font-medium text-primary hover:bg-secondary/40">
                                {events.length - shown.length} more — see the full history
                            </Link>
                        </li>
                    )}
                </ol>
            )}
        </section>
    );
}
