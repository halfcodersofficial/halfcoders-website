import type { SubmissionHistory, SubmissionReviewEntry, SubmissionVersion } from "@/types/mentor.types";

type Recheck = SubmissionHistory["rechecks"][number];

/** One thing that happened to a hand-in, for its history — newest first. */
export type HistoryEvent =
    | { kind: "version"; id: string; at: string; version: SubmissionVersion }
    | { kind: "review"; id: string; at: string; review: SubmissionReviewEntry }
    | { kind: "recheckAsked"; id: string; at: string; recheck: Recheck }
    | { kind: "recheckDecided"; id: string; at: string; recheck: Recheck };

/** The hand-in's versions, markings and rechecks as one list, newest first. Each `id` is its anchor on the history page. */
export const historyEvents = (history: SubmissionHistory): HistoryEvent[] =>
    [
        ...history.versions.map((version) => ({ kind: "version" as const, id: `version-${version.id}`, at: version.submittedAt, version })),
        ...history.reviews.map((review) => ({ kind: "review" as const, id: `review-${review.id}`, at: review.createdAt, review })),
        ...history.rechecks.map((recheck) => ({ kind: "recheckAsked" as const, id: `recheck-${recheck.id}`, at: recheck.createdAt, recheck })),
        ...history.rechecks
            .filter((recheck) => recheck.status !== "PENDING" && recheck.reviewedAt)
            .map((recheck) => ({ kind: "recheckDecided" as const, id: `decided-${recheck.id}`, at: recheck.reviewedAt as string, recheck })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

export const VERSION_LABEL: Record<SubmissionVersion["kind"], string> = {
    FIRST: "Handed in",
    REQUESTED: "Handed in again, after changes were asked",
    VOLUNTARY: "Resubmitted before the results",
    RECHECK: "Sent again for the recheck",
};

const REVIEW_LABEL: Record<string, string> = {
    ACCEPTED: "Marked",
    NEEDS_REVISION: "Changes asked",
    REJECTED: "Rejected",
};

/** What happened, in a few words: "Marked 70/100 by Habib", "Recheck — kept at 70". */
export const eventTitle = (event: HistoryEvent, totalMarks: number) => {
    switch (event.kind) {
        case "version":
            return `${VERSION_LABEL[event.version.kind]} · #${event.version.attempt}`;
        case "review": {
            const { review } = event;
            const label = REVIEW_LABEL[review.status] ?? review.status;
            const mark = review.status === "ACCEPTED" && review.score !== null ? ` ${review.score}/${totalMarks}` : "";
            return `${label}${mark}${review.reviewer ? ` by ${review.reviewer.name}` : ""}`;
        }
        case "recheckAsked":
            return "Recheck asked";
        case "recheckDecided":
            return event.recheck.status === "VALID"
                ? `Recheck — mark raised ${event.recheck.scoreBefore} → ${event.recheck.scoreAfter}`
                : `Recheck — mark kept at ${event.recheck.scoreBefore}`;
    }
};

/** Where the review queue opens on this hand-in, in the tab it sits under. */
export const queueHref = (history: Pick<SubmissionHistory, "id" | "status" | "recheckOpen" | "assignment">) => {
    const params = new URLSearchParams({ course: history.assignment.course.id, assignment: history.assignment.id, focus: history.id });
    if (history.recheckOpen) params.set("recheck", "open");
    else if (history.status !== "SUBMITTED" && history.status !== "UNDER_REVIEW") params.set("status", history.status);
    return `/mentor/reviews?${params.toString()}`;
};
