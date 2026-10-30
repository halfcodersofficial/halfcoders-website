import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AdminCourseDetail } from "@/types/admin.types";

export interface ReadinessItem {
    label: string;
    done: boolean;
}

/** What a strong course page on Half Coders has. `content` is the live form, or the saved course. */
export function readinessOf(
    course: AdminCourseDetail,
    content: { images: number; subtitle: string | null; description: string; outcomes: number; features: number; faqs: number },
): ReadinessItem[] {
    const publishedLessons = course.milestones
        .filter((milestone) => milestone.isPublished)
        .flatMap((milestone) => milestone.modules.filter((module) => module.isPublished))
        .reduce((sum, module) => sum + module._count.videos, 0);

    return [
        { label: "A thumbnail image", done: content.images > 0 },
        { label: "A subtitle that sells it", done: (content.subtitle ?? "").trim() !== "" },
        { label: "A description of 150+ characters", done: content.description.trim().length >= 150 },
        { label: "Three or more learning outcomes", done: content.outcomes >= 3 },
        { label: "Three or more feature tiles", done: content.features >= 3 },
        { label: "A course-specific FAQ", done: content.faqs >= 1 },
        { label: `A published ${course.milestoneLabel.toLowerCase()} with lessons`, done: publishedLessons > 0 },
    ];
}

/** The saved course, read the same way. */
export const savedReadiness = (course: AdminCourseDetail) =>
    readinessOf(course, {
        images: (course.thumbnail ? 1 : 0) + course.gallery.length,
        subtitle: course.subtitle,
        description: course.description,
        outcomes: course.outcomes.length,
        features: course.features.length,
        faqs: course.faqs.length,
    });

/**
 * Is the page ready to sell? A meter of one segment per item, then the items
 * themselves — ticks in the primary colour, gaps as plain dashes. `editHref`
 * (on the overview) adds the way to fix what's missing.
 */
export function CourseReadiness({
    items,
    published,
    editHref,
    compact = false,
}: {
    items: ReadinessItem[];
    published: boolean;
    editHref?: string;
    compact?: boolean;
}) {
    const done = items.filter((item) => item.done).length;

    return (
        <section aria-labelledby="readiness-title" className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="readiness-title" className="text-base font-semibold tracking-tight">
                    Is the page ready to sell?
                </h2>
                <p className="text-sm tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{done}</span> of {items.length}
                </p>
            </div>

            <div className="mt-3 flex gap-1" aria-hidden>
                {items.map((item) => (
                    <span key={item.label} className={cn("h-1.5 flex-1 rounded-full", item.done ? "bg-brand" : "bg-secondary")} />
                ))}
            </div>

            <ul className={cn("mt-4 grid gap-x-6 gap-y-2 text-sm", !compact && "sm:grid-cols-2")}>
                {items.map((item) => (
                    <li key={item.label} className="flex items-center gap-2.5">
                        {item.done ? (
                            <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                        ) : (
                            <span className="h-px w-4 shrink-0 bg-muted-foreground/50" aria-hidden />
                        )}
                        <span className={cn(item.done ? "text-muted-foreground" : "font-medium")}>
                            <span className="sr-only">{item.done ? "Done: " : "Still to do: "}</span>
                            {item.label}
                        </span>
                    </li>
                ))}
            </ul>

            {(editHref || !published) && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    {!published && <p className="text-xs text-muted-foreground">Publishing is an admin&apos;s call — ask one once it&apos;s ready.</p>}
                    {editHref && (
                        <Link href={editHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                            Edit the course page <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    )}
                </div>
            )}
        </section>
    );
}
