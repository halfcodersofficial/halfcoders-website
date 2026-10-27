"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import OutlineSchedule, {
    DayLeaf,
    formatItemTime,
    OUTLINE_KIND_META,
    relativeTime,
    weekCounts,
    weekLabelFor,
} from "@/components/shared/OutlineSchedule";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { learningService } from "@/services";
import type { CourseOutline } from "@/types/domain.types";

/** Page-load rise, staggered with `delay-*`; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

export default function CourseOutlinePage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;

    const { data, isLoading, isError } = useQuery({
        queryKey: ["learning", slug, "outline"],
        queryFn: () => learningService.outline(slug),
    });

    if (isLoading) {
        return (
            <div className="container-page space-y-8 py-8 sm:py-10">
                <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-3xl" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="grid min-h-[70dvh] place-items-center px-4">
                <div className="max-w-md text-center">
                    <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
                        <Lock className="size-6" />
                    </span>
                    <h1 className="text-xl font-bold">Can&apos;t open this course</h1>
                    <p className="mt-2 text-muted-foreground">Enrol in this course to see its outline.</p>
                    <Button asChild className="mt-6 rounded-full px-6">
                        <Link href={`/courses/${slug}`}>View course details</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return <Outline data={data} slug={slug} />;
}

function Outline({ data, slug }: { data: CourseOutline; slug: string }) {
    const now = useNow();
    // A traditional course is self-paced, so its outline is undated: just the
    // items staff published, in their order. Bootcamp gets the dated schedule.
    const isTraditional = data.course.courseType === "TRADITIONAL";
    const milestone = data.course.milestoneLabel.toLowerCase();
    const isCompleted = data.enrollment?.status === "COMPLETED";

    return (
        <div className="container-page space-y-8 py-8 sm:py-10">
            <header className={cn(RISE, "flex flex-wrap items-end justify-between gap-6")}>
                <div className="min-w-0 max-w-3xl">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Course outline
                        <span
                            className={cn(
                                "rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold normal-case tracking-normal",
                                isCompleted ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
                            )}
                        >
                            {isCompleted ? "Completed" : "In progress"}
                        </span>
                    </p>
                    <h1 className="mt-2 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                        {data.course.title}
                    </h1>
                    <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                        {isTraditional
                            ? `What the course covers, ${milestone} by ${milestone}, at your own pace. Your lessons are in the course itself.`
                            : `The planned schedule, ${milestone} by ${milestone} — what's coming and when. Your lessons open in the course itself as each ${data.course.moduleLabel.toLowerCase()} is released.`}
                    </p>
                </div>
                <Button asChild size="lg" className="rounded-full px-6">
                    <Link href={`/learn/${slug}`}>
                        Go to the course <ArrowRight />
                    </Link>
                </Button>
            </header>

            {data.weeks.length > 0 && (
                <div className={cn(RISE, "delay-100")}>
                    <AtAGlance data={data} now={now} dated={!isTraditional} />
                </div>
            )}

            <div className={cn(RISE, "delay-200")}>
                <OutlineSchedule weeks={data.weeks} weekLabel={data.course.milestoneLabel} undated={isTraditional} />
            </div>
        </div>
    );
}

/**
 * The outline in one line: for a bootcamp, the next planned item as a dated
 * card that counts down to it; beside it, how big the course is and, dated,
 * how much of it is out. Counts, like everything on the outline, are the
 * plan's — a function of its dates, never of the Module Manager.
 */
function AtAGlance({ data, now, dated }: { data: CourseOutline; now: number; dated: boolean }) {
    const items = data.weeks.flatMap((week) => week.items.map((item) => ({ item, week })));
    const visible = dated ? items : items.filter(({ item }) => item.isPublished);
    const modules = visible.filter(({ item }) => item.kind === "MODULE").length;
    const practiceDays = visible.filter(({ item }) => item.kind === "PRACTICE").length;
    const counts = data.weeks.reduce(
        (sum, week) => {
            const { total, released } = weekCounts(week, now);
            return { total: sum.total + total, released: sum.released + released };
        },
        { total: 0, released: 0 },
    );

    const next = dated
        ? items.find(({ item }) => item.kind !== "NO_MODULE" && item.scheduledAt && new Date(item.scheduledAt).getTime() > now)
        : undefined;

    const stats = [
        { label: `${data.course.milestoneLabel}s`, value: String(data.weeks.length) },
        { label: modules === 1 ? data.course.moduleLabel : `${data.course.moduleLabel}s`, value: String(modules) },
        ...(practiceDays > 0 ? [{ label: practiceDays === 1 ? "Practice day" : "Practice days", value: String(practiceDays) }] : []),
        ...(dated && counts.total > 0 ? [{ label: "Released", value: `${counts.released}/${counts.total}` }] : []),
    ];

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            {next && (
                <div className="relative isolate flex min-w-0 flex-1 items-center gap-4 overflow-hidden rounded-2xl bg-slate-950 p-4 pr-6 text-white shadow-panel">
                    <span aria-hidden className="absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-brand opacity-40 blur-3xl" />
                    <DayLeaf date={new Date(next.item.scheduledAt!)} tone="dark" />
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-sky-300">
                            Next up · {relativeTime(new Date(next.item.scheduledAt!).getTime(), now)}
                        </p>
                        <p className="mt-1 truncate text-lg font-semibold">{next.item.title}</p>
                        <p className="truncate text-sm text-white/60">
                            {weekLabelFor(next.week, data.course.milestoneLabel)} · {OUTLINE_KIND_META[next.item.kind].label} ·{" "}
                            {formatItemTime(next.item.scheduledAt!)}
                        </p>
                    </div>
                </div>
            )}

            <dl
                className={cn(
                    "grid divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card",
                    stats.length === 4 ? "grid-cols-4" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2",
                    !next && "lg:flex-1",
                )}
            >
                {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col justify-center px-5 py-4">
                        <dd className="text-2xl font-bold leading-tight tracking-tight tabular-nums">{stat.value}</dd>
                        <dt className="mt-0.5 truncate text-xs text-muted-foreground">{stat.label}</dt>
                    </div>
                ))}
            </dl>
        </div>
    );
}
