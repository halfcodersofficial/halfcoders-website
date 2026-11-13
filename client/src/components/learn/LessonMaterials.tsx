import { ExternalLink, FileText, Link as LinkIcon, PlayCircle, type LucideIcon } from "lucide-react";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { linkify } from "@/lib/linkify";
import { cn } from "@/lib/utils";
import type { LessonType } from "@/types/domain.types";
import type { LessonMaterial } from "@/types/learning.types";

const TYPE: Record<LessonType, { label: string; plural: string; icon: LucideIcon; tile: string }> = {
    VIDEO: { label: "Video", plural: "videos", icon: PlayCircle, tile: "bg-primary/10 text-primary" },
    TEXT: { label: "Read", plural: "texts", icon: FileText, tile: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
    RESOURCE: { label: "Link", plural: "links", icon: LinkIcon, tile: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

const hostnameOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/** "2 videos · 1 text · 1 link" — what's in the list, at a glance. */
const summarise = (materials: LessonMaterial[]) =>
    (["VIDEO", "TEXT", "RESOURCE"] as const)
        .map((type) => {
            const count = materials.filter((material) => material.type === type).length;
            if (count === 0) return null;
            const word = TYPE[type].plural;
            return `${count} ${count === 1 ? word.replace(/s$/, "") : word}`;
        })
        .filter(Boolean)
        .join(" · ");

/**
 * The lessons that come with an assignment or a practice day, in order: each
 * with its number, its kind in a coloured tile, its title and note — then the
 * thing itself: a video to play right here, a text to read, or a link to open
 * in a new tab. Renders nothing when there are none.
 */
export default function LessonMaterials({
    materials,
    intro,
    className,
}: {
    materials: LessonMaterial[];
    /** A line under the heading: what these are for. */
    intro?: string;
    className?: string;
}) {
    if (materials.length === 0) return null;

    return (
        <section aria-labelledby="lesson-materials-title" className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="lesson-materials-title" className="font-semibold">
                    Lessons <span className="font-normal text-muted-foreground">· {materials.length}</span>
                </h2>
                <p className="text-xs text-muted-foreground">{summarise(materials)}</p>
            </header>
            {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}

            <ol className="mt-5 space-y-6">
                {materials.map((material, index) => {
                    const meta = TYPE[material.type];
                    const Icon = meta.icon;
                    return (
                        <li key={material.id} className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-md", meta.tile)}>
                                    <Icon className="size-4.5" />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                                        {String(index + 1).padStart(2, "0")} · {meta.label}
                                    </p>
                                    <h3 className="font-semibold leading-snug">{material.title}</h3>
                                    {material.description && (
                                        <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground wrap-break-word">{linkify(material.description)}</p>
                                    )}
                                </div>
                            </div>

                            {material.type === "VIDEO" && material.youtubeVideoId && (
                                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                                    <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${material.youtubeVideoId}?rel=0&modestbranding=1`}
                                        title={material.title}
                                        loading="lazy"
                                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="size-full"
                                    />
                                </div>
                            )}

                            {material.type === "TEXT" && material.content && (
                                <div
                                    className="rounded-lg border border-border bg-secondary/20 p-4 text-[15px] leading-relaxed"
                                    // Escaped and link-restricted by renderLightMarkdown.
                                    dangerouslySetInnerHTML={{ __html: renderLightMarkdown(material.content) }}
                                />
                            )}

                            {material.type === "RESOURCE" && material.resourceUrl && (
                                <a
                                    href={material.resourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{hostnameOf(material.resourceUrl)}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{material.resourceUrl}</span>
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                                        Open <ExternalLink className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
                                    </span>
                                </a>
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
