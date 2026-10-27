import { CheckCircle2, Square } from "lucide-react";
import CourseChecklistMotion from "@/components/shared/CourseChecklistMotion";
import { emphasiseLatin } from "@/lib/scriptEmphasis";
import { cn } from "@/lib/utils";

/**
 * A course-page list — "What you'll learn", "What you'll need" — on the page
 * and in its admin preview, as a checklist: a green tick for what the course
 * gives you, an empty box for what to have ready (the reader's own to tick),
 * each item in a cell, two columns where there's room, the English terms in
 * the stronger ink (`emphasiseLatin`). With an odd number of items the last
 * takes the whole row, so two columns never end on an empty cell.
 */
export default function CourseChecklist({
    items,
    mark,
    animate = false,
}: {
    items: string[];
    mark: "tick" | "box";
    /** Plays `CourseChecklistMotion`'s entrance. Off in the admin preview,
     *  which scrolls inside its own panel rather than the window. */
    animate?: boolean;
}) {
    const ticked = mark === "tick";

    const list = (
        <div className="@container">
            <ul className="grid gap-px overflow-hidden rounded-card border border-border bg-border @xl:grid-cols-2">
                {items.map((item, index) => (
                    <li
                        key={`${index}-${item}`}
                        data-check-item
                        className={cn(
                            "flex gap-3 bg-card px-4 py-3.5 text-[0.9375rem] leading-relaxed text-muted-foreground",
                            items.length % 2 === 1 && index === items.length - 1 && "@xl:col-span-2",
                        )}
                    >
                        {ticked ? (
                            <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden />
                        ) : (
                            <Square className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden />
                        )}
                        <span className="min-w-0">{emphasiseLatin(item, "font-medium text-foreground")}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    return animate ? <CourseChecklistMotion>{list}</CourseChecklistMotion> : list;
}
