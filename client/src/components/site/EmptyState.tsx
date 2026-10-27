import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    /** What to do instead — a button or link. */
    action?: ReactNode;
    className?: string;
}

/** Nothing to show yet: an empty file — say so plainly and offer the next step. */
export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn("rounded-card border border-dashed border-border-strong bg-card/60 px-6 py-12 text-center sm:py-14", className)}>
            {Icon ? (
                <span className="mx-auto grid size-11 place-items-center rounded-md border border-border bg-surface text-primary">
                    <Icon className="size-5" aria-hidden />
                </span>
            ) : (
                <p aria-hidden className="font-mono text-2xl text-syn-comment">{"{ }"}</p>
            )}
            <p className="mt-5 font-heading text-lg font-semibold">{title}</p>
            {description && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
            {action && <div className="mt-6 flex justify-center">{action}</div>}
        </div>
    );
}
