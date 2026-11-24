"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Clock,
    CodeXml,
    ExternalLink,
    Eye,
    FileText,
    Headphones,
    Hourglass,
    Lock,
    MessageSquare,
    RotateCcw,
    Scale,
    Send,
    Trophy,
    Zap,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MarkChanges, RecheckDialog, RecheckResult, ResultDetails } from "@/components/learn/AssignmentResult";
import SubmissionFiles, { attachedFrom, type AttachedFile } from "@/components/learn/SubmissionFiles";
import { Eyebrow } from "@/components/site/code";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { linkify } from "@/lib/linkify";
import { cn, formatDateTime } from "@/lib/utils";
import { assignmentService } from "@/services";
import type { AssignmentSubmission, StudentAssignment } from "@/types/learning.types";

type PayWith = "MARKS" | "XP";
type Popup = "submission" | "feedback" | "recheck" | "resubmit";

/**
 * An assignment's own page in the player: what it is, then one box that
 * changes with where the student is — the answer box; "submitted, waiting
 * for the results" (with Resubmit, at a cost they choose: marks or XP); the
 * mentor checking it; and once the results are out, the score with "My
 * submission", "Feedback" and "Recheck" — each in its own popup. Previous /
 * Next along the course sit under it, from the player.
 */
export default function AssignmentPane({ slug, assignmentId }: { slug: string; assignmentId: string }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);
    // A paid resubmission opens only once the student has picked how to pay — never by accident.
    const [payWith, setPayWith] = useState<PayWith | null>(null);
    const [popup, setPopup] = useState<Popup | null>(null);
    // While a recheck waits: the answer box, or their result. Null follows the
    // default — the box until they've sent their work again for it.
    const [recheckView, setRecheckView] = useState<"form" | "result" | null>(null);

    useEffect(() => {
        setPayWith(null);
        setPopup(null);
        setRecheckView(null);
    }, [assignmentId]);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["assignment", assignmentId],
        queryFn: () => assignmentService.get(assignmentId),
    });

    const submission = data?.submission ?? null;

    // A resubmission starts from exactly what was sent. The text already holds
    // the link (it's only picked out of it on submit), so the link is added
    // on top only for an older hand-in that stored it apart — never twice.
    useEffect(() => {
        const content = submission?.content ?? "";
        const url = submission?.submissionUrl;
        setDraft(url && !content.includes(url) ? [url, content].filter(Boolean).join("\n\n") : content);
    }, [assignmentId, submission?.id, submission?.content, submission?.submissionUrl]);

    // A resubmission starts from the files already handed in; any can be taken off.
    const submittedFiles = submission?.fileUrls.join("\n") ?? "";
    useEffect(() => {
        setFiles(submittedFiles ? submittedFiles.split("\n").map(attachedFrom) : []);
    }, [assignmentId, submittedFiles]);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
        void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
    };

    const submit = useMutation({
        mutationFn: (content: string) => {
            const urlMatch = content.match(/https?:\/\/\S+/);
            const submissionUrl = urlMatch ? urlMatch[0].replace(/[.,;:!?)\]]+$/, "") : undefined;
            return assignmentService.submit(assignmentId, {
                content: content || undefined,
                submissionUrl,
                fileUrls: files.map((file) => file.url),
                ...(payWith ? { acceptPenalty: true, payWith } : {}),
            });
        },
        onSuccess: (result) => {
            const penalty = result?.penalty;
            toast.success(
                penalty
                    ? penalty.xp > 0
                        ? `Resubmitted — ${penalty.xp} XP was taken.`
                        : `Resubmitted — ${penalty.marks} marks will come off your final mark.`
                    : submission?.recheckOpen
                      ? "Sent — your mentor will recheck this version."
                      : "Submitted — your mentor will check it.",
            );
            setPayWith(null);
            // Sent for a recheck: back to their result, with its three buttons.
            if (submission?.recheckOpen) setRecheckView("result");
            refresh();
            void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't submit your work.")),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Can&apos;t open this assignment</p>
                <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "It may not be published yet.")}</p>
            </div>
        );
    }

    const paid = data.resubmitCost;
    // A recheck waiting on the mentor: the answer box first, then — once they've
    // sent their work again for it, or chosen to keep it — their result again.
    const pendingRecheck = submission?.recheckOpen ? (submission.rechecks.find((entry) => entry.status === "PENDING") ?? null) : null;
    const resentForRecheck = Boolean(pendingRecheck && submission && new Date(submission.submittedAt) > new Date(pendingRecheck.createdAt));
    const recheckMode = pendingRecheck ? (recheckView ?? (resentForRecheck ? "result" : "form")) : null;
    const showForm = data.canSubmit && (!paid || payWith !== null) && recheckMode !== "result";
    const status = submission?.status;

    const mySubmissionButton = (
        // A plain button — it also sits inside the answer form while a recheck waits.
        <Button type="button" variant="outline" className="rounded-full" onClick={() => setPopup("submission")}>
            <FileText className="size-4" aria-hidden /> My submission
        </Button>
    );

    /** The one box that changes with where the student is. */
    const stage = (() => {
        // The course moved to Previous (recorded): nothing more is taken or checked.
        if (data.batchEnded) {
            const mark = status === "ACCEPTED" && submission?.finalScore !== null && submission?.finalScore !== undefined ? submission.finalScore : null;
            return (
                <BatchEnded
                    actions={
                        submission && (
                            <>
                                {mySubmissionButton}
                                {status === "ACCEPTED" && data.resultsPublished && (
                                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setPopup("feedback")}>
                                        <MessageSquare className="size-4" aria-hidden /> Feedback
                                    </Button>
                                )}
                            </>
                        )
                    }
                >
                    {mark !== null && data.resultsPublished && (
                        <p className="mt-3 text-sm">
                            Your mark:{" "}
                            <span className="font-semibold tabular-nums">
                                {mark}/{data.totalMarks}
                            </span>
                        </p>
                    )}
                </BatchEnded>
            );
        }

        if (showForm) {
            const sentBack = status === "NEEDS_REVISION" || status === "REJECTED";
            // A recheck the student asked for, still waiting: they may send their work again for it.
            const forRecheck = Boolean(submission?.recheckOpen);
            return (
                <form
                    className="mx-auto max-w-3xl space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!draft.trim() && files.length === 0) {
                            toast.error("Add your work before submitting: paste a link, write an answer, or attach a file.");
                            return;
                        }
                        submit.mutate(draft.trim());
                    }}
                >
                    {sentBack && submission && (
                        <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
                            <p className="flex items-center gap-2 font-semibold">
                                <MessageSquare className="size-4 shrink-0" aria-hidden />
                                {status === "REJECTED" ? "Not accepted — you can send it again" : "Your mentor asked for changes"}
                            </p>
                            {submission.feedback && <p className="mt-1.5 whitespace-pre-line wrap-break-word">{submission.feedback}</p>}
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Sending it again is free.
                                {submission.maxScore !== null
                                    ? ` It stays marked out of ${submission.maxScore}, as when you first submitted.`
                                    : " It's still marked out of the full total."}
                            </p>
                        </div>
                    )}

                    {forRecheck && submission && (
                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
                            <p className="flex items-center gap-2 font-semibold">
                                <Scale className="size-4 shrink-0 text-primary" aria-hidden />
                                Recheck asked — your mentor will look at it again
                            </p>
                            <p className="mt-1.5 text-muted-foreground">
                                Your mark for now:{" "}
                                <span className="font-semibold tabular-nums text-foreground">
                                    {submission.finalScore}/{data.totalMarks}
                                </span>
                                . Fixed something? Send your work again below — it&apos;s free, and your mentor rechecks the version you send. Nothing to
                                change? Keep it as it is.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {mySubmissionButton}
                                <Button type="button" variant="outline" className="rounded-full" onClick={() => setPopup("feedback")}>
                                    <MessageSquare className="size-4" aria-hidden /> Feedback
                                </Button>
                                <Button type="button" variant="ghost" className="rounded-full" onClick={() => setRecheckView("result")}>
                                    Keep my work as it is
                                </Button>
                            </div>
                        </div>
                    )}

                    {!submission && data.window.status === "LATE" && data.window.maxScore !== null && (
                        <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning-ink">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                            {data.window.until
                                ? `The deadline has passed. Submit before ${formatDateTime(data.window.until)} and this is marked out of ${data.window.maxScore} instead of ${data.totalMarks}.`
                                : data.window.maxScore < data.totalMarks
                                  ? `The deadline has passed, so this is marked out of ${data.window.maxScore} instead of ${data.totalMarks}. You can still submit until the batch ends.`
                                  : "The deadline has passed, but you can still submit until the batch ends."}
                        </p>
                    )}

                    {payWith && paid && (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-warning/10 p-3 text-sm text-warning-ink">
                            <RotateCcw className="size-4 shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1">
                                Resubmitting — {payWith === "XP" ? `${paid.xp} XP is` : `${paid.marks} marks are`} taken when you submit. Your new work replaces
                                the one you sent.
                            </span>
                            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setPopup("resubmit")}>
                                Change
                            </button>
                        </p>
                    )}

                    <label className="block space-y-1.5">
                        <span className="text-sm font-semibold">Your answer</span>
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Paste your link (GitHub, HackerRank profile…) and anything your mentor should know…"
                            rows={7}
                            maxLength={20_000}
                            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                        />
                    </label>

                    <SubmissionFiles assignmentId={assignmentId} files={files} onChange={setFiles} disabled={submit.isPending} />

                    <div className="flex flex-wrap justify-center gap-2">
                        <Button type="submit" size="lg" className="min-w-40 rounded-full" isLoading={submit.isPending}>
                            {!submit.isPending && <Send className="size-4" aria-hidden />}
                            {submission ? "Submit again" : "Submit"}
                        </Button>
                        {payWith && (
                            <Button
                                type="button"
                                size="lg"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setPayWith(null)}
                                disabled={submit.isPending}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            );
        }

        if (!submission) {
            return (
                <StageMessage
                    icon={Lock}
                    tone="danger"
                    title="Submissions are closed"
                    actions={
                        <Button asChild variant="outline" className="rounded-full">
                            <Link href={`/learn/${slug}/support`}>
                                <Headphones className="size-4" aria-hidden /> Talk to a mentor
                            </Link>
                        </Button>
                    }
                >
                    {data.lateTiers.length > 0 ? "The last late window has passed." : "The deadline passed before you submitted."}
                </StageMessage>
            );
        }

        if (status === "ACCEPTED" && submission.finalScore !== null) {
            return (
                <ScoreStage
                    assignment={data}
                    submission={submission}
                    mySubmissionButton={mySubmissionButton}
                    onFeedback={() => setPopup("feedback")}
                    onRecheck={() => setPopup("recheck")}
                    recheckWaiting={Boolean(pendingRecheck)}
                    resent={resentForRecheck}
                    onSendAgain={() => setRecheckView("form")}
                />
            );
        }

        if (status === "UNDER_REVIEW") {
            return (
                <StageMessage icon={Eye} title="Your mentor is checking it now" actions={mySubmissionButton}>
                    You&apos;ll get a notification when your result is out.
                </StageMessage>
            );
        }

        if (status === "SUBMITTED" && data.resultsPublished) {
            return (
                <StageMessage icon={Hourglass} title="Results are out — yours is still being marked" actions={mySubmissionButton}>
                    Your score shows here as soon as it&apos;s marked.
                </StageMessage>
            );
        }

        if (status === "SUBMITTED") {
            return (
                <StageMessage
                    icon={Hourglass}
                    title="Submitted! Marks & feedback are on the way"
                    actions={
                        <>
                            {paid && (
                                <Button className="rounded-full" onClick={() => setPopup("resubmit")}>
                                    <RotateCcw className="size-4" aria-hidden /> Resubmit
                                </Button>
                            )}
                            {mySubmissionButton}
                        </>
                    }
                >
                    Your mentor will mark it. Your score shows here once the results are published — you&apos;ll get a notification.
                </StageMessage>
            );
        }

        // Sent back with no way to send it again — shouldn't happen, but never a blank box.
        return (
            <StageMessage icon={MessageSquare} title="Your mentor's feedback" actions={mySubmissionButton}>
                {submission.feedback ?? "Your mentor has looked at it."}
            </StageMessage>
        );
    })();

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {/* What it is — the title; the brief and instructions are in its lessons. */}
                <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
                    <Eyebrow>Assignment</Eyebrow>
                    <h2 className="mt-1.5 text-balance text-xl font-bold tracking-tight wrap-break-word sm:text-2xl">{data.title}</h2>
                </div>

                <div className="border-t border-border px-5 py-6 sm:px-8 sm:py-8">{stage}</div>
            </div>

            {submission && (
                <Modal open={popup === "submission"} onOpenChange={(open) => !open && setPopup(null)} title="My submission" size="md">
                    <ModalBody>
                        <MySubmission assignment={data} submission={submission} />
                    </ModalBody>
                </Modal>
            )}

            {submission && (
                <Modal open={popup === "feedback"} onOpenChange={(open) => !open && setPopup(null)} title="Feedback" size="lg">
                    <ModalBody>
                        <ResultDetails assignment={data} submission={submission} />
                    </ModalBody>
                </Modal>
            )}

            {submission && (
                <RecheckDialog
                    open={popup === "recheck"}
                    onOpenChange={(open) => !open && setPopup(null)}
                    assignmentId={data.id}
                    currentMark={submission.finalScore ?? 0}
                    outOf={data.totalMarks}
                    penalties={data.penalties}
                    onDone={() => {
                        setPopup(null);
                        refresh();
                    }}
                />
            )}

            {paid && (
                <Modal open={popup === "resubmit"} onOpenChange={(open) => !open && setPopup(null)} title="Resubmit your work?" size="sm">
                    <ModalBody className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Sending it again before the results costs <span className="font-semibold text-foreground">{paid.marks} marks</span> or{" "}
                            <span className="font-semibold text-foreground">{paid.xp} XP</span> — you choose. Your new work replaces the one you sent and goes
                            back to your mentor.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <PayOption
                                icon={Zap}
                                title={`Pay ${paid.xp} XP`}
                                note={paid.xpAvailable >= paid.xp ? `You have ${paid.xpAvailable} XP` : `You have ${paid.xpAvailable} XP — not enough`}
                                disabled={paid.xpAvailable < paid.xp}
                                selected={payWith === "XP"}
                                onSelect={() => {
                                    setPayWith("XP");
                                    setPopup(null);
                                }}
                            />
                            <PayOption
                                icon={Scale}
                                title={`Pay ${paid.marks} marks`}
                                note="Taken off your final mark"
                                selected={payWith === "MARKS"}
                                onSelect={() => {
                                    setPayWith("MARKS");
                                    setPopup(null);
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="outline" onClick={() => setPopup(null)}>
                            Cancel
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
        </div>
    );
}

/**
 * The batch is over — the course moved to Previous (recorded) — so its
 * assignments are no longer taken or checked. Shown in place of everything
 * else, with the student's own work and mark still a click away.
 */
function BatchEnded({ actions, children }: { actions?: ReactNode; children?: ReactNode }) {
    return (
        <div className="mx-auto max-w-xl py-6 text-center">
            {/* A small editor window, closed for good. */}
            <span className="relative mx-auto mb-6 block w-28" aria-hidden>
                <span className="block overflow-hidden rounded-lg border border-border bg-card shadow-card">
                    <span className="flex gap-1 border-b border-border bg-secondary/60 px-2 py-1.5">
                        <span className="size-1.5 rounded-full bg-destructive/60" />
                        <span className="size-1.5 rounded-full bg-warning/70" />
                        <span className="size-1.5 rounded-full bg-success/60" />
                    </span>
                    <span className="grid h-16 place-items-center text-primary">
                        <CodeXml className="size-8" />
                    </span>
                </span>
                <span className="absolute -bottom-2 -right-3 grid size-8 place-items-center rounded-full border-4 border-card bg-muted-foreground text-card">
                    <Lock className="size-3.5" />
                </span>
            </span>
            <p className="text-balance text-xl font-bold tracking-tight">Checking for this batch has ended</p>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
                This batch is over, so assignments aren&apos;t taken or checked any more. Keep practising with the lessons — they&apos;re all still here, and
                keep building your skills.
            </p>
            {children}
            {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
    );
}

/** A state of the box: an icon, what's happening, a line on what's next, and its buttons. */
function StageMessage({
    icon: Icon,
    tone = "primary",
    title,
    actions,
    children,
}: {
    icon: LucideIcon;
    tone?: "primary" | "danger";
    title: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="mx-auto max-w-xl text-center">
            <span
                className={cn(
                    "mx-auto mb-4 grid size-16 place-items-center rounded-full",
                    tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                )}
            >
                <Icon className="size-7" aria-hidden />
            </span>
            <p className="text-balance text-lg font-semibold">{title}</p>
            <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{children}</p>
            {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
    );
}

/**
 * The result, once it's out: the score, and the three ways into it — their
 * work, the feedback, and a recheck (asked for, or waiting on the mentor, with
 * a way to send the work again for it).
 */
function ScoreStage({
    assignment,
    submission,
    mySubmissionButton,
    onFeedback,
    onRecheck,
    recheckWaiting,
    resent,
    onSendAgain,
}: {
    assignment: StudentAssignment;
    submission: AssignmentSubmission;
    mySubmissionButton: ReactNode;
    onFeedback: () => void;
    onRecheck: () => void;
    /** A recheck is with the mentor. */
    recheckWaiting: boolean;
    /** They sent their work again for it. */
    resent: boolean;
    onSendAgain: () => void;
}) {
    return (
        <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Trophy className="size-7" aria-hidden />
            </span>
            <div className="mx-auto inline-flex flex-col items-center rounded-xl bg-primary px-8 py-4 text-primary-foreground">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Your score</span>
                <span className="text-3xl font-bold tabular-nums">
                    {submission.finalScore}/{assignment.totalMarks}
                </span>
            </div>
            {submission.maxScore !== null && <p className="mt-3 text-xs text-muted-foreground">Handed in late, so marked out of {submission.maxScore}.</p>}
            <MarkChanges submission={submission} />

            <div className="mt-5 flex flex-wrap justify-center gap-2">
                {mySubmissionButton}
                <Button variant="outline" className="rounded-full" onClick={onFeedback}>
                    <MessageSquare className="size-4" aria-hidden /> Feedback
                </Button>
                {assignment.canRecheck ? (
                    <Button variant="outline" className="rounded-full" onClick={onRecheck}>
                        <Scale className="size-4" aria-hidden /> Recheck
                    </Button>
                ) : (
                    recheckWaiting && (
                        <Button variant="outline" className="rounded-full" disabled title="Your mentor is looking at it — one recheck at a time">
                            <Clock className="size-4" aria-hidden /> Recheck waiting
                        </Button>
                    )
                )}
            </div>

            {recheckWaiting && (
                <p className="mt-3 text-xs text-muted-foreground">
                    Your recheck is with your mentor{resent ? " — they'll look at the work you sent again" : ""}. You&apos;ll get a notification when it&apos;s
                    decided.{" "}
                    <button type="button" onClick={onSendAgain} className="font-semibold text-primary underline-offset-2 hover:underline">
                        {resent ? "Change what you sent" : "Send your work again"}
                    </button>
                </p>
            )}

            {assignment.canRecheck && (
                <p className="mt-3 text-xs text-muted-foreground">
                    Think a mark is wrong? A recheck costs {assignment.penalties.recheckFeeMarks} marks — you get them back if your mark goes up. You can send
                    your work again with it.
                </p>
            )}
            <RecheckResult submission={submission} penalties={assignment.penalties} />
        </div>
    );
}

/** One way to pay for a resubmission, as a big button. */
function PayOption({
    icon: Icon,
    title,
    note,
    disabled = false,
    selected,
    onSelect,
}: {
    icon: LucideIcon;
    title: string;
    note: string;
    disabled?: boolean;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent",
                selected ? "border-primary bg-primary/5" : "border-border",
            )}
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
                <span className="block font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{note}</span>
            </span>
        </button>
    );
}

/** What the student sent, as it stands now — for the "My submission" popup. */
function MySubmission({ assignment, submission }: { assignment: StudentAssignment; submission: AssignmentSubmission }) {
    const linkShownInText = Boolean(submission.submissionUrl && submission.content?.includes(submission.submissionUrl));
    const marksPaid = -submission.adjustments.filter((entry) => entry.kind === "RESUBMIT_PENALTY").reduce((sum, entry) => sum + entry.marks, 0);
    const costs = [marksPaid > 0 && `−${marksPaid} marks`, submission.xpDeducted > 0 && `−${submission.xpDeducted} XP`].filter(Boolean);

    return (
        <div className="space-y-4">
            {submission.content ? (
                <p className="whitespace-pre-line rounded-lg bg-secondary/50 p-3 text-sm wrap-break-word">{linkify(submission.content)}</p>
            ) : (
                !submission.submissionUrl && submission.fileUrls.length === 0 && <p className="text-sm text-muted-foreground">Nothing written.</p>
            )}
            {submission.submissionUrl && !linkShownInText && (
                <a
                    href={submission.submissionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                    {submission.submissionUrl} <ExternalLink className="size-3.5" aria-hidden />
                </a>
            )}
            {submission.fileUrls.length > 0 && (
                <SubmissionFiles assignmentId={assignment.id} files={submission.fileUrls.map(attachedFrom)} onChange={() => {}} disabled />
            )}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Submitted {formatDateTime(submission.submittedAt)}
                {submission.maxScore !== null && ` · late, so marked out of ${submission.maxScore} of ${assignment.totalMarks}`}
                {submission.attempts > 1 && ` · sent ${submission.attempts} times`}
                {costs.length > 0 && ` · resubmitting cost ${costs.join(" and ")}`}
            </p>
        </div>
    );
}
