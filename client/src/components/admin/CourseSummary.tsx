import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { PHASE_META } from "@/lib/courseClassification";
import { cn } from "@/lib/utils";
import type { AdminSummaryCourse } from "@/types/admin.types";

/*
 * The pieces the admin's per-course screens share — Payments and Enrolments
 * both open on every course as a card or a row, then one course with a
 * header over its list — so the two read as one family.
 */

const TYPE_LABEL = { BOOTCAMP: "Bootcamp", TRADITIONAL: "Traditional" } as const;

/**
 * Sized by the space the list has, not the window (the sidebar takes a share
 * of that): five across once there's room for five cards of ~15rem.
 */
export const COURSE_GRID = "grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @7xl:grid-cols-5";

/** "Last order 2 hours ago", or `none` when there's no date. */
export const since = (prefix: string, date: string | null, none: string) =>
    date ? `${prefix} ${formatDistanceToNowStrict(new Date(date), { addSuffix: true })}` : none;

/**
 * Category and type, led by a course that's no longer live, and its status
 * unless it's simply running. One line of text that ends in an ellipsis when
 * it runs out of room (or wraps, with `wrap`) — never a part squeezed to nothing.
 */
export function CourseMeta({ course, wrap = false, className }: { course: AdminSummaryCourse; wrap?: boolean; className?: string }) {
    const notLive = course.isDeleted || course.status !== "PUBLISHED";
    return (
        <p className={cn("min-w-0 text-[0.6875rem] text-muted-foreground", !wrap && "truncate", className)}>
            {course.isDeleted ? (
                <span className="font-semibold text-destructive">Deleted course</span>
            ) : (
                notLive && <span className="font-semibold text-foreground/80">{course.status === "DRAFT" ? "Draft" : "Archived"}</span>
            )}
            {notLive && <span aria-hidden> · </span>}
            {course.category?.title ?? "No category"}
            <span aria-hidden> · </span>
            {TYPE_LABEL[course.courseType]}
            {course.phase && course.phase !== "PRESENT" && (
                <>
                    <span aria-hidden> · </span>
                    <span title={PHASE_META[course.phase].hint}>{PHASE_META[course.phase].admin}</span>
                </>
            )}
        </p>
    );
}

export function CourseThumb({ course, sizes, className }: { course: AdminSummaryCourse; sizes: string; className?: string }) {
    return (
        <SafeImage
            src={course.thumbnail}
            alt=""
            fill
            sizes={sizes}
            className={cn("object-cover", course.isDeleted && "grayscale", className)}
            fallback={<BookOpen className="size-7 text-muted-foreground" />}
        />
    );
}

export interface Segment {
    key: string;
    count: number;
    /** Lower-case, as it reads after the number: "paid", "awaiting payment". */
    label: string;
    /** For a narrow legend: "awaiting". */
    shortLabel?: string;
    fill: string;
}

/**
 * A whole split by status as one bar, with a legend of the parts it actually
 * has. Nothing to split draws an empty dashed track.
 */
