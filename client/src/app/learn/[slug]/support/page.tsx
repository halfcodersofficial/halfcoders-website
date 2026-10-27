"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Headphones, Lock, Radio, Ticket, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { DayLeaf, relativeTime } from "@/components/shared/OutlineSchedule";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { useSupportSocket } from "@/hooks/useSupportSocket";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatQueueNumber, formatTime } from "@/lib/utils";
import { optionalTextField } from "@/lib/validation";
import { catalogueService, supportService } from "@/services";
import type { QueueBoard, SupportSessionCard } from "@/types/domain.types";

const topicSchema = z.object({ topic: optionalTextField({ label: "Topic", max: 500 }) });

/** Page-load rise, staggered with `delay-*`; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

export default function SupportPage() {
    const { slug } = useParams<{ slug: string }>();
    const queryClient = useQueryClient();

    const { data: course } = useQuery({
        queryKey: ["course", slug],
        queryFn: () => catalogueService.courseBySlug(slug),
    });

    const courseId = course?.id ?? null;

    const { data: sessions, isLoading } = useQuery({
        queryKey: ["support", "sessions", courseId],
        queryFn: () => supportService.sessionsForCourse(courseId!),
        enabled: Boolean(courseId),
        refetchInterval: 60_000,
    });

    // The live session is the only one worth watching; there is at most one.
    const liveSession = sessions?.find((session) => session.isLive) ?? null;
    const { board, isConnected } = useSupportSocket(liveSession?.id ?? null);

    const { data: position } = useQuery({
        queryKey: ["support", "position", liveSession?.id],
        queryFn: () => supportService.myPosition(liveSession!.id),
        enabled: Boolean(liveSession),
        // Socket pushes are the primary signal; this poll is the fallback for
        // when the handshake failed, so it can be slow.
        refetchInterval: isConnected ? 60_000 : 10_000,
    });

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["support"] });
    };

    const join = useMutation({
        mutationFn: (values: z.output<typeof topicSchema>) =>
            supportService.joinQueue(liveSession!.id, values.topic || undefined),
        onSuccess: (entry) => {
            toast.success(`You're in the queue — your number is ${formatQueueNumber(entry.queueNumber)}`);
            topicForm.reset({ topic: "" });
            invalidate();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't join the queue.")),
    });

    const topicForm = useZodForm({
        schema: topicSchema,
        initialValues: { topic: "" },
        onSubmit: (values) => join.mutate(values),
    });

    const leave = useMutation({
        mutationFn: () => supportService.leaveQueue(liveSession!.id),
        onSuccess: () => {
            toast.success("You've left the queue.");
            invalidate();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't leave the queue.")),
    });

    // Prefer the pushed board so the "now serving" number is never stale.
    const nowServing = board?.nowServing?.queueNumber ?? position?.nowServing ?? null;
    const waitingCount = board?.waitingCount ?? position?.waitingCount ?? 0;
    const isMyTurn = position?.myStatus === "SERVING";
    // Falls back to the REST snapshot until the socket pushes its first board,
    // which mirrors how the mentor can close sign-ups mid-session (plan §23).
    const joinOpen = board?.joinOpen ?? liveSession?.joinOpen ?? true;
    const myNumber = position?.myQueueNumber ?? null;

    return (
        <div className="min-h-dvh bg-background">
            <header className="border-b border-border">
                <div className="container-page flex h-16 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <BackButton href={`/learn/${slug}`} label="Back to course" compact />
                        <div className="min-w-0">
                            <h1 className="font-semibold leading-tight">Support sessions</h1>
                            <p className="truncate text-xs text-muted-foreground">{course?.title}</p>
                        </div>
                    </div>
                    {liveSession && (
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                            <span className="relative flex size-2">
                                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                                <span className="relative size-2 rounded-full bg-success" />
                            </span>
                            Live now
                        </span>
                    )}
                </div>
            </header>

            <div className="container-page max-w-5xl py-8 sm:py-10">
                {isLoading || !courseId ? (
                    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                        <div className="space-y-6">
                            <Skeleton className="h-64 rounded-3xl" />
                            <Skeleton className="h-40 rounded-2xl" />
                        </div>
                        <Skeleton className="h-80 rounded-2xl" />
                    </div>
                ) : !sessions || sessions.length === 0 ? (
                    <NoSessions previous={course?.phase === "PREVIOUS"} />
                ) : liveSession ? (
                    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
                        <div className="min-w-0 space-y-6">
                            <div className={RISE}>
                                <NowServingBoard
                                    session={liveSession}
                                    nowServing={nowServing}
                                    waitingCount={waitingCount}
                                    isConnected={isConnected}
                                />
                            </div>

                            <div className={cn(RISE, "delay-100")}>
                                {isMyTurn ? (
                                    <section className="relative overflow-hidden rounded-3xl border border-success/40 bg-success/10 p-6 text-center sm:p-8">
                                        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success text-white shadow-lg">
                                            <Headphones className="size-7" />
                                        </span>
                                        <p className="mt-4 text-2xl font-bold tracking-tight text-success">It&apos;s your turn</p>
                                        <p className="mt-1 text-muted-foreground">Join the meeting now — your mentor is waiting.</p>
                                        {liveSession.meetingLink && (
                                            <Button asChild size="lg" className="mt-5 rounded-full px-8">
                                                <a href={liveSession.meetingLink} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink /> Join meeting
                                                </a>
                                            </Button>
                                        )}
                                    </section>
                                ) : position?.inQueue && myNumber !== null ? (
                                    <MyTicket
                                        myNumber={myNumber}
                                        nowServing={nowServing}
                                        peopleAhead={position.peopleAhead ?? 0}
                                        estimatedWaitMinutes={position.estimatedWaitMinutes ?? 0}
                                        board={board}
                                        onLeave={() => leave.mutate()}
                                        isLeaving={leave.isPending}
                                    />
                                ) : !joinOpen ? (
                                    <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
                                        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                                            <Lock className="size-5" />
                                        </span>
                                        <p className="mt-3 font-semibold">Sign-ups are closed for this session</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Your mentor has stopped taking new numbers right now — check back in a bit.
                                        </p>
                                    </section>
                                ) : (
                                    <form
                                        className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-7"
                                        noValidate
                                        onSubmit={topicForm.handleSubmit}
                                    >
                                        <div className="mb-5 flex items-center gap-3">
                                            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white shadow-sm">
                                                <Ticket className="size-5" />
                                            </span>
                                            <div>
                                                <h2 className="text-lg font-bold tracking-tight">Take a number</h2>
                                                <p className="text-sm text-muted-foreground">
                                                    {waitingCount === 0
                                                        ? "No one's waiting — you'll be next."
                                                        : `${waitingCount} ${waitingCount === 1 ? "person is" : "people are"} waiting.`}
                                                </p>
                                            </div>
                                        </div>
                                        <FormField
                                            form={topicForm}
                                            name="topic"
                                            label="What do you need help with?"
                                            optional
                                            counterMax={500}
                                            hint="Lets your mentor prepare before calling your number."
                                        >
                                            <Input placeholder="e.g. my loop never stops" />
                                        </FormField>
                                        <Button type="submit" className="mt-4 w-full rounded-full" size="lg" isLoading={join.isPending}>
                                            <Ticket /> Take a number
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <div className={cn(RISE, "delay-200 lg:sticky lg:top-24")}>
                            <TheLine board={board} myNumber={myNumber} waitingCount={waitingCount} />
                        </div>
                    </div>
                ) : (
                    <UpcomingSessions sessions={sessions} />
                )}
            </div>
        </div>
    );
}

/**
 * The counter's display: the number being served, large, re-keyed so it
 * drops in fresh each time the mentor calls the next one.
 */
