"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Clapperboard, Play, Plus, Radio } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { pad2, plural } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDuration, formatHoursMinutes } from "@/lib/utils";
import { conceptualAuthoring } from "@/services/conceptual";
import type { StaffConceptualCourse, StaffConceptualCourseSummary } from "@/types/conceptual.types";
import AddRecordingModal from "./AddRecordingModal";
import RecordingPreview from "./RecordingPreview";
import { filedIn, STATE_LABEL, watchRate, type Filed } from "./recordingState";
import { publishLabel, usePublishRecording } from "./usePublishRecording";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";
const PANEL = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/**
 * The mentor's conceptual sessions — the recordings of their live classes —
 * as a desk: what's live and how much of it is watched, what students still
 * can't see and the one click that fixes each, then every course they teach
 * as a shelf of its recordings, newest first. A recording can be added from
 * here for any of their courses; a course's topics are arranged in its own
 * manager (the Conceptual tab of the course).
 */
export default function ConceptualDesk() {
    const [adding, setAdding] = useState<{ courseId?: string } | null>(null);
    const [previewing, setPreviewing] = useState<{ filed: Filed; course: StaffConceptualCourse } | null>(null);

    const summaries = useQuery({ queryKey: ["conceptual", "manage-courses"], queryFn: conceptualAuthoring.courses });
    // Each course's own manager query, so opening one is instant and an edit in either place shows in both.
    const details = useQueries({
        queries: (summaries.data ?? []).map((summary) => ({
            queryKey: ["conceptual", "manage", summary.course.id],
            queryFn: () => conceptualAuthoring.course(summary.course.id),
        })),
    });

    const courses = summaries.data ?? [];
    const loaded = details.map((query) => query.data).filter((data): data is StaffConceptualCourse => Boolean(data));
    const loading = summaries.isLoading || details.some((query) => query.isLoading);

    return (
        <div className="container-page space-y-6 py-8 sm:py-10">
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold sm:text-3xl">Conceptual sessions</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                        Recordings of your live classes, filed by topic. Students are told the first time one goes live.
                    </p>
                </div>
                {courses.length > 0 && (
                    <Button onClick={() => setAdding({})}>
                        <Plus /> Add a recording
                    </Button>
                )}
            </header>

            {summaries.isError ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load your conceptual sessions.</p>
                    <Button variant="outline" className="mt-4" onClick={() => summaries.refetch()}>
                        Try again
                    </Button>
                </div>
            ) : loading ? (
                <div className="space-y-6">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-72 rounded-2xl" />
                </div>
            ) : courses.length === 0 ? (
                <NoCourses />
            ) : (
                <>
                    <Totals courses={loaded} />
                    <NotLiveYet courses={loaded} onOpen={(filed, course) => setPreviewing({ filed, course })} />
                    <div className="space-y-6">
                        {courses.map((summary, index) => {
                            const course = loaded.find((entry) => entry.course.id === summary.course.id);
                            return (
                                course && (
                                    <div key={summary.course.id} className={RISE} style={{ animationDelay: `${120 + index * 60}ms` }}>
                                        <Shelf
                                            summary={summary}
                                            course={course}
                                            onAdd={() => setAdding({ courseId: summary.course.id })}
                                            onOpen={(filed) => setPreviewing({ filed, course })}
                                        />
                                    </div>
                                )
                            );
                        })}
                    </div>
                </>
            )}

            <AddRecordingModal
                open={adding !== null}
                onOpenChange={(open) => !open && setAdding(null)}
                courses={courses}
                initialCourseId={adding?.courseId}
            />
            <RecordingPreview
                filed={previewing?.filed ?? null}
                courseTitle={previewing?.course.course.title ?? ""}
                students={previewing?.course.students ?? 0}
                manageHref={previewing ? staffCourseRoutes("mentor", previewing.course.course.id).conceptual : "#"}
                onClose={() => setPreviewing(null)}
            />
        </div>
    );
}

