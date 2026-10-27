"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarPlus, Link2Off } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { DayLeaf } from "@/components/shared/OutlineSchedule";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { useSupportSocket } from "@/hooks/useSupportSocket";
import { cn, formatQueueNumber } from "@/lib/utils";
import { supportService } from "@/services";
import type { MentorSupportSession } from "@/types/mentor.types";
import { clock, DAY_MS, dhakaDayKey, pad2, plural } from "./time";

const STAGE = "relative isolate overflow-hidden rounded-3xl bg-slate-950 text-white shadow-panel ring-1 ring-white/5";
const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em]";
const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-wider text-white/50";

/**
 * The support desk, as the top of the dashboard: the session on air — who's
 * being helped, who's in line, pushed live over the queue's socket — or the
 * next one counting down, or a way to schedule one.
 */
export default function SupportStage({ sessions }: { sessions: MentorSupportSession[] }) {
    // Sessions go live and end on the clock, not on a refetch.
    const now = useNow(15_000);
    const current = sessions.filter((session) => new Date(session.endTime).getTime() >= now);
    const live = current.filter((session) => new Date(session.startTime).getTime() <= now);
    const upcoming = current.filter((session) => new Date(session.startTime).getTime() > now);

    if (live.length > 0) return <OnAir session={live[0]} alsoLive={live.length - 1} />;
    if (upcoming.length > 0) return <NextSession session={upcoming[0]} later={upcoming.slice(1)} now={now} />;
    return <NothingScheduled />;
}

