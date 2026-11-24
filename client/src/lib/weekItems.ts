import type { WeekItemKind } from "@/services/curriculum";
import type { MentorMilestone } from "@/types/mentor.types";

type WeekModule = MentorMilestone["modules"][number];
type WeekAssignment = MentorMilestone["assignments"][number];
type WeekPractice = MentorMilestone["practiceDays"][number];

/** One row of a week's single list — `key` is its sortable id, `${kind}:${id}`. */
export type WeekItem =
    | { kind: "MODULE"; key: string; entry: WeekModule }
    | { kind: "ASSIGNMENT"; key: string; entry: WeekAssignment }
    | { kind: "PRACTICE"; key: string; entry: WeekPractice };

const KIND_RANK: Record<WeekItemKind, number> = { MODULE: 0, ASSIGNMENT: 1, PRACTICE: 2 };

/**
 * A week's modules, assignments and practice days as the one list students
 * see, in its saved order — the Module Manager's rows, and what the editors'
 * Previous / Next walk. Ties (rows that predate `position`) fall back to
 * modules first, then each kind's own order.
 */
export const weekItems = (milestone: MentorMilestone): WeekItem[] =>
    [
        ...milestone.modules.map((entry) => ({ kind: "MODULE" as const, key: `MODULE:${entry.id}`, entry })),
        ...milestone.assignments.map((entry) => ({ kind: "ASSIGNMENT" as const, key: `ASSIGNMENT:${entry.id}`, entry })),
        ...milestone.practiceDays.map((entry) => ({ kind: "PRACTICE" as const, key: `PRACTICE:${entry.id}`, entry })),
    ].sort((a, b) => a.entry.position - b.entry.position || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.entry.order - b.entry.order);