/** Across every course: what's live, what isn't yet, how long it runs and how much of it is watched. */
function Totals({ courses }: { courses: StaffConceptualCourse[] }) {
    const all = courses.flatMap(filedIn);
    const live = all.filter((entry) => entry.state === "live");
    const runtime = live.reduce((sum, entry) => sum + entry.recording.duration, 0);
    const rates = courses.map(watchRate);
    const ticks = rates.reduce((sum, rate) => sum + rate.ticks, 0);
    const possible = rates.reduce((sum, rate) => sum + rate.possible, 0);

    return (
        <ul aria-label="Totals" className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm lg:grid-cols-4", RISE)} style={{ animationDelay: "60ms" }}>
            <Total label="Live recordings" value={live.length} hint={`in ${plural(courses.flatMap((course) => course.topics).filter((topic) => topic.isPublished).length, "live topic")}`} />
            <Total label="Not live yet" value={all.length - live.length} hint="Drafts, or waiting on their topic" tone={all.length > live.length ? "warn" : undefined} />
            <Total label="Running time" value={runtime > 0 ? formatHoursMinutes(runtime) : "—"} hint="Of what's live" />
            <Total
                label="Watched"
                value={possible > 0 ? `${Math.round((ticks / possible) * 100)}%` : "—"}
                hint={possible > 0 ? `${ticks} of ${possible} possible views ticked` : "Once something's live"}
            />
        </ul>
    );
}

function Total({ label, value, hint, tone }: { label: string; value: ReactNode; hint: string; tone?: "warn" }) {
    return (
        <li className="min-w-0 bg-card px-5 py-4">
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span className={cn("mt-1 block text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]", tone === "warn" && "text-amber-700 dark:text-amber-400")}>
                {value}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>
        </li>
    );
}

