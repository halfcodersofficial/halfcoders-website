import { ChevronRight, FileText, Link as LinkIcon, PlayCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonType } from "@/types/domain.types";
import type { LessonMaterial } from "@/types/learning.types";

const TYPE: Record<LessonType, { label: string; icon: LucideIcon }> = {
    VIDEO: { label: "Video", icon: PlayCircle },
    TEXT: { label: "Read", icon: FileText },
    RESOURCE: { label: "Link", icon: LinkIcon },
};

/**
 * The lessons of an assignment or a practice day as a short list — each opens
 * in the player, one at a time, the way a module's lessons do (they're also
 * in the course-content list). Renders nothing when there are none.
 */
export default function MaterialList({
    materials,
    onOpen,
    intro,
    className,
}: {
    materials: LessonMaterial[];
    onOpen: (materialId: string) => void;
    /** A line under the heading: what these are for. */
    intro?: string;
    className?: string;
}) {
    if (materials.length === 0) return null;

    return (
        <section aria-labelledby="material-list-title" className={cn("rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6", className)}>
            <h3 id="material-list-title" className="font-semibold">
                Lessons <span className="font-normal text-muted-foreground">· {materials.length}</span>
            </h3>
            {intro && <p className="mt-0.5 text-sm text-muted-foreground">{intro}</p>}

            <ol className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {materials.map((material, index) => {
                    const meta = TYPE[material.type];
                    const Icon = meta.icon;
                    return (
                        <li key={material.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(material.id)}
                                className="group flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none"
                            >
                                <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                                <span className="min-w-0 flex-1 truncate font-medium">{material.title}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{meta.label}</span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
