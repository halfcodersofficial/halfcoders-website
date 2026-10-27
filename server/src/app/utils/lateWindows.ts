import status from "http-status";
import AppError from "../errorHelpers/AppError";

/**
 * Late-submission windows for assignments — pure rules, no database. An
 * assignment's `lateTiers` extend its deadline: a first submission after the
 * deadline but by a window's `until` is marked out of that window's
 * `maxMarks`; after the last window, submissions close.
 */

export type LateTier = { until: Date; maxMarks: number };

/** Reads the stored JSON back into dates, skipping anything malformed. */
export const parseLateTiers = (value: unknown): LateTier[] =>
    (Array.isArray(value) ? value : [])
        .map((tier) => ({
            until: new Date((tier as { until?: string }).until ?? ""),
            maxMarks: Number((tier as { maxMarks?: number }).maxMarks),
        }))
        .filter((tier) => !Number.isNaN(tier.until.getTime()) && Number.isInteger(tier.maxMarks))
        .sort((a, b) => a.until.getTime() - b.until.getTime());

/**
 * Checks a set of late windows against the assignment they belong to and
 * returns them ready to store. Each window must end after the deadline and
 * after the window before it, and allow fewer marks than the one before it —
 * starting below the full `totalMarks`. Windows mean nothing without a
 * deadline, so an assignment without one stores none.
 */
export const normaliseLateTiers = (tiers: LateTier[], deadline: Date | null, totalMarks: number) => {
    if (tiers.length === 0 || !deadline) {
        if (tiers.length > 0) {
            throw new AppError(status.BAD_REQUEST, "Set a deadline before adding late windows.");
        }
        return [];
    }

    const sorted = [...tiers].sort((a, b) => a.until.getTime() - b.until.getTime());
    let previousUntil = deadline;
    let previousMarks = totalMarks;

    for (const tier of sorted) {
        if (tier.until.getTime() <= previousUntil.getTime()) {
            throw new AppError(
                status.BAD_REQUEST,
                "Each late window must end after the deadline and after the window before it.",
            );
        }
        if (tier.maxMarks >= previousMarks) {
            throw new AppError(
                status.BAD_REQUEST,
                `Each late window must allow fewer marks than the one before it (the first, fewer than the full ${totalMarks}).`,
            );
        }
        previousUntil = tier.until;
        previousMarks = tier.maxMarks;
    }

    return sorted.map((tier) => ({ until: tier.until.toISOString(), maxMarks: tier.maxMarks }));
};

/**
 * Where a submission made `at` lands: on time (full marks), inside a late
 * window (capped at its `maxMarks`), or closed — past the deadline and every
 * window. No deadline means always on time.
 */
export const submissionWindow = (
    assignment: { deadline: Date | null; lateTiers: unknown },
    at: Date,
): { status: "ON_TIME"; maxScore: null } | { status: "LATE"; maxScore: number; until: Date } | { status: "CLOSED" } => {
    if (!assignment.deadline || at.getTime() <= assignment.deadline.getTime()) {
        return { status: "ON_TIME", maxScore: null };
    }
    const tier = parseLateTiers(assignment.lateTiers).find((t) => at.getTime() <= t.until.getTime());
    return tier ? { status: "LATE", maxScore: tier.maxMarks, until: tier.until } : { status: "CLOSED" };
};
