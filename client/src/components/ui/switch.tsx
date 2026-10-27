"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    disabled?: boolean;
    /** Falls back to `aria-label` when there's no visible text next to the switch. */
    "aria-label"?: string;
    className?: string;
}

/**
 * A plain pill toggle, controlled by `checked`/`onCheckedChange` rather than
 * the form-context `useField()` pattern `Checkbox` uses — these save
 * individually on click (a settings toggle firing its own mutation), not
 * through a form submit. Hand-rolled rather than pulling in
 * `@radix-ui/react-switch` for the one page that needs it.
 */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-primary" : "bg-border-strong",
                className,
            )}
            {...aria}
        >
            <span
                className={cn(
                    "inline-block size-4.5 transform rounded-full bg-white shadow-sm transition-transform",
                    checked ? "translate-x-6" : "translate-x-1",
                )}
            />
        </button>
    );
}

interface SwitchRowProps {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    /** What it is, and what each state means — the line under it can change with `checked`. */
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
}

/**
 * A setting that's on or off, as one bordered row: what it is and what that
 * means on the left, the switch on the right. The whole row is the hit target;
 * the switch is the control a screen reader meets, named by the row's label.
 */
export function SwitchRow({ checked, onCheckedChange, label, description, disabled, className }: SwitchRowProps) {
    return (
        <label
            className={cn(
                "flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors",
                "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                checked ? "border-primary/40 bg-primary/4" : "border-border hover:bg-surface",
                className,
            )}
        >
            <span className="min-w-0 text-sm">
                <span className="block font-medium">{label}</span>
                {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
            </span>
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                aria-label={typeof label === "string" ? label : undefined}
            />
        </label>
    );
}
