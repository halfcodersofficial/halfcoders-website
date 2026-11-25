"use client";

import { Check } from "lucide-react";
import { pad2 } from "@/components/shared/OutlineSyllabus";
import { Eyebrow } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import { cn } from "@/lib/utils";
import type { CourseLearning, LearningMilestone, LearningModule } from "@/types/domain.types";

/** A practice day or assignment that comes after the module in its week. */
export type ModuleTrailItem =
    { kind: "PRACTICE"; entry: LearningMilestone["practiceDays"][number] } | { kind: "ASSIGNMENT"; entry: LearningMilestone["assignments"][number] };

export const TRAIL_LABEL: Record<ModuleTrailItem["kind"], string> = { ASSIGNMENT: "Assignment", PRACTICE: "Practice day" };

interface ModuleCompleteProps {
    course: CourseLearning["course"];
    milestone: LearningMilestone;
    courseModule: LearningModule;
    /**
     * What was just finished: the last practice day or assignment after the
     * module that's done — or null, the module itself.
     */
    finished: ModuleTrailItem | null;
}

/** Bits of confetti around the tick — decoration only. */
const CONFETTI = [
    "-left-10 top-1 h-2 w-3.5 rotate-12 bg-syn-string delay-100",
    "-left-6 bottom-0 size-2 rounded-full bg-syn-number delay-200",
    "-right-9 top-0 h-3.5 w-2 -rotate-12 bg-syn-func delay-150",
    "-right-12 bottom-3 h-2 w-3 rotate-45 bg-syn-tag delay-300",
    "left-2 -top-7 size-1.5 rounded-full bg-syn-keyword delay-200",
    "right-3 -top-6 h-1.5 w-3 -rotate-6 bg-primary delay-100",
    "-left-14 top-10 size-1.5 rounded-full bg-syn-func delay-300",
    "-right-5 -bottom-4 size-1.5 rounded-full bg-syn-string delay-150",
];

/** "You finished …" — and, for an assignment still being checked, what happens next. */
function FinishedLine({ finished, courseModule }: { finished: ModuleTrailItem | null; courseModule: LearningModule }) {
    const name = (title: string) => <span className="font-semibold text-editor-fg">&ldquo;{title}&rdquo;</span>;

    if (!finished) return <>Congratulations — you finished {name(courseModule.title)}.</>;
    if (finished.kind === "PRACTICE") return <>Congratulations — you finished {name(finished.entry.title)}.</>;

    const { entry } = finished;
    if (entry.isAccepted) return <>Congratulations — you finished {name(entry.title)}.</>;
    if (entry.submissionStatus === "NEEDS_REVISION") {
        return <>You handed in {name(entry.title)} — it needs a few changes. Open it from the course list to see what to fix.</>;
    }
    return <>Congratulations — you handed in {name(entry.title)}. Your mark shows on its page once it&apos;s checked.</>;
}

/**
 * The finish line of a module and the practice days and assignments after
 * it, shown in the player's place: a "well done" for whatever was just
 * finished — the module, a practice day or an assignment. Where to go from
 * here is the player's Previous / Next below it and the course list beside it.
 */
export default function ModuleComplete({ course, milestone, courseModule, finished }: ModuleCompleteProps) {
    const moduleLabel = course.moduleLabel || "Module";
    const place = `${course.milestoneLabel} ${pad2(milestone.order)} · ${moduleLabel} ${pad2(courseModule.order)}`;
    const label = finished ? TRAIL_LABEL[finished.kind] : moduleLabel;

    return (
        <EditorWindow
            tabs={[{ name: "done.md", label: `${label} complete`, active: true }]}
            status={
                <>
                    <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3" strokeWidth={3} aria-hidden /> All done
                    </span>
                    <span className="truncate">{place}</span>
                </>
            }
            className="mx-auto w-full max-w-6xl"
            bodyClassName="relative isolate overflow-hidden"
        >
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10" />
            <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 -z-10 size-96 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary-500/25 blur-3xl"
            />

            <div className="flex flex-col items-center px-5 py-12 text-center sm:px-10 sm:py-16">
                <div className="relative">
                    {CONFETTI.map((piece) => (
                        <span
                            key={piece}
                            aria-hidden
                            className={cn("absolute rounded-[2px] fill-mode-both animate-in fade-in zoom-in-0 duration-700 motion-reduce:animate-none", piece)}
                        />
                    ))}
                    <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_8px_color-mix(in_oklch,var(--violet-500)_25%,transparent)] animate-in zoom-in-50 duration-500 motion-reduce:animate-none sm:size-24">
                        <Check className="size-10 sm:size-12" strokeWidth={3} aria-hidden />
                    </span>
                </div>

                <Eyebrow className="mt-8">{place}</Eyebrow>
                <h2 className="mt-2 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{label} complete!</h2>
                <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-editor-muted sm:text-base">
                    <FinishedLine finished={finished} courseModule={courseModule} />
                </p>
                {!finished && <p className="mt-1.5 max-w-xl text-pretty text-sm leading-relaxed text-editor-muted">Well done — keep going.</p>}
            </div>
        </EditorWindow>
    );
}
