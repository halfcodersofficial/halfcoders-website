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
import { buildSyllabus, MODULE_ANCHOR, pad2, plural, type SyllabusPlan } from "@/components/shared/OutlineSyllabus";
import { Eyebrow } from "@/components/site/code";
import { FileIcon } from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { langOf } from "@/lib/lang";
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

    if (isLoading) return <OutlineLoading />;

    if (isError || !data) {
        return (
            <div className="grid min-h-[70dvh] place-items-center px-4">
                <div className="max-w-md text-center">
                    <span className="mx-auto mb-4 grid size-14 place-items-center rounded-panel border border-border bg-card text-muted-foreground shadow-card">
                        <Lock className="size-6" />
                    </span>
                    <h1 className="text-xl font-bold">Can&apos;t open this course</h1>
                    <p className="mt-2 text-muted-foreground">Enrol in this course to see its outline.</p>
                    <Button asChild variant="brand" className="mt-6 px-6">
                        <Link href={`/courses/${slug}`}>View course details</Link>
                    </Button>
                </div>
            </div>
        );
    }

    // A traditional course is self-paced, so its outline is undated: just the
    // items staff published, in their order. Bootcamp gets the dated schedule.
    return data.course.courseType === "TRADITIONAL" ? (
        <SelfPacedOutline data={data} slug={slug} />
    ) : (
        <Outline data={data} slug={slug} />
    );
}

