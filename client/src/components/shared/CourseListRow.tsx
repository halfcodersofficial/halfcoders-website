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
 * The list view's form of `CourseCard`: one row of a listing — the
 * thumbnail and the course (category and level, the title, two
 * lines of what it's about, who teaches it) on the left, the price and
 * "বিস্তারিত →" in a column on the right. On a phone it stacks like the grid's
 * card. The whole row is one link.
 *
 * The thumbnail keeps its 16:9 at every width, inset in the row: a banner is
 * mostly words, and stretched to the row's height it lost them off both sides.
 */
export default function CourseListRow({ course }: { course: CourseCardType }) {
    const summary = course.subtitle ?? course.description;

    return (
        <Link
            href={`/courses/${course.slug}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/50 hover:shadow-card-hover motion-reduce:transition-none md:flex-row"
        >
            <div className="shrink-0 md:w-60 md:self-center md:py-3 md:pl-3 lg:w-72 xl:w-80">
                <div className="relative aspect-video overflow-hidden bg-secondary md:rounded-md">
                    <SafeImage
                        src={course.thumbnail}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 308px"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none"
                        fallback={<BookOpen className="size-10 text-muted-foreground" />}
                    />
                    <CourseCardBatch course={course} className="absolute bottom-2 left-2" />
                </div>
            </div>

            <div className="min-w-0 flex-1 px-4 py-4 md:px-5">
                <p className="flex items-center justify-between gap-2">
                    <span lang={langOf(course.category?.title)} className="flex min-w-0 items-center gap-1.5 text-[0.72rem] font-medium text-muted-foreground">
                        <FileIcon name="course.md" />
                        <span className="truncate">{course.category?.title ?? "Course"}</span>
                    </span>
                    {course.phase && <CoursePhaseChip phase={course.phase} className="shrink-0 border-transparent bg-transparent px-0" />}
                </p>
                <CourseCardTags course={course} className="mt-2" />
                <h3
                    lang={langOf(course.title)}
                    className="mt-1.5 line-clamp-2 text-lg font-semibold leading-snug transition-colors group-hover:text-primary sm:text-xl"
                >
                    {keepSymbolsTogether(course.title)}
                </h3>
                {summary && (
                    <p lang={langOf(summary)} className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {summary}
                    </p>
                )}
                {course.delivery && <CourseDeliveryTag delivery={course.delivery} mode={course.mode} className="mt-3" />}
                <CourseCardMentors course={course} className="mt-3" />
            </div>

            <div className="flex shrink-0 items-end justify-between gap-3 border-t border-border px-4 py-3 md:w-52 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0 md:px-5">
                <CourseCardPrice course={course} large />
                <OpenLabel className="md:justify-center" />
            </div>
        </Link>
    );
}

/** The row's shape while the catalogue loads, so the list doesn't jump when it arrives. */
export function CourseListRowSkeleton() {
    return (
        <div aria-hidden className="flex flex-col overflow-hidden rounded-card border border-border bg-card md:flex-row">
            <div className="shrink-0 md:w-60 md:self-center md:py-3 md:pl-3 lg:w-72 xl:w-80">
                <Skeleton className="aspect-video w-full rounded-none md:rounded-md" />
            </div>
            <div className="flex-1 space-y-3 px-4 py-4 md:px-5">
                <Skeleton className="h-2.5 w-32" />
                <Skeleton className="h-2.5 w-40" />
                <Skeleton className="h-5 w-3/4" />
                <SkeletonLines lines={2} />
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3 md:w-52 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-7 w-full" />
            </div>
        </div>
    );
}
