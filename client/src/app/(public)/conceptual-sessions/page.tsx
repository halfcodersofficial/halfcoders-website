"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clapperboard, Play } from "lucide-react";
import Link from "next/link";
import ProgressRing from "@/components/shared/ProgressRing";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENT_ROLES } from "@/lib/access";
import { cn, formatHoursMinutes } from "@/lib/utils";
import { conceptualService } from "@/services/conceptual";
import type { ConceptualCourseSummary } from "@/types/conceptual.types";

/** Page-load rise, staggered per row; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/** A recording added in the last three days that the student hasn't watched. */
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export default function ConceptualSessionsPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <ConceptualSessionsView />
        </RoleGuard>
    );
}

/**
 * The student's courses that have conceptual session recordings — the live
 * classes, recorded and put up the next day. Each opens its player, at the
 * first recording they haven't watched.
 */
function ConceptualSessionsView() {
    const { data, isLoading } = useQuery({
        queryKey: ["conceptual", "my-courses"],
        queryFn: conceptualService.myCourses,
    });

    return (
        <div className="container-page max-w-5xl py-8 sm:py-12">
            <header className={cn(RISE, "max-w-2xl")}>
                <p className="font-mono text-xs text-syn-comment">{"// recorded live classes"}</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Conceptual Sessions</h1>
                <p className="mt-3 text-muted-foreground">
                    Every live conceptual class, recorded and up the day after — grouped by topic, so you can catch one
                    you missed or go over it again.
                </p>
            </header>

            <div className="mt-8 sm:mt-10">
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-44 rounded-card" />
                        ))}
                    </div>
                ) : !data || data.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ol className="space-y-4">
                        {data.map((summary, index) => (
                            <li key={summary.course.id} className={RISE} style={{ animationDelay: `${120 + index * 80}ms` }}>
                                <CourseRow summary={summary} />
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}

/** One course: its picture, what's in it, how much of it the student has watched, and the way in. */
function CourseRow({ summary }: { summary: ConceptualCourseSummary }) {
    const { course, latest, next } = summary;
    const href = `/learn/${course.slug}/conceptual${next ? `?session=${next.id}` : ""}`;
    const share = summary.recordings ? (summary.watched / summary.recordings) * 100 : 0;
    const isFresh = Boolean(
        latest && latest.id === next?.id && Date.now() - new Date(latest.addedAt).getTime() < FRESH_MS,
    );

    return (
        <Link
            href={href}
            className="group grid gap-5 rounded-card border border-border bg-card p-3 transition-colors hover:border-primary/50 sm:grid-cols-[16rem_1fr_auto] sm:items-center sm:gap-6 sm:pr-6"
        >
            <div className="relative aspect-video overflow-hidden rounded-md bg-secondary">
                <SafeImage
                    src={course.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 256px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    fallback={<Clapperboard className="size-8 text-muted-foreground" />}
                />
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-sm bg-editor/85 font-mono px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
                    <Clapperboard className="size-3.5" aria-hidden />
                    {plural(summary.recordings, "recording")}
                </span>
            </div>

            <div className="min-w-0 px-2 pb-1 sm:px-0 sm:pb-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                    <span>{plural(summary.topics, "topic")}</span>
                    {summary.totalDuration > 0 && (
                        <>
                            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                            <span className="tabular-nums">{formatHoursMinutes(summary.totalDuration)}</span>
                        </>
                    )}
                    {isFresh && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">
                            New recording
                        </span>
                    )}
                </p>
                <h2 className="mt-1.5 line-clamp-2 text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-xl">
                    {course.title}
                </h2>
                <p className="mt-3 flex min-w-0 items-center gap-2 text-sm">
                    {next ? (
                        <>
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                                <Play className="ml-px size-3 fill-current" aria-hidden />
                            </span>
                            <span className="shrink-0 text-muted-foreground">{summary.watched > 0 ? "Up next" : "Start with"}</span>
                            <span className="truncate font-medium">{next.title}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground">You&apos;ve watched every recording so far.</span>
                    )}
                </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border px-2 pb-1 pt-4 sm:flex-col sm:justify-center sm:border-0 sm:p-0">
                <span className="flex items-center gap-3 sm:flex-col sm:gap-1.5">
                    <ProgressRing value={share} size={56} stroke={5} fillIn>
                        <span className="text-xs font-bold tabular-nums">
                            {summary.watched}/{summary.recordings}
                        </span>
                    </ProgressRing>
                    <span className="text-xs text-muted-foreground">watched</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary sm:hidden">
                    {next ? "Watch" : "Rewatch"} <ArrowRight className="size-4" />
                </span>
            </div>
        </Link>
    );
}

function EmptyState() {
    return (
        <section className="rounded-card border border-dashed border-border px-6 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-card bg-primary/10 text-primary">
                <Clapperboard className="size-7" aria-hidden />
            </span>
            <h2 className="mt-5 text-lg font-semibold">No recordings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                When your course holds a live conceptual class, its recording shows up here the day after — and
                you&apos;ll get a notification when it does.
            </p>
            <Button asChild variant="brand-outline" className="mt-6 px-6">
                <Link href="/dashboard">Back to My Learning</Link>
            </Button>
        </section>
    );
}
