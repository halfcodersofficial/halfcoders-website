"use client";

import { Bell, Check, CheckCheck, GraduationCap, Inbox, MonitorPlay, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { linkifyMessage, TYPE_VARIANT } from "@/components/shared/AnnouncementsView";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LOGIN_POPUP_LOCK_SECONDS } from "@/lib/confirm";
import { cn } from "@/lib/utils";

export type PreviewView = "popup" | "bell" | "inbox";

const VIEW_META = {
    popup: { label: "Login pop-up", icon: MonitorPlay },
    bell: { label: "Bell & toast", icon: Bell },
    inbox: { label: "Inbox page", icon: Inbox },
} as const;

const ARRIVE = "animate-in fade-in duration-500 ease-out fill-mode-both motion-reduce:animate-none";

interface RecipientPreviewProps {
    /** The views to offer, in order. */
    views: readonly PreviewView[];
    title: string;
    message: string;
    type: string;
    link: string;
    view: PreviewView;
    onViewChange: (view: PreviewView) => void;
    /** A pop-up shown at every sign-in rather than once — for the pop-up's caption. */
    repeat?: boolean;
    /** Who it's going to, for the caption — "1,248 students". */
    reach: string | null;
    /** Set while it's showing the broadcast that just went out — "Sent 15:42". */
    stamp?: string;
    /** Bumped on every send, which replays the arrival. */
    deliveries: number;
    className?: string;
}

/**
 * The broadcast as a recipient meets it, redrawn live from the composer: the
 * login pop-up (the themed SweetAlert `loginPopupAlert` opens, with its lock
 * counting down), the row at the top of their bell (the classes
 * `NotificationsDropdown` uses), the toast anyone online gets the moment it
 * lands, and the same message on their Announcements page. A miniature, not
 * a screenshot — the page around them is reduced to blanks so the message is
 * the only thing that reads.
 */
