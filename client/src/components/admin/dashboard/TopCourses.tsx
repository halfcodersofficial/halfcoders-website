import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { formatBDT } from "@/lib/utils";
import type { AdminDashboard } from "@/types/admin.types";

const TYPE_LABEL = { BOOTCAMP: "Bootcamp", TRADITIONAL: "Traditional" } as const;

/**
 * Published courses with the most students who still have access — how many,
 * how many finished, and what each has actually earned (settled orders, not
 * the list price). Each opens the course.
 *
 * The table's columns follow the card's own width (a container query), not
 * the screen's: beside the activity feed on a 1280px screen the card is
 * narrower than a phone in landscape, and the columns would crush the title.
 */
export default function TopCourses({ courses }: { courses: AdminDashboard["topCourses"] }) {
    return (
        <section aria-labelledby="courses-title" className="@container overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <h2 id="courses-title" className="text-lg font-semibold tracking-tight">
                    Courses
                </h2>
                <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    All courses <ArrowRight className="size-4" aria-hidden />
                </Link>
            </header>

            {courses.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">No published courses yet.</p>
            ) : (
                <>
                    <div
                        className="hidden grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6rem_1rem] gap-4 border-b border-border px-6 py-2 text-xs font-medium text-muted-foreground @2xl:grid"
                        aria-hidden
                    >
                        <span>Course</span>
                        <span className="text-right">Enrolled</span>
                        <span className="text-right">Finished</span>
                        <span className="text-right">Earned</span>
                        <span />
                    </div>
                    <ul className="divide-y divide-border">
                        {courses.map(({ course, enrolled, completed, revenue }) => {
                            const rate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
                            // "0 of 3" says it plainly; the rate only once someone has finished.
                            return (
                                <li key={course.id}>
                                    <Link
                                        href={`/admin/courses/${course.id}`}
                                        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:px-6 @2xl:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6rem_1rem]"
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                                                <SafeImage
                                                    src={course.thumbnail}
                                                    alt=""
                                                    fill
                                                    sizes="80px"
                                                    className="object-cover"
                                                    fallback={<BookOpen className="size-5 text-muted-foreground" />}
                                                />
                                            </span>
                                            <span className="min-w-0">
                                                {/* Two lines before it's cut — long course names stay readable. */}
                                                <span className="line-clamp-2 text-sm font-semibold leading-snug" title={course.title}>
                                                    {course.title}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    {TYPE_LABEL[course.courseType]} · {formatBDT(course.discountPrice ?? course.price)}
                                                </span>
                                            </span>
                                        </span>

                                        <span className="text-right text-sm @2xl:contents">
                                            <span className="block font-semibold tabular-nums @2xl:text-right">
                                                {enrolled}
                                                <span className="font-normal text-muted-foreground @2xl:hidden"> enrolled</span>
                                            </span>
                                            <span className="block text-xs tabular-nums text-muted-foreground @2xl:text-right @2xl:text-sm @2xl:text-foreground">
                                                {enrolled > 0 ? (
                                                    <>
                                                        {completed} of {enrolled}
                                                        <span className="@2xl:hidden"> finished</span>
                                                        {completed > 0 && <span className="text-muted-foreground"> · {rate}%</span>}
                                                    </>
                                                ) : (
                                                    // Only the table needs a placeholder; the stacked list just skips the line.
                                                    <span className="text-muted-foreground @max-2xl:hidden">—</span>
                                                )}
                                            </span>
                                            <span className="block text-xs font-medium tabular-nums @2xl:text-right @2xl:text-sm">
                                                {formatBDT(revenue)}
                                            </span>
                                        </span>
                                        <ChevronRight
                                            className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 @2xl:block"
                                            aria-hidden
                                        />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