function NowServingBoard({
    session,
    nowServing,
    waitingCount,
    isConnected,
}: {
    session: SupportSessionCard;
    nowServing: number | null;
    waitingCount: number;
    isConnected: boolean;
}) {
    return (
        <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-panel sm:p-8">
            <span aria-hidden className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-brand opacity-40 blur-3xl" />
            <span aria-hidden className="absolute -bottom-32 -left-16 -z-10 size-72 rounded-full bg-emerald-500 opacity-15 blur-3xl" />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold">{session.title ?? "Support session"}</p>
                <p className="text-sm tabular-nums text-white/60">
                    {formatTime(session.startTime)} – {formatTime(session.endTime)}
                </p>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Now serving</p>
                    <p
                        key={nowServing ?? "none"}
                        aria-live="polite"
                        className="mt-2 animate-in fade-in zoom-in-75 bg-linear-to-b from-white to-sky-200 bg-clip-text font-mono text-7xl font-bold leading-none tracking-tight text-transparent duration-500 motion-reduce:animate-none sm:text-8xl"
                    >
                        {nowServing ? formatQueueNumber(nowServing) : "—"}
                    </p>
                </div>

                <dl className="grid grid-cols-2 gap-6 sm:justify-self-end">
                    <div>
                        <dt className="flex items-center gap-1.5 text-xs text-white/50">
                            <Users className="size-3.5" /> Waiting
                        </dt>
                        <dd className="mt-1 text-2xl font-bold tabular-nums">{waitingCount}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-white/50">Mentor</dt>
                        <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                            <Avatar src={session.mentor.image} name={session.mentor.name} size={24} />
                            <span className="truncate">{session.mentor.name}</span>
                        </dd>
                    </div>
                </dl>
            </div>

            <p className="mt-8 flex items-center gap-1.5 border-t border-white/10 pt-4 text-xs text-white/50">
                <Radio className={cn("size-3.5", isConnected && "text-emerald-300")} />
                {isConnected ? "Live — the number updates by itself" : "Reconnecting…"}
            </p>
        </section>
    );
}

