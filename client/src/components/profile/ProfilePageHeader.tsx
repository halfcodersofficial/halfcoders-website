import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The heading a profile page opens with when it isn't a single editable panel. */
export function ProfilePageHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
                </div>
            </div>
            {action}
        </header>
    );
}
