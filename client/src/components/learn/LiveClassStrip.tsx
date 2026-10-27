"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Radio } from "lucide-react";
import { clock, dayMonthOf, dhakaDayKey, weekdayOf } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { liveClassService } from "@/services/conceptual";
import type { LearnerLiveClass } from "@/types/conceptual.types";

const MINUTE = 60_000;

/** "in 2 days", "in 3 h", "in 12 min". */
const until = (target: number, now: number) => {
    const minutes = Math.max(1, Math.round((target - now) / MINUTE));
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 36) return `in ${hours} h`;
    return `in ${Math.round(hours / 24)} days`;
};

/**
 * The course's next live classes, above its recordings: when, how long,
 * and — from thirty minutes before — the button that joins it. Nothing
 * scheduled, nothing shown.
 */
export default function LiveClassStrip({ slug }: { slug: string }) {
    const now = useNow(30_000);
    const { data } = useQuery({
        queryKey: ["learning", slug, "live-classes"],
        queryFn: () => liveClassService.forLearner(slug),
        // The link appears near the start — look again every minute.
        refetchInterval: 60_000,
    });
    const classes = (data?.classes ?? []).filter((entry) => new Date(entry.endsAt).getTime() >= now).slice(0, 3);
    if (classes.length === 0) return null;

    return (
        <section aria-labelledby="live-classes-title" className="rounded-2xl border border-border bg-card shadow-card">
            <h2 id="live-classes-title" className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" aria-hidden /> Live classes
                <span className="font-normal text-muted-foreground">· Dhaka time</span>
            </h2>
            <ul className="divide-y divide-border">
                {classes.map((liveClass) => (
                    <ClassRow key={liveClass.id} liveClass={liveClass} now={now} />
                ))}
            </ul>
        </section>
    );
}

function ClassRow({ liveClass, now }: { liveClass: LearnerLiveClass; now: number }) {
    const cancelled = liveClass.status === "CANCELLED";
    const starts = new Date(liveClass.startsAt).getTime();
    const day = dhakaDayKey(liveClass.startsAt);
    return (
        <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", liveClass.isLive && "bg-success/5", cancelled && "opacity-60")}>
            <p className="w-24 shrink-0 tabular-nums">
                <span className="block text-sm font-semibold">{clock(liveClass.startsAt)}</span>
                <span className="block text-xs text-muted-foreground">
                    {weekdayOf(day)} {dayMonthOf(day)}
                </span>
            </p>
            <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", cancelled && "line-through")}>{liveClass.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {liveClass.durationMinutes} min
                    {liveClass.topic && ` · ${liveClass.topic.title}`}
                    {liveClass.description && ` · ${liveClass.description}`}
                </p>
            </div>
            <div className="shrink-0 text-right text-xs">
                {cancelled ? (
                    <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">Cancelled</span>
                ) : liveClass.joinUrl ? (
                    <Button asChild size="sm" className={cn(liveClass.isLive && "bg-success hover:bg-success/90")}>
                        <a href={liveClass.joinUrl} target="_blank" rel="noopener noreferrer">
                            {liveClass.isLive ? <Radio /> : null} {liveClass.isLive ? "Join now" : "Join"} <ExternalLink />
                        </a>
                    </Button>
                ) : (
                    <span className="text-muted-foreground">
                        {liveClass.isLive
                            ? "On now"
                            : liveClass.hasLink
                              ? `Link opens ${clock(liveClass.joinOpensAt)}`
                              : `Starts ${until(starts, now)}`}
                    </span>
                )}
            </div>
        </li>
    );
}
