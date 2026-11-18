"use client";

import { CheckCircle2, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { linkify } from "@/lib/linkify";
import { formatDateTime } from "@/lib/utils";
import type { LearningMilestone } from "@/types/domain.types";

type PracticeDay = LearningMilestone["practiceDays"][number];

/**
 * The page of a practice day with no lessons of its own — its one stop: what
 * it's for. "Next" under it marks the day done, the same way "Next" on the
 * last lesson of a day that has lessons does. Practice is self-marked —
 * nothing to hand in, no mentor review.
 */
export default function PracticePane({
    practice,
    isPreview,
}: {
    practice: PracticeDay;
    /** Staff previewing the course — nothing is marked. */
    isPreview: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">
                        <Dumbbell className="size-3" /> Practice day
                    </Badge>
                    {practice.isCompleted && (
                        <Badge variant="success">
                            <CheckCircle2 className="size-3" /> Done
                        </Badge>
                    )}
                </div>
                <h2 className="mt-3 text-xl font-bold leading-tight wrap-break-word">{practice.title}</h2>
                {practice.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground wrap-break-word">{linkify(practice.description)}</p>
                )}
            </div>

            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {isPreview
                    ? "Students practise, then click Next — that marks the day done. Nothing to hand in."
                    : practice.isCompleted
                      ? `You finished this practice day${practice.completedAt ? ` on ${formatDateTime(practice.completedAt)}` : ""}.`
                      : "Practise what's above, then click Next — that marks the day done."}
            </p>
        </div>
    );
}
