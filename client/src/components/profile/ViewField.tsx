import type { ReactNode } from "react";

/** One label/value tile inside a `SectionPanel`'s read-only `<dl>` grid. */
export function ViewField({ label, value }: { label: string; value?: ReactNode }) {
    return (
        <div className="min-w-0 rounded-md bg-secondary/40 px-4 py-3">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-break-word font-medium">
                {value || <span className="font-normal text-muted-foreground/70">Not added yet</span>}
            </dd>
        </div>
    );
}
