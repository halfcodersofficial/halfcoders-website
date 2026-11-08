"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareHeart, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { supportService } from "@/services";
import type { PendingSupportFeedback } from "@/types/domain.types";

const SCALE = [1, 2, 3, 4, 5] as const;

const QUESTIONS = [
    { key: "rating", label: "How was the support session?", low: "Poor", high: "Excellent" },
    { key: "solved", label: "Did it solve your problem?", low: "Not at all", high: "Fully solved" },
] as const;

type Scores = { rating: number | null; solved: number | null };

/**
 * Asked once a student's turn with the mentor is over, and before they can
 * take another number (the server holds to it too): how it went and how far
 * it solved their problem, 1–5 each. Sent, it refreshes the support queries,
 * so the page moves straight on to "Take a number".
 */
export function SupportFeedbackForm({ turn, className }: { turn: PendingSupportFeedback; className?: string }) {
    const queryClient = useQueryClient();
    const [scores, setScores] = useState<Scores>({ rating: null, solved: null });
    const [tried, setTried] = useState(false);

    const submit = useMutation({
        mutationFn: (feedback: { rating: number; solved: number }) => supportService.submitFeedback(turn.id, feedback),
        onSuccess: () => {
            toast.success("Thanks for your feedback! You can take a number now.");
            void queryClient.invalidateQueries({ queryKey: ["support"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send your feedback. Please try again.")),
    });

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        setTried(true);
        if (scores.rating !== null && scores.solved !== null) submit.mutate({ rating: scores.rating, solved: scores.solved });
    };

    return (
        <form noValidate onSubmit={onSubmit} className={cn("rounded-3xl border border-primary/25 bg-card p-6 shadow-card sm:p-7", className)}>
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <MessageSquareHeart className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight">Rate your last support session</h2>
                    <p className="text-sm text-muted-foreground">Before you take a new number, tell us how it went. It only takes a few seconds.</p>
                </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                <Avatar src={turn.session.mentor.image} name={turn.session.mentor.name} size={32} />
                <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{turn.session.course.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        With {turn.session.mentor.name} · {formatDateTime(turn.completedAt ?? turn.session.startTime)}
                    </p>
                    {turn.topic && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">You asked about: {turn.topic}</p>}
                </div>
            </div>

            <div className="mt-6 space-y-6">
                {QUESTIONS.map((question) => {
                    const missing = tried && scores[question.key] === null;
                    return (
                        <fieldset key={question.key} aria-invalid={missing || undefined}>
                            <legend className="text-sm font-semibold">{question.label}</legend>
                            <div className="mt-2 grid grid-cols-5 gap-2">
                                {SCALE.map((value) => {
                                    const selected = scores[question.key] === value;
                                    return (
                                        <label
                                            key={value}
                                            className={cn(
                                                "grid h-11 cursor-pointer place-items-center rounded-md border text-base font-semibold tabular-nums transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                                selected
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name={`support-feedback-${question.key}`}
                                                value={value}
                                                checked={selected}
                                                onChange={() => setScores((current) => ({ ...current, [question.key]: value }))}
                                                aria-label={`${value} out of 5`}
                                                className="sr-only"
                                            />
                                            {value}
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                                <span>1 = {question.low}</span>
                                <span>5 = {question.high}</span>
                            </p>
                            {missing && <p className="mt-1 text-xs text-destructive">Pick a number from 1 to 5.</p>}
                        </fieldset>
                    );
                })}
            </div>

            <Button type="submit" className="mt-6 w-full rounded-full" size="lg" isLoading={submit.isPending}>
                Submit feedback
            </Button>
        </form>
    );
}

/** 4–5 reads good, 3 so-so, 1–2 poor. */
const scoreTone = (score: number) =>
    score >= 4
        ? "bg-success/10 text-success"
        : score === 3
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-destructive/10 text-destructive";

/** For mentors and admins: what a student said about their turn, or nothing if they haven't. */
export function SupportFeedbackScores({
    rating,
    solved,
    className,
}: {
    rating: number | null;
    solved: number | null;
    className?: string;
}) {
    if (rating === null || solved === null) return null;
    return (
        <span className={cn("inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold", className)}>
            <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 tabular-nums", scoreTone(rating))} title="How the session went">
                <Star className="size-3 fill-current" aria-hidden />
                Session {rating}/5
            </span>
            <span className={cn("rounded-sm px-1.5 py-0.5 tabular-nums", scoreTone(solved))} title="How far it solved their problem">
                Solved {solved}/5
            </span>
        </span>
    );
}
