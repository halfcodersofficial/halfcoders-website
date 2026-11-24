"use client";

import { Check } from "lucide-react";
import { pad2 } from "@/components/shared/OutlineSyllabus";
import { Eyebrow } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import type { CourseLearning, LearningMilestone, LearningModule } from "@/types/domain.types";

interface ModuleCompleteProps {
    course: CourseLearning["course"];
    milestone: LearningMilestone;
    courseModule: LearningModule;
}

/**
 * The finish line of a module, shown in the player's place: just that it's
 * done. Where to go from here is the player's Previous / Next below it and
 * the course list beside it.
 */
export default function ModuleComplete({ course, milestone, courseModule }: ModuleCompleteProps) {
    const moduleLabel = course.moduleLabel || "Module";
    const place = `${course.milestoneLabel} ${pad2(milestone.order)} · ${moduleLabel} ${pad2(courseModule.order)}`;

    return (
        <EditorWindow
            tabs={[{ name: "module.md", label: `${moduleLabel} complete`, active: true }]}
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
            <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-primary-500/25 blur-3xl" />

            <div className="flex flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:px-10 sm:py-14">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_6px_color-mix(in_oklch,var(--violet-500)_25%,transparent)] animate-in zoom-in-50 duration-500 motion-reduce:animate-none">
                    <Check className="size-7" strokeWidth={3} aria-hidden />
                </span>
                <div className="min-w-0">
                    <Eyebrow>{place}</Eyebrow>
                    <h2 className="mt-1.5 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{moduleLabel} complete!</h2>
                    <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-editor-muted sm:text-base">
                        You finished <span className="font-semibold text-editor-fg">&ldquo;{courseModule.title}&rdquo;</span>. Well done — keep going.
                    </p>
                </div>
            </div>
        </EditorWindow>
    );
}
