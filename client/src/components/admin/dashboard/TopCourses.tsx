import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { formatBDT } from "@/lib/utils";
import type { AdminDashboard } from "@/types/admin.types";
import Panel from "./Panel";

const TYPE_LABEL = { BOOTCAMP: "Bootcamp", TRADITIONAL: "Traditional" } as const;

/** The table's columns, after the rank gutter — shared by the header and every row. */
const COLUMNS = "@2xl:grid-cols-[minmax(0,1fr)_4.5rem_8rem_6.5rem_1rem]";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Published courses with the most students who still have access — how many,
 * how many finished (with a bar for the share), and what each has actually
 * earned (settled orders, not the list price). Each opens the course. The
 * rank runs down a gutter like an editor's line numbers.
 *
 * The table's columns follow the panel's own width (a container query), not
 * the screen's: beside the activity feed on a 1280px screen the panel is
 * narrower than a phone in landscape, and the columns would crush the title.
 */
export default function TopCourses({ courses }: { courses: AdminDashboard["topCourses"] }) {
    return (
        <Panel
            id="courses-title"
            title="Top courses"
            file="courses/"
            bodyClassName="@container"
            actions={
                <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    All courses <ArrowRight className="size-4" aria-hidden />
                </Link>
            }
            footer={courses.length > 0 && <span>Published courses with the most students who still have access</span>}
        >
            {courses.length === 0 ? (
                <div className="px-6 py-12 text-center">
                    <p className="font-medium">No published courses yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Publish a course and it shows here with its students and earnings.</p>
                </div>
            ) : (
                <>
                    <div
                        className="hidden grid-cols-[2.5rem_minmax(0,1fr)] border-b border-border text-xs font-medium text-muted-foreground @2xl:grid"
                        aria-hidden
                    >
                        <span className="grid place-items-center border-r border-border bg-surface/70 font-mono">#</span>
                        <span className={`grid gap-4 px-5 py-2 ${COLUMNS}`}>
                            <span>Course</span>
                            <span className="text-right">Enrolled</span>
                            <span className="text-right">Finished</span>
                            <span className="text-right">Earned</span>
                            <span />
                        </span>
                    </div>
                    <ol className="divide-y divide-border">
                        {courses.map(({ course, enrolled, completed, revenue }, index) => {
                            const rate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
                            return (
                                <li key={course.id}>
                                    <Link
                                        href={`/admin/courses/${course.id}`}
                                        className="group grid grid-cols-[2.5rem_minmax(0,1fr)] transition-colors hover:bg-secondary/40"
                                    >
                                        {/* The list is ordered, so the rank is already read out; this is the visible gutter. */}
                                        <span
                                            className="grid place-items-center border-r border-border bg-surface/70 font-mono text-xs tabular-nums text-muted-foreground transition-colors group-hover:text-primary"
                                            aria-hidden
                                        >
                                            {pad2(index + 1)}
                                        </span>

                                        <span className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 ${COLUMNS}`}>
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
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
                                                    <span
                                                        className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary"
                                                        title={course.title}
                                                    >
                                                        {course.title}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                                        {TYPE_LABEL[course.courseType]} · {formatBDT(course.discountPrice ?? course.price)}
                                                    </span>
                                                </span>
                                            </span>

                                            <span className="text-right text-sm @2xl:contents">
                                                <span className="block font-mono font-semibold tabular-nums @2xl:text-right">
                                                    {enrolled}
                                                    <span className="font-sans font-normal text-muted-foreground @2xl:hidden"> enrolled</span>
                                                </span>
                                                <span className="block text-xs tabular-nums text-muted-foreground @2xl:text-right @2xl:text-sm @2xl:text-foreground">
                                                    {enrolled > 0 ? (
                                                        <>
                                                            {completed} of {enrolled}
                                                            <span className="@2xl:hidden"> finished</span>
                                                            {completed > 0 && <span className="text-muted-foreground"> · {rate}%</span>}
                                                            {/* The share as a bar — the table only; the stacked list says it in words. */}
                                                            <span
                                                                className="mt-1.5 block h-1 overflow-hidden rounded-full bg-secondary @max-2xl:hidden"
                                                                aria-hidden
                                                            >
                                                                <span className="block h-full rounded-full bg-success" style={{ width: `${rate}%` }} />
                                                            </span>
                                                        </>
                                                    ) : (
                                                        // Only the table needs a placeholder; the stacked list just skips the line.
                                                        <span className="text-muted-foreground @max-2xl:hidden">—</span>
                                                    )}
                                                </span>
                                                <span className="block font-mono text-xs font-medium tabular-nums @2xl:text-right @2xl:text-sm">
                                                    {formatBDT(revenue)}
                                                </span>
                                            </span>
                                            <ChevronRight
                                                className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 @2xl:block"
                                                aria-hidden
                                            />
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </>
            )}
        </Panel>
    );
}
