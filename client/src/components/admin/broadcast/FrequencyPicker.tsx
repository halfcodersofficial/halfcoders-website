"use client";

import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const FREQUENCIES = [
    {
        value: "ONCE",
        label: "Once",
        description: "The next time they open Half Coders — then never again.",
        shows: [true, false, false, false],
    },
    {
        value: "EVERY_LOGIN",
        label: "Every time they sign in",
        description: "Once in each sign-in, until they read it in their bell or you stop it.",
        shows: [true, true, true, true],
    },
] as const;

/**
 * How often a pop-up comes back, as two choices with their consequence
 * spelled out — and drawn: four sign-ins in a row, lit where it appears.
 * Native radios underneath, wired by `FormField`.
 */
export default function FrequencyPicker() {
    const field = useField();

    return (
        <div role="radiogroup" aria-describedby={field?.describedBy} className="grid gap-2 sm:grid-cols-2">
            {FREQUENCIES.map((frequency, index) => {
                const checked = field?.value === frequency.value;

                return (
                    <label
                        key={frequency.value}
                        className={cn(
                            "relative flex cursor-pointer flex-col gap-4 rounded-card border p-4 transition-colors",
                            "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
                            checked ? "border-primary bg-primary/6" : "border-border bg-card hover:border-primary/40",
                        )}
                    >
                        <input
                            type="radio"
                            id={index === 0 ? field?.id : undefined}
                            name={field?.id}
                            value={frequency.value}
                            checked={checked}
                            onChange={() => field?.setValue(frequency.value)}
                            onBlur={field?.onBlur}
                            className="sr-only"
                        />

                        <span className="flex items-center justify-between gap-3">
                            <span className="flex items-end gap-1.5" aria-hidden>
                                {frequency.shows.map((shows, step) => (
                                    <span key={step} className="flex flex-col items-center gap-1">
                                        <span
                                            className={cn(
                                                "h-5 w-4 rounded-sm border transition-colors",
                                                shows
                                                    ? checked
                                                        ? "border-primary bg-primary"
                                                        : "border-foreground/30 bg-foreground/30"
                                                    : "border-dashed border-border",
                                            )}
                                        />
                                        <span className="text-[0.5625rem] tabular-nums text-muted-foreground">{step + 1}</span>
                                    </span>
                                ))}
                                <span className="mb-4 ml-0.5 text-xs text-muted-foreground">…</span>
                            </span>
                            <span
                                aria-hidden
                                className={cn(
                                    "size-4 shrink-0 rounded-full border transition-[border-width,border-color]",
                                    checked ? "border-[5px] border-primary" : "border-border",
                                )}
                            />
                        </span>

                        <span>
                            <span className="block text-sm font-semibold">{frequency.label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{frequency.description}</span>
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
