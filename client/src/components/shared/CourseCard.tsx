import { BookOpen } from "lucide-react";
import Link from "next/link";
import CourseCardBatch from "@/components/shared/CourseCardBatch";
import { CourseDeliveryTag, CoursePhaseChip } from "@/components/shared/CourseClassification";
import { CourseCardMentors, CourseCardPrice, CourseCardTags, OpenLabel } from "@/components/shared/courseCardParts";
import { FileIcon } from "@/components/site/EditorWindow";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";
import { keepSymbolsTogether, langOf } from "@/lib/lang";
import type { CourseCard as CourseCardType } from "@/types/domain.types";

/**
 * A course in the grid, as a pane open in the editor: a strip with its
 * category and where the course is in its life, the thumbnail (with a
 * bootcamp's enrolment news), the category and level as a path, the title,
 * two lines of what it's about, how its classes run, who teaches it; and a
 * footer with the price and "বিস্তারিত →". On hover the border turns violet and a
 * thin halo arrives — nothing moves. The whole card is one link.
 */
export default function CourseCard({ course }: { course: CourseCardType }) {
    const summary = course.subtitle ?? course.description;

    return (
        <Link
            href={`/courses/${course.slug}`}
            // min-w-0: a grid item otherwise grows to its widest line and
            // scrolls the whole page sideways on a phone.
            className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/50 hover:shadow-card-hover motion-reduce:transition-none"
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1.5">
                <span lang={langOf(course.category?.title)} className="flex min-w-0 items-center gap-1.5 text-[0.72rem] font-medium text-muted-foreground">
                    <FileIcon name="course.md" />
                    <span className="truncate">{course.category?.title ?? "Course"}</span>
                </span>
                {course.phase && <CoursePhaseChip phase={course.phase} className="shrink-0 border-transparent bg-transparent px-0" />}
            </div>

            <div className="relative aspect-video overflow-hidden bg-secondary">
                <SafeImage
                    src={course.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none"
                    fallback={<BookOpen className="size-10 text-muted-foreground" />}
                />
                <CourseCardBatch course={course} className="absolute bottom-2 left-2" />
            </div>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                <CourseCardTags course={course} />
                <h3
                    lang={langOf(course.title)}
                    className="mt-2 line-clamp-2 text-[1.0625rem] font-semibold leading-snug transition-colors group-hover:text-primary"
                >
                    {keepSymbolsTogether(course.title)}
                </h3>
                {summary && (
                    <p lang={langOf(summary)} className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {summary}
                    </p>
                )}
                {course.delivery && <CourseDeliveryTag delivery={course.delivery} mode={course.mode} className="mt-3" />}
                <CourseCardMentors course={course} className="mt-auto pt-4" />
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3">
                <CourseCardPrice course={course} />
                <OpenLabel />
            </div>
        </Link>
    );
}

/** The card's shape while the catalogue loads, so the grid doesn't jump when it arrives. */
export function CourseCardSkeleton() {
    return (
        <div aria-hidden className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
                <Skeleton className="size-3.5" />
                <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="aspect-video rounded-none" />
            <div className="space-y-3 px-4 pb-4 pt-4">
                <Skeleton className="h-2.5 w-2/5" />
                <Skeleton className="h-4 w-11/12" />
                <SkeletonLines lines={2} />
                <div className="flex items-center gap-2 pt-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-2.5 w-1/3" />
                </div>
            </div>
            <div className="flex items-end justify-between border-t border-border px-4 py-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-7 w-16" />
            </div>
        </div>
    );
}
