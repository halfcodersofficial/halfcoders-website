import { formatDistanceToNowStrict } from "date-fns";
import { RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Where a setting stands: edited and not saved, changed from its default (and
 * when), or on its default. Each state is its own keyed element — swapped,
 * not rewritten in place, which Firefox could leave with an unlaid-out label.
 */
export function SettingStatus({ dirty, changedAt, className }: { dirty: boolean; changedAt: string | null; className?: string }) {
    const base = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium";

    if (dirty) {
        return (
            <span key="dirty" className={cn(base, "bg-amber-500/10 text-amber-700 dark:text-amber-400", className)}>
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                <span>Unsaved</span>
            </span>
        );
    }
    if (changedAt) {
        return (
            <span key="changed" className={cn(base, "bg-primary/10 text-primary", className)} title={formatDateTime(changedAt)}>
                <span>
                    Changed{" "}
                    {Date.now() - new Date(changedAt).getTime() < 60_000
                        ? "just now"
                        : formatDistanceToNowStrict(new Date(changedAt), { addSuffix: true })}
                </span>
            </span>
        );
    }
    return (
        <span key="default" className={cn(base, "bg-secondary text-muted-foreground", className)}>
            <span>Default</span>
        </span>
    );
}

/**
 * One setting's panel: what it is and what it's for, where it stands, a way
 * back to the built-in default once it's been changed, and its controls.
 */
export function SettingSection({
    id,
    icon: Icon,
    title,
    purpose,
    dirty,
    changedAt,
    onReset,
    children,
}: {
    id: string;
    icon: LucideIcon;
    title: string;
    purpose: ReactNode;
    dirty: boolean;
    changedAt: string | null;
    /** Offered only once the setting has been changed from its default. */
    onReset?: () => void;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className={cn(
                "scroll-mt-8 overflow-hidden rounded-card border bg-card shadow-card transition-colors",
                dirty ? "border-amber-500/40" : "border-border",
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4 sm:px-6 bg-surface">
                <div className="flex min-w-0 gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h2 id={`${id}-title`} className="font-semibold leading-tight">
                            {title}
                        </h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{purpose}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                    <SettingStatus dirty={dirty} changedAt={changedAt} />
                    {onReset && changedAt && (
                        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
                            <RotateCcw /> Reset to default
                        </Button>
                    )}
                </div>
            </header>
            <div className="px-5 py-5 sm:px-6">{children}</div>
        </section>
    );
}

/** The facts an admin should know before changing a setting, as a quiet list. */
export function SettingFacts({ children }: { children: ReactNode }) {
    return <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm text-muted-foreground [&>li]:flex [&>li]:gap-2 [&>li]:before:mt-2 [&>li]:before:size-1 [&>li]:before:shrink-0 [&>li]:before:rounded-full [&>li]:before:bg-muted-foreground/60 [&>li]:before:content-['']">{children}</ul>;
}
