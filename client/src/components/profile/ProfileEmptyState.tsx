import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The one empty state every profile page uses: an icon tile, what's missing, and what to do about it. */
export function ProfileEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center",
                className,
            )}
        >
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative mx-auto max-w-sm">
                {Icon && (
                    <span className="mx-auto mb-4 grid size-12 place-items-center rounded-card border border-border bg-card text-primary shadow-card">
                        <Icon className="size-5" />
                    </span>
                )}
                <p className="font-semibold">{title}</p>
                {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
                {action && <div className="mt-5">{action}</div>}
            </div>
        </div>
    );
}
