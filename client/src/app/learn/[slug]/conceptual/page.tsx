"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clapperboard, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import LiveClassStrip from "@/components/learn/LiveClassStrip";
import ProgressRing from "@/components/shared/ProgressRing";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatHoursMinutes } from "@/lib/utils";
import { conceptualService } from "@/services/conceptual";
import type { ConceptualCourse, ConceptualRecording, ConceptualTopic } from "@/types/conceptual.types";

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * One course's conceptual session recordings: the player on the left, the
 * topics on the right with every recording in them, ticked as the student
 * marks them watched. Opens on `?session=`, else the first recording not yet
 * watched. Only video — nothing here touches course progress.
 */
export default function ConceptualPlayerPage() {
    const { slug } = useParams<{ slug: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const queryKey = ["conceptual", "course", slug];

    const { data, isLoading, isError, error } = useQuery({
        queryKey,
        queryFn: () => conceptualService.course(slug),
    });

    // Course order, once — "next", "previous" and the numbering read off it.
    const recordings = useMemo(
        () => data?.topics.flatMap((topic) => topic.sessions.map((session) => ({ session, topic }))) ?? [],
        [data],
    );

    const requested = searchParams.get("session");
    const active =
        recordings.find(({ session }) => session.id === requested) ??
        recordings.find(({ session }) => !session.isWatched) ??
        recordings[0] ??
        null;

    // Which topics are open: the active one's by default, then whatever the student toggles.
    const [toggled, setToggled] = useState<Record<string, boolean>>({});
    const isOpen = (topicId: string) => toggled[topicId] ?? topicId === active?.topic.id;
    const [started, setStarted] = useState<string | null>(null);

    const markWatched = useMutation({
        mutationFn: ({ id, watched }: { id: string; watched: boolean }) => conceptualService.setWatched(id, watched),
        onMutate: async ({ id, watched }) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<ConceptualCourse>(queryKey);
            if (previous) {
                queryClient.setQueryData<ConceptualCourse>(queryKey, {
                    ...previous,
                    topics: previous.topics.map((topic) => ({
                        ...topic,
                        sessions: topic.sessions.map((session) =>
                            session.id === id ? { ...session, isWatched: watched } : session,
                        ),
                    })),
                });
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't save that."));
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: ["conceptual", "my-courses"] }),
    });

    const goTo = (id: string) => {
        router.replace(`/learn/${slug}/conceptual?session=${id}`, { scroll: false });
        // The player sits above the list on a phone, so a pick brings it back into view.
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (isLoading) {
        return (
            <div className="container mx-auto grid gap-8 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
                <div className="space-y-4">
                    <Skeleton className="aspect-video rounded-2xl" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-8 w-2/3" />
                </div>
                <Skeleton className="h-120 rounded-2xl" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="grid min-h-[70dvh] place-items-center px-4">
                <div className="max-w-md text-center">
                    <Lock className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h1 className="text-xl font-bold">Can&apos;t open these recordings</h1>
                    <p className="mt-2 text-muted-foreground">
                        {getApiErrorMessage(error, "Enrol in this course to watch its conceptual sessions.")}
                    </p>
                    <Button asChild className="mt-6">
                        <Link href="/conceptual-sessions">All conceptual sessions</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const watched = recordings.filter(({ session }) => session.isWatched).length;
    const totalDuration = recordings.reduce((sum, { session }) => sum + session.duration, 0);
    const index = active ? recordings.indexOf(active) : -1;
    const previous = index > 0 ? recordings[index - 1] : null;
    const next = index >= 0 && index < recordings.length - 1 ? recordings[index + 1] : null;

    return (
        <div className="container mx-auto min-h-dvh bg-background">
            <header className="sticky top-16 z-40 border-b border-border bg-background/90 backdrop-blur-md">
                <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                    <BackButton href="/conceptual-sessions" label="Conceptual sessions" compact />
                    {recordings.length > 0 && (
                        <ProgressRing value={(watched / recordings.length) * 100} size={38}>
                            <span className="text-[0.625rem] font-bold tabular-nums">{watched}</span>
                        </ProgressRing>
                    )}
                    <div className="min-w-0">
                        <h1 className="truncate font-semibold leading-tight">{data.course.title}</h1>
                        <p className="truncate text-xs tabular-nums text-muted-foreground">
                            {recordings.length === 0
                                ? "No recordings yet"
                                : `${watched} of ${plural(recordings.length, "recording")} watched`}
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-5">
                    <LiveClassStrip slug={slug} />
                    {active ? (
                        <>
                            <Player
                                recording={active.session}
                                number={index + 1}
                                total={recordings.length}
                                started={started === active.session.id}
                                onStart={() => setStarted(active.session.id)}
                            />

                            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
                                        <span className="font-semibold uppercase tracking-wider text-primary">Topic</span>
                                        <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                        <span className="truncate">{active.topic.title}</span>
                                    </p>
                                    <h2 className="mt-1.5 text-balance text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                                        {active.session.title}
                                    </h2>
                                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                                        Recording {index + 1} of {recordings.length}
                                        {active.session.durationLabel && ` · ${active.session.durationLabel}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={previous ? `Previous: ${previous.session.title}` : "No previous recording"}
                                        title={previous?.session.title}
                                        disabled={!previous}
                                        onClick={() => previous && goTo(previous.session.id)}
                                    >
                                        <ChevronLeft />
                                    </Button>
                                    <Button
                                        variant={active.session.isWatched ? "outline" : "default"}
                                        aria-pressed={active.session.isWatched}
                                        onClick={() => {
                                            // Pin it in the URL first: without `?session=` the player
                                            // falls back to the first unwatched one, which would jump
                                            // away from this recording the moment it's ticked.
                                            if (requested !== active.session.id) {
                                                router.replace(`/learn/${slug}/conceptual?session=${active.session.id}`, { scroll: false });
                                            }
                                            markWatched.mutate({ id: active.session.id, watched: !active.session.isWatched });
                                        }}
                                        className={cn(
                                            "rounded-full px-5",
                                            active.session.isWatched && "border-success/40 text-success hover:bg-success/10",
                                        )}
                                    >
                                        {active.session.isWatched ? (
                                            <>
                                                <CheckCircle2 /> Watched
                                            </>
                                        ) : (
                                            <>
                                                <Check /> Mark as watched
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={next ? `Next: ${next.session.title}` : "No next recording"}
                                        title={next?.session.title}
                                        disabled={!next}
                                        onClick={() => next && goTo(next.session.id)}
                                    >
                                        <ChevronRight />
                                    </Button>
                                </div>
                            </div>

                            {active.session.description && (
                                <p className="max-w-3xl whitespace-pre-line border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
                                    {active.session.description}
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-border bg-brand-soft text-center">
                            <div className="max-w-md space-y-3 px-6">
                                <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-card">
                                    <Clapperboard className="size-6" />
                                </span>
                                <p className="text-lg font-semibold">No recordings yet</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    This course&apos;s conceptual classes will show up here the day after each one —
                                    you&apos;ll get a notification.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {recordings.length > 0 && (
                    <aside className="lg:sticky lg:top-36 lg:max-h-[calc(100dvh-10rem)] lg:self-start lg:overflow-y-auto">
                        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                            <div className="border-b border-border px-5 py-4">
                                <h2 className="font-semibold">Conceptual Sessions</h2>
                                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                    {totalDuration > 0 && `${formatHoursMinutes(totalDuration)} · `}
                                    {plural(data.topics.length, "topic")} · {plural(recordings.length, "recording")}
                                </p>
                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full rounded-full bg-brand transition-[width] duration-700"
                                        style={{ width: `${(watched / recordings.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <ol className="divide-y divide-border">
                                {data.topics.map((topic) => (
                                    <TopicGroup
                                        key={topic.id}
                                        topic={topic}
                                        open={isOpen(topic.id)}
                                        onToggle={() => setToggled((current) => ({ ...current, [topic.id]: !isOpen(topic.id) }))}
                                        activeId={active?.session.id ?? null}
                                        onPick={goTo}
                                    />
                                ))}
                            </ol>
                        </section>
                    </aside>
                )}
            </div>
        </div>
    );
}

/**
 * The YouTube player behind an opaque cover until the student presses play —
 * the same cover as the lesson player, which hides YouTube's own title and
 * "Watch on YouTube" link (cross-origin, so they can't be styled away).
 */
function Player({
    recording,
    number,
    total,
    started,
    onStart,
}: {
    recording: ConceptualRecording;
    number: number;
    total: number;
    started: boolean;
    onStart: () => void;
}) {
    return (
        <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-panel ring-1 ring-border">
            {started ? (
                <iframe
                    key={recording.id}
                    src={`https://www.youtube-nocookie.com/embed/${recording.youtubeVideoId}?rel=0&modestbranding=1&disablekb=1&autoplay=1`}
                    title={recording.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="size-full"
                />
            ) : (
                <button
                    type="button"
                    onClick={onStart}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-label={`Play ${recording.title}`}
                    className="group absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-hidden bg-black px-6 text-center text-white"
                >
                    <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                    />
                    <span className="relative grid size-20 place-items-center rounded-full bg-brand shadow-[0_10px_40px_-8px_oklch(0.55_0.2_260/0.8)] ring-8 ring-white/10 transition-transform duration-300 group-hover:scale-105">
                        <svg viewBox="0 0 24 24" className="ml-1 size-8 fill-white" aria-hidden>
                            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                        </svg>
                    </span>
                    <span className="relative max-w-xl space-y-1.5">
                        <span className="block text-lg font-semibold leading-snug sm:text-xl">{recording.title}</span>
                        <span className="block text-sm tabular-nums text-white/60">
                            Recording {number} of {total}
                            {recording.durationLabel && ` · ${recording.durationLabel}`}
                        </span>
                    </span>
                </button>
            )}
        </div>
    );
}

/** One topic: its header (opens and closes), then its recordings, each with its watched tick. */
function TopicGroup({
    topic,
    open,
    onToggle,
    activeId,
    onPick,
}: {
    topic: ConceptualTopic;
    open: boolean;
    onToggle: () => void;
    activeId: string | null;
    onPick: (id: string) => void;
}) {
    const watched = topic.sessions.filter((session) => session.isWatched).length;
    const duration = topic.sessions.reduce((sum, session) => sum + session.duration, 0);
    const done = watched === topic.sessions.length;
    const panelId = `topic-${topic.id}`;

    return (
        <li>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
            >
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{topic.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                        {done ? (
                            <span className="inline-flex items-center gap-1 font-medium text-success">
                                <CheckCircle2 className="size-3.5" aria-hidden /> All watched
                            </span>
                        ) : (
                            <span>
                                {watched}/{topic.sessions.length} watched
                            </span>
                        )}
                        {duration > 0 && (
                            <>
                                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                {formatHoursMinutes(duration)}
                            </>
                        )}
                    </span>
                </span>
                <ChevronDown
                    className={cn("mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
                    aria-hidden
                />
            </button>

            {/* Grid rows 0fr → 1fr, so the list slides open at its own height. */}
            <div
                id={panelId}
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
            >
                <ul className="min-h-0 overflow-hidden" inert={!open}>
                    {topic.sessions.map((session) => {
                        const isActive = session.id === activeId;
                        return (
                            <li key={session.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(session.id)}
                                    aria-current={isActive || undefined}
                                    className={cn(
                                        "relative flex w-full items-start gap-3 py-3 pl-5 pr-5 text-left transition-colors",
                                        isActive ? "bg-primary/7" : "hover:bg-secondary/40",
                                    )}
                                >
                                    {isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-primary" />}
                                    {session.isWatched ? (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Watched" />
                                    ) : isActive ? (
                                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                                    ) : (
                                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                "block text-sm leading-snug",
                                                isActive ? "font-semibold text-foreground" : "font-medium",
                                                session.isWatched && !isActive && "text-muted-foreground",
                                            )}
                                        >
                                            {session.title}
                                        </span>
                                        {session.durationLabel && (
                                            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                                                {session.durationLabel}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </li>
    );
}
