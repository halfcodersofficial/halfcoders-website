import { SubmissionStatus } from "../../generated/prisma/enums";

/**
 * What resubmitting and rechecking an assignment cost — the one place the
 * amounts live. The student's assignment endpoint hands them to the page, so
 * what a student is shown and what is taken can never disagree.
 *
 * Before an assignment's results are published, a student may resubmit as
 * often as they like; every resubmission after the first hand-in costs
 * `resubmitMarks` off their final mark and `resubmitXp` off their course XP.
 * A resubmission the mentor asked for ("Needs revision", or a rejection) is
 * free. After publication resubmitting closes; a recheck costs
 * `recheckFeeMarks` at once — refunded if the mark is raised, followed by a
 * further `recheckInvalidMarks` if it stands.
 */
export const ASSIGNMENT_PENALTIES = {
    resubmitMarks: 3,
    resubmitXp: 5,
    recheckFeeMarks: 2,
    recheckInvalidMarks: 3,
} as const;

export type AssignmentPenalties = typeof ASSIGNMENT_PENALTIES;

/** A student's mark after every penalty and refund: never below zero. Null while unmarked. */
export const finalScore = (score: number | null, markAdjustment: number): number | null =>
    score === null ? null : Math.max(0, score + markAdjustment);

/**
 * Whether a hand-in's mark is still kept from its student: a marked
 * (accepted) one waits for the assignment's results to be published. Work
 * sent back (changes asked, or rejected) never waits — the student needs the
 * feedback to act on it.
 */
export const isResultHidden = (status: SubmissionStatus, resultsPublishedAt: Date | null) =>
    status === SubmissionStatus.ACCEPTED && !resultsPublishedAt;

/** The fields `forStudent` reads, or clears while the mark is hidden. */
export type StudentSubmissionFields = {
    status: SubmissionStatus;
    score: number | null;
    markAdjustment: number;
    feedback?: string | null;
    reviewedAt?: Date | null;
    reviewedById?: string | null;
    reviewedBy?: unknown;
    rubricScores?: unknown[];
};

/**
 * A hand-in as its own student may see it, with its final mark (after every
 * penalty and refund). While the results are unpublished a marked one reads as
 * still waiting: no verdict, score, feedback, rubric or reviewer — nothing
 * that would give the mark away. Every student-facing read of a hand-in goes
 * through here.
 */
export const forStudent = <T extends StudentSubmissionFields>(submission: T, resultsPublishedAt: Date | null) => {
    if (!isResultHidden(submission.status, resultsPublishedAt)) {
        return { ...submission, finalScore: finalScore(submission.score, submission.markAdjustment), resultHidden: false };
    }
    return {
        ...submission,
        status: SubmissionStatus.SUBMITTED,
        score: null,
        finalScore: null,
        resultHidden: true,
        ...("feedback" in submission ? { feedback: null } : {}),
        ...("reviewedAt" in submission ? { reviewedAt: null } : {}),
        ...("reviewedById" in submission ? { reviewedById: null } : {}),
        ...("reviewedBy" in submission ? { reviewedBy: null } : {}),
        ...("rubricScores" in submission ? { rubricScores: [] } : {}),
    } as T & { finalScore: number | null; resultHidden: boolean };
};
