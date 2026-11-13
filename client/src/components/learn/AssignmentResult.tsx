"use client";

import { useMutation } from "@tanstack/react-query";
import { Clock, MessageSquare, Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { assignmentService } from "@/services";
import type { AssignmentRecheck, AssignmentSubmission, MarkAdjustment, StudentAssignment } from "@/types/learning.types";

const ADJUSTMENT_LABEL: Record<MarkAdjustment["kind"], string> = {
    RESUBMIT_PENALTY: "Resubmitted before the results",
    RECHECK_FEE: "Recheck fee",
    RECHECK_REFUND: "Recheck fee given back",
    RECHECK_PENALTY: "Recheck: the mark was right",
};

const RECHECK_META: Record<AssignmentRecheck["status"], { label: string; variant: "secondary" | "success" | "destructive" }> = {
    PENDING: { label: "Waiting for your mentor", variant: "secondary" },
    VALID: { label: "Mark raised", variant: "success" },
    INVALID: { label: "Mark unchanged", variant: "destructive" },
};

/** "−3" or "+2", with a real minus sign. */
const signed = (marks: number) => (marks > 0 ? `+${marks}` : `−${Math.abs(marks)}`);

/** The minimum a reason has to be — the API's too. */
const MIN_REASON = 10;

/**
 * A hand-in's verdict, once the student may see it. Work sent back shows the
 * mentor's feedback. A mark shows as the final mark — the mentor's mark after
 * every penalty and refund — with each change listed under it, the feedback
 * and rubric, and the rechecks: asked for here, with what one costs spelled
 * out before it's sent, and each past one with what came of it.
 */
export default function AssignmentResult({
    assignment,
    submission,
    onChanged,
}: {
    assignment: StudentAssignment;
    submission: AssignmentSubmission;
    /** After a recheck is asked for: the page refetches. */
    onChanged: () => void;
}) {
    const [asking, setAsking] = useState(false);
    const accepted = submission.status === "ACCEPTED";
    const outOf = assignment.totalMarks;
    const { penalties } = assignment;

    return (
        <div className={cn("rounded-xl border p-6 shadow-sm", accepted ? "border-success/40 bg-success/5" : "border-accent/40 bg-accent/5")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                    <MessageSquare className="size-4" aria-hidden /> {accepted ? "Your result" : "Mentor feedback"}
                </h2>
                {accepted && submission.finalScore !== null && (
                    <span className="text-lg font-bold tabular-nums">
                        {submission.finalScore}
                        <span className="text-sm font-normal text-muted-foreground">
                            /{outOf}
                            {submission.maxScore !== null && ` · late, marked out of ${submission.maxScore}`}
                        </span>
                    </span>
                )}
            </div>

            {/* How the final mark was reached — only when anything changed it. */}
            {accepted && submission.score !== null && submission.adjustments.length > 0 && (
                <dl className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60 bg-card/60 text-sm">
                    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
                        <dt>Your mentor&apos;s mark</dt>
                        <dd className="font-semibold tabular-nums">{submission.score}</dd>
                    </div>
                    {submission.adjustments.map((entry) => (
                        <div key={entry.id} className="flex items-baseline justify-between gap-4 px-3 py-2">
                            <dt className="min-w-0">
                                {ADJUSTMENT_LABEL[entry.kind]}
                                <span className="block text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                            </dt>
                            <dd className={cn("shrink-0 font-semibold tabular-nums", entry.marks < 0 ? "text-destructive-ink" : "text-success-ink")}>
                                {signed(entry.marks)}
                            </dd>
                        </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-4 bg-secondary/40 px-3 py-2 font-semibold">
                        <dt>Final mark</dt>
                        <dd className="tabular-nums">
                            {submission.finalScore} / {outOf}
                        </dd>
                    </div>
                </dl>
            )}

            {submission.feedback && <p className="mt-4 whitespace-pre-line text-sm">{submission.feedback}</p>}

            {(submission.rubricScores?.length ?? 0) > 0 && (
                <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60 bg-card/60 text-sm">
                    {assignment.rubric.map((line) => {
                        const given = submission.rubricScores?.find((score) => score.criterionId === line.id);
                        if (!given) return null;
                        return (
                            <li key={line.id} className="px-3 py-2">
                                <span className="flex items-baseline justify-between gap-4">
                                    <span className="font-medium">{line.title}</span>
                                    <span className="shrink-0 tabular-nums">
                                        <span className="font-semibold">{given.points}</span>
                                        <span className="text-muted-foreground"> / {line.maxPoints}</span>
                                    </span>
                                </span>
                                {given.comment && <span className="mt-0.5 block text-xs text-muted-foreground">{given.comment}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}

            {submission.reviewedBy && submission.reviewedAt && (
                <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                    <Avatar src={submission.reviewedBy.image} name={submission.reviewedBy.name} size={28} />
                    <span className="text-xs text-muted-foreground">
                        {submission.reviewedBy.name} · {formatDateTime(submission.reviewedAt)}
                    </span>
                </div>
            )}

            {accepted && (assignment.canRecheck || submission.rechecks.length > 0) && (
                <section aria-label="Rechecks" className="mt-5 space-y-3 border-t border-border/50 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <Scale className="size-4" aria-hidden /> Recheck
                        </h3>
                        {assignment.canRecheck && (
                            <Button type="button" size="sm" variant="outline" onClick={() => setAsking(true)}>
                                Ask for a recheck
                            </Button>
                        )}
                    </div>
                    {assignment.canRecheck && submission.rechecks.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Think your mark is wrong? Ask your mentor to look again. It costs {penalties.recheckFeeMarks} marks, which you get
                            back if your mark goes up.
                        </p>
                    )}
                    {submission.rechecks.length > 0 && (
                        <ol className="space-y-2">
                            {submission.rechecks.map((recheck) => (
                                <RecheckEntry key={recheck.id} recheck={recheck} penalties={penalties} />
                            ))}
                        </ol>
                    )}
                </section>
            )}

            <RecheckDialog
                open={asking}
                onOpenChange={setAsking}
                assignmentId={assignment.id}
                currentMark={submission.finalScore ?? 0}
                outOf={outOf}
                penalties={penalties}
                onDone={() => {
                    setAsking(false);
                    onChanged();
                }}
            />
        </div>
    );
}

/** One recheck: when it was asked, why, and what came of it. */
function RecheckEntry({ recheck, penalties }: { recheck: AssignmentRecheck; penalties: StudentAssignment["penalties"] }) {
    const meta = RECHECK_META[recheck.status];
    return (
        <li className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Asked {formatDateTime(recheck.createdAt)}</span>
                <Badge variant={meta.variant}>
                    {recheck.status === "PENDING" && <Clock className="size-3" aria-hidden />}
                    {meta.label}
                </Badge>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-muted-foreground">“{recheck.reason}”</p>
            {recheck.status === "VALID" && (
                <p className="mt-2 font-medium text-success-ink">
                    Your mentor raised the mark from {recheck.scoreBefore} to {recheck.scoreAfter}, and the {penalties.recheckFeeMarks}-mark fee was
                    given back.
                </p>
            )}
            {recheck.status === "INVALID" && (
                <p className="mt-2 font-medium text-destructive-ink">
                    The mark stayed at {recheck.scoreBefore}. {penalties.recheckInvalidMarks} more marks were taken (
                    {penalties.recheckFeeMarks + penalties.recheckInvalidMarks} for this recheck in all).
                </p>
            )}
            {recheck.status === "PENDING" && (
                <p className="mt-2 text-muted-foreground">
                    {penalties.recheckFeeMarks} marks were taken when you asked. You&apos;ll be notified when your mentor decides.
                </p>
            )}
            {recheck.reviewerNote && <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">Mentor: {recheck.reviewerNote}</p>}
        </li>
    );
}

/**
 * Asking for a recheck: why, in the student's words, under exactly what it
 * costs and what each outcome means — so nobody is surprised by the fee.
 */
function RecheckDialog({
    open,
    onOpenChange,
    assignmentId,
    currentMark,
    outOf,
    penalties,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assignmentId: string;
    currentMark: number;
    outOf: number;
    penalties: StudentAssignment["penalties"];
    onDone: () => void;
}) {
    const [reason, setReason] = useState("");
    const fee = penalties.recheckFeeMarks;
    const extra = penalties.recheckInvalidMarks;
    const tooShort = reason.trim().length < MIN_REASON;

    const ask = useMutation({
        mutationFn: () => assignmentService.requestRecheck(assignmentId, reason.trim()),
        onSuccess: () => {
            toast.success(`Recheck requested — ${fee} marks were taken for now.`);
            setReason("");
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't ask for a recheck.")),
    });

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Ask for a recheck" size="sm" closeOnOutsideClick={false}>
            <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!tooShort) ask.mutate();
                }}
            >
                <ModalBody className="space-y-4">
                    <ul className="space-y-1.5 rounded-lg bg-secondary/50 p-3 text-sm">
                        <li>
                            <span className="font-semibold">{fee} marks are taken now</span> — your mark goes from {currentMark} to{" "}
                            {Math.max(0, currentMark - fee)} out of {outOf} while your mentor looks again.
                        </li>
                        <li>If you deserved more, your mark goes up and the {fee} marks come back.</li>
                        <li>
                            If the mark was right, {extra} more marks are taken — {fee + extra} for this recheck in all.
                        </li>
                    </ul>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">
                            Why should it be looked at again? <span className="text-destructive">*</span>
                        </span>
                        <Textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder="Which part do you think was marked wrong, and why?"
                        />
                        {tooShort && reason.length > 0 && (
                            <span className="block text-xs text-muted-foreground">A sentence or two, please — at least {MIN_REASON} characters.</span>
                        )}
                    </label>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={tooShort} isLoading={ask.isPending}>
                        Ask for a recheck · −{fee} marks
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
