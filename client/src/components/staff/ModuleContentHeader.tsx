"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import WeekItemPager from "@/components/staff/WeekItemPager";
import { BackButton } from "@/components/ui/back-button";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The head of a module's content pages — which module this is and where it
 * sits in the course. Its quiz is added and opened from the lesson page's
 * "Add a lesson" tiles and lesson list, so the quiz page leads back there.
 * Previous / next walk everything in the course in order — modules, and the
 * assignments and practice days between them (`WeekItemPager`).
 *
 * Reads the same curriculum query the Module Manager does, so arriving from
 * there costs no extra request.
 */
export default function ModuleContentHeader({
    courseId,
    moduleId,
    area,
    active,
    actions,
}: {
    courseId: string;
    moduleId: string;
    area: StaffArea;
    active: "lessons" | "quiz";
    /** Page-specific buttons at the right of the title row. */
    actions?: ReactNode;
}) {
    const routes = staffCourseRoutes(area, courseId);

    const { data: course } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    const { data: milestones } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    const current = (milestones ?? [])
        .flatMap((milestone) => milestone.modules.map((courseModule) => ({ milestone, courseModule })))
        .find(({ courseModule }) => courseModule.id === moduleId);

    const milestoneLabel = course?.milestoneLabel ?? "Milestone";
    const moduleLabel = course?.moduleLabel ?? "Module";
    const onQuiz = active === "quiz";

    return (
        <header className="space-y-4">
            {onQuiz ? (
                <BackButton href={routes.module(moduleId)} label={`${moduleLabel} lessons`} />
            ) : (
                <BackButton href={routes.modules} label="Module Manager" />
            )}

            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    {current && (
                        <p className="text-xs font-semibold font-mono uppercase tracking-wider text-primary">
                            {milestoneLabel} {pad(current.milestone.order)} · {moduleLabel} {pad(current.courseModule.order)}
                            {onQuiz && " · Quiz"}
                        </p>
                    )}
                    <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{current?.courseModule.title ?? moduleLabel}</h1>
                    {current && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span
                                className={cn(
                                    "rounded-sm px-2 py-px text-xs font-semibold",
                                    current.courseModule.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                                )}
                            >
                                {current.courseModule.isPublished ? "Live" : "Draft"}
                            </span>
                            {!current.courseModule.isPublished && current.courseModule.releaseAt && (
                                <span className="inline-flex items-center gap-1 font-medium text-primary">
                                    <CalendarClock className="size-3.5" aria-hidden />
                                    Goes live {formatDateTime(current.courseModule.releaseAt)}
                                </span>
                            )}
                            <span className="truncate">in {current.milestone.title}</span>
                        </p>
                    )}
                </div>

                <WeekItemPager courseId={courseId} area={area} kind="MODULE" id={moduleId} />

                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </header>
    );
}
