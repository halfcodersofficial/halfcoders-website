import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * What a "something changed for you" push refreshes: the pages that show a
 * person where they stand — their dashboard, courses, orders, certificates,
 * support line — and, for staff, what's waiting on them. Never an editor's
 * form: refetching the data a form was filled from could undo what someone
 * is typing. Only the queries on screen refetch; the rest just go stale and
 * refresh when next opened.
 */
const LIVE_QUERIES: QueryKey[] = [
    ["notifications"],
    ["dashboard"],
    ["learning"],
    ["certificates"],
    ["admission-ticket"],
    ["orders"],
    ["order"],
    ["bundle-order"],
    ["refunds"],
    ["leaderboard"],
    ["conceptual", "my-courses"],
    ["student-profile", "overview"],
    ["support", "sessions"],
    ["support", "position"],
    ["support", "student-board"],
    ["support", "feedback"],
    ["support", "board"],
    ["support", "history"],
    // Staff: payments, refunds, support and questions waiting on them.
    ["admin", "dashboard"],
    ["admin", "orders"],
    ["admin", "order-courses"],
    ["admin", "refunds"],
    ["admin", "bundle-orders"],
    ["admin", "support"],
    ["admin", "support-courses"],
    ["admin", "support-course"],
    ["lesson-questions", "inbox"],
];

export const refreshLiveData = (queryClient: QueryClient) =>
    Promise.all(LIVE_QUERIES.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
