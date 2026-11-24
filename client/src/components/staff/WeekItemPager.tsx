"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { weekItems, type WeekItem } from "@/lib/weekItems";
import { curriculumAuthoring, type WeekItemKind } from "@/services/curriculum";

/**
 * Previous / Next on a module's, an assignment's or a practice day's page:
 * every week item of the course in the Module Manager's order — so a mentor
 * filling a whole course steps from a module to the practice day and
 * assignment after it, and on to the next module, without going back to the
 * Module Manager in between.
 *
 * Reads the same curriculum query the Module Manager does, so arriving from
 * there costs no extra request. Renders nothing until it knows where it is.
 */
export default function WeekItemPager({ courseId, area, kind, id }: { courseId: string; area: StaffArea; kind: WeekItemKind; id: string }) {
    const routes = staffCourseRoutes(area, courseId);

    const { data: course } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });
    const { data: milestones } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    const flat = (milestones ?? []).flatMap(weekItems);
    const index = flat.findIndex((item) => item.kind === kind && item.entry.id === id);
    if (index < 0) return null;
    const previous = flat[index - 1];
    const next = flat[index + 1];
    if (!previous && !next) return null;

    const moduleWord = (course?.moduleLabel ?? "Module").toLowerCase();
    const word = (item: WeekItem) => (item.kind === "MODULE" ? moduleWord : item.kind === "ASSIGNMENT" ? "assignment" : "practice day");
    const href = (item: WeekItem) =>
        item.kind === "MODULE" ? routes.module(item.entry.id) : item.kind === "ASSIGNMENT" ? routes.assignment(item.entry.id) : routes.practice(item.entry.id);

    return (
        <nav aria-label="Course content" className="flex flex-wrap items-center gap-2">
            {previous && <PagerLink href={href(previous)} direction="previous" label={`Previous ${word(previous)}`} title={previous.entry.title} />}
            {next && <PagerLink href={href(next)} direction="next" label={`Next ${word(next)}`} title={next.entry.title} />}
        </nav>
    );
}

/**
 * Names what it leads to, so a mentor stepping through the course can see
 * where they're going before they click.
 */
function PagerLink({ href, direction, label, title }: { href: string; direction: "previous" | "next"; label: string; title: string }) {
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
