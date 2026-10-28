import CourseHighlightsMotion from "@/components/shared/CourseHighlightsMotion";
import { FileIcon } from "@/components/site/EditorWindow";
import { featureIcon } from "@/lib/courseFeatureIcons";
import { splitLeadingCount } from "@/lib/leadingCount";
import { cn } from "@/lib/utils";
import type { CourseFeature } from "@/types/domain.types";

/**
 * "What's included" on the course page and its admin preview, as a spec
 * sheet open in the editor (`features.json`).
 *
 * Up top, the highlights that open with a count ("4 Exams", "1:1 Support
 * Session"): the number large, in mono and the number colour, since how many
 * exams, assignments or sessions is what a buyer compares between courses,
 * each in its own cell. Under them the rest, two to a row where there's room,
 * each with its line icon in a small square tile. The counted ones come
 * first, each group in the admin's order.
 */
export default function CourseHighlights({
    features,
    animate = false,
}: {
    features: CourseFeature[];
    /** Plays `CourseHighlightsMotion`'s entrance. Off in the admin preview,
     *  which scrolls inside its own panel rather than the window. */
    animate?: boolean;
}) {
    const items = features.map((feature, index) => ({ feature, key: `${index}-${feature.title}`, ...splitLeadingCount(feature.title) }));
    const counted = items.filter((item) => item.count);
    const others = items.filter((item) => !item.count);
    // The last counted cell takes the rest of its row, at two columns and at
    // three, so a count that doesn't divide evenly never leaves a grey hole.
    const n = counted.length;
    const lastSpan = cn(
        n > 1 && n % 2 === 1 && "@lg:col-span-2",
        n > 2 && (n % 3 === 1 ? "@3xl:col-span-3" : n % 3 === 2 ? "@3xl:col-span-2" : "@3xl:col-span-1"),
    );

    const panel = (
        <div className="@container">
            <div data-hl-panel className="overflow-hidden rounded-card border border-border bg-card">
                <p className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">
                    <FileIcon name="features.json" /> এক নজরে
                </p>
                {counted.length > 0 && (
                    <ul
                        className={cn(
                            "grid gap-px bg-border",
                            counted.length > 1 && "@lg:grid-cols-2",
                            counted.length > 2 && "@3xl:grid-cols-3",
                        )}
                    >
                        {counted.map(({ feature, key, count, rest }, index) => (
                            <li key={key} className={cn("min-w-0 bg-card p-5 sm:p-6", index === n - 1 && lastSpan)}>
                                <span aria-hidden data-hl-marker className="inline-block">
                                    <span data-hl-count className="font-mono text-4xl font-semibold leading-none tracking-tight text-syn-number tabular-nums">
                                        {count}
                                    </span>
                                </span>
                                <div data-hl-text>
                                    <h3 className="mt-3 font-semibold leading-snug">
                                        <span className="sr-only">{count} </span>
                                        {rest}
                                    </h3>
                                    {feature.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {others.length > 0 && (
                    <ul className={cn("grid gap-x-10 gap-y-6 p-5 sm:p-6 @lg:grid-cols-2", counted.length > 0 && "border-t border-border")}>
                        {others.map(({ feature, key }) => {
                            const Icon = featureIcon(feature.icon);
                            return (
                                <li key={key} className="group flex min-w-0 gap-4">
                                    <span
                                        aria-hidden
                                        data-hl-marker
                                        className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface text-primary transition-colors duration-200 group-hover:border-primary/50 motion-reduce:transition-none"
                                    >
                                        <Icon className="size-5" strokeWidth={1.75} />
                                    </span>
                                    <div data-hl-text className="min-w-0">
                                        <h3 className="font-semibold leading-snug">{feature.title}</h3>
                                        {feature.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );

    return animate ? <CourseHighlightsMotion>{panel}</CourseHighlightsMotion> : panel;
}
