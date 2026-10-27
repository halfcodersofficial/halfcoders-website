"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, CornerDownLeft, ExternalLink, Eye, FileText, Github, Hand, Link2, MessageSquareWarning, Send, Undo2, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { elapsed, pad2 } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { privateFileHref } from "@/lib/privateFile";
import { cn, formatDateTime } from "@/lib/utils";
import { submissionFileName } from "@/lib/submissionFiles";
import { numericField, optionalTextField } from "@/lib/validation";
import { assignmentService } from "@/services";
import type { SubmissionStatus } from "@/types/api.types";
import type { ReviewQueueItem } from "@/types/mentor.types";

export const STATUS_META: Record<SubmissionStatus, { label: string; tone: string }> = {
    SUBMITTED: { label: "Waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    UNDER_REVIEW: { label: "In review", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    ACCEPTED: { label: "Accepted", tone: "bg-success/10 text-success" },
    NEEDS_REVISION: { label: "Changes asked", tone: "bg-secondary text-secondary-foreground" },
    REJECTED: { label: "Rejected", tone: "bg-destructive/10 text-destructive" },
};

const DECISIONS: { value: SubmissionStatus; label: string; icon: LucideIcon; hint: (week: string) => string }[] = [
    { value: "ACCEPTED", label: "Accept", icon: Check, hint: (week) => `Awards the score and the ${week}'s XP.` },
    { value: "NEEDS_REVISION", label: "Ask for changes", icon: MessageSquareWarning, hint: () => "They can edit and resubmit." },
    { value: "REJECTED", label: "Reject", icon: X, hint: () => "Closes the submission." },
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


/**
 * One hand-in, ready to mark: who (by name, nothing more), the brief it
 * answers, their work — link, notes, files — any earlier review, and the
 * decision with its score and feedback. Ctrl/⌘ + Enter saves.
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

    // The rubric's lines, scored one by one — the mark is their sum (scaled to a late window's marks).
    const rubric = assignment.rubric ?? [];
    const [points, setPoints] = useState<Record<string, string>>(() =>
        Object.fromEntries(rubric.map((line) => [line.id, String(submission.rubricScores?.find((score) => score.criterionId === line.id)?.points ?? "")])),
    );
    const [lineNotes, setLineNotes] = useState<Record<string, string>>(() =>
        Object.fromEntries(rubric.map((line) => [line.id, submission.rubricScores?.find((score) => score.criterionId === line.id)?.comment ?? ""])),
    );
    const rubricFilled = rubric.length > 0 && rubric.every((line) => points[line.id] !== "" && Number(points[line.id]) >= 0 && Number(points[line.id]) <= line.maxPoints);
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
            {/* Who and when. A name, and nothing more: no photo, no contact details, no profile to open. */}
            <header className={cn("flex flex-wrap items-center gap-3", !compact && "border-b border-border px-6 py-5")}>
                <Avatar name={submission.student.name} size={compact ? 36 : 44} />
                <div className="min-w-0 flex-1">
                    <h2 className={cn("truncate font-semibold", compact ? "text-base" : "text-lg")}>{submission.student.name}</h2>
                    <p className="text-xs text-muted-foreground">
                        Handed in {formatDateTime(submission.submittedAt)}
                        {pending && (
                            <span className={cn(wait.days >= 2 && "font-medium text-amber-700 dark:text-amber-400")}> · waiting {wait.text}</span>
                        )}
                    </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_META[submission.status].tone)}>{STATUS_META[submission.status].label}</span>
            </header>

            <div className={cn("space-y-5", compact ? "mt-4" : "px-6 py-5")}>
                {/* The brief it answers. */}
                <section aria-label="The assignment" className="rounded-xl border border-border bg-secondary/30 p-4">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        {assignment.course.title} · {assignment.course.milestoneLabel} {pad2(assignment.milestone.order)}
                    </p>
                    <p className="mt-1 font-semibold">{assignment.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Out of {total}</span>
                        {assignment.deadline && <span>Due {formatDateTime(assignment.deadline)}</span>}
                        {isLate && (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">Late — at most {maxScore}</span>
                        )}
                        <Link href={`/mentor/courses/${assignment.course.id}/assignments/${assignment.id}`} className="font-medium text-primary hover:underline">
                            Read the brief
                        </Link>
                    </p>
                </section>

                <Work submission={submission} />

                {!pending && submission.reviewedAt && (
                    <section aria-label="The last review" className="rounded-xl border border-dashed border-border px-4 py-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                            Reviewed {formatDateTime(submission.reviewedAt)} —{" "}
                            <span className="font-medium text-foreground">{STATUS_META[submission.status].label}</span>
                            {submission.score !== null && (
                                <span className="font-medium text-foreground">
                                    {" "}
                                    · {submission.score} / {total}
                                </span>
                            )}
                        </p>
                        {submission.feedback && <p className="mt-1.5 whitespace-pre-line text-muted-foreground">“{submission.feedback}”</p>}
                    </section>
                )}
            </div>

            <form className={cn("space-y-4 border-t border-border", compact ? "mt-5 pt-5" : "px-6 py-5")} noValidate onSubmit={form.handleSubmit} onKeyDown={onKeyDown}>
                {pending && (
                    <div
                        className={cn(
                            "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 text-sm",
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
                                    <span className="font-semibold text-foreground">{reviewer?.name}</span> has been reviewing this for {elapsed(submission.updatedAt, now).text}.
                                </>
                            ) : mine ? (
                                <>
                                    <span className="font-semibold text-foreground">You&apos;re reviewing this</span> · {elapsed(submission.updatedAt, now).text}. They
                                    can&apos;t resubmit until you&apos;ve marked it.
                                </>
                            ) : (
                                "Let co-mentors know you're on it — they'll see your name, and the student can't swap the work while you mark."
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
                                Start reviewing
                            </Button>
                        )}
                    </div>
                )}

                <fieldset disabled={colleagues} className={cn("space-y-4 transition-opacity", colleagues && "pointer-events-none opacity-50")}>
                    <fieldset>
                        <legend className="text-sm font-medium">
                            {pending ? "Your decision" : "Change the decision"}
                            <span className="text-destructive"> *</span>
                        </legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {DECISIONS.map((option) => {
                                const selected = decision === option.value;
                                return (
                                    <label
                                        key={option.value}
                                        className={cn(
                                            "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
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
                                        <span className="text-xs text-muted-foreground">{option.hint(assignment.course.milestoneLabel.toLowerCase())}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {form.errorFor("status") && <p className="mt-1.5 text-xs text-destructive">{form.errorFor("status")}</p>}
                    </fieldset>

                    {rubric.length > 0 && decision && (
                        <fieldset className="overflow-hidden rounded-xl border border-border">
                            <legend className="sr-only">Rubric</legend>
                            <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-3.5 py-2 text-xs">
                                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                                    Rubric{decision === "ACCEPTED" ? <span className="text-destructive"> *</span> : <span className="font-normal normal-case tracking-normal"> · optional</span>}
                                </span>
                                <span className="font-semibold tabular-nums">
                                    {rubricSum} / {total}
                                    {isLate && rubricFilled && <span className="font-normal text-muted-foreground"> → {rubricScore} / {maxScore} late</span>}
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
                                                className={cn("h-9 w-16 text-right tabular-nums", Number(points[line.id]) > line.maxPoints && "border-destructive")}
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
                            <FormField form={form} name="score" label="Score" required hint={isLate ? `Out of ${total} — at most ${maxScore} (late)` : `Out of ${total}`}>
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
                                                "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
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

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                            <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.6875rem]">Ctrl</kbd>
                            <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.6875rem]">
                                <CornerDownLeft className="inline size-3" aria-label="Enter" />
                            </kbd>
                            saves and moves on
                        </p>
                        <Button type="submit" isLoading={review.isPending}>
                            {!review.isPending && <Send />} Save review
                        </Button>
                    </div>
                </fieldset>
            </form>
        </article>
    );
}

/** Their link, notes and files — the work itself. */
function Work({ submission }: { submission: ReviewQueueItem }) {
    const url = submission.submissionUrl;
    let host = "";
    let path = "";
    if (url) {
        try {
            const parsed = new URL(url);
            host = parsed.hostname.replace(/^www\./, "");
            path = parsed.pathname.replace(/\/$/, "");
        } catch {
            host = url;
        }
    }
    const isGithub = host === "github.com";
    const nothing = !url && !submission.content && submission.fileUrls.length === 0;

    return (
        <section aria-label="Their work" className="space-y-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Their work</h3>
            {nothing && <p className="text-sm text-muted-foreground">Nothing attached — just the hand-in.</p>}

            {url && (
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        {isGithub ? <Github className="size-5" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{isGithub ? path.slice(1) || host : host}</span>
                        <span className="block truncate text-xs text-muted-foreground">{url}</span>
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Copy the link"
                        onClick={() => {
                            void navigator.clipboard?.writeText(url).then(
                                () => toast.success("Link copied."),
                                () => toast.error("Couldn't copy — select it instead."),
                            );
                        }}
                    >
                        <Copy className="size-4" />
                    </Button>
                    <Button asChild size="sm" variant="brand-outline">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            Open <ExternalLink />
                        </a>
                    </Button>
                </div>
            )}

            {submission.content && (
                <blockquote className="whitespace-pre-line rounded-xl bg-secondary/40 px-4 py-3 text-sm leading-relaxed">{submission.content}</blockquote>
            )}

            {submission.fileUrls.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border">
                    {submission.fileUrls.map((file) => (
                        <li key={file}>
                            <a href={privateFileHref(file)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40">
                                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{submissionFileName(file)}</span>
                                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
