"use client";

import { BookOpen, Link2, Pencil, Play, Trash2 } from "lucide-react";
import StarRating from "@/components/shared/StarRating";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DragHandle, SortableItem } from "@/components/ui/sortable";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { extractYoutubeId } from "@/lib/validation";
import type { AdminTestimonial } from "@/types/admin.types";

/** Where a testimonial shows on the site, worked out from the list's order. */
export interface Placement {
    /** 1-based among the live ones, which is the homepage's order; null for a draft. */
    liveRank: number | null;
    /** Whether that rank is inside the homepage's slots. */
    onHomepage: boolean;
    /** 1-based among its course's live ones; null without a course, or for a draft. */
    courseRank: number | null;
}

interface TestimonialRowProps {
    testimonial: AdminTestimonial;
    placement: Placement;
    /** How many a course page shows, to say when one falls past them. */
    courseSlots: number;
    sortable: boolean;
    /** Its new position is being saved. */
    savingOrder: boolean;
    /** Just added or edited — drawn with a brief ring so the eye finds it. */
    flash: boolean;
    onToggle: (next: boolean) => void;
    onEdit: () => void;
    onDelete: () => void;
}

/**
 * One testimonial on the admin list: its place on the homepage down the left
 * edge, who said it and what, where else it shows, and its controls — live
 * switch, edit, delete. Drag by the ≡ to move it.
 */
export default function TestimonialRow({
    testimonial,
    placement,
    courseSlots,
    sortable,
    savingOrder,
    flash,
    onToggle,
    onEdit,
    onDelete,
}: TestimonialRowProps) {
    const live = testimonial.isPublished;
    const videoId = testimonial.videoUrl ? extractYoutubeId(testimonial.videoUrl) : null;
    const className = cn(
        "flex items-start gap-3 px-3 py-4 transition-[background-color,box-shadow] duration-500 sm:gap-4 sm:px-5",
        flash && "bg-primary/5 ring-2 ring-inset ring-primary/40",
    );

    const body = (
        <>
            {sortable && <DragHandle label={`${testimonial.name}'s testimonial`} isSaving={savingOrder} />}
            <Rank placement={placement} />
            <Avatar src={testimonial.avatar} name={testimonial.name} size={44} className="mt-0.5 max-sm:hidden" />

            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-5 gap-y-3">
                <div className={cn("min-w-0 flex-1 basis-72 transition-opacity", !live && "opacity-70")}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{testimonial.name}</span>
                        {testimonial.designation && (
                            <span className="text-sm text-muted-foreground">{testimonial.designation}</span>
                        )}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <StarRating rating={testimonial.rating} size="size-3.5" />
                        {testimonial.course && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                                <BookOpen className="size-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{testimonial.course.title}</span>
                                <CourseNote testimonial={testimonial} placement={placement} courseSlots={courseSlots} />
                            </span>
                        )}
                        {videoId && (
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1",
                                    testimonial.course ? "lg:hidden" : "text-amber-600 dark:text-amber-400",
                                )}
                            >
                                <Play className="size-3.5" aria-hidden />
                                {/* Only a course page plays it; the homepage shows the quote. */}
                                {testimonial.course ? "Video" : "Video plays only on a course page — add a course"}
                            </span>
                        )}
                        {testimonial.student && (
                            <span className="inline-flex items-center gap-1" title={testimonial.student.email}>
                                <Link2 className="size-3.5" aria-hidden />
                                {testimonial.student.name === testimonial.name
                                    ? "Linked to their account"
                                    : `Linked to ${testimonial.student.name}`}
                            </span>
                        )}
                    </div>
                </div>

                {videoId && testimonial.videoUrl && (
                    <a
                        href={testimonial.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Watch ${testimonial.name}'s video on YouTube`}
                        className="group relative hidden aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-black lg:block"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                            alt=""
                            className={cn("size-full object-cover", !live && "opacity-70")}
                        />
                        <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover:bg-black/35">
                            <span className="grid size-7 place-items-center rounded-full bg-white/95 text-primary shadow">
                                <Play className="ml-0.5 size-3.5 fill-current" aria-hidden />
                            </span>
                        </span>
                    </a>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <label className="mr-1 flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <Switch
                            checked={live}
                            onCheckedChange={onToggle}
                            aria-label={live ? `Hide ${testimonial.name}'s testimonial` : `Put ${testimonial.name}'s testimonial live`}
                        />
                        <span className={cn("w-9", live ? "text-foreground" : "text-muted-foreground")}>
                            {live ? "Live" : "Draft"}
                        </span>
                    </label>
                    <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${testimonial.name}'s testimonial`}>
                        <Pencil />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                        aria-label={`Delete ${testimonial.name}'s testimonial`}
                        className="text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 />
                    </Button>
                </div>
            </div>
        </>
    );

    return sortable ? (
        <SortableItem as="li" id={testimonial.id} className={className} data-testimonial-id={testimonial.id}>
            {body}
        </SortableItem>
    ) : (
        <li className={className} data-testimonial-id={testimonial.id}>
            {body}
        </li>
    );
}

/** Its slot on the homepage, as a big number — muted when it's live but past the slots, a dash for a draft. */
function Rank({ placement }: { placement: Placement }) {
    const { liveRank, onHomepage } = placement;

    return (
        <span
            className="mt-1.5 w-7 shrink-0 text-center"
            title={
                liveRank === null
                    ? "A draft — not on the site"
                    : onHomepage
                      ? `Number ${liveRank} on the homepage`
                      : "Live, but past the homepage's slots"
            }
        >
            <span
                className={cn(
                    "block text-base font-bold leading-none tabular-nums",
                    liveRank === null ? "text-muted-foreground/50" : onHomepage ? "text-primary" : "text-muted-foreground",
                )}
            >
                {liveRank === null ? "—" : String(liveRank).padStart(2, "0")}
            </span>
        </span>
    );
}

/** Where it stands on its course's page, when that's worth saying. */
function CourseNote({
    testimonial,
    placement,
    courseSlots,
}: {
    testimonial: AdminTestimonial;
    placement: Placement;
    courseSlots: number;
}) {
    if (!testimonial.course) return null;
    if (testimonial.course.status !== "PUBLISHED") {
        return <span className="shrink-0 text-amber-600 dark:text-amber-400">· its page isn&apos;t public</span>;
    }
    if (placement.courseRank === null) return null;
    if (placement.courseRank > courseSlots) {
        return <span className="shrink-0 text-amber-600 dark:text-amber-400">· past its page&apos;s {courseSlots}</span>;
    }
    return <span className="shrink-0">· #{placement.courseRank} on its page</span>;
}
