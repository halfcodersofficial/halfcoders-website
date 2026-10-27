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
 */
export default function TopCourses({ courses }: { courses: AdminDashboard["topCourses"] }) {
    const most = Math.max(1, ...courses.map((entry) => entry.enrolled));

    return (
        <section aria-labelledby="courses-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
                        className="hidden grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_1rem] gap-4 border-b border-border px-6 py-2 text-xs font-medium text-muted-foreground md:grid"
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
                            return (
                                <li key={course.id}>
                                    <Link
                                        href={`/admin/courses/${course.id}`}
                                        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:px-6 md:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_1rem]"
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
                                                <span className="block truncate text-sm font-semibold">{course.title}</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {TYPE_LABEL[course.courseType]} · {formatBDT(course.discountPrice ?? course.price)}
                                                </span>
                                                {/* How it compares with the busiest course here. */}
                                                <span className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-secondary" aria-hidden>
                                                    <span
                                                        className="block h-full rounded-full bg-primary/70"
                                                        style={{ width: `${(enrolled / most) * 100}%` }}
                                                    />
                                                </span>
                                            </span>
                                        </span>

                                        <span className="text-right text-sm md:contents">
                                            <span className="block font-semibold tabular-nums md:text-right">
                                                {enrolled}
                                                <span className="font-normal text-muted-foreground md:hidden"> enrolled</span>
                                            </span>
                                            <span className="block text-xs tabular-nums text-muted-foreground md:text-right md:text-sm md:text-foreground">
                                                {enrolled > 0 ? (
                                                    <>
                                                        {completed}
                                                        <span className="md:hidden"> finished</span>
                                                        <span className="text-muted-foreground"> · {rate}%</span>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </span>
                                            <span className="block text-xs font-medium tabular-nums md:text-right md:text-sm">
                                                {formatBDT(revenue)}
                                            </span>
                                        </span>
                                        <ChevronRight
                                            className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block"
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