/** Everything students can't see yet, across courses, each with the click that makes it live. */
function NotLiveYet({ courses, onOpen }: { courses: StaffConceptualCourse[]; onOpen: (filed: Filed, course: StaffConceptualCourse) => void }) {
    const publish = usePublishRecording();
    const waiting = courses.flatMap((course) => filedIn(course).filter((entry) => entry.state !== "live").map((filed) => ({ filed, course })));
    if (waiting.length === 0) return null;

    return (
        <section aria-labelledby="not-live-title" className={cn(PANEL, RISE)} style={{ animationDelay: "90ms" }}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-6">
                <h2 id="not-live-title" className="text-lg font-semibold tracking-tight">
                    Not live yet <span className="font-normal text-muted-foreground">{waiting.length}</span>
                </h2>
                <p className="text-xs text-muted-foreground">Students see a recording once it and its topic are both live.</p>
            </header>
            <ul className="divide-y divide-border">
                {waiting.slice(0, 8).map(({ filed, course }) => {
                    const busy = publish.isPending && publish.variables?.filed.recording.id === filed.recording.id;
                    return (
                        <li key={filed.recording.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                            <button
                                type="button"
                                onClick={() => onOpen(filed, course)}
                                className="group flex min-w-0 flex-1 items-center gap-4 text-left"
                                aria-label={`Preview ${filed.recording.title}`}
                            >
                                <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-secondary">
                                    <SafeImage src={filed.recording.thumbnail} alt="" fill sizes="96px" className="object-cover" fallback={null} />
                                    <span className="absolute inset-0 grid place-items-center bg-slate-950/0 transition-colors group-hover:bg-slate-950/30">
                                        <Play className="size-5 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" aria-hidden />
                                    </span>
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{filed.recording.title}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {course.course.title} · {pad2(filed.topic.order)} {filed.topic.title}
                                    </span>
                                </span>
                            </button>
                            <span className="hidden shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 sm:inline dark:text-amber-400">
                                {STATE_LABEL[filed.state]}
                            </span>
                            <Button size="sm" variant="brand-outline" className="shrink-0" isLoading={busy} disabled={publish.isPending} onClick={() => publish.mutate({ filed })}>
                                {!busy && <Radio />} {publishLabel(filed)}
                            </Button>
                        </li>
                    );
                })}
            </ul>
            {waiting.length > 8 && (
                <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">{waiting.length - 8} more — each course&apos;s shelf below has them all.</p>
            )}
        </section>
    );
}

/** One course: its figures, then its recordings as a strip of tiles, newest first. */
function Shelf({
    summary,
    course,
    onAdd,
    onOpen,
}: {
    summary: StaffConceptualCourseSummary;
    course: StaffConceptualCourse;
    onAdd: () => void;
    onOpen: (filed: Filed) => void;
}) {
    const routes = staffCourseRoutes("mentor", summary.course.id);
    const recordings = filedIn(course);
    const live = recordings.filter((entry) => entry.state === "live");
    const rate = watchRate(course);

    return (
        <section aria-labelledby={`shelf-${summary.course.id}`} className={PANEL}>
            <header className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
                <span className="relative hidden aspect-video w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary ring-1 ring-border sm:grid">
                    <SafeImage src={summary.course.thumbnail} alt="" fill sizes="64px" className="object-cover" fallback={<BookOpen className="size-4 text-muted-foreground" />} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id={`shelf-${summary.course.id}`} className="truncate text-base font-semibold tracking-tight">
                        {summary.course.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">{live.length}</span> live · {plural(course.topics.length, "topic")}
                        {summary.liveDuration > 0 && ` · ${formatHoursMinutes(summary.liveDuration)}`}
                        {rate.percent !== null && ` · ${rate.percent}% watched`} · {plural(course.students, "student")}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={onAdd}>
                        <Plus /> Add
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={routes.conceptual}>
                            Topics <ArrowRight />
                        </Link>
                    </Button>
                </div>
            </header>

            {recordings.length === 0 ? (
                <button
                    type="button"
                    onClick={onAdd}
                    className="m-5 flex w-[calc(100%-2.5rem)] items-center gap-4 rounded-xl border border-dashed border-border px-5 py-6 text-left transition-colors hover:bg-secondary/40 sm:m-6 sm:w-[calc(100%-3rem)]"
                >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Clapperboard className="size-5" aria-hidden />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold">No recordings yet</span>
                        <span className="block text-xs text-muted-foreground">After the next live class, add its YouTube link here — students are told when it&apos;s up.</span>
                    </span>
                </button>
            ) : (
                // `relative` so nothing absolutely placed inside can widen the page.
                // Scroll padding to match, or snapping parks the first tile on the card's edge.
                <ol className="no-scrollbar relative flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 py-5 sm:scroll-px-6 sm:px-6">
                    {recordings.map((filed) => (
                        <li key={filed.recording.id} className="w-56 shrink-0 snap-start">
                            <Tile filed={filed} students={course.students} onOpen={() => onOpen(filed)} />
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function Tile({ filed, students, onOpen }: { filed: Filed; students: number; onOpen: () => void }) {
    const { recording, topic, state } = filed;
    const share = students > 0 ? Math.min(100, (recording._count.watches / students) * 100) : 0;

    return (
        <button type="button" onClick={onOpen} className="group block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="relative block aspect-video overflow-hidden rounded-xl bg-secondary ring-1 ring-border">
                <SafeImage
                    src={recording.thumbnail}
                    alt=""
                    fill
                    sizes="224px"
                    className={cn("object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none", state !== "live" && "opacity-60 grayscale")}
                    fallback={<Clapperboard className="m-auto size-6 text-muted-foreground" />}
                />
                <span className="absolute inset-0 grid place-items-center bg-slate-950/0 transition-colors group-hover:bg-slate-950/30">
                    <span className="grid size-10 place-items-center rounded-full bg-white/90 text-slate-900 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        <Play className="ml-0.5 size-4 fill-current" aria-hidden />
                    </span>
                </span>
                {state !== "live" && (
                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{STATE_LABEL[state]}</span>
                )}
                {recording.duration > 0 && (
                    <span className="absolute bottom-2 right-2 rounded bg-slate-950/80 px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-white">
                        {formatDuration(recording.duration)}
                    </span>
                )}
            </span>
            <span className="mt-2.5 block line-clamp-2 text-sm font-semibold leading-snug">{recording.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {pad2(topic.order)} · {topic.title}
            </span>
            {state === "live" && (
                <span className="mt-2 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                    </span>
                    <span className="shrink-0 tabular-nums">
                        {recording._count.watches}/{students} watched
                    </span>
                </span>
            )}
        </button>
    );
}

function NoCourses() {
    return (
        <section className={cn("relative isolate overflow-hidden rounded-3xl border border-border bg-brand-soft px-6 py-16 text-center", RISE)}>
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 size-64 rounded-full bg-primary/10 blur-2xl" />
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
                <Clapperboard className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight">No courses assigned yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Once an admin assigns you a course, its live-class recordings are filed here, topic by topic.
            </p>
        </section>
    );
}
