import { techStackIcon } from "@/lib/techStackIcons";
import type { CourseTechStackItem } from "@/types/domain.types";

/**
 * The tools a course teaches: each a small chip with the tool's icon and
 * name.
 */
export default function CourseTechStack({ items }: { items: CourseTechStackItem[] }) {
    return (
        <div className="rounded-card border border-border bg-card p-4 sm:p-5">
            <ul className="flex flex-wrap gap-2">
                {items.map((item, index) => {
                    const Icon = techStackIcon(item.icon);
                    return (
                        <li
                            key={`${index}-${item.name}`}
                            className="group inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-primary/50"
                        >
                            <Icon className="size-4 text-foreground/70 transition-colors group-hover:text-primary" aria-hidden />
                            <span className="font-medium">{item.name}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
