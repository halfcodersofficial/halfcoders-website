"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, HelpCircle, PlayCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The head of a module's content pages — which module this is, where it sits
 * in the course, and tabs between its lessons and its quiz. Previous / next
 * walk the course's modules in order, so a mentor filling a whole course
 * never has to go back to the Module Manager between modules.
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

    const flat = (milestones ?? []).flatMap((milestone) =>
        milestone.modules.map((courseModule) => ({ milestone, courseModule })),
    );
    const index = flat.findIndex(({ courseModule }) => courseModule.id === moduleId);
    const current = flat[index];
    const previous = index > 0 ? flat[index - 1] : undefined;
    const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : undefined;

    const milestoneLabel = course?.milestoneLabel ?? "Milestone";
    const moduleLabel = course?.moduleLabel ?? "Module";
    const targetFor = (id: string) => (active === "quiz" ? routes.quiz(id) : routes.module(id));

    const tabs = [
        {
            key: "lessons" as const,
            href: routes.module(moduleId),
            icon: PlayCircle,
            label: current ? `Lessons (${current.courseModule._count.videos})` : "Lessons",
        },
        { key: "quiz" as const, href: routes.quiz(moduleId), icon: HelpCircle, label: "Quiz" },
    ];

    return (
        <header className="space-y-4">
            <BackButton href={routes.modules} label="Module Manager" />

            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    {current && (
                        <p className="text-xs font-semibold font-mono uppercase tracking-wider text-primary">
                            {milestoneLabel} {pad(current.milestone.order)} · {moduleLabel} {pad(current.courseModule.order)}
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

                {(previous || next) && (
                    <nav aria-label={`${moduleLabel}s`} className="flex flex-wrap items-center gap-2">
                        {previous && (
                            <PagerLink
                                href={targetFor(previous.courseModule.id)}
                                direction="previous"
                                label={`Previous ${moduleLabel.toLowerCase()}`}
                                title={previous.courseModule.title}
                            />
                        )}
                        {next && (
                            <PagerLink
                                href={targetFor(next.courseModule.id)}
                                direction="next"
                                label={`Next ${moduleLabel.toLowerCase()}`}
                                title={next.courseModule.title}
                            />
                        )}
                    </nav>
                )}

                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>

            <div className="border-b border-border">
                <nav aria-label={`${moduleLabel} content`} className="-mb-px flex gap-1">
                    {tabs.map(({ key, href, icon: Icon, label }) => (
                        <Link
                            key={key}
                            href={href}
                            aria-current={active === key ? "page" : undefined}
                            className={cn(
                                "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                                active === key
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Icon className="size-4" /> {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}

/**
 * Names the module it leads to, so a mentor stepping through the course can
 * see where they're going before they click.
 */
function PagerLink({
    href,
    direction,
    label,
    title,
}: {
    href: string;
    direction: "previous" | "next";
    label: string;
    title: string;
}) {
    const isNext = direction === "next";
    return (
        <Button asChild variant="outline" className="h-auto max-w-60 bg-card py-2 shadow-card">
            <Link href={href} aria-label={`${label}: ${title}`} title={title}>
                {!isNext && <ChevronLeft />}
                <span className={cn("min-w-0", isNext ? "text-right" : "text-left")}>
                    <span className="block text-xs font-normal text-muted-foreground">{label}</span>
                    <span className="block truncate">{title}</span>
                </span>
                {isNext && <ChevronRight />}
            </Link>
        </Button>
    );
}
