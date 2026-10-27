import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn, discountPercent, effectivePrice, formatBDT, LEVEL_LABEL } from "@/lib/utils";
import type { CourseCard } from "@/types/domain.types";

/** The pieces the grid card and the list row share, so the two views read as one design. */

/** A label laid over the thumbnail (a batch's status, the course's phase): a solid mono tag, so it reads on any photo. */
export const THUMBNAIL_CHIP =
    "inline-flex items-center gap-1 rounded-sm border border-border/70 bg-card/95 px-2 py-0.5 font-mono text-[0.68rem] font-semibold leading-5";

/* The level's colour, as in the catalogue's level filter. */
const LEVEL_DOT: Record<string, string> = {
    BEGINNER: "bg-success",
    INTERMEDIATE: "bg-primary",
    ADVANCED: "bg-destructive",
};

/** "programming / ■ Beginner" — what it's about and who it's for, set like a path. */
export function CourseCardTags({ course, className }: { course: CourseCard; className?: string }) {
    return (
        <p className={cn("flex min-w-0 items-center gap-2 font-mono text-[0.72rem]", className)}>
            {course.category && (
                <>
                    <span className="truncate text-syn-keyword">{course.category.title}</span>
                    <span aria-hidden className="text-border-strong">/</span>
                </>
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <span aria-hidden className={cn("size-1.5 rounded-[1px]", LEVEL_DOT[course.level] ?? "bg-muted-foreground/60")} />
                {LEVEL_LABEL[course.level] ?? course.level}
            </span>
        </p>
    );
}

/**
 * A ticket's tear: a dashed line between two notches bitten out of its edges
 * (circles in the page's colour, only their inner half showing) — across the
 * top of a stub below, or down the left of a stub beside. Place it in the
 * stub, which must be `relative`.
 */
export function TicketTear({ along = "top", className }: { along?: "top" | "left"; className?: string }) {
    if (along === "left") {
        return (
            <span aria-hidden className={className}>
                <span className="absolute inset-y-5 left-0 border-l-2 border-dashed border-border-strong" />
                <span className="absolute -top-3 left-0 size-6 -translate-x-1/2 rounded-full border border-border bg-background [clip-path:inset(50%_0_0_0)]" />
                <span className="absolute -bottom-3 left-0 size-6 -translate-x-1/2 rounded-full border border-border bg-background [clip-path:inset(0_0_50%_0)]" />
            </span>
        );
    }
    return (
        <span aria-hidden className={className}>
            <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-border-strong" />
            <span className="absolute -left-3 top-0 size-6 -translate-y-1/2 rounded-full border border-border bg-background [clip-path:inset(0_0_0_50%)]" />
            <span className="absolute -right-3 top-0 size-6 -translate-y-1/2 rounded-full border border-border bg-background [clip-path:inset(0_50%_0_0)]" />
        </span>
    );
}

/** The mentors as an overlapping stack, the lead named: "Md Habibur Rahman & 1 more". */
export function CourseCardMentors({ course, className }: { course: CourseCard; className?: string }) {
    const mentors = course.mentors.map(({ mentor }) => mentor);
    if (mentors.length === 0) return null;
    const extra = mentors.length - 1;

    return (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
            <span className="flex shrink-0">
                {mentors.slice(0, 3).map((mentor, index) => (
                    <Avatar
                        key={mentor.id}
                        src={mentor.image}
                        name={mentor.name}
                        size={24}
                        className={cn("ring-2 ring-card", index > 0 && "-ml-2")}
                    />
                ))}
            </span>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{mentors[0].name}</span>
                {extra > 0 && ` & ${extra} more`}
            </span>
        </div>
    );
}

/**
 * The price in mono, with — when it's discounted — the original struck
 * through and the saving as a tag beside it, on a line that keeps its height
 * without one too, so every card's footer lines up across a row.
 */
export function CourseCardPrice({ course, large = false }: { course: CourseCard; large?: boolean }) {
    // A free course is stored at ৳0; the price check covers a list that doesn't send `pricing`.
    const free = course.pricing === "FREE" || effectivePrice(course.price, course.discountPrice) === 0;
    const price = free ? 0 : effectivePrice(course.price, course.discountPrice);
    const off = free ? null : discountPercent(course.price, course.discountPrice);

    return (
        <span className="flex min-w-0 flex-col">
            <span className="flex h-5 items-center gap-1.5 font-mono text-[0.7rem]">
                {off !== null && (
                    <>
                        <span className="text-muted-foreground line-through tabular-nums">{formatBDT(course.price)}</span>
                        <span className="rounded-sm bg-syn-tag/10 px-1 text-syn-tag">-{off}%</span>
                    </>
                )}
            </span>
            <span
                className={cn(
                    "font-mono font-semibold leading-tight tracking-tight tabular-nums",
                    large ? "text-2xl" : "text-lg",
                    free && "text-success",
                )}
            >
                {free ? "Free" : formatBDT(price)}
            </span>
        </span>
    );
}

/** A card's way in: "বিস্তারিত →" (details), turning violet as the card is hovered. The card itself is the link. */
export function OpenLabel({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
                className,
            )}
        >
            <span lang="bn">বিস্তারিত</span>
            <ChevronRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
    );
}
