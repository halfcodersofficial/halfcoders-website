"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowUp, Equal, Scale, Send, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { assignmentService } from "@/services";
import type { ReviewQueueItem } from "@/types/mentor.types";

type Outcome = "VALID" | "INVALID";

/**
 * A recheck waiting on a hand-in, ready to decide: the student's reason, the
 * mark as it stands, and the two outcomes with exactly what each does to their
 * mark. Raising it takes a new mark above the old one (or the rubric's lines
 * again); keeping it takes a reason, which the student reads.
 */
export default function RecheckPanel({
    submission,
    onSaved,
    onDirtyChange,
    compact = false,
}: {
    submission: ReviewQueueItem;
    onSaved: (submission: ReviewQueueItem) => void;
    onDirtyChange: (dirty: boolean) => void;
    compact?: boolean;
}) {
    const recheck = submission.rechecks.find((entry) => entry.status === "PENDING");
    const { penalties, assignment } = submission;
    const total = assignment.totalMarks;
    const maxScore = submission.maxScore ?? total;
    const fee = penalties.recheckFeeMarks;
    const extra = penalties.recheckInvalidMarks;
    const before = recheck?.scoreBefore ?? submission.score ?? 0;

    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [score, setScore] = useState("");
    const [note, setNote] = useState("");
    const rubric = assignment.rubric ?? [];
    const [points, setPoints] = useState<Record<string, string>>(() =>
        Object.fromEntries(rubric.map((line) => [line.id, String(submission.rubricScores?.find((given) => given.criterionId === line.id)?.points ?? "")])),
    );
    const rubricSum = rubric.reduce((sum, line) => sum + (Number(points[line.id]) || 0), 0);
    const rubricScore = maxScore === total ? rubricSum : Math.round((rubricSum * maxScore) / total);
    const rubricFilled = rubric.every((line) => points[line.id] !== "" && Number(points[line.id]) >= 0 && Number(points[line.id]) <= line.maxPoints);
    const newScore = rubric.length > 0 ? rubricScore : Number(score);

    useEffect(() => onDirtyChange(Boolean(outcome || score || note)), [outcome, score, note, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    const decide = useMutation({
        mutationFn: () =>
            assignmentService.decideRecheck(recheck!.id, {
                outcome: outcome!,
                score: outcome === "VALID" && rubric.length === 0 ? Number(score) : undefined,
                rubric:
                    outcome === "VALID" && rubric.length > 0
                        ? rubric.map((line) => ({ criterionId: line.id, points: Number(points[line.id]) }))
                        : undefined,
                note: note.trim() || undefined,
            }),
        onSuccess: () => {
            toast.success("Recheck decided — the student has been notified.");
            onSaved(submission);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the decision.")),
    });

    if (!recheck) return null;

    // What's wrong with the decision as it stands, if anything — said before it's sent.
    const problem =
        outcome === null
            ? "Choose whether the mark goes up or stays."
            : outcome === "VALID"
              ? rubric.length > 0 && !rubricFilled
                  ? "Score every rubric line, each within its points."
                  : rubric.length === 0 && score === ""
                    ? "Give the new mark."
                    : !Number.isFinite(newScore) || newScore <= before
                      ? `A raised mark is more than ${before}.`
                      : newScore > maxScore
                        ? `The mark can be at most ${maxScore}.`
                        : null
              : !note.trim()
                ? "Say why the mark stands — the student will read it."
                : null;

    const OPTIONS: { value: Outcome; label: string; icon: LucideIcon; hint: string }[] = [
        { value: "VALID", label: "Raise the mark", icon: ArrowUp, hint: `They deserved more. The ${fee}-mark fee goes back to them.` },
        { value: "INVALID", label: "Keep the mark", icon: Equal, hint: `The mark was right. ${extra} more marks are taken — ${fee + extra} in all.` },
    ];

    return (
        <form
            className={cn("space-y-4 border-t border-border", compact ? "mt-5 pt-5" : "px-6 py-5")}
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                if (problem) {
                    toast.error(problem);
                    return;
                }
                decide.mutate();
            }}
        >
            <section aria-label="The recheck request" className="rounded-card border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                    <Scale className="size-4 text-amber-600" aria-hidden /> Recheck requested
                    <span className="font-normal text-muted-foreground">· {formatDateTime(recheck.createdAt)}</span>
                </p>
                <p className="mt-2 whitespace-pre-line">“{recheck.reason}”</p>
                <p className="mt-2 text-xs text-muted-foreground">
                    Your mark: <span className="font-semibold text-foreground">{before}</span> / {total}. The {fee}-mark fee is already taken.
                </p>
            </section>

            <fieldset>
                <legend className="text-sm font-medium">
                    Your decision<span className="text-destructive"> *</span>
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {OPTIONS.map((option) => {
                        const selected = outcome === option.value;
                        return (
                            <label
                                key={option.value}
                                className={cn(
                                    "flex cursor-pointer flex-col gap-1 rounded-card border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                    selected
                                        ? option.value === "VALID"
                                            ? "border-primary bg-primary/5"
                                            : "border-destructive/60 bg-destructive/5"
                                        : "border-border hover:bg-secondary/40",
                                )}
                            >
                                <input
                                    type="radio"
                                    name={`recheck-${recheck.id}`}
                                    value={option.value}
                                    checked={selected}
                                    onChange={() => setOutcome(option.value)}
                                    className="sr-only"
                                />
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <option.icon
                                        className={cn("size-4", selected ? (option.value === "VALID" ? "text-primary" : "text-destructive") : "text-muted-foreground")}
                                        aria-hidden
                                    />
                                    {option.label}
                                </span>
                                <span className="text-xs text-muted-foreground">{option.hint}</span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            {outcome === "VALID" && rubric.length > 0 && (
                <fieldset className="overflow-hidden rounded-card border border-border">
                    <legend className="sr-only">Rubric</legend>
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-3.5 py-2 text-xs">
                        <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">Rubric, again</span>
                        <span className="font-semibold tabular-nums">
                            {rubricSum} / {total}
                            {maxScore !== total && <span className="font-normal text-muted-foreground"> → {rubricScore} / {maxScore} late</span>}
                        </span>
                    </div>
                    <ul className="divide-y divide-border">
                        {rubric.map((line) => (
                            <li key={line.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="min-w-0 text-sm font-medium">{line.title}</span>
                                <label className="flex items-center gap-1.5 text-sm">
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={line.maxPoints}
                                        value={points[line.id] ?? ""}
                                        onChange={(event) => setPoints((current) => ({ ...current, [line.id]: event.target.value }))}
                                        aria-label={`${line.title}, out of ${line.maxPoints}`}
                                        className="h-9 w-16 text-right tabular-nums"
                                    />
                                    <span className="text-muted-foreground">/ {line.maxPoints}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </fieldset>
            )}

            {outcome === "VALID" && rubric.length === 0 && (
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">
                        New mark<span className="text-destructive"> *</span>
                    </span>
                    <Input
                        type="number"
                        inputMode="numeric"
                        min={before + 1}
                        max={maxScore}
                        value={score}
                        onChange={(event) => setScore(event.target.value)}
                        className="w-32 tabular-nums"
                        autoFocus
                    />
                    <span className="block text-xs text-muted-foreground">
                        More than {before}, at most {maxScore}
                        {maxScore !== total && " (it came in late)"}.
                    </span>
                </label>
            )}

            {outcome && (
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">
                        {outcome === "INVALID" ? "Why the mark stands" : "A note for the student"}
                        {outcome === "INVALID" ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> · optional</span>}
                    </span>
                    <Textarea
                        rows={compact ? 3 : 4}
                        maxLength={5000}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={outcome === "INVALID" ? "What you checked, and why the mark was right…" : "What you found on a second look…"}
                    />
                </label>
            )}

            <div className="flex justify-end">
                <Button type="submit" isLoading={decide.isPending}>
                    {!decide.isPending && <Send />} Save decision
                </Button>
            </div>
        </form>
    );
}
