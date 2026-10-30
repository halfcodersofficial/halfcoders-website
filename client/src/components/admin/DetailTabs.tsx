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
        // A strip of editor tabs: the open one sits on the page with a violet line across its top.
        <div role="tablist" aria-label={label} className="no-scrollbar flex overflow-x-auto border-b border-border">
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
                        data-active={selected || undefined}
                        onClick={() => onChange(item.id)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "editor-tab flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            selected
                                ? "bg-card text-foreground shadow-[inset_1px_0_0_var(--border),inset_-1px_0_0_var(--border)]"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        )}
                    >
                        {item.label}
                        {item.count !== undefined && (
                            <span
                                className={cn(
                                    "rounded-sm px-1.5 py-px font-mono text-[0.68rem] tabular-nums",
                                    selected ? "bg-primary/10 text-primary-ink" : "bg-secondary text-muted-foreground",
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
