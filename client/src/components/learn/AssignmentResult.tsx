"use client";

import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Scale } from "lucide-react";
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
    RECHECK_REFUND: "Given back when the mark was raised",
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
 * What the "Feedback" popup shows: just the mentor's feedback — what they
 * wrote, their marks per part when the assignment has a rubric, and who
 * marked it. How the mark changed after that, and rechecks, sit under the
 * score instead (`MarkChanges`, `RecheckResult`).
 */
export function ResultDetails({ assignment, submission }: { assignment: StudentAssignment; submission: AssignmentSubmission }) {
    const hasRubric = (submission.rubricScores?.length ?? 0) > 0;

    return (
        <div className="space-y-4">
            <section aria-label="Feedback">
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="size-4 text-primary" aria-hidden /> What your mentor said
                </h3>
                {submission.feedback ? (
                    <p className="whitespace-pre-line text-sm wrap-break-word">{submission.feedback}</p>
                ) : (
                    <p className="text-sm text-muted-foreground">No written feedback{hasRubric ? " — the marks per part are below." : "."}</p>
                )}
            </section>

            {hasRubric && (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/60 text-sm">
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
                <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                    <Avatar src={submission.reviewedBy.image} name={submission.reviewedBy.name} size={28} />
                    <span className="text-xs text-muted-foreground">
                        Marked by {submission.reviewedBy.name} · {formatDateTime(submission.reviewedAt)}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * How the mentor's mark became the final one, in one line under the score:
 * "Your mentor gave 70 · Recheck fee −2 · …". Null when nothing changed it.
 */
export function MarkChanges({ submission }: { submission: AssignmentSubmission }) {
    // Nothing to explain when the mark is exactly the one given — after a raise on recheck, say.
    if (submission.score === null || submission.adjustments.length === 0 || submission.finalScore === submission.score) return null;
    return (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Your mentor gave <span className="font-semibold tabular-nums text-foreground">{submission.score}</span>
            {submission.adjustments.map((entry) => (
                <span key={entry.id}>
                    {" · "}
                    {ADJUSTMENT_LABEL[entry.kind]}{" "}
                    <span className={cn("font-semibold tabular-nums", entry.marks < 0 ? "text-destructive-ink" : "text-success-ink")}>
                        {signed(entry.marks)}
                    </span>
                </span>
            ))}
        </p>
    );
}

/** What came of the newest recheck, once decided — with the mentor's reply. Null while there's none, or it's waiting. */
export function RecheckResult({ submission, penalties }: { submission: AssignmentSubmission; penalties: StudentAssignment["penalties"] }) {
    const latest = submission.rechecks[0];
    if (!latest || latest.status === "PENDING") return null;
    const valid = latest.status === "VALID";

    return (
        <div className="mx-auto mt-4 max-w-md rounded-lg border border-border/60 bg-card/60 p-3 text-left text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
                <Scale className="size-4 text-primary" aria-hidden /> Your recheck
                <Badge variant={RECHECK_META[latest.status].variant}>{RECHECK_META[latest.status].label}</Badge>
            </p>
            <p className={cn("mt-1.5", valid ? "text-success-ink" : "text-destructive-ink")}>
                {valid
                    ? `Your mentor raised your mark to ${latest.scoreAfter} — that's your mark now, with nothing taken off.`
                    : `The mark stayed at ${latest.scoreBefore}, so ${penalties.recheckInvalidMarks} more marks were taken.`}
            </p>
            {latest.reviewerNote && <p className="mt-1.5 whitespace-pre-line text-muted-foreground wrap-break-word">Mentor: {latest.reviewerNote}</p>}
        </div>
    );
}

/**
 * Asking for a recheck: why, in the student's words, under exactly what it
 * costs and what each outcome means — so nobody is surprised by the fee.
 */
export function RecheckDialog({
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
            toast.success(`Recheck requested — ${fee} marks were taken for now. You can send your work again below.`);
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
                        <li>If you deserved more, your mark becomes exactly what your mentor gives — everything taken off comes back.</li>
                        <li>
                            If the mark was right, {extra} more marks are taken — {fee + extra} for this recheck in all.
                        </li>
                        <li>Fixed something? After asking, you can send your work again — your mentor rechecks the version you send.</li>
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