function OnAir({ session, alsoLive }: { session: MentorSupportSession; alsoLive: number }) {
    const queryClient = useQueryClient();
    // The queue board's own query and socket, so this is the board the mentor
    // would see — and opening it is instant.
    const { data: fetched } = useQuery({
        queryKey: ["support", "board", session.id],
        queryFn: () => supportService.queueBoard(session.id),
        refetchInterval: 30_000,
    });
    const { board: pushed } = useSupportSocket(session.id);
    const board = pushed ?? fetched;

    // A new number called means the last one was helped — refresh the count.
    const servingNumber = pushed?.nowServing?.queueNumber ?? null;
    const lastServing = useRef<number | null | undefined>(undefined);
    useEffect(() => {
        if (!pushed) return;
        if (lastServing.current !== undefined && lastServing.current !== servingNumber) {
            void queryClient.invalidateQueries({ queryKey: ["dashboard", "mentor"] });
        }
        lastServing.current = servingNumber;
    }, [pushed, servingNumber, queryClient]);

    const serving = board?.nowServing ?? null;
    const waiting = board?.waiting ?? [];
    const waitingCount = board?.waitingCount ?? session.queueStats?.waiting ?? 0;
    const helped = session.queueStats?.done ?? 0;
    const joinOpen = board?.joinOpen ?? session.joinOpen;

    return (
        <section aria-labelledby="stage-title" className={STAGE}>
            <span aria-hidden className="absolute -left-24 -top-28 -z-10 size-80 rounded-full bg-emerald-500/20 blur-3xl" />
            <span aria-hidden className="absolute -bottom-32 right-0 -z-10 size-72 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className={cn(EYEBROW, "inline-flex items-center gap-2 text-emerald-300")}>
                        <span className="relative flex size-2.5" aria-hidden>
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                        </span>
                        On air
                        {alsoLive > 0 && <span className="font-medium normal-case tracking-normal text-white/60">· {alsoLive} more live</span>}
                    </p>
                    <p className="text-xs text-white/60">
                        {clock(session.startTime)} – {clock(session.endTime)} · sign-ups {joinOpen ? "open" : "closed"}
                    </p>
                </div>

                <h2 id="stage-title" className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    {session.title || "Support session"}
                </h2>
                <p className="mt-1 truncate text-sm font-medium text-white/70">{session.course.title}</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    {/* The ticket being served. */}
                    <div className="relative overflow-hidden rounded-2xl bg-white/6 p-5 ring-1 ring-white/10">
                        <p className={LABEL}>Now serving</p>
                        {serving ? (
                            <>
                                <p className="mt-1 font-mono text-5xl font-bold leading-none tracking-tight tabular-nums">
                                    {formatQueueNumber(serving.queueNumber)}
                                </p>
                                <p className="mt-3 truncate font-semibold">{serving.student.name}</p>
                                {serving.topic && <p className="mt-0.5 line-clamp-2 text-sm text-white/60">“{serving.topic}”</p>}
                            </>
                        ) : (
                            <>
                                <p className="mt-1 font-mono text-5xl font-bold leading-none tracking-tight text-white/25">#--</p>
                                <p className="mt-3 text-sm text-white/60">
                                    {waitingCount > 0 ? "Call the first number from the board." : "Nobody yet — they take a number as they arrive."}
                                </p>
                            </>
                        )}
                    </div>

                    {/* The line behind them. */}
                    <div className="rounded-2xl bg-white/6 p-5 ring-1 ring-white/10">
                        <p className={LABEL}>In line</p>
                        <p className="mt-1 text-5xl font-bold leading-none tracking-tight tabular-nums">{waitingCount}</p>
                        {waiting.length > 0 ? (
                            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Waiting numbers">
                                {waiting.slice(0, 6).map((entry, index) => (
                                    <li
                                        key={entry.id}
                                        title={entry.student.name}
                                        className={cn(
                                            "rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ring-1",
                                            index === 0 ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30" : "text-white/70 ring-white/15",
                                        )}
                                    >
                                        {formatQueueNumber(entry.queueNumber)}
                                    </li>
                                ))}
                                {waitingCount > 6 && <li className="px-1 py-0.5 text-xs text-white/50">+{waitingCount - 6}</li>}
                            </ul>
                        ) : (
                            <p className="mt-3 text-sm text-white/60">{waitingCount > 0 ? plural(waitingCount, "student") + " waiting" : "Nobody waiting."}</p>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <Button asChild variant="inverse" size="lg">
                        <Link href={`/mentor/support/${session.id}`}>
                            Open queue board <ArrowRight />
                        </Link>
                    </Button>
                    <dl className="flex gap-6 text-sm">
                        <div>
                            <dt className={LABEL}>Helped</dt>
                            <dd className="mt-0.5 font-semibold tabular-nums">{helped}</dd>
                        </div>
                        <div>
                            <dt className={LABEL}>Time left</dt>
                            <dd className="mt-0.5 font-semibold tabular-nums">
                                <Remaining to={session.endTime} />
                            </dd>
                        </div>
                    </dl>
                    {!session.meetingLink && <MissingLink sessionId={session.id} live />}
                </div>
            </div>

            <SessionLine start={session.startTime} end={session.endTime} />
        </section>
    );
}

/** "Today", "Tomorrow", "Saturday" within the week, "Sat 24 Oct" beyond it. */
function dayWord(value: string, now: number) {
    const date = new Date(value);
    if (dhakaDayKey(date) === dhakaDayKey(now)) return "Today";
    if (dhakaDayKey(date) === dhakaDayKey(now + DAY_MS)) return "Tomorrow";
    return date.toLocaleDateString(
        "en-GB",
        date.getTime() - now < 6 * DAY_MS
            ? { weekday: "long", timeZone: "Asia/Dhaka" }
            : { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" },
    );
}

function NextSession({ session, later, now }: { session: MentorSupportSession; later: MentorSupportSession[]; now: number }) {
    const start = new Date(session.startTime);
    const when = dayWord(session.startTime, now);
    const isToday = when === "Today";

    return (
        <section aria-labelledby="stage-title" className={STAGE}>
            <span aria-hidden className="absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-sky-500/20 blur-3xl" />
            <span aria-hidden className="absolute -bottom-36 -left-20 -z-10 size-72 rounded-full bg-indigo-500/15 blur-3xl" />

            <div className="flex h-full flex-col p-6 sm:p-8">
                <p className={cn(EYEBROW, "text-sky-300")}>Your next session · {when}</p>

                <div className="mt-4 flex items-start gap-5">
                    <DayLeaf date={start} isToday={isToday} tone="dark" />
                    <div className="min-w-0">
                        <h2 id="stage-title" className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                            {session.title || "Support session"}
                        </h2>
                        <p className="mt-1 truncate text-sm font-medium text-white/70">{session.course.title}</p>
                        <p className="mt-2 text-xs text-white/55">
                            {clock(session.startTime)} – {clock(session.endTime)} · {session.slotMinutes} min a student
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 sm:mt-8">
                    <div>
                        <p className={LABEL}>Starts in</p>
                        <p className="mt-1 text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">
                            <Countdown to={session.startTime} />
                        </p>
                    </div>

                    {/* What follows it, so the stage shows the run of sessions, not just one. */}
                    {later.length > 0 && (
                        <div className="min-w-0 sm:max-w-[16rem]">
                            <p className={LABEL}>After that</p>
                            <ul className="mt-2 space-y-1.5">
                                {later.slice(0, 2).map((next) => (
                                    <li key={next.id}>
                                        <Link href={`/mentor/support/${next.id}`} className="group flex items-baseline gap-2 text-sm">
                                            <span className="shrink-0 font-medium tabular-nums text-white/85">
                                                {dayWord(next.startTime, now)} {clock(next.startTime)}
                                            </span>
                                            <span className="truncate text-white/50 group-hover:text-white/80">{next.course.title}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
                    <Button asChild variant="inverse" size="lg">
                        <Link href={`/mentor/support/${session.id}`}>
                            Open session <ArrowRight />
                        </Link>
                    </Button>
                    {!session.meetingLink && <MissingLink sessionId={session.id} />}
                    {later.length > 2 && (
                        <Link href="/mentor/support" className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline">
                            {plural(later.length, "more session")} scheduled
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}

function NothingScheduled() {
    return (
        <section aria-labelledby="stage-title" className={STAGE}>
            <span aria-hidden className="absolute -right-28 -top-32 -z-10 size-80 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="flex h-full flex-col p-6 sm:p-8">
                <p className={cn(EYEBROW, "text-sky-300")}>Support</p>
                <h2 id="stage-title" className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    No sessions scheduled
                </h2>
                <p className="mt-2 max-w-md text-sm text-white/65">
                    Schedule one and your students hear about it straight away. When it goes live they take a number,
                    and you work the line from the queue board.
                </p>
                {/* An empty ticket rail — where the line will form. */}
                <ol aria-hidden className="mt-6 flex gap-2">
                    {[1, 2, 3, 4].map((n) => (
                        <li key={n} className="rounded-md border border-dashed border-white/15 px-2 py-1 font-mono text-xs text-white/30">
                            {formatQueueNumber(n)}
                        </li>
                    ))}
                </ol>
                <div className="mt-auto pt-6">
                    <Button asChild variant="inverse" size="lg">
                        <Link href="/mentor/support?new=1">
                            <CalendarPlus /> Schedule a session
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}

/** Students can't join without a link — the one thing worth fixing before it starts. */
function MissingLink({ sessionId, live = false }: { sessionId: string; live?: boolean }) {
    return (
        <Link
            href={`/mentor/support?edit=${sessionId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-300/30 transition-colors hover:bg-amber-400/25"
        >
            <Link2Off className="size-3.5" aria-hidden />
            {live ? "No Meet link — students can't join" : "No Meet link yet"} · Add one
        </Link>
    );
}

/** "02:14:36" under a day away, "3 days" beyond. */
function Countdown({ to }: { to: string }) {
    const now = useNow(1000);
    const ms = new Date(to).getTime() - now;
    if (ms <= 0) return <>Starting…</>;
    if (ms >= DAY_MS) {
        const days = Math.round(ms / DAY_MS);
        return <>{plural(days, "day")}</>;
    }
    const seconds = Math.floor(ms / 1000);
    return (
        <span aria-label={`${Math.floor(seconds / 3600)} hours ${Math.floor((seconds % 3600) / 60)} minutes`}>
            {pad2(Math.floor(seconds / 3600))}:{pad2(Math.floor((seconds % 3600) / 60))}
            <span className="text-white/40">:{pad2(seconds % 60)}</span>
        </span>
    );
}

function Remaining({ to }: { to: string }) {
    const now = useNow(30_000);
    const minutes = Math.max(0, Math.ceil((new Date(to).getTime() - now) / 60_000));
    if (minutes >= 60) return <>{Math.floor(minutes / 60)} h {pad2(minutes % 60)} min</>;
    return <>{minutes} min</>;
}

/** How far through its window the session is, along the stage's bottom edge. */
function SessionLine({ start, end }: { start: string; end: string }) {
    const now = useNow(30_000);
    const from = new Date(start).getTime();
    const to = new Date(end).getTime();
    const elapsed = Math.min(100, Math.max(0, ((now - from) / Math.max(1, to - from)) * 100));

    return (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <span
                className="block h-full bg-linear-to-r from-emerald-400 to-sky-400 transition-[width] duration-1000"
                style={{ width: `${elapsed}%` }}
            />
        </span>
    );
}
