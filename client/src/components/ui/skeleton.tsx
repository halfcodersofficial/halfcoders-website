import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A placeholder bar with a soft band scanning across it (`.skeleton-scan`). Never wider than its box, so a `w-96` bar fits a phone. */
export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div aria-hidden className={cn("skeleton-scan max-w-full rounded-sm", className)} {...props} />
);

/**
 * A block of placeholder "code": numbered lines of uneven length, the way an
 * editor looks while a file loads. For text-heavy panes (a description, a
 * list of facts) where a few bars of one width would look like a form.
 */
export const SkeletonLines = ({
    lines = 4,
    numbered = false,
    className,
}: {
    lines?: number;
    numbered?: boolean;
    className?: string;
}) => {
    // Fixed, uneven widths: the same every render, so nothing jumps.
    const widths = ["w-11/12", "w-8/12", "w-10/12", "w-6/12", "w-9/12", "w-7/12", "w-5/12", "w-10/12"];
    return (
        <div aria-hidden className={cn("space-y-2.5", className)}>
            {Array.from({ length: lines }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                    {numbered && (
                        <span className="w-5 shrink-0 text-right font-mono text-[0.7rem] text-muted-foreground/60">
                            {index + 1}
                        </span>
                    )}
                    <div className={cn("skeleton-scan h-3 rounded-sm", widths[index % widths.length])} />
                </div>
            ))}
        </div>
    );
};
