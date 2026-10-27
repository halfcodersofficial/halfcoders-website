"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A percentage as a ring drawn in the brand gradient, with whatever sits in
 * its middle (the number, by default). Clamped like `Progress`. `fillIn`
 * sweeps it up from empty when it first appears; `trackClassName` recolours
 * the empty track (e.g. for a dark surface).
 */
export default function ProgressRing({
    value,
    size = 40,
    stroke = 4,
    fillIn = false,
    trackClassName = "stroke-secondary",
    className,
    children,
}: {
    value: number;
    size?: number;
    stroke?: number;
    fillIn?: boolean;
    trackClassName?: string;
    className?: string;
    children?: ReactNode;
}) {
    const gradientId = useId();
    const pct = Math.min(100, Math.max(0, Math.round(value)));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    // Drawn empty on the first paint, then filled, so the transition runs.
    const [shown, setShown] = useState(fillIn ? 0 : pct);
    useEffect(() => {
        if (!fillIn) {
            setShown(pct);
            return;
        }
        const frame = window.requestAnimationFrame(() => setShown(pct));
        return () => window.cancelAnimationFrame(frame);
    }, [fillIn, pct]);

    return (
        <span
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn("relative inline-grid shrink-0 place-items-center", className)}
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        {/* The brand gradient's stops. A style, not the attribute:
                            presentation attributes don't resolve var(). */}
                        <stop offset="0%" style={{ stopColor: "var(--violet-700)" }} />
                        <stop offset="55%" style={{ stopColor: "var(--violet-600)" }} />
                        <stop offset="100%" style={{ stopColor: "var(--violet-500)" }} />
                    </linearGradient>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    stroke={`url(#${gradientId})`}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - shown / 100)}
                    // An empty ring would still show the round cap as a dot.
                    opacity={shown === 0 ? 0 : 1}
                    className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
                />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[0.6875rem] font-bold tabular-nums">
                {children ?? `${pct}%`}
            </span>
        </span>
    );
}
