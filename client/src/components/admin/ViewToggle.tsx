"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

const VIEWS = [
    { value: "grid", label: "Card view", icon: LayoutGrid },
    { value: "list", label: "List view", icon: List },
] as const;

/**
 * Card / list switch for admin registers that have both layouts. Styled as
 * a small version of DataShell's segmented filter so the two read as one set
 * of controls.
 */
export default function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (view: ViewMode) => void }) {
    return (
        <div role="group" aria-label="Layout" className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            {VIEWS.map(({ value: view, label, icon: Icon }) => (
                <button
                    key={view}
                    type="button"
                    aria-pressed={value === view}
                    aria-label={label}
                    title={label}
                    onClick={() => onChange(view)}
                    className={cn(
                        "grid size-8 place-items-center rounded-sm transition-colors",
                        value === view
                            ? "bg-primary/10 text-primary-ink"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                >
                    <Icon className="size-4" />
                </button>
            ))}
        </div>
    );
}
