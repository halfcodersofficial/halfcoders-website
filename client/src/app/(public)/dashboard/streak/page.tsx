"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENT_ROLES } from "@/lib/access";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services";
import type { CourseType } from "@/types/api.types";

/** Bootcamp and Traditional earn a streak under different rules — spelled
 *  out here so a student sees why one course's count moves differently from
 *  another's, not just the number. */
const RULE_COPY: Record<CourseType, string> = {
    BOOTCAMP: "Counts when you watch a newly released module within 24 hours and keep every assignment submitted on time.",
    TRADITIONAL: "Counts every day you watch at least one lesson — a full day with nothing watched resets it.",
};

/** What to do next when the count is zero, by the same rules. */
const START_COPY: Record<CourseType, string> = {
    BOOTCAMP: "Watch the next module within 24 hours of its release to start one.",
    TRADITIONAL: "Watch a lesson today to start one.",
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Page-load rise, staggered with `delay-*`; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/**
 * A real month grid rather than a 7-cell strip, so a student can page back
 * and see the whole shape of a course's activity, not just the last week.
 * Active days are lit tiles, missed bootcamp releases are marked, today is
 * ringed and the rest of the month is faded. Dates in `history` are plain
 * "yyyy-mm-dd" strings with no time component, so the grid is built in UTC
 * throughout to match them exactly — running them through local-time `Date`
 * math would shift a day near midnight.
 */
function MonthCalendar({ history }: { history: { date: string; isActive: boolean }[] }) {
    const [monthOffset, setMonthOffset] = useState(0);
    const activeByDate = new Map(history.map((h) => [h.date, h.isActive]));

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const viewed = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1));
    const year = viewed.getUTCFullYear();
    const month = viewed.getUTCMonth();
    const monthLabel = viewed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: (number | null)[] = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const monthPrefix = `${year}-${pad2(month + 1)}-`;
    const activeThisMonth = history.filter((h) => h.isActive && h.date.startsWith(monthPrefix)).length;

    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setMonthOffset((m) => m - 1)}
                    aria-label="Previous month"
                    className="grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <div className="text-center">
                    <p className="text-sm font-semibold">{monthLabel}</p>
                    <p className="text-xs text-muted-foreground">
                        {activeThisMonth} active {activeThisMonth === 1 ? "day" : "days"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setMonthOffset((m) => m + 1)}
                    disabled={monthOffset >= 0}
                    aria-label="Next month"
                    className="grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="pb-1 text-center text-[0.6875rem] font-semibold text-muted-foreground">
                        {label}
                    </div>
                ))}
                {cells.map((day, i) => {
                    if (day === null) return <div key={`blank-${i}`} />;

                    const dateStr = `${monthPrefix}${pad2(day)}`;
                    // true = active, false = a Bootcamp release that was missed, undefined = no event that day.
                    const state = activeByDate.get(dateStr);
                    const isToday = dateStr === todayStr;
                    const isFuture = dateStr > todayStr;

                    return (
                        <div
                            key={dateStr}
                            title={state === true ? "Active" : state === false ? "Missed" : undefined}
                            className={cn(
                                "relative grid aspect-square place-items-center rounded-lg text-xs font-medium tabular-nums",
                                state === true
                                    ? "bg-syn-number text-white shadow-sm"
                                    : state === false
                                        ? "border border-dashed border-destructive/40 text-destructive"
                                        : isFuture
                                            ? "text-muted-foreground/40"
                                            : "bg-secondary/50 text-muted-foreground",
                                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                            )}
                        >
                            <span className={cn(state === true && "font-bold")}>{day}</span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-syn-number" /> Active
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-dashed border-destructive/60" /> Missed
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm ring-2 ring-primary" /> Today
                </span>
            </div>
        </div>
    );
}

function StreakPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", "student"],
        queryFn: dashboardService.student,
    });

    if (isLoading || !data) {
        return (
            <div className="container-page space-y-6 py-8 sm:py-10">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-96 w-full rounded-panel" />
            </div>
        );
    }

    const { enrollments } = data;

    return (
        <div className="container-page space-y-8 py-8 sm:py-10">
            <header className={RISE}>
                <p className="font-mono text-xs text-syn-comment">{"// streak"}</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your learning streak</h1>
                <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                    Every enrolled course keeps its own streak, earned under its own rule.
                </p>
            </header>

            {enrollments.length === 0 ? (
                <div className={cn(RISE, "delay-100 relative grid place-items-center overflow-hidden rounded-panel border border-border bg-surface px-6 py-16 text-center")}>
                    <div className="relative max-w-md space-y-3">
                        <span className="mx-auto grid size-14 place-items-center rounded-card border border-border bg-card text-syn-number shadow-card">
                            <Flame className="size-6" />
                        </span>
                        <p className="text-lg font-semibold">No streak to keep yet</p>
                        <p className="text-sm text-muted-foreground">Enrol in a course to start building one.</p>
                        <Button asChild className="mt-2 px-6">
                            <Link href="/courses">Browse courses</Link>
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {enrollments.map((enrollment, index) => {
                        const courseType = enrollment.streak?.courseType ?? enrollment.course.courseType;
                        const days = enrollment.streak?.currentStreakDays ?? 0;
                        const history = enrollment.streak?.history ?? [];
                        const href = `/learn/${enrollment.course.slug}`;

                        return (
                            <article
                                key={enrollment.id}
                                className={cn(RISE, "overflow-hidden rounded-panel border border-border bg-card shadow-card")}
                                style={{ animationDelay: `${100 + index * 100}ms` }}
                            >
                                <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
                                    <div className="flex flex-col p-6 sm:p-8">
                                        <div className="flex items-center gap-4">
                                            <Link
                                                href={href}
                                                tabIndex={-1}
                                                aria-hidden
                                                className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-secondary"
                                            >
                                                <SafeImage
                                                    src={enrollment.course.thumbnail}
                                                    alt=""
                                                    fill
                                                    sizes="96px"
                                                    className="object-cover"
                                                    fallback={<BookOpen className="size-5 text-muted-foreground" />}
                                                />
                                            </Link>
                                            <div className="min-w-0">
                                                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                                                    {courseType === "BOOTCAMP" ? "Bootcamp" : "Self-paced"}
                                                </span>
                                                <h2 className="mt-1.5 line-clamp-2 font-bold leading-snug tracking-tight">
                                                    <Link href={href} className="hover:text-primary">
                                                        {enrollment.course.title}
                                                    </Link>
                                                </h2>
                                            </div>
                                        </div>

                                        <div className="mt-8 flex items-center gap-5">
                                            <span
                                                className={cn(
                                                    "grid size-20 shrink-0 place-items-center rounded-panel",
                                                    days > 0
                                                        ? "bg-syn-number text-white shadow-[0_12px_30px_-10px_oklch(0.65_0.22_30/0.7)]"
                                                        : "bg-secondary text-muted-foreground/60",
                                                )}
                                            >
                                                <Flame className={cn("size-10", days > 0 && "motion-safe:animate-pulse")} />
                                            </span>
                                            <div>
                                                <p className="text-6xl font-bold leading-none tracking-tight tabular-nums">{days}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {days === 1 ? "day" : "days"} in a row
                                                </p>
                                            </div>
                                        </div>

                                        <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
                                            {RULE_COPY[courseType]}
                                        </p>
                                        {days === 0 && (
                                            <p className="mt-2 text-sm font-semibold text-foreground">{START_COPY[courseType]}</p>
                                        )}

                                        <div className="mt-auto pt-6">
                                            <Button asChild variant="brand-outline" className="px-5">
                                                <Link href={href}>Go to the course</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border-t border-border bg-secondary/30 p-6 lg:border-l lg:border-t-0">
                                        <MonthCalendar history={history} />
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Students only, like the rest of `/dashboard` — see `dashboard/layout.tsx`. */
export default function DashboardStreakPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <StreakPage />
        </RoleGuard>
    );
}
