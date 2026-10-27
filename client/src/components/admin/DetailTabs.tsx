"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface DetailTab<T extends string> {
    id: T;
    label: string;
    /** Shown after the label — how many rows the tab holds. */
    count?: number;
}

/**
 * The tab strip of an admin detail page (a mentor, a student). Arrow keys
 * move between tabs, as screen-reader users expect; each tab controls the
 * panel with id `panel-<tab id>`.
 */
export default function DetailTabs<T extends string>({
    tabs,
    value,
    onChange,
    label,
}: {
    tabs: readonly DetailTab<T>[];
    value: T;
    onChange: (tab: T) => void;
    label: string;
}) {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const next =
            event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
                    : null;
        if (next === null) return;
        event.preventDefault();
        onChange(tabs[next].id);
        buttons.current[next]?.focus();
    };

    return (
        <div role="tablist" aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((item, index) => {
                const selected = item.id === value;
                return (
                    <button
                        key={item.id}
                        ref={(element) => {
                            buttons.current[index] = element;
                        }}
                        type="button"
                        role="tab"
                        id={`tab-${item.id}`}
                        aria-selected={selected}
                        aria-controls={`panel-${item.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(item.id)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {item.label}
                        {item.count !== undefined && (
                            <span
                                className={cn(
                                    "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                                    selected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                                )}
                            >
                                {item.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