function OutlineLoading() {
    return (
        <div aria-busy="true" aria-label="Loading the outline">
            <div className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <div className="h-8 border-b border-editor-line bg-editor-panel" />
                <div className="container-page relative grid gap-8 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-11 w-3/4" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-6 h-12 w-48 rounded-md" />
                    </div>
                    <Skeleton className="h-44 w-full rounded-panel" />
                </div>
            </div>
            <div className="container-page grid gap-8 py-8 sm:py-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <Skeleton className="hidden h-96 rounded-panel lg:block" />
                <div className="space-y-3">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="flex gap-4 rounded-card border border-border bg-card p-5">
                            <Skeleton className="size-11 shrink-0 rounded-md" />
                            <SkeletonLines lines={2} className="flex-1 pt-1" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ---- A self-paced course: the whole syllabus ------------------------------ */

function SelfPacedOutline({ data, slug }: { data: CourseOutline; slug: string }) {
    const { course } = data;
    const syllabus = buildSyllabus(data.weeks);
    const isCompleted = data.enrollment?.status === "COMPLETED";
    const milestone = course.milestoneLabel.toLowerCase();

    return (
        <>
            {/* ---- The header: the course's outline open as a file, on the dark editor surface. */}
            <header data-nav-tone="dark" className="editor relative isolate overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10" />
                <span
                    aria-hidden
                    className="pointer-events-none absolute -right-40 -top-48 -z-10 size-128 rounded-full bg-primary-500/20 blur-3xl"
                />

                <div className="border-b border-editor-line bg-editor-panel">
                    <nav aria-label="Breadcrumb" className="container-page flex items-center gap-1.5 overflow-hidden py-2 text-xs text-editor-muted">
                        <Link href="/dashboard" className="shrink-0 hover:text-editor-fg">
                            My Learning
                        </Link>
                        <span aria-hidden>/</span>
                        <Link href={`/learn/${slug}`} lang={langOf(course.title)} className="min-w-0 truncate hover:text-editor-fg">
                            {course.title}
                        </Link>
                        <span aria-hidden>/</span>
                        <span aria-current="page" className="flex shrink-0 items-center gap-1.5 text-editor-fg">
                            <FileIcon name="outline.md" />
                            Outline
                        </span>
                    </nav>
                </div>

                <div className="container-page grid gap-8 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end lg:gap-12">
                    <div className="min-w-0">
                        <div className={cn(RISE, "flex flex-wrap items-center gap-x-3 gap-y-2")}>
                            <Eyebrow>Course outline</Eyebrow>
                            <span className="inline-flex items-center gap-1.5 rounded-sm border border-editor-line bg-editor-panel px-2 py-0.5 font-mono text-[0.7rem]">
                                <span
                                    aria-hidden
                                    className={cn("size-1.5 rounded-full", isCompleted ? "bg-syn-string" : "bg-syn-keyword")}
                                />
                                <span className={isCompleted ? "text-syn-string" : "text-syn-keyword"}>
                                    {isCompleted ? "Completed" : "In progress"}
                                </span>
                            </span>
                            <span className="rounded-sm border border-editor-line bg-editor-panel px-2 py-0.5 font-mono text-[0.7rem] text-editor-muted">
                                Self-paced
                            </span>
                        </div>
                        <h1 lang={langOf(course.title)} className={cn(RISE, "delay-75 mt-4 text-h1 text-balance")}>
                            {course.title}
                        </h1>
                        <p className={cn(RISE, "delay-150 mt-4 max-w-2xl text-lead text-editor-muted")}>
                            Everything this course covers, {milestone} by {milestone}. Learn at your own pace — open any{" "}
                            {course.moduleLabel.toLowerCase()} below to see its topics, or search for one.
                        </p>
                        <div className={cn(RISE, "delay-200 mt-7 flex flex-wrap items-center gap-3")}>
                            <Button asChild variant="brand" size="lg">
                                <Link href={`/learn/${slug}`}>
                                    {isCompleted ? "Review the course" : "Continue learning"} <ArrowRight />
                                </Link>
                            </Button>
                            <p className="font-mono text-xs text-editor-muted">Your lessons are inside the course.</p>
                        </div>
                    </div>

                    {syllabus.modules.length > 0 && (
                        <div className={cn(RISE, "delay-300")}>
                            <AtAGlancePanel syllabus={syllabus} milestoneLabel={course.milestoneLabel} moduleLabel={course.moduleLabel} />
                        </div>
                    )}
                </div>
            </header>

            <div className={cn(RISE, "delay-300 container-page py-8 sm:py-10")}>
                <OutlineSchedule weeks={data.weeks} weekLabel={course.milestoneLabel} moduleLabel={course.moduleLabel} undated />
            </div>
        </>
    );
}

/**
 * The course's size in three figures, and under them each module as a bar as
 * tall as its list of topics — a map of the course that doubles as a way in:
 * a bar is a link that opens its module further down.
 */
function AtAGlancePanel({
    syllabus,
    milestoneLabel,
    moduleLabel,
}: {
    syllabus: SyllabusPlan;
    milestoneLabel: string;
    moduleLabel: string;
}) {
    const { sections, modules, topicCount } = syllabus;
    const figures = [
        { label: sections.length === 1 ? milestoneLabel : `${milestoneLabel}s`, value: sections.length, tone: "text-syn-keyword" },
        { label: modules.length === 1 ? moduleLabel : `${moduleLabel}s`, value: modules.length, tone: "text-syn-func" },
        ...(topicCount > 0 ? [{ label: topicCount === 1 ? "Topic" : "Topics", value: topicCount, tone: "text-syn-string" }] : []),
    ];
    const most = Math.max(1, ...modules.map((module) => module.topics.length));
    const showMap = topicCount > 0 && modules.length > 1 && modules.length <= 40;

    return (
        <div className="overflow-hidden rounded-panel border border-editor-line bg-editor-panel/85 shadow-panel backdrop-blur-sm">
            <p className="flex items-center justify-between gap-2 border-b border-editor-line px-4 py-2 text-xs text-editor-muted">
                <span className="flex items-center gap-1.5">
                    <FileIcon name="outline.md" />
                    At a glance
                </span>
                <span className="font-mono text-[0.68rem]">{plural(modules.length, moduleLabel.toLowerCase())}</span>
            </p>

            <dl className={cn("grid divide-x divide-editor-line", figures.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                {figures.map((figure) => (
                    <div key={figure.label} className="flex min-w-0 flex-col-reverse px-4 py-4">
                        <dt className="mt-1 truncate text-xs text-editor-muted">{figure.label}</dt>
                        <dd className={cn("font-mono text-3xl font-semibold leading-none tabular-nums", figure.tone)}>{pad2(figure.value)}</dd>
                    </div>
                ))}
            </dl>

            {showMap && (
                <div className="border-t border-editor-line px-4 pb-3 pt-3">
                    <p className="mb-2 flex items-center justify-between gap-2 text-[0.7rem] text-editor-muted">
                        <span>Topics in each {moduleLabel.toLowerCase()}</span>
                        <span className="font-mono text-editor-gutter">tap a bar to open it</span>
                    </p>
                    <div className="flex h-16 items-end gap-1">
                        {modules.map((module, index) => {
                            const name = `${moduleLabel} ${module.number}: ${module.item.title} — ${plural(module.topics.length, "topic")}`;
                            return (
                                <a
                                    key={module.item.id}
                                    href={`#${MODULE_ANCHOR}${module.item.id}`}
                                    title={name}
                                    aria-label={name}
                                    className="group flex h-full min-w-1 flex-1 flex-col justify-end rounded-t-[2px] focus-visible:outline-offset-1"
                                >
                                    <span
                                        className="block w-full animate-in fade-in slide-in-from-bottom-2 rounded-t-[2px] bg-primary-400/40 fill-mode-both duration-500 transition-colors group-hover:bg-primary-300 group-focus-visible:bg-primary-300 motion-reduce:animate-none"
                                        style={{
                                            height: `${Math.max(10, (module.topics.length / most) * 100)}%`,
                                            animationDelay: `${400 + index * 35}ms`,
                                        }}
                                    />
                                </a>
                            );
                        })}
                    </div>
                    {modules.length <= 16 && (
                        <div aria-hidden className="mt-1.5 flex gap-1">
                            {modules.map((module) => (
                                <span key={module.item.id} className="min-w-1 flex-1 text-center font-mono text-[0.6rem] text-editor-gutter">
                                    {module.number}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---- A bootcamp: the dated schedule --------------------------------------- */

function Outline({ data, slug }: { data: CourseOutline; slug: string }) {
    const now = useNow();
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
                        {`The planned schedule, ${milestone} by ${milestone} — what's coming and when. Your lessons open in the course itself as each ${data.course.moduleLabel.toLowerCase()} is released.`}
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
                    <AtAGlance data={data} now={now} />
                </div>
            )}

            <div className={cn(RISE, "delay-200")}>
                <OutlineSchedule weeks={data.weeks} weekLabel={data.course.milestoneLabel} />
            </div>
        </div>
    );
}

/**
 * The outline in one line: the next planned item as a dated card that counts
 * down to it; beside it, how big the course is and how much of it is out.
 * Counts, like everything on the outline, are the plan's — a function of its
 * dates, never of the Module Manager.
 */
function AtAGlance({ data, now }: { data: CourseOutline; now: number }) {
    const items = data.weeks.flatMap((week) => week.items.map((item) => ({ item, week })));
    const modules = items.filter(({ item }) => item.kind === "MODULE").length;
    const practiceDays = items.filter(({ item }) => item.kind === "PRACTICE").length;
    const counts = data.weeks.reduce(
        (sum, week) => {
            const { total, released } = weekCounts(week, now);
            return { total: sum.total + total, released: sum.released + released };
        },
        { total: 0, released: 0 },
    );

    const next = items.find(
        ({ item }) => item.kind !== "NO_MODULE" && item.scheduledAt && new Date(item.scheduledAt).getTime() > now,
    );

    const stats = [
        { label: `${data.course.milestoneLabel}s`, value: String(data.weeks.length) },
        { label: modules === 1 ? data.course.moduleLabel : `${data.course.moduleLabel}s`, value: String(modules) },
        ...(practiceDays > 0 ? [{ label: practiceDays === 1 ? "Practice day" : "Practice days", value: String(practiceDays) }] : []),
        ...(counts.total > 0 ? [{ label: "Released", value: `${counts.released}/${counts.total}` }] : []),
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
                    <div key={stat.label} className="flex min-w-0 flex-col justify-center px-3 py-3 sm:px-5 sm:py-4">
                        <dd className="text-xl font-bold leading-tight tracking-tight tabular-nums sm:text-2xl">{stat.value}</dd>
                        <dt className="mt-0.5 truncate text-xs text-muted-foreground">{stat.label}</dt>
                    </div>
                ))}
            </dl>
        </div>
    );
}
