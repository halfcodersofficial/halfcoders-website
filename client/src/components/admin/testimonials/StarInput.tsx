"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

/**
 * A rating as five stars to click. Native radios underneath — arrow keys move
 * between them, and each is announced as "4 stars" — wired by `FormField`
 * like the console's other controls. Hovering previews a rating before it's
 * chosen.
 */
export default function StarInput() {
    const field = useField();
    const value = Number(field?.value ?? 0);
    const [hover, setHover] = useState<number | null>(null);
    const shown = hover ?? value;

    return (
        <div
            role="radiogroup"
            aria-describedby={field?.describedBy}
            className="flex items-center gap-0.5"
            onMouseLeave={() => setHover(null)}
        >
            {[1, 2, 3, 4, 5].map((stars) => (
                <label
                    key={stars}
                    onMouseEnter={() => setHover(stars)}
                    className="cursor-pointer rounded-md p-0.5 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring"
                >
                    <input
                        type="radio"
                        id={stars === 1 ? field?.id : undefined}
                        name={field?.id}
                        value={stars}
                        checked={value === stars}
                        onChange={() => field?.setValue(stars)}
                        onBlur={field?.onBlur}
                        aria-label={`${stars} star${stars === 1 ? "" : "s"}`}
                        className="sr-only"
                    />
                    <Star
                        aria-hidden
                        className={cn(
                            "size-7 transition-[color,fill,scale] duration-150",
                            stars <= shown ? "fill-warning text-warning" : "text-border",
                            hover === stars && "scale-110",
                        )}
                    />
                </label>
            ))}
            <span className="ml-2 w-16 text-sm text-muted-foreground" aria-hidden>
                {WORDS[shown]}
            </span>
        </div>
    );
}
