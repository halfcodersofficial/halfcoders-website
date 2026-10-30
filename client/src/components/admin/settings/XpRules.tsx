"use client";

import { RotateCcw } from "lucide-react";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ZodFormApi } from "@/hooks/useZodForm";
import { cn } from "@/lib/utils";

export const MAX_XP = 10_000;

/**
 * Every XpSource, grouped the way a student meets them, with exactly when
 * each is awarded (see `awardXp` and its callers on the API). Each award is
 * once per thing — re-completing a lesson or re-grading an assignment never
 * stacks.
 */
export const XP_GROUPS = [
    {
        label: "Learning",
        sources: [
            { key: "VIDEO_COMPLETE", label: "Lesson completed", when: "Each lesson a student finishes — once per lesson." },
            { key: "QUIZ_COMPLETE", label: "Quiz submitted", when: "A module's quiz handed in — once per quiz, whatever the score." },
            { key: "MODULE_COMPLETE", label: "Module completed", when: "Every lesson in a module finished." },
            { key: "MILESTONE_COMPLETE", label: "Milestone completed", when: "A whole milestone finished." },
            { key: "COURSE_COMPLETE", label: "Course completed", when: "The course finished end to end." },
        ],
    },
    {
        label: "Assignments",
        sources: [
            { key: "ASSIGNMENT_SUBMIT", label: "Assignment submitted", when: "Handed in — once per assignment." },
            {
                key: "ASSIGNMENT_SCORE",
                label: "Assignment accepted",
                when: "At full marks; a lower mark earns its share — half marks, half the XP.",
            },
        ],
    },
    {
        label: "Practice & support",
        sources: [
            { key: "PRACTICE_COMPLETE", label: "Practice day done", when: "A bootcamp practice day marked complete." },
            { key: "SUPPORT_PARTICIPATION", label: "Joined a support session", when: "Taking a place in a session's queue — once per session." },
        ],
    },
] as const;

export const XP_SOURCE_KEYS = XP_GROUPS.flatMap((group) => group.sources.map((source) => source.key));

/**
 * The XP table: each award with when it fires, a bar for its weight against
 * the largest award (so a lopsided economy shows at a glance), and its
 * points — with the built-in value one click away once it's been changed.
 */
export default function XpRules({
    form,
    defaults,
}: {
    form: ZodFormApi<Record<string, string>>;
    defaults: Record<string, number>;
}) {
    const points = (key: string) => {
        const value = Number(form.values[key]);
        return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const largest = Math.max(1, ...XP_SOURCE_KEYS.map(points));

    return (
        <div className="space-y-6">
            {XP_GROUPS.map((group) => (
                <div key={group.label}>
                    <p className="text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{group.label}</p>
                    <ul className="mt-1 divide-y divide-border">
                        {group.sources.map((source) => {
                            const fallback = defaults[source.key];
                            const changed = form.values[source.key] !== String(fallback);

                            return (
                                <li
                                    key={source.key}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_9rem_auto]"
                                >
                                    <div className="min-w-0 pt-1">
                                        <p className="text-sm font-medium">{source.label}</p>
                                        <p className="text-xs text-muted-foreground">{source.when}</p>
                                    </div>

                                    <div className="hidden pt-3.5 md:block" aria-hidden>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                            <div
                                                className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
                                                style={{ width: `${(points(source.key) / largest) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <button
                                            type="button"
                                            onClick={() => form.setValue(source.key, String(fallback))}
                                            title={`Back to the default, ${fallback} XP`}
                                            aria-label={`Set ${source.label} back to its default, ${fallback} XP`}
                                            className={cn(
                                                "mt-2 inline-flex h-7 w-14 shrink-0 items-center justify-end gap-1 rounded-md px-1.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                                                !changed && "invisible",
                                            )}
                                        >
                                            <RotateCcw className="size-3" aria-hidden />
                                            {fallback}
                                        </button>
                                        <FormField
                                            form={form}
                                            name={source.key}
                                            label={<span className="sr-only">{source.label}, in XP</span>}
                                            className="w-28"
                                        >
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                max={MAX_XP}
                                                step={1}
                                                addonStart="XP"
                                                className="tabular-nums"
                                            />
                                        </FormField>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
