import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The review step of a multi-step modal: everything entered, as it will be
 * saved, one bordered section per step with a way back into it.
 */
interface ReviewSectionProps {
    title: string;
    onEdit: () => void;
    disabled: boolean;
    children: ReactNode;
}

export function ReviewSection({ title, onEdit, disabled, children }: ReviewSectionProps) {
    return (
        <section className="@container overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-surface/70 py-1.5 pl-4 pr-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-primary hover:bg-primary/10"
                    onClick={onEdit}
                    disabled={disabled}
                    aria-label={`Edit ${title.toLowerCase()}`}
                >
                    <Pencil /> Edit
                </Button>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

/** One label/value pair; put a run of them in a `<dl className="space-y-2.5">`. */
export const ReviewRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid gap-0.5 text-sm @md:grid-cols-[9rem_1fr] @md:gap-3">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
);

/** An optional field left empty. */
export const NotProvided = ({ children = "Not provided" }: { children?: ReactNode }) => (
    <span className="text-muted-foreground italic">{children}</span>
);
