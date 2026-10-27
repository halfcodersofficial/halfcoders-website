import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });

/** "Jan 2025 – Jun 2025", "Aug 2025 – Present", "— – Jun 2025". */
export const periodLabel = (start: string | null, end: string | null, current: boolean) =>
    `${start ? MONTH_YEAR.format(new Date(start)) : "—"} – ${current ? "Present" : end ? MONTH_YEAR.format(new Date(end)) : "—"}`;

/** "6 mos", "1 yr 2 mos" — counting both the start and end month. Null without a start. */
export const durationLabel = (start: string | null, end: string | null, current: boolean) => {
    if (!start || (!end && !current)) return null;
    const from = new Date(start);
    const to = current || !end ? new Date() : new Date(end);
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    if (months < 1) return null;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years > 0 && `${years} yr${years > 1 ? "s" : ""}`, rest > 0 && `${rest} mo${rest > 1 ? "s" : ""}`]
        .filter(Boolean)
        .join(" ");
};

export function EntryChip({ icon: Icon, children, tone = "muted" }: { icon?: LucideIcon; children: ReactNode; tone?: "muted" | "success" | "primary" }) {
    return (
        <span
            className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                tone === "success" && "bg-success/10 font-semibold text-success",
                tone === "primary" && "bg-primary/10 font-semibold text-primary",
                tone === "muted" && "bg-secondary text-muted-foreground",
            )}
        >
            {Icon && <Icon className="size-3 shrink-0" />}
            <span className="truncate">{children}</span>
        </span>
    );
}

/**
 * The read-only face of a job entry (Job Experience, Got hired): the
 * company's initial as a monogram, the role and company, a row of chips, then
 * whatever longer text the entry has.
 */
export function EntryView({
    company,
    title,
    active,
    chips,
    children,
}: {
    company: string;
    title: string;
    /** A job still going — the monogram takes the brand fill. */
    active?: boolean;
    chips: ReactNode;
    children?: ReactNode;
}) {
    // Chips and text sit under the monogram on a phone, where indenting them
    // past it would leave them a column too narrow to read.
    return (
        <div>
            <div className="flex items-center gap-3.5">
                <span
                    aria-hidden
                    className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-md text-base font-bold uppercase",
                        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary",
                    )}
                >
                    {company.trim().charAt(0) || "?"}
                </span>
                <div className="min-w-0">
                    <p className="font-semibold leading-snug">{title}</p>
                    <p className="text-sm text-muted-foreground">{company}</p>
                </div>
            </div>
            <div className="sm:pl-14.5">
                <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>
                {children && <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>}
            </div>
        </div>
    );
}