export function SegmentBar({
    segments,
    legend = true,
    short = false,
    emptyLabel,
    className,
}: {
    segments: Segment[];
    legend?: boolean;
    short?: boolean;
    emptyLabel: string;
    className?: string;
}) {
    const present = segments.filter((segment) => segment.count > 0);
    const total = present.reduce((sum, segment) => sum + segment.count, 0);

    return (
        <div className={className}>
            {total === 0 ? (
                <div className="h-2 rounded-full border border-dashed border-border" role="img" aria-label={emptyLabel} />
            ) : (
                <div
                    className="flex h-2 gap-0.5 overflow-hidden rounded-full"
                    role="img"
                    aria-label={present.map((segment) => `${segment.count} ${segment.label}`).join(", ")}
                >
                    {present.map((segment) => (
                        <span
                            key={segment.key}
                            className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.fill)}
                            style={{ width: `${(segment.count / total) * 100}%` }}
                        />
                    ))}
                </div>
            )}
            {legend && present.length > 0 && (
                <ul className={cn("mt-2 flex flex-wrap gap-y-1 text-muted-foreground", short ? "gap-x-2.5 text-[0.6875rem]" : "gap-x-3 text-xs")}>
                    {present.map((segment) => (
                        <li key={segment.key} className="flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", segment.fill)} aria-hidden />
                            <span className="font-semibold tabular-nums text-foreground">{segment.count.toLocaleString("en-US")}</span>
                            {(short && segment.shortLabel) || segment.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export interface StatCell {
    label: string;
    value: string;
    hint: string;
    /** Something waiting on an admin — amber, with a dot. */
    alert?: boolean;
    /** Makes the cell a button, e.g. into the matching filter. */
    onClick?: () => void;
}

/** Four figures in one strip, two by two on a phone. `embedded` drops its own frame, for inside a card. */
export function StatStrip({ cells, embedded = false }: { cells: StatCell[]; embedded?: boolean }) {
    return (
        <div
            className={cn(
                "grid grid-cols-2 lg:grid-cols-4",
                embedded ? "border-t border-border" : "overflow-hidden rounded-card border border-border bg-card shadow-card",
            )}
        >
            {cells.map((cell, index) => {
                const body = (
                    <>
                        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                            {cell.alert && <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />}
                            {cell.label}
                        </p>
                        <p
                            className={cn(
                                "mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
                                cell.alert && "text-amber-600 dark:text-amber-400",
                            )}
                        >
                            {cell.value}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{cell.hint}</p>
                    </>
                );
                const edge = cn(
                    "min-w-0 px-4 py-4 text-left sm:px-5",
                    index % 2 === 1 && "border-l border-border",
                    index >= 2 && "border-t border-border lg:border-t-0",
                    index === 2 && "lg:border-l",
                );
                return cell.onClick ? (
                    <button
                        key={cell.label}
                        type="button"
                        onClick={cell.onClick}
                        className={cn(edge, cell.alert ? "hover:bg-amber-500/5" : "hover:bg-secondary/40", "transition-colors")}
                    >
                        {body}
                    </button>
                ) : (
                    <div key={cell.label} className={edge}>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}

/** One course above its list: picture, title, a line of details and links, its figures, and its bar. */
export function CourseSummaryHeader({
    course,
    details,
    action,
    stats,
    bar,
}: {
    course: AdminSummaryCourse;
    details: ReactNode;
    /** Top right — the screen's one "add" button. */
    action?: ReactNode;
    stats: StatCell[];
    bar: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-card bg-secondary sm:w-52">
                    <CourseThumb course={course} sizes="(max-width: 640px) 100vw, 208px" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <CourseMeta course={course} wrap className="text-xs" />
                        {action && <div className="shrink-0 max-sm:hidden">{action}</div>}
                    </div>
                    <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{course.title}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">{details}</div>
                    {action && <div className="mt-4 sm:hidden">{action}</div>}
                </div>
            </div>
            <StatStrip cells={stats} embedded />
            <div className="border-t border-border px-5 py-4">{bar}</div>
        </section>
    );
}

/**
 * A course on an overview, card layout — sized for a five-across grid. It
 * reads top-down with the title held at two lines, so the figures and bars
 * of every card in a row line up; only the footer is pinned to the bottom.
 * The whole card opens the course.
 */
export function CourseSummaryCard({
    course,
    href,
    badge,
    figure,
    bar,
    note,
}: {
    course: AdminSummaryCourse;
    href: string;
    /** Over the picture's corner — something that needs an admin. */
    badge?: ReactNode;
    figure: ReactNode;
    bar: ReactNode;
    note: string;
}) {
    return (
        <Link
            href={href}
            className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="relative aspect-video overflow-hidden bg-secondary">
                <CourseThumb
                    course={course}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {badge && <div className="absolute left-2.5 top-2.5">{badge}</div>}
            </div>

            <div className="flex flex-1 flex-col p-4">
                <CourseMeta course={course} />
                <p className="mt-1 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug" title={course.title}>
                    {course.title}
                </p>
                <div className="mt-4">{figure}</div>
                <div className="mb-3 mt-3">{bar}</div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[0.6875rem]">
                    <span className="truncate text-muted-foreground">{note}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary">
                        View
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </div>
            </div>
        </Link>
    );
}

/** The same course as one row, for the list layout. Badge and bar sit in fixed slots so rows line up. */
export function CourseSummaryRow({
    course,
    href,
    badge,
    figure,
    bar,
    note,
}: {
    course: AdminSummaryCourse;
    href: string;
    badge?: ReactNode;
    figure: ReactNode;
    bar: ReactNode;
    note: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-4 rounded-card border border-border bg-card p-3 pr-4 shadow-card transition-colors hover:border-primary/30 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-secondary sm:w-28">
                <CourseThumb course={course} sizes="112px" />
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{course.title}</p>
                <CourseMeta course={course} className="text-xs" />
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
            </div>

            <div className="hidden w-40 shrink-0 xl:block">{bar}</div>
            <div className="hidden w-44 shrink-0 justify-end md:flex">{badge}</div>
            <div className="w-24 shrink-0 text-right sm:w-28">{figure}</div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}
