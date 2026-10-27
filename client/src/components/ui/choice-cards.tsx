"use client";

import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface Choice {
    value: string;
    label: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    /** Drawn in place of an icon — a status's coloured dot, say. */
    marker?: ReactNode;
}

/**
 * Columns by the room the group has, not the window's width — the same cards
 * sit in a popup, a side panel and a full-width editor. Below the width that
 * fits them, the group falls back to one card per row.
 */
const COLUMNS = {
    1: "",
    2: "@md:grid-cols-2",
    3: "@[34rem]:grid-cols-3",
} as const;

/**
 * A few mutually exclusive choices as cards, each with a line on what it
 * means — for decisions an admin should read before making, where a select
 * would hide the options. Native radios underneath, so arrow keys move
 * between them and a form reads them like any other field; inside a
 * `FormField` it's wired like `Input`.
 *
 * Each card lays itself out by its own width: wide, the icon sits beside the
 * words; narrow (three across in a popup), it sits above them, so a label
 * never breaks a word per line.
 */
export function ChoiceCards({
    choices,
    columns = 1,
    className,
}: {
    choices: Choice[];
    columns?: keyof typeof COLUMNS;
    className?: string;
}) {
    const field = useField();

    return (
        <div className="@container">
            <div
                role="radiogroup"
                aria-describedby={field?.describedBy}
                aria-invalid={field?.error ? true : undefined}
                aria-required={field?.required || undefined}
                className={cn("grid gap-2.5", COLUMNS[columns], className)}
            >
                {choices.map((choice, index) => {
                    const checked = field?.value === choice.value;
                    const Icon = choice.icon;
                    return (
                        <label
                            key={choice.value}
                            className={cn(
                                "@container relative cursor-pointer rounded-xl border bg-card transition-[border-color,background-color,box-shadow] duration-200 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-card",
                                checked
                                    ? "border-primary bg-primary/4 shadow-[inset_0_0_0_1px_var(--color-primary)]"
                                    : "border-border hover:border-primary/40 hover:bg-surface",
                                field?.error && !checked && "border-destructive/50",
                            )}
                        >
                            <input
                                type="radio"
                                // The label above focuses the first choice.
                                id={index === 0 ? field?.id : undefined}
                                name={field?.name}
                                value={choice.value}
                                checked={checked}
                                onChange={() => field?.setValue(choice.value)}
                                onBlur={field?.onBlur}
                                className="sr-only"
                            />
                            <span className="flex h-full flex-col gap-2.5 p-3.5 @[17rem]:flex-row @[17rem]:items-start @[17rem]:gap-3">
                                {(Icon || choice.marker) && (
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                                            checked ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                                        )}
                                    >
                                        {Icon ? <Icon className="size-4.5" /> : choice.marker}
                                    </span>
                                )}
                                <span className={cn("min-w-0 flex-1 @[17rem]:pt-0.5", Icon || choice.marker ? "@[17rem]:pr-7" : "pr-7")}>
                                    <span className="block text-sm font-semibold leading-snug">{choice.label}</span>
                                    {choice.description && (
                                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                            {choice.description}
                                        </span>
                                    )}
                                </span>
                            </span>
                            {/* The radio's own mark, top right in either layout. */}
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute right-3.5 top-3.5 grid size-5 place-items-center rounded-full border-[1.5px] transition-colors duration-200",
                                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card",
                                )}
                            >
                                {checked && <Check className="size-3" strokeWidth={3.5} />}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
