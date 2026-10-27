"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    Lock,
    Send,
    Trophy,
    XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { quizService } from "@/services";
import type { QuizAttemptReview, QuizForStudent } from "@/types/learning.types";

type Phase = "overview" | "taking" | "review";

const scoreTone = (percentage: number) =>
    percentage >= 80 ? "text-success" : percentage >= 50 ? "text-accent-foreground" : "text-destructive";

/**
 * Picks survive a refresh or a wander off to another lesson: they're a
 * per-browser draft until submitted. Storage can be unavailable (private
 * mode, blocked site data), so every access is guarded and the quiz simply
 * works without it.
 */
const draftKey = (quizId: string) => `halfcoders:quiz-draft:${quizId}`;

const readDraft = (quizId: string): Record<string, string> => {
    try {
        const raw = window.localStorage.getItem(draftKey(quizId));
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
        return {};
    }
};

const writeDraft = (quizId: string, selections: Record<string, string>) => {
    try {
        window.localStorage.setItem(draftKey(quizId), JSON.stringify(selections));
    } catch {
        // Nothing to do — the picks still live in memory.
    }
};

const clearDraft = (quizId: string) => {
    try {
        window.localStorage.removeItem(draftKey(quizId));
    } catch {
        // Ignore — a stale draft is harmless once the quiz is submitted.
    }
};

/**
 * The quiz, swapped into the player pane the same way `AssignmentPane` is.
 *
 * It works like a test, not a drill: the student picks an answer for every
 * question — changing them freely, with no hint of what's right — then
 * submits once. Only then do the score and the correct answers appear, and
 * the quiz can't be taken again.
 */