export default function RecipientPreview({
    views,
    title,
    message,
    type,
    link,
    view,
    onViewChange,
    repeat = false,
    reach,
    stamp,
    deliveries,
    className,
}: RecipientPreviewProps) {
    const [replays, setReplays] = useState(0);
    const shownTitle = title.trim() || "Your title";
    const shownMessage = message.trim() || "Your message shows here as you write it.";
    const titleEmpty = !title.trim();
    const messageEmpty = !message.trim();

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                {stamp ? (
                    <p className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
                        <Check className="size-3.5" aria-hidden />
                        {stamp}
                    </p>
                ) : (
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">What they&apos;ll see</p>
                )}
                <div role="group" aria-label="Preview" className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-1">
                    {views.map((value) => {
                        const { label, icon: Icon } = VIEW_META[value];
                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={view === value}
                                onClick={() => onViewChange(value)}
                                className={cn(
                                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                                    view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Icon className="size-3.5" aria-hidden />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* A picture of what the form already says, so it's kept out of the accessibility tree. */}
            <div
                aria-hidden
                className="relative h-129 overflow-hidden rounded-2xl border border-border bg-background select-none"
                style={{ boxShadow: "var(--shadow-panel)" }}
            >
                <ScreenHeader view={view} deliveries={deliveries} />
                <PageBlanks />

                {view === "bell" ? (
                    <>
                        {/* The live toast — sonner's default light theme, top centre, as app/layout.tsx mounts
                            it. Dropped below their header here, which the miniature has no room to share. */}
                        <div
                            key={`toast-${deliveries}`}
                            className={cn(
                                "absolute left-1/2 top-15 z-20 w-[min(17rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-[hsl(0,0%,93%)] bg-white p-3.5 text-[hsl(0,0%,9%)] shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
                                ARRIVE,
                                "slide-in-from-top-3 delay-500",
                            )}
                        >
                            <span className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-[hsl(0,0%,93%)] bg-white">
                                <X className="size-2.5" />
                            </span>
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                                    <p className={cn("font-medium", titleEmpty && "text-[hsl(0,0%,60%)]")}>{shownTitle}</p>
                                    <p className={cn("mt-0.5 line-clamp-3 text-[#3f3f3f]", messageEmpty && "text-[hsl(0,0%,60%)]")}>
                                        {shownMessage}
                                    </p>
                                </div>
                                {link && (
                                    <span className="shrink-0 rounded bg-[hsl(0,0%,9%)] px-2 py-1 text-xs font-medium text-white">View</span>
                                )}
                            </div>
                        </div>

                        {/* The bell, opened. */}
                        <div
                            key={`panel-${deliveries}`}
                            className={cn(
                                "absolute right-3 top-38 z-10 w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground",
                                ARRIVE,
                                "slide-in-from-top-2 delay-150",
                            )}
                            style={{ boxShadow: "var(--shadow-panel)" }}
                        >
                            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                                <div>
                                    <p className="font-semibold">Notifications</p>
                                    <p className="text-xs text-muted-foreground">1 unread</p>
                                </div>
                                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary">
                                    <CheckCheck className="size-3.5" /> Mark all read
                                </span>
                            </div>

                            <div className="space-y-1 p-1.5">
                                <div className="flex gap-2 rounded-lg bg-primary/5 p-2.5">
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <p className={cn("truncate text-sm font-medium text-primary", titleEmpty && "text-primary/45")}>
                                                {shownTitle}
                                            </p>
                                            <Badge variant={TYPE_VARIANT[type] ?? "secondary"} className="shrink-0 text-[10px]">
                                                {type}
                                            </Badge>
                                            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                                        </div>
                                        <p className={cn("line-clamp-2 text-xs text-muted-foreground", messageEmpty && "text-muted-foreground/60")}>
                                            {shownMessage}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">Just now</p>
                                    </div>
                                </div>
                                <EarlierRow />
                                <EarlierRow short />
                            </div>

                            <p className="border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary">
                                View all announcements
                            </p>
                        </div>
                    </>
                ) : view === "popup" ? (
                    <LoginPopupMock
                        key={`popup-${deliveries}-${replays}`}
                        title={shownTitle}
                        message={shownMessage}
                        titleEmpty={titleEmpty}
                        messageEmpty={messageEmpty}
                        link={link}
                    />
                ) : (
                    // Their Announcements page: the list with this one selected, then the reading pane.
                    <div key={`inbox-${deliveries}`} className={cn("absolute inset-x-0 bottom-0 top-12 space-y-3 bg-background p-3", ARRIVE)}>
                        <div className="flex items-baseline justify-between px-1">
                            <p className="text-base font-bold">Announcements</p>
                            <p className="text-xs text-muted-foreground">1 unread</p>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            <div className="border-l-2 border-primary bg-primary/5 px-3.5 py-3">
                                <span className="flex items-center gap-2">
                                    <span className={cn("truncate text-sm font-medium text-primary", titleEmpty && "text-primary/45")}>
                                        {shownTitle}
                                    </span>
                                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                                </span>
                                <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">{shownMessage}</span>
                            </div>
                            <div className="space-y-1.5 border-t border-border px-3.5 py-3 opacity-60">
                                <span className="block h-2 w-2/5 rounded-full bg-secondary" />
                                <span className="block h-1.5 w-4/5 rounded-full bg-secondary" />
                            </div>
                        </div>
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={TYPE_VARIANT[type] ?? "secondary"}>{type}</Badge>
                                <span className="text-xs text-muted-foreground">Just now</span>
                            </div>
                            <p className={cn("text-lg font-bold leading-snug", titleEmpty && "text-muted-foreground/60")}>{shownTitle}</p>
                            <p
                                className={cn(
                                    "line-clamp-9 whitespace-pre-wrap text-sm leading-relaxed text-foreground",
                                    messageEmpty && "text-muted-foreground/60",
                                )}
                            >
                                {messageEmpty ? shownMessage : linkifyMessage(message)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
                {view === "popup" ? (
                    <>
                        Covers the screen of {reach ? <span className="font-medium text-foreground">{reach}</span> : "everyone you picked"}{" "}
                        {repeat ? "once every time they sign in" : "the next time they open Half Coders"}. For the first{" "}
                        {LOGIN_POPUP_LOCK_SECONDS} seconds it can&apos;t be closed; after that{" "}
                        {link ? (
                            <>
                                &ldquo;View&rdquo; opens{" "}
                                <PathChip path={link} />.
                            </>
                        ) : (
                            "they close it with ×."
                        )}{" "}
                        <button
                            type="button"
                            onClick={() => setReplays((n) => n + 1)}
                            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                        >
                            <RotateCcw className="size-3" aria-hidden />
                            Replay
                        </button>
                    </>
                ) : view === "bell" ? (
                    <>
                        Lands in the bell of {reach ? <span className="font-medium text-foreground">{reach}</span> : "everyone you picked"}
                        ; anyone online right now also gets the toast.{" "}
                        {link ? (
                            <>
                                Both open <PathChip path={link} />.
                            </>
                        ) : (
                            "With no link, the toast has no “View” button."
                        )}
                    </>
                ) : (
                    <>
                        The full text, as it reads on their Announcements page. Web addresses written into the message
                        become links here; the &ldquo;Opens&rdquo; path is used by the bell and the toast.
                    </>
                )}
            </p>
        </div>
    );
}

/** A path in a caption: kept on one line, a long one cut short (in full on hover). */
function PathChip({ path }: { path: string }) {
    return (
        <code
            title={path}
            className="inline-block max-w-full truncate rounded bg-secondary px-1 py-0.5 align-bottom font-mono text-[0.6875rem] leading-tight text-foreground"
        >
            {path}
        </code>
    );
}

/**
 * The login pop-up over their page: SweetAlert's backdrop and info icon, the
 * popup in the console's theme (globals.css), and the lock counting down for
 * real — then the × and, with a link, "View", exactly as `loginPopupAlert`
 * unlocks them. Remounted to replay.
 */
function LoginPopupMock({
    title,
    message,
    titleEmpty,
    messageEmpty,
    link,
}: {
    title: string;
    message: string;
    titleEmpty: boolean;
    messageEmpty: boolean;
    link: string;
}) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const started = Date.now();
        const timer = window.setInterval(() => {
            const seconds = Math.floor((Date.now() - started) / 1000);
            setElapsed(seconds);
            if (seconds >= LOGIN_POPUP_LOCK_SECONDS) window.clearInterval(timer);
        }, 250);
        return () => window.clearInterval(timer);
    }, []);

    const left = Math.max(0, LOGIN_POPUP_LOCK_SECONDS - elapsed);
    const locked = left > 0;

    return (
        <div className={cn("absolute inset-0 z-30 grid place-items-center bg-black/40 p-4", ARRIVE, "duration-300")}>
            <div
                className="relative w-full max-w-76 rounded-xl border border-border bg-card px-5 pb-5 pt-6 text-center text-card-foreground animate-in fade-in zoom-in-95 duration-300 fill-mode-both motion-reduce:animate-none"
                style={{ boxShadow: "var(--shadow-panel)" }}
            >
                {!locked && (
                    <span className="absolute right-2.5 top-1.5 text-2xl leading-none text-[#ccc] animate-in fade-in duration-300">×</span>
                )}
                {/* SweetAlert's own info icon — the console's theme leaves it as is. */}
                <span className="mx-auto grid size-14 place-items-center rounded-full border-4 border-[#9de0f6] text-4xl font-light text-[#3fc3ee]">
                    i
                </span>
                <p className={cn("mt-4 text-lg font-semibold leading-snug text-foreground", titleEmpty && "text-muted-foreground/60")}>
                    {title}
                </p>
                <p
                    className={cn(
                        "mt-2 line-clamp-6 whitespace-pre-line text-sm text-muted-foreground",
                        messageEmpty && "text-muted-foreground/60",
                    )}
                >
                    {message}
                </p>

                {locked ? (
                    <p className="mt-4 border-t border-[#eee] pt-3 text-sm tabular-nums">
                        You can close this in {left}s…
                    </p>
                ) : (
                    link && (
                        <span className={cn(buttonVariants(), "mt-5 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none")}>
                            View
                        </span>
                    )
                )}
            </div>
        </div>
    );
}

/** Their header: the Half Coders mark, blanks for the nav, the bell with its count. */
function ScreenHeader({ view, deliveries }: { view: PreviewView; deliveries: number }) {
    return (
        <div className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="size-3.5" />
            </span>
            <span className="text-xs font-bold">Half Coders</span>
            <span className="ml-2 h-1.5 w-9 rounded-full bg-secondary" />
            <span className="h-1.5 w-12 rounded-full bg-secondary" />
            <span
                className={cn(
                    "relative ml-auto grid size-8 place-items-center rounded-full",
                    view === "bell" ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
            >
                <Bell className="size-4" />
                <span
                    key={deliveries}
                    className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50 duration-300 delay-300 fill-mode-both motion-reduce:animate-none"
                >
                    1
                </span>
            </span>
            <span className="size-7 rounded-full bg-secondary" />
        </div>
    );
}

/** Whatever page they were on, reduced to shapes. */
function PageBlanks() {
    return (
        <div className="space-y-3 p-4 opacity-70">
            <span className="block h-2.5 w-1/3 rounded-full bg-secondary" />
            <span className="block h-1.5 w-1/2 rounded-full bg-secondary/80" />
            <span className="block h-28 rounded-xl bg-secondary/60" />
            <span className="grid grid-cols-3 gap-3">
                <span className="h-20 rounded-xl bg-secondary/60" />
                <span className="h-20 rounded-xl bg-secondary/60" />
                <span className="h-20 rounded-xl bg-secondary/60" />
            </span>
            <span className="block h-24 rounded-xl bg-secondary/50" />
            <span className="block h-16 rounded-xl bg-secondary/40" />
        </div>
    );
}

/** An older notification under the new one, as blanks. */
function EarlierRow({ short = false }: { short?: boolean }) {
    return (
        <div className="space-y-1.5 rounded-lg p-2.5 opacity-60">
            <span className={cn("block h-2 rounded-full bg-secondary", short ? "w-1/3" : "w-1/2")} />
            <span className="block h-1.5 w-11/12 rounded-full bg-secondary" />
            <span className="block h-1.5 w-1/4 rounded-full bg-secondary/80" />
        </div>
    );
}
