import { cn } from "@/lib/utils";

interface ProgressProps {
    value: number;
    className?: string;
    barClassName?: string;
}

/** Clamped so a stale or malformed value can't overflow the track. */
export const Progress = ({ value, className, barClassName }: ProgressProps) => {
    const pct = Math.min(100, Math.max(0, Math.round(value)));

    return (
        <div
            className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={cn("h-full rounded-full bg-primary transition-all duration-500", barClassName)}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
};
