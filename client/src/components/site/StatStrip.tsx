import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Stat {
    value: ReactNode;
    label: string;
}

/**
 * A row of figures divided by hairlines — two by two on phones, one line from
 * `lg`. The hairlines are the grid's gap showing the border colour through,
 * so they stay exact however the cells wrap. Only ever show real numbers:
 * the caller hides the strip when there's nothing to count yet.
 */
export default function StatStrip({ items, className }: { items: Stat[]; className?: string }) {
    const odd = items.length % 2 === 1;

    return (
        <dl
            className={cn(
                "grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border",
                items.length === 3 && "sm:grid-cols-3",
                items.length >= 4 && "lg:grid-cols-4",
                className,
            )}
        >
            {items.map((item, index) => (
                <div
                    key={item.label}
                    className={cn(
                        "flex flex-col gap-1 bg-card p-5 sm:p-6",
                        // The last of an odd count takes the full phone row rather than leave a hole.
                        odd && index === items.length - 1 && "col-span-2 sm:col-span-1",
                    )}
                >
                    <dt className="order-2 text-sm text-muted-foreground">{item.label}</dt>
                    <dd className="order-1 font-heading text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
