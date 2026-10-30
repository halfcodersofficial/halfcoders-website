"use client";

import { AlertCircle } from "lucide-react";
import { useDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface EditorStep {
    id: string;
    label: string;
    /** A failed save found a problem on this step. */
    hasError?: boolean;
}

/**
 * A long editor's sections as numbered steps. Unlike a create wizard, every
 * step is open from the start: an editor is usually opened to change one
 * thing, so any step can be jumped to, and saving works from all of them.
 *
 * The steps share the row equally, so they never overflow; below `sm` only the
 * numbers fit, and the page's own heading names the step.
 */
export function EditorSteps({
    steps,
    active,
    onChange,
    label = "Editor sections",
}: {
    steps: EditorStep[];
    active: string;
    onChange: (id: string) => void;
    label?: string;
}) {
    const t = useT();
    const digits = useDigits();
    const activeIndex = Math.max(0, steps.findIndex((step) => step.id === active));

    return (
        <nav aria-label={label}>
            <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((step, index) => {
                    const isActive = index === activeIndex;
                    const isPassed = index < activeIndex;

                    return (
                        <li key={step.id} className="relative">
                            {/* Joins this step to the one before, centre to centre. */}
                            {index > 0 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 transition-colors",
                                        index <= activeIndex ? "bg-primary" : "bg-border",
                                    )}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => onChange(step.id)}
                                aria-current={isActive ? "step" : undefined}
                                className="group relative flex w-full flex-col items-center gap-1.5 rounded-md pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {/* Opaque and raised: the line from the next step runs up to
                                    this circle's centre and must pass behind it. */}
                                <span
                                    className={cn(
                                        "relative z-10 grid size-8 place-items-center rounded-full text-sm font-semibold transition-colors",
                                        step.hasError
                                            ? "bg-destructive text-destructive-foreground"
                                            : isActive
                                                ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                                : isPassed
                                                    ? "bg-secondary text-primary ring-1 ring-inset ring-primary/40"
                                                    : "bg-secondary text-muted-foreground group-hover:text-foreground",
                                    )}
                                >
                                    {step.hasError ? <AlertCircle className="size-4" aria-hidden /> : digits(index + 1)}
                                </span>
                                <span
                                    className={cn(
                                        "hidden px-0.5 text-center text-xs leading-tight sm:block",
                                        isActive ? "font-medium text-foreground" : "text-muted-foreground",
                                        step.hasError && "text-destructive",
                                    )}
                                >
                                    {step.label}
                                </span>
                                {/* The label is hidden on phones; the button still needs its name. */}
                                <span className="sr-only sm:hidden">{step.label}</span>
                                {step.hasError && <span className="sr-only">{t(" — needs attention", " — ঠিক করতে হবে")}</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
