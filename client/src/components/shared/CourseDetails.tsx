import { BookOpenText, ClipboardCheck, CodeXml, Headset, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Reveal from "@/components/site/Reveal";
import { emphasiseLatin } from "@/lib/scriptEmphasis";
import { cn } from "@/lib/utils";

export type CourseDetailId = "about" | "assignments" | "practice" | "support";

export interface CourseDetailRow {
    id: CourseDetailId;
    label: string;
    /** Text as the admin wrote it; anything else (the preview's placeholder) is shown as given. */
    text: ReactNode;
}

const ICONS: Record<CourseDetailId, LucideIcon> = {
    about: BookOpenText,
    assignments: ClipboardCheck,
    practice: CodeXml,
    support: Headset,
};


const textOf = (row: CourseDetailRow, strong: string) =>
    typeof row.text === "string" ? emphasiseLatin(row.text, strong) : row.text;

/**
 * "Course details" on the course page and its admin preview, as editor
 * panes side by side. "About this course" leads, a wide pane of its own — it's the
 * description. How the course runs follows in smaller panes, one per row the
 * admin wrote (assignments, practice days, mentor support), each with its
 * icon and label in the pane's strip. Everything shows at once — there are only a few
 * rows, and none is worth a click to open.
 */
export default function CourseDetails({
    rows,
    animate = false,
}: {
    rows: CourseDetailRow[];
    /** Fades the panes in as they scroll into view (`Reveal`). Off in the admin
     *  preview, which scrolls inside its own panel rather than the window. */
    animate?: boolean;
}) {
    const about = rows.find((row) => row.id === "about");
    const rest = rows.filter((row) => row.id !== "about");

    const layout = (
        <div className="@container space-y-4">
            {about && <Pane row={about} lead />}
            {rest.length > 0 && (
                <div className={cn("grid gap-4", rest.length > 1 && "@2xl:grid-cols-2", rest.length > 2 && "@4xl:grid-cols-3")}>
                    {rest.map((row) => (
                        <Pane key={row.id} row={row} />
                    ))}
                </div>
            )}
        </div>
    );

    return animate ? <Reveal>{layout}</Reveal> : layout;
}

function Pane({ row, lead = false }: { row: CourseDetailRow; lead?: boolean }) {
    const Icon = ICONS[row.id];
    return (
        <section data-reveal className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
            <h3 className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 text-sm font-semibold">
                <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden />
                {row.label}
            </h3>
            <div className={cn("flex-1", lead ? "px-5 py-5 sm:px-7 sm:py-6" : "px-5 py-4")}>
                <p
                    className={cn(
                        "whitespace-pre-line text-muted-foreground",
                        lead ? "text-base leading-[1.85] sm:text-[1.0625rem]" : "text-[0.9375rem] leading-[1.8]",
                    )}
                >
                    {textOf(row, "text-foreground")}
                </p>
            </div>
        </section>
    );
}
