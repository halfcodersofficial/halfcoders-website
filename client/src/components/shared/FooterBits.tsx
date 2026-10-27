"use client";

import { ArrowUp, Check, Clock, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";

const BD_TIME = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" });

/**
 * The time in Dhaka, for the status bar — where Half Coders is, for a visitor
 * writing from somewhere else. The browser's clock, so it shows only once the
 * page is running (never a server's guess), and moves on with the minutes.
 */
export function BangladeshTime({ className }: { className?: string }) {
    const [time, setTime] = useState<string | null>(null);

    useEffect(() => {
        const tick = () => setTime(BD_TIME.format(new Date()));
        tick();
        const timer = window.setInterval(tick, 20_000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
            <Clock className="size-3 shrink-0" aria-hidden />
            {time ? (
                <span>
                    <span className="tabular-nums">{time}</span> Dhaka
                </span>
            ) : (
                <span>Dhaka time</span>
            )}
        </span>
    );
}

/** A small button that copies `value`, and says so for a moment. Takes its colour from the text around it. */
export function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    return (
        <button
            type="button"
            onClick={() => {
                void navigator.clipboard?.writeText(value).then(() => setCopied(true));
            }}
            aria-label={copied ? "Copied" : label}
            title={copied ? "Copied" : label}
            className={cn(
                "grid size-7 shrink-0 place-items-center rounded-sm border transition-colors",
                copied ? "border-syn-string/50 text-syn-string" : "border-current/20 opacity-75 hover:border-current/50 hover:opacity-100",
            )}
        >
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
    );
}

/** Back to the top of the page — with the page's smooth scroll, unless reduced motion is asked for. */
export function BackToTop({ className }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => scrollPageTo(0)}
            className={cn("group inline-flex items-center gap-1.5 text-xs transition-colors hover:text-syn-keyword", className)}
        >
            <ArrowUp className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
            Back to top
        </button>
    );
}
