import type { ReactNode } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import { cn } from "@/lib/utils";

/**
 * A dashboard panel, set as a light editor pane: its title on a file tab (the
 * file name only picks the tab's icon), a link or a note at the right of the
 * tab strip, the body, and an optional quiet foot. The tab strip is hidden from
 * screen readers, so the title is also the section's heading, for them only.
 */
export default function Panel({
    id,
    title,
    file,
    actions,
    footer,
    className,
    bodyClassName,
    children,
}: {
    /** The heading's id; the section is labelled by it. */
    id: string;
    title: string;
    /** "courses/", "totals.json" — decoration for the tab's icon. */
    file: string;
    actions?: ReactNode;
    footer?: ReactNode;
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}) {
    return (
        <section aria-labelledby={id} className={cn("flex min-w-0 flex-col", className)}>
            <h2 id={id} className="sr-only">
                {title}
            </h2>
            <EditorWindow
                tone="light"
                tabs={[{ name: file, label: title, active: true }]}
                actions={actions}
                className="flex-1 shadow-card"
                bodyClassName="flex flex-col"
            >
                <div className={cn("flex-1", bodyClassName)}>{children}</div>
                {footer && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-surface px-5 py-2.5 font-mono text-[0.7rem] text-muted-foreground sm:px-6">
                        {footer}
                    </div>
                )}
            </EditorWindow>
        </section>
    );
}
