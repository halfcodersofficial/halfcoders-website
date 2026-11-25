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
            if (event.recheck.status !== "VALID") return `Recheck — mark kept at ${event.recheck.scoreBefore}`;
            // Raised past the mentor's own mark, or only the marks taken off given back.
            return (event.recheck.scoreAfter ?? 0) > event.recheck.scoreBefore
                ? `Recheck — mark raised ${event.recheck.scoreBefore} → ${event.recheck.scoreAfter}`
                : `Recheck — mark raised to ${event.recheck.scoreAfter}, nothing taken off`;
    }
};

/** Where the review queue opens on this hand-in, in the tab it sits under. */
export const queueHref = (history: Pick<SubmissionHistory, "id" | "status" | "recheckOpen" | "assignment">) => {
    const params = new URLSearchParams({ course: history.assignment.course.id, assignment: history.assignment.id, focus: history.id });
    if (history.recheckOpen) params.set("recheck", "open");
    else if (history.status !== "SUBMITTED" && history.status !== "UNDER_REVIEW") params.set("status", history.status);
    return `/mentor/reviews?${params.toString()}`;
};

/**
 * Where a hand-in version or a recheck request stands: resolved once it's
 * been marked (a marking or a recheck decision after it), waiting while it's
 * the latest and not yet marked, replaced when a newer version came in before
 * anyone marked it. Markings and decisions are resolutions themselves — null.
 */
export const eventState = (event: HistoryEvent, history: SubmissionHistory): "resolved" | "waiting" | "replaced" | null => {
    if (event.kind === "recheckAsked") return event.recheck.status === "PENDING" ? "waiting" : "resolved";
    if (event.kind !== "version") return null;

    const sent = new Date(event.version.submittedAt).getTime();
    // Marked while this was the version on hand: after it came in, before the next one did.
    const next = Math.min(
        ...history.versions.map((version) => new Date(version.submittedAt).getTime()).filter((time) => time > sent),
        Number.POSITIVE_INFINITY,
    );
    const markedWhileCurrent = (at: string) => {
        const time = new Date(at).getTime();
        return time >= sent && time < next;
    };
    if (
        history.reviews.some((review) => markedWhileCurrent(review.createdAt)) ||
        history.rechecks.some((recheck) => recheck.reviewedAt !== null && markedWhileCurrent(recheck.reviewedAt))
    ) {
        return "resolved";
    }
    return next === Number.POSITIVE_INFINITY ? "waiting" : "replaced";
};

export const STATE_META = {
    resolved: { label: "Resolved", tone: "bg-success/10 text-success" },
    waiting: { label: "Waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    replaced: { label: "Replaced", tone: "bg-secondary text-muted-foreground" },
} as const;