export default function QuizPane({ quizId }: { quizId: string }) {
    const queryClient = useQueryClient();
    const [phase, setPhase] = useState<Phase>("overview");
    const [currentIndex, setCurrentIndex] = useState(0);
    // questionId → the option picked. Changeable until the sheet is submitted.
    const [selections, setSelections] = useState<Record<string, string>>({});

    const { data: quiz, isLoading, isError, error } = useQuery({
        queryKey: ["quiz", quizId],
        queryFn: () => quizService.get(quizId),
    });

    const showSubmitted = () => {
        clearDraft(quizId);
        setSelections({});
        setPhase("overview");
        void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
        // The sidebar's completion badge and score read off the learning payload.
        void queryClient.invalidateQueries({ queryKey: ["learning"] });
    };

    const submit = useMutation({
        mutationFn: (questions: QuizForStudent["questions"]) =>
            quizService.submit(
                quizId,
                questions.map((question) => ({ questionId: question.id, selectedOptionId: selections[question.id] })),
            ),
        onSuccess: (result) => {
            // Show the result at once; the refetch in showSubmitted confirms it.
            queryClient.setQueryData<QuizForStudent>(["quiz", quizId], (current) =>
                current ? { ...current, result, questions: [] } : current,
            );
            toast.success("Quiz submitted.");
            showSubmitted();
        },
        onError: (err) => {
            toast.error(getApiErrorMessage(err, "Couldn't submit your answers. Your picks are saved — try again."));
            // Already submitted from another tab: go and show that result.
            if (axios.isAxiosError(err) && err.response?.status === 409) showSubmitted();
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !quiz) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Can&apos;t open this quiz</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {getApiErrorMessage(error, "It may not be published yet.")}
                </p>
            </div>
        );
    }

    if (phase === "review" && quiz.result) {
        return <QuizReview attemptId={quiz.result.id} onClose={() => setPhase("overview")} />;
    }

    // ---- Submitted: the score, and the way into the answers -------------
    if (quiz.result) {
        const result = quiz.result;
        return (
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                    <Trophy className="size-8" />
                </span>
                <h2 className="text-xl font-bold">{quiz.title}</h2>
                {result.completedAt && (
                    <p className="mt-1 text-sm text-muted-foreground">Submitted {formatDateTime(result.completedAt)}</p>
                )}

                <div className="mx-auto mt-5 inline-flex flex-col items-center rounded-xl bg-primary px-8 py-4 text-primary-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Your score</span>
                    <span className="text-3xl font-bold">
                        {result.score}/{result.totalQuestions}
                    </span>
                </div>

                <p className={cn("mt-3 text-lg font-semibold", scoreTone(result.percentage))}>{result.percentage}%</p>

                <div className="mt-4 flex justify-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="size-4" /> {result.correctCount} correct
                    </span>
                    <span className="flex items-center gap-1.5 text-destructive">
                        <XCircle className="size-4" /> {result.incorrectCount} incorrect
                    </span>
                </div>

                <Button className="mt-6" onClick={() => setPhase("review")}>
                    See correct answers
                </Button>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden /> A quiz can be submitted once — this is your final score.
                </p>
            </div>
        );
    }

    const questions = quiz.questions;
    const answeredCount = questions.filter((question) => selections[question.id]).length;
    const allAnswered = questions.length > 0 && answeredCount === questions.length;

    // ---- Answering -------------------------------------------------------
    if (phase === "taking" && questions.length > 0) {
        const index = Math.min(currentIndex, questions.length - 1);
        const question = questions[index];
        const isLast = index === questions.length - 1;

        const choose = (optionId: string) => {
            const next = { ...selections, [question.id]: optionId };
            setSelections(next);
            writeDraft(quizId, next);
        };

        const confirmAndSubmit = async () => {
            if (
                await confirmAction({
                    title: "Submit your answers?",
                    text: "You'll see your score and the correct answers straight away. You can't change your answers or take this quiz again afterwards.",
                    confirmText: "Submit answers",
                })
            ) {
                submit.mutate(questions);
            }
        };

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Question {index + 1} of {questions.length}
                    </span>
                    <span>
                        {answeredCount}/{questions.length} answered
                    </span>
                </div>
                <Progress value={(answeredCount / questions.length) * 100} />

                {/* Jump to any question — filled in once it has an answer. */}
                <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
                    {questions.map((item, itemIndex) => {
                        const isAnswered = Boolean(selections[item.id]);
                        const isCurrent = itemIndex === index;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setCurrentIndex(itemIndex)}
                                aria-current={isCurrent ? "step" : undefined}
                                aria-label={`Question ${itemIndex + 1}${isAnswered ? ", answered" : ", not answered yet"}`}
                                className={cn(
                                    "grid size-8 place-items-center rounded-md border text-xs font-medium transition-colors",
                                    isAnswered
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border text-muted-foreground hover:bg-secondary",
                                    isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                                )}
                            >
                                {itemIndex + 1}
                            </button>
                        );
                    })}
                </nav>

                <fieldset className="rounded-xl border border-border bg-card p-6 shadow-sm">
                    <legend className="sr-only">Question {index + 1}</legend>
                    <p className="mb-5 text-lg font-semibold">{question.question}</p>

                    <div className="space-y-2.5">
                        {question.options.map((option) => {
                            const checked = selections[question.id] === option.id;
                            return (
                                <label
                                    key={option.id}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                        checked
                                            ? "border-primary bg-primary/10 font-medium text-primary"
                                            : "border-border hover:border-primary/50 hover:bg-secondary/40",
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name={`quiz-question-${question.id}`}
                                        value={option.id}
                                        checked={checked}
                                        onChange={() => choose(option.id)}
                                        disabled={submit.isPending}
                                        className="sr-only"
                                    />
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "grid size-4 shrink-0 place-items-center rounded-full border",
                                            checked ? "border-primary" : "border-muted-foreground/60",
                                        )}
                                    >
                                        {checked && <span className="size-2 rounded-full bg-primary" />}
                                    </span>
                                    <span className="flex-1">{option.text}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" disabled={index === 0} onClick={() => setCurrentIndex(index - 1)}>
                        <ChevronLeft className="size-4" /> Previous
                    </Button>
                    {!isLast && (
                        <Button variant="outline" onClick={() => setCurrentIndex(index + 1)}>
                            Next <ChevronRight className="size-4" />
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                    <p className="text-sm text-muted-foreground">
                        {allAnswered
                            ? "All questions answered. Check your picks, then submit — you can only submit once."
                            : `Answer all ${questions.length} questions to submit — ${questions.length - answeredCount} left.`}
                    </p>
                    <Button disabled={!allAnswered} isLoading={submit.isPending} onClick={() => void confirmAndSubmit()}>
                        {!submit.isPending && <Send className="size-4" />} Submit answers
                    </Button>
                </div>
            </div>
        );
    }

    // ---- Not started: what to expect -----------------------------------
    const start = () => {
        // Pick up an unfinished draft — keeping only picks that still match
        // this quiz, in case it was edited since.
        const draft = readDraft(quizId);
        const valid: Record<string, string> = {};
        for (const question of questions) {
            const optionId = draft[question.id];
            if (optionId && question.options.some((option) => option.id === optionId)) valid[question.id] = optionId;
        }
        setSelections(valid);
        const firstUnanswered = questions.findIndex((question) => !valid[question.id]);
        setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
        setPhase("taking");
    };

    const hasDraft = typeof window !== "undefined" && Object.keys(readDraft(quizId)).length > 0;

    return (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <HelpCircle className="size-6" />
            </span>
            <h2 className="text-xl font-bold">{quiz.title}</h2>
            {quiz.description && (
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{quiz.description}</p>
            )}

            <div className="mt-4 flex justify-center">
                <Badge variant="secondary">{quiz.totalQuestions} questions</Badge>
            </div>

            <ul className="mx-auto mt-5 max-w-md space-y-1.5 text-left text-sm text-muted-foreground">
                <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    Answer every question — you can change an answer until you submit.
                </li>
                <li className="flex gap-2">
                    <Trophy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    Your score and the correct answers appear after you submit.
                </li>
                <li className="flex gap-2">
                    <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    You can submit only once — there are no retakes.
                </li>
            </ul>

            <Button className="mt-6" disabled={questions.length === 0} onClick={start}>
                {hasDraft ? "Continue quiz" : "Start quiz"}
            </Button>
        </div>
    );
}

/** Steps through one finished attempt's questions, showing the student's
 *  answer against the correct one plus the explanation — "See Correct Answers". */
function QuizReview({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
    const [index, setIndex] = useState(0);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["quiz-attempt-review", attemptId],
        queryFn: () => quizService.getAttempt(attemptId),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Can&apos;t open this review</p>
                <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again shortly.")}</p>
                <Button variant="outline" className="mt-4" onClick={onClose}>
                    Back
                </Button>
            </div>
        );
    }

    const question = data.questions[index] as QuizAttemptReview["questions"][number];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                    Review — Question {index + 1} of {data.questions.length}
                </h2>
                <Badge variant={data.percentage >= 50 ? "success" : "destructive"}>
                    {data.score}/{data.totalQuestions} ({data.percentage}%)
                </Badge>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 font-medium">{question.question}</h3>

                <div className="space-y-2.5">
                    {question.options.map((option) => (
                        <div
                            key={option.id}
                            className={cn(
                                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                                option.isCorrect && "border-success bg-success/10 text-success",
                                !option.isCorrect &&
                                    option.id === question.selectedOptionId &&
                                    "border-destructive bg-destructive/10 text-destructive",
                                !option.isCorrect &&
                                    option.id !== question.selectedOptionId &&
                                    "border-border opacity-60",
                            )}
                        >
                            {option.isCorrect ? (
                                <CheckCircle2 className="size-4 shrink-0" />
                            ) : option.id === question.selectedOptionId ? (
                                <XCircle className="size-4 shrink-0" />
                            ) : (
                                <span className="size-4 shrink-0" />
                            )}
                            <span className="flex-1">{option.text}</span>
                            {option.id === question.selectedOptionId && (
                                <span className="text-xs font-medium">Your answer</span>
                            )}
                        </div>
                    ))}
                </div>

                {question.explanation && (
                    <p className="mt-4 rounded-lg bg-secondary/40 p-3.5 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Explanation: </span>
                        {question.explanation}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                    <ChevronLeft className="size-4" /> Previous
                </Button>

                {index === data.questions.length - 1 ? (
                    <Button onClick={onClose}>Done</Button>
                ) : (
                    <Button onClick={() => setIndex((i) => Math.min(data.questions.length - 1, i + 1))}>
                        Next <ChevronRight className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