/**
 * The student's ticket: their number on a stub, and the line between the
 * counter and them — each number still ahead, as it's called.
 */
function MyTicket({
    myNumber,
    nowServing,
    peopleAhead,
    estimatedWaitMinutes,
    board,
    onLeave,
    isLeaving,
}: {
    myNumber: number;
    nowServing: number | null;
    peopleAhead: number;
    estimatedWaitMinutes: number;
    board: QueueBoard | null;
    onLeave: () => void;
    isLeaving: boolean;
}) {
    const ahead = board?.waiting.filter((entry) => entry.queueNumber < myNumber).map((entry) => entry.queueNumber) ?? [];

    return (
        <section className="flex overflow-hidden rounded-3xl border border-border bg-card shadow-card max-sm:flex-col">
            {/* The stub, torn off at a perforated edge. */}
            <div className="relative flex flex-col items-center justify-center bg-brand px-8 py-7 text-white sm:w-56">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">Your number</p>
                <p className="mt-1 font-mono text-6xl font-bold leading-none tracking-tight">{formatQueueNumber(myNumber)}</p>
                <span
                    aria-hidden
                    className="absolute inset-y-3 right-0 hidden w-0 border-r-2 border-dashed border-white/40 sm:block"
                />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Ahead of you</p>
                        <p className="text-2xl font-bold tabular-nums">{peopleAhead}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Estimated wait</p>
                        <p className="text-2xl font-bold tabular-nums">~{estimatedWaitMinutes} min</p>
                    </div>
                </div>

                {/* The line, from the counter to you. */}
                <ol className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1" aria-label="The line ahead of you">
                    <li className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {nowServing ? formatQueueNumber(nowServing) : "—"}
                    </li>
                    {ahead.map((number) => (
                        <li key={number} className="flex shrink-0 items-center gap-1.5">
                            <span aria-hidden className="h-px w-3 bg-border" />
                            <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground">
                                {formatQueueNumber(number)}
                            </span>
                        </li>
                    ))}
                    <li className="flex shrink-0 items-center gap-1.5">
                        <span aria-hidden className="h-px w-3 bg-border" />
                        <span className="rounded-full bg-brand px-2.5 py-1 font-mono text-xs font-bold text-white shadow-sm">
                            {formatQueueNumber(myNumber)} · you
                        </span>
                    </li>
                </ol>

                {/* The mentor advances the queue manually, so this is an
                    estimate — say so rather than implying a countdown. */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Your mentor calls each number in turn, so the wait is an estimate. Keep this page open — we&apos;ll
                    tell you when it&apos;s your turn.
                </p>

                <Button variant="outline" className="mt-auto self-start rounded-full" onClick={onLeave} isLoading={isLeaving}>
                    Leave the queue
                </Button>
            </div>
        </section>
    );
}

/** Everyone waiting, in order — the student's own place marked. */
function TheLine({ board, myNumber, waitingCount }: { board: QueueBoard | null; myNumber: number | null; waitingCount: number }) {
    return (
        <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="font-semibold">The line</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{waitingCount} waiting</span>
            </div>

            {!board || board.waiting.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {board ? "No one is waiting." : "Connecting to the queue…"}
                </p>
            ) : (
                <ol className="max-h-112 divide-y divide-border overflow-y-auto">
                    {board.waiting.map((entry) => {
                        const isMe = entry.queueNumber === myNumber;
                        return (
                            <li key={entry.id} className={cn("flex items-start gap-3 px-5 py-3", isMe && "bg-primary/6")}>
                                <span
                                    className={cn(
                                        "mt-0.5 shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-bold",
                                        isMe ? "bg-brand text-white" : "bg-secondary text-muted-foreground",
                                    )}
                                >
                                    {formatQueueNumber(entry.queueNumber)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={cn("block truncate text-sm", isMe && "font-semibold text-primary")}>
                                        {isMe ? "You" : entry.student.name}
                                    </span>
                                    {entry.topic && <span className="block truncate text-xs text-muted-foreground">{entry.topic}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

/** Nothing live: when the next session is, then the rest of what's planned. */
function UpcomingSessions({ sessions }: { sessions: SupportSessionCard[] }) {
    const now = useNow();
    const next = sessions.find((session) => session.status === "SCHEDULED" && new Date(session.startTime).getTime() > now);
    const isOver = (session: SupportSessionCard) => session.status === "ENDED" || new Date(session.endTime).getTime() < now;
    // Still to come first, then the ones that just ended.
    const rest = sessions
        .filter((session) => session !== next)
        .sort((a, b) => Number(isOver(a)) - Number(isOver(b)));

    return (
        <div className="space-y-6">
            {next ? (
                <section className={cn(RISE, "relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-panel sm:p-8")}>
                    <span aria-hidden className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-brand opacity-40 blur-3xl" />
                    <div className="flex flex-wrap items-center gap-5">
                        <DayLeaf date={new Date(next.startTime)} tone="dark" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
                                Next session · {relativeTime(new Date(next.startTime).getTime(), now)}
                            </p>
                            <p className="mt-1 text-2xl font-bold tracking-tight">{next.title ?? "Support session"}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                                <span className="tabular-nums">
                                    {formatTime(next.startTime)} – {formatTime(next.endTime)}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Avatar src={next.mentor.image} name={next.mentor.name} size={20} />
                                    {next.mentor.name}
                                </span>
                            </p>
                        </div>
                    </div>
                    {next.notes && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-white/70">{next.notes}</p>}
                    <p className="mt-6 border-t border-white/10 pt-4 text-xs text-white/50">
                        You can take a number once it goes live — this page updates by itself.
                    </p>
                </section>
            ) : (
                <section className={cn(RISE, "rounded-3xl border border-border bg-card p-6 text-center shadow-card")}>
                    <p className="font-semibold">No session is live right now</p>
                    <p className="mt-1 text-sm text-muted-foreground">You can take a number once one goes live.</p>
                </section>
            )}

            {rest.length > 0 && (
                <section className={cn(RISE, "delay-100")}>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        Other sessions
                    </h2>
                    <ul className="space-y-3">
                        {rest.map((session) => {
                            const ended = isOver(session);
                            return (
                                <li
                                    key={session.id}
                                    className={cn(
                                        "flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card",
                                        ended && "opacity-60",
                                    )}
                                >
                                    <DayLeaf date={new Date(session.startTime)} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold">{session.title ?? "Support session"}</p>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                            <span className="tabular-nums">
                                                {formatTime(session.startTime)} – {formatTime(session.endTime)}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Avatar src={session.mentor.image} name={session.mentor.name} size={18} />
                                                {session.mentor.name}
                                            </span>
                                        </p>
                                    </div>
                                    <span
                                        className={cn(
                                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                                            ended ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary",
                                        )}
                                    >
                                        {ended ? "Ended" : relativeTime(new Date(session.startTime).getTime(), now)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}

/** Nothing scheduled — or, on a previous (recorded) course, nothing ever will be. */
function NoSessions({ previous }: { previous: boolean }) {
    return (
        <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-border bg-brand-soft px-6 py-16 text-center">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-accent/15 blur-2xl" />
            <div className="relative max-w-md space-y-3">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-card">
                    <Headphones className="size-6" />
                </span>
                {previous ? (
                    <>
                        <p className="text-lg font-semibold">This course has no support sessions</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            It&apos;s a previous recorded course: its classes are over, and you learn from the recordings at
                            your own pace. A question about a lesson can still go under that lesson.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-lg font-semibold">No support sessions yet</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            When your mentor schedules one, it will show here with its date and time. Once it goes live, take a
                            number and they&apos;ll call you in turn.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
