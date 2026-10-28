import { featureIcon } from "@/lib/courseFeatureIcons";
import { splitLeadingCount } from "@/lib/leadingCount";
import { cn } from "@/lib/utils";
import type { CourseIconLine } from "@/types/domain.types";
import { CalendarDays, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface Token {
    /** The key: a count if the line opens with one ("20+"), otherwise the icon. */
    count: string | null;
    icon: LucideIcon;
    label: ReactNode;
}

/** Load-in for each fact, a beat after the one before; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-1 duration-500 ease-out fill-mode-both motion-reduce:animate-none";
const FIRST_DELAY_MS = 250;
const STAGGER_MS = 50;

/**
 * The hero's facts as a small table of key/value cells, the way an editor
 * shows a file's properties: the key on the left is the count when the line
 * opens with one ("20+"), in the number colour, since how many lessons or
 * exams is what a buyer compares; otherwise it's the line's icon.
 *
 * `delayMs` offsets the load-in, so the facts follow whatever rises above them.
 * `compact` is the smaller set a course card carries, static and capped at `limit`.
 * `onDark` for the course page's editor-surface hero.
 */
export default function CourseHeroFacts({
    facts,
    duration,
    delayMs = 0,
    compact = false,
    limit,
    onDark = false,
}: {
    facts: CourseIconLine[];
    duration: string | null;
    delayMs?: number;
    compact?: boolean;
    limit?: number;
    onDark?: boolean;
}) {
    const tokens: Token[] = [
        ...facts.map((fact) => {
            const { count, rest } = splitLeadingCount(fact.text);
            return { count, icon: featureIcon(fact.icon), label: count ? rest : fact.text };
        }),
        ...(duration
            ? [{
                count: null,
                icon: CalendarDays,
                label: (
                    <>
                        চলবে <span className="font-semibold">{duration}</span>
                    </>
                ),
            }]
            : []),
    ];

    const shown = limit === undefined ? tokens : tokens.slice(0, limit);
    if (shown.length === 0) return null;

    return (
        <ul className={cn(compact ? "flex flex-wrap gap-1.5" : "grid gap-px overflow-hidden rounded-card border sm:grid-cols-2", !compact && (onDark ? "border-editor-line bg-editor-line" : "border-border bg-border"))}>
            {shown.map((token, index) => (
                <li
                    key={index}
                    className={cn(
                        "flex items-center",
                        compact
                            ? cn("gap-1.5 rounded-sm border px-2 py-1 text-xs", onDark ? "border-editor-line text-editor-fg" : "border-border")
                            // An odd one out takes the whole last row, rather than
                            // leaving an empty cell beside it.
                            : cn(RISE, "gap-3 px-4 py-3 text-sm sm:last:odd:col-span-2", onDark ? "bg-editor-panel text-editor-fg" : "bg-card"),
                    )}
                    style={compact ? undefined : ({ animationDelay: `${delayMs + FIRST_DELAY_MS + index * STAGGER_MS}ms` } as CSSProperties)}
                >
                    <span className={cn("grid shrink-0 place-items-center font-mono font-semibold tabular-nums text-syn-number", compact ? "min-w-5" : "min-w-9")}>
                        {token.count ?? <token.icon className={cn(compact ? "size-3.5" : "size-4", "text-syn-func")} strokeWidth={2} aria-hidden />}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                        {token.count && (
                            <token.icon
                                className={cn("shrink-0", onDark ? "text-editor-muted" : "text-muted-foreground", compact ? "size-3.5" : "size-4")}
                                strokeWidth={1.75}
                                aria-hidden
                            />
                        )}
                        <span>{token.label}</span>
                    </span>
                </li>
            ))}
        </ul>
    );
}
