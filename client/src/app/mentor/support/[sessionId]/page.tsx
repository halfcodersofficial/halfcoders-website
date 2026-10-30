"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ClipboardList, Hourglass, Lock, Radio, SkipForward, Square, Unlock, Video, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clock, elapsed, plural } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { useSupportSocket } from "@/hooks/useSupportSocket";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatQueueNumber } from "@/lib/utils";
import { supportService } from "@/services";
import type { QueueBoard } from "@/types/domain.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";
const PANEL = "rounded-card border border-border bg-card shadow-card";

/** True while the person is typing — a key press there is text, not a shortcut. */
const typing = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The mentor's live queue board (plan §26). The line moves only when the
 * mentor moves it: finish with someone and "Done — call next" promotes the
 * lowest waiting number (N does the same from the keyboard). Students watch
 * the same board update live; they're named, nothing more.
 */
export default function MentorQueueBoardPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const queryClient = useQueryClient();
    const now = useNow(15_000);
    const [note, setNote] = useState("");

    const { data: fetched, isLoading, isError, error } = useQuery({
        queryKey: ["support", "board", sessionId],
        queryFn: () => supportService.queueBoard(sessionId),
    });
    const { board: pushed, isConnected } = useSupportSocket(sessionId);
    // The socket carries the freshest state; the REST fetch seeds the first
    // render and covers a failed handshake.
    const board = pushed ?? fetched;

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["support", "board", sessionId] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "mentor"] });
    };

    const serveNext = useMutation({
        mutationFn: () => supportService.serveNext(sessionId, note.trim() || undefined),
        onSuccess: (next) => {
            toast.success(next ? `Now with ${formatQueueNumber(next.queueNumber)}` : "That was the last one — nobody's waiting.");
            setNote("");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't call the next student.")),
    });
    const completeCurrent = useMutation({
        mutationFn: () => supportService.completeCurrent(sessionId, note.trim() || undefined),
        onSuccess: () => {
            toast.success("Done — the next one waits until you call them.");
            setNote("");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't finish that one.")),
    });
    const skip = useMutation({
        mutationFn: (queueId: string) => supportService.skip(queueId, "No response."),
        onSuccess: () => invalidate(),
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't skip that student.")),
    });
    const endSession = useMutation({
        mutationFn: () => supportService.setSessionStatus(sessionId, "ENDED"),
        onSuccess: () => {
            toast.success("Session ended.");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't end the session.")),
    });
    // Cuts off new sign-ups (at 8:55 for a 9:00 close, say) without ending the
    // session — everyone already in line is still seen.
    const toggleJoinOpen = useMutation({
        mutationFn: (joinOpen: boolean) => supportService.updateSession(sessionId, { joinOpen }),
        onSuccess: (_result, joinOpen) => {
            toast.success(joinOpen ? "Sign-ups open again." : "Sign-ups closed — nobody new can join.");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't change sign-ups.")),
    });

    const busy = serveNext.isPending || completeCurrent.isPending;
    const canCall = Boolean(board && (board.nowServing || board.waitingCount > 0));

    // N: done with this one, call the next.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
            if (!canCall || busy) return;
            event.preventDefault();
            serveNext.mutate();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [canCall, busy, serveNext]);

    if (isLoading) {
        return (
            <div className="w-full space-y-6">
                <Skeleton className="h-16 w-80" />
                <Skeleton className="h-20 rounded-card" />
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <Skeleton className="h-96 rounded-card" />
                    <Skeleton className="h-96 rounded-card" />
                </div>
            </div>
        );
    }

    if (isError || !board) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this session</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "It may belong to a course you don't mentor.")}</p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href="/mentor/support">Back to sessions</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const askEnd = async () => {
        const ok = await confirmAction({
            title: "End the session?",
            text: board.waitingCount
                ? `${plural(board.waitingCount, "student is", "students are")} still waiting — they'll be let go.`
                : "Nobody new can join, and the board closes.",
            confirmText: "End session",
        });
        if (ok) endSession.mutate();
    };

    return (
        <div className="w-full space-y-6">
            <Header board={board} now={now} isConnected={isConnected} />

            <Stats board={board} now={now} />

            {board.isLive && (
                <div className={cn("flex flex-wrap items-center gap-2", RISE)} style={{ animationDelay: "120ms" }}>
                    {board.meetingLink && (
                        <Button asChild variant="brand-outline">
                            <a href={board.meetingLink} target="_blank" rel="noopener noreferrer">
                                <Video /> Open the Meet
                            </a>
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => toggleJoinOpen.mutate(!board.joinOpen)} isLoading={toggleJoinOpen.isPending}>
                        {!toggleJoinOpen.isPending && (board.joinOpen ? <Lock /> : <Unlock />)}
                        {board.joinOpen ? "Close sign-ups" : "Open sign-ups again"}
                    </Button>
                    <Button variant="ghost" className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void askEnd()} isLoading={endSession.isPending}>
                        {!endSession.isPending && <Square />} End session
                    </Button>
                </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <NowServing
                    board={board}
                    now={now}
                    note={note}
                    setNote={setNote}
                    busy={busy}
                    canCall={canCall}
                    calling={serveNext.isPending}
                    finishing={completeCurrent.isPending}
                    onNext={() => serveNext.mutate()}
                    onFinish={() => completeCurrent.mutate()}
                />
                <Line board={board} now={now} skipping={skip.isPending ? skip.variables : undefined} onSkip={(id) => skip.mutate(id)} />
            </div>

            <p className="text-center text-xs text-muted-foreground">
                Students see this board update live.{" "}
                <Link href={`/mentor/support/${sessionId}/history`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <ClipboardList className="size-3.5" aria-hidden /> Attendance
                </Link>
            </p>
        </div>
    );
}

function Header({ board, now, isConnected }: { board: QueueBoard; now: number; isConnected: boolean }) {
    const ended = !board.isLive && new Date(board.endTime).getTime() < now;
    return (
        <header className={cn("space-y-4", RISE)}>
            <BackButton href="/mentor/support" label="All sessions" />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                        {board.isLive ? (
                            <span className="inline-flex items-center gap-1.5 text-success">
                                <span className="size-2 rounded-full bg-success motion-safe:animate-pulse" aria-hidden /> Live
                            </span>
                        ) : (
                            <span>{ended || board.status === "ENDED" ? "Over" : board.status === "CANCELLED" ? "Cancelled" : "Not started"}</span>
                        )}
                        {board.course && (
                            <>
                                <span aria-hidden>·</span>
                                <span className="normal-case tracking-normal">{board.course.title}</span>
                            </>
                        )}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{board.title || "Support session"}</h1>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {clock(board.startTime)} – {clock(board.endTime)} · {board.slotMinutes} min a student · Dhaka time
                    </p>
                </div>
                <p className={cn("inline-flex items-center gap-1.5 text-xs", isConnected ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
                    {isConnected ? <Radio className="size-3.5 text-success" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
                    {isConnected ? "Updating live" : "Reconnecting…"}
                </p>
            </div>
        </header>
    );
}

/** The line at a glance: waiting, helped, skipped — and the session's clock. */
function Stats({ board, now }: { board: QueueBoard; now: number }) {
    const start = new Date(board.startTime).getTime();
    const end = new Date(board.endTime).getTime();
    const share = Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
    const left = end - now;
    const capacityLeft = Math.max(0, Math.floor(left / 60_000 / board.slotMinutes));
    return (
        <section aria-label="The session so far" className={cn(PANEL, "overflow-hidden", RISE)} style={{ animationDelay: "60ms" }}>
            <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                <Stat label="Waiting" value={board.waitingCount} hint={board.joinOpen ? "Sign-ups open" : "Sign-ups closed"} />
                <Stat label="Helped" value={board.helpedCount ?? 0} />
                <Stat label="Skipped" value={board.skippedCount ?? 0} />
                <Stat
                    label={left > 0 ? "Time left" : "Time"}
                    value={left > 0 ? (left >= 3_600_000 ? `${Math.floor(left / 3_600_000)} h ${Math.round((left % 3_600_000) / 60_000)} m` : `${Math.max(1, Math.round(left / 60_000))} min`) : "Over"}
                    hint={left > 0 ? `Room for about ${plural(capacityLeft, "more student", "more students")}` : undefined}
                />
            </dl>
            <div className="h-1 bg-secondary" aria-hidden>
                <div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${share}%` }} />
            </div>
        </section>
    );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="bg-card px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
            {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

function NowServing({
    board,
    now,
    note,
    setNote,
    busy,
    canCall,
    calling,
    finishing,
    onNext,
    onFinish,
}: {
    board: QueueBoard;
    now: number;
    note: string;
    setNote: (note: string) => void;
    busy: boolean;
    canCall: boolean;
    calling: boolean;
    finishing: boolean;
    onNext: () => void;
    onFinish: () => void;
}) {
    const serving = board.nowServing;
    const next = board.waiting[0];
    return (
        <section aria-labelledby="serving-title" className={cn(PANEL, RISE, serving && "border-primary/40")} style={{ animationDelay: "160ms" }}>
            <h2 id="serving-title" className="border-b border-border px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground sm:px-6">
                With you now
            </h2>
            <div className="space-y-5 p-5 sm:p-6">
                {serving ? (
                    <>
                        <div className="flex flex-wrap items-center gap-5">
                            <span className="font-mono text-6xl font-bold leading-none tracking-tight text-primary tabular-nums">{formatQueueNumber(serving.queueNumber)}</span>
                            <div className="min-w-0">
                                <p className="truncate text-xl font-semibold">{serving.student.name}</p>
                                {serving.servedAt && (
                                    <p className="text-sm text-muted-foreground">
                                        With you {elapsed(serving.servedAt, now).text}
                                        {elapsed(serving.servedAt, now).days === 0 &&
                                            now - new Date(serving.servedAt).getTime() > board.slotMinutes * 60_000 && (
                                            <span className="font-medium text-amber-700 dark:text-amber-400"> · over the {board.slotMinutes} min slot</span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                        {serving.topic && (
                            <blockquote className="rounded-card bg-secondary/40 px-4 py-3 text-sm leading-relaxed">
                                <span className="mb-1 block text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">They need help with</span>
                                {serving.topic}
                            </blockquote>
                        )}
                        <Textarea
                            rows={2}
                            maxLength={1000}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={`A note on ${serving.student.name}'s question, for the attendance record (optional)…`}
                            aria-label="Note for the attendance record"
                        />
                    </>
                ) : (
                    <div className="py-6 text-center">
                        <span className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-surface text-muted-foreground">
                            <Hourglass className="size-5" aria-hidden />
                        </span>
                        <p className="mt-3 font-medium">{next ? "Ready when you are" : "Nobody's in line"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {next
                                ? `${formatQueueNumber(next.queueNumber)} ${next.student.name} is first.`
                                : board.isLive
                                  ? board.joinOpen
                                      ? "Students on the course can take a number now."
                                      : "Sign-ups are closed."
                                  : "The line opens when the session starts."}
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    <Button size="lg" onClick={onNext} isLoading={calling} disabled={busy || !canCall}>
                        {!calling && (serving ? <Check /> : <ArrowRight />)}
                        {serving ? (next ? "Done — call next" : "Done") : "Call the first student"}
                        <kbd className="ml-1 hidden rounded border border-white/30 px-1.5 font-mono text-[0.6875rem] sm:inline">N</kbd>
                    </Button>
                    {serving && next && (
                        <Button variant="outline" size="lg" onClick={onFinish} isLoading={finishing} disabled={busy}>
                            Done, take a break
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}

function Line({ board, now, skipping, onSkip }: { board: QueueBoard; now: number; skipping?: string; onSkip: (id: string) => void }) {
    const askSkip = async (entry: QueueBoard["waiting"][number]) => {
        const ok = await confirmAction({
            title: `Skip ${formatQueueNumber(entry.queueNumber)} ${entry.student.name}?`,
            text: "They're taken out of the line as not answering. They can take a new number if sign-ups are open.",
            confirmText: "Skip",
            tone: "default",
        });
        if (ok) onSkip(entry.id);
    };
    return (
        <section aria-labelledby="line-title" className={cn(PANEL, "overflow-hidden", RISE)} style={{ animationDelay: "200ms" }}>
            <h2 id="line-title" className="flex items-baseline justify-between border-b border-border px-5 py-3 sm:px-6">
                <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">In line</span>
                <span className="text-xs tabular-nums text-muted-foreground">{board.waitingCount}</span>
            </h2>
            {board.waiting.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nobody&apos;s waiting.</p>
            ) : (
                <ol className="divide-y divide-border">
                    {board.waiting.map((entry, index) => {
                        const wait = elapsed(entry.joinedAt, now);
                        return (
                            <li key={entry.id} className={cn("flex items-start gap-3 px-5 py-3 sm:px-6", index === 0 && "bg-primary/4")}>
                                <span className={cn("w-12 shrink-0 pt-1.5 font-mono text-sm font-semibold tabular-nums", index === 0 ? "text-primary" : "text-muted-foreground")}>
                                    {formatQueueNumber(entry.queueNumber)}
                                </span>
                                <Avatar name={entry.student.name} size={32} />
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-baseline gap-2">
                                        <span className="truncate text-sm font-medium">{entry.student.name}</span>
                                        {index === 0 && <span className="shrink-0 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-primary">Next</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">waiting {wait.text}</p>
                                    {entry.topic && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/80">{entry.topic}</p>}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Skip ${entry.student.name}`}
                                    title="Skip — not answering"
                                    isLoading={skipping === entry.id}
                                    onClick={() => void askSkip(entry)}
                                >
                                    {skipping !== entry.id && <SkipForward className="size-4" />}
                                </Button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
