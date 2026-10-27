import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/**
 * One step of the broadcast composer, hung on a rail down its left edge. The
 * numeral turns into a tick once the step is complete and the rail below it
 * fills, so how far along the message is reads at a glance without a
 * separate progress bar.
 */
export default function ComposerStep({
    index,
    title,
    hint,
    aside,
    done = false,
    last = false,
    delayMs = 0,
    children,
}: {
    index: number;
    title: string;
    hint?: ReactNode;
    /** Top right of the step — a status or a small action. */
    aside?: ReactNode;
    done?: boolean;
    last?: boolean;
    delayMs?: number;
    children: ReactNode;
}) {
    return (
        <section
            className={cn("grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-5", RISE)}
            style={{ animationDelay: `${delayMs}ms` } as CSSProperties}
            aria-labelledby={`broadcast-step-${index}`}
        >
            <div className="flex flex-col items-center" aria-hidden>
                <span
                    className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors duration-300 sm:size-9",
                        done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground",
                    )}
                >
                    {done ? <Check className="size-4" /> : String(index).padStart(2, "0")}
                </span>
                {!last && (
                    <span className="relative mt-2 w-px flex-1 overflow-hidden bg-border">
                        <span
                            className={cn(
                                "absolute inset-0 origin-top bg-primary transition-transform duration-700 ease-out",
                                done ? "scale-y-100" : "scale-y-0",
                            )}
                        />
                    </span>
                )}
            </div>

            <div className={cn("min-w-0", !last && "pb-10")}>
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:min-h-9">
                    <h2 id={`broadcast-step-${index}`} className="text-lg font-semibold tracking-tight">
                        {title}
                    </h2>
                    {aside}
                </div>
                {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
                <div className="mt-4">{children}</div>
            </div>
        </section>
    );
}
