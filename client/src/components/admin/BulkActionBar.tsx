"use client";

import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkAction {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    destructive?: boolean;
    isLoading?: boolean;
}

interface BulkActionBarProps {
    count: number;
    onClear: () => void;
    actions: BulkAction[];
    /**
     * Offers to widen the selection to everything on screen — for layouts
     * with no "select all" header box of their own, like a card grid.
     */
    selectAll?: { total: number; onSelect: () => void };
}

/**
 * The floating bar that appears once a table's checkboxes have a selection.
 *
 * Fixed to the bottom of the viewport rather than inline above the table —
 * an inline bar shifts every row down when it appears, which reads as the
 * page jumping right as the admin clicks. Fixed positioning keeps the table
 * still and puts the actions where the thumb already is on a phone.
 */
export default function BulkActionBar({ count, onClear, actions, selectAll }: BulkActionBarProps) {
    if (count === 0) return null;

    return (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div
                className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-card px-3 py-2 text-card-foreground"
                style={{ boxShadow: "var(--shadow-panel)" }}
                role="toolbar"
                aria-label="Bulk actions"
            >
                <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={onClear}>
                    <X className="size-4" />
                </Button>

                <span className="pr-1 text-sm font-medium tabular-nums">
                    {count} selected
                </span>

                {selectAll && count < selectAll.total && (
                    <Button variant="ghost" size="sm" onClick={selectAll.onSelect}>
                        Select all {selectAll.total}
                    </Button>
                )}

                <div className="h-6 w-px bg-border" aria-hidden />

                {actions.map((action) => (
                    <Button
                        key={action.label}
                        variant={action.destructive ? "destructive" : "outline"}
                        size="sm"
                        onClick={action.onClick}
                        isLoading={action.isLoading}
                    >
                        {action.icon && <action.icon className="size-4" />}
                        {action.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
