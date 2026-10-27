"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SupportSchedule {
    /** Open days, 0 = Sunday … 6 = Saturday. */
    days: number[];
    /** Opening and closing hour, 24-hour, Bangladesh time. */
    opens: number;
    closes: number;
    /** How the page writes those hours: "সকাল ১০টা", "সন্ধ্যা ৭টা". */
    opensLabel: string;
    closesLabel: string;
}

const DAY_NAMES = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
/** One list for "no holidays", so the default doesn't change on every render. */
const NO_HOLIDAYS: readonly string[] = [];
const DHAKA = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23" });

/** Today's date and hour in Bangladesh, wherever the visitor is. */
const dhakaNow = () => {
    const parts = Object.fromEntries(DHAKA.formatToParts(new Date()).map((part) => [part.type, part.value]));
    return { year: Number(parts.year), month: Number(parts.month), date: Number(parts.day), hour: Number(parts.hour) };
};

/** The day `ahead` days from a Bangladesh date: its weekday and its "YYYY-MM-DD". */
const dayAhead = (today: ReturnType<typeof dhakaNow>, ahead: number) => {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.date + ahead));
    return { weekday: day.getUTCDay(), iso: day.toISOString().slice(0, 10) };
};

const statusOf = (schedule: SupportSchedule, holidays: readonly string[]) => {
    const now = dhakaNow();
    const isOpenDay = (day: ReturnType<typeof dayAhead>) => schedule.days.includes(day.weekday) && !holidays.includes(day.iso);
    const today = dayAhead(now, 0);

    if (isOpenDay(today) && now.hour >= schedule.opens && now.hour < schedule.closes) {
        return { open: true, text: `এখন খোলা আছে · ${schedule.closesLabel} পর্যন্ত` };
    }
    if (isOpenDay(today) && now.hour < schedule.opens) {
        return { open: false, text: `এখন বন্ধ · আজ ${schedule.opensLabel}য় খুলবে` };
    }
    const closedFor = holidays.includes(today.iso) ? "আজ সরকারি ছুটি" : "এখন বন্ধ";
    for (let ahead = 1; ahead <= 14; ahead += 1) {
        const next = dayAhead(now, ahead);
        if (isOpenDay(next)) {
            const when = ahead === 1 ? "আগামীকাল" : DAY_NAMES[next.weekday];
            return { open: false, text: `${closedFor} · ${when} ${schedule.opensLabel}য় খুলবে` };
        }
    }
    return { open: false, text: closedFor };
};

/**
 * Whether the support line is open right now, in Bangladesh time: a green
 * dot and until when, or when it opens next — skipping `holidays`
 * ("YYYY-MM-DD"), when the line is closed all day. Worked out in the browser
 * after it loads (the server's clock and zone may differ), and again each
 * minute; nothing is shown before that.
 */
export default function SupportStatus({
    schedule,
    holidays = NO_HOLIDAYS,
    className,
}: {
    schedule: SupportSchedule;
    holidays?: readonly string[];
    className?: string;
}) {
    const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);

    useEffect(() => {
        const update = () => setStatus(statusOf(schedule, holidays));
        update();
        const timer = window.setInterval(update, 60_000);
        return () => window.clearInterval(timer);
    }, [schedule, holidays]);

    if (!status) return null;

    return (
        <p
            aria-live="polite"
            className={cn(
                "inline-flex items-center gap-2 rounded-sm px-2.5 py-1 font-mono text-xs font-semibold",
                status.open ? "bg-syn-string/15 text-syn-string" : "bg-editor-raised text-editor-muted",
                className,
            )}
        >
            <span className="relative flex size-2" aria-hidden>
                {status.open && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />}
                <span className="relative size-2 rounded-full bg-current" />
            </span>
            {status.text}
        </p>
    );
}
