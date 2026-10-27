"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { COURSE_GRID, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { SupportCourseCard, SupportCourseRow } from "@/components/admin/support/SupportCourseCard";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/admin";
import type { AdminSupportCourse } from "@/types/admin.types";

const VIEW_KEY = "admin.support.view";

type Filter = "" | "WITH" | "WITHOUT";

const matches = (summary: AdminSupportCourse, filter: Filter, term: string) =>
    (filter === "" || (filter === "WITH") === summary.counts.total > 0) &&
    (!term || summary.course.title.toLowerCase().includes(term.toLowerCase()));

function totals(courses: AdminSupportCourse[]): StatCell[] {
    const sum = (pick: (summary: AdminSupportCourse) => number) => courses.reduce((total, s) => total + pick(s), 0);
    const live = sum((s) => s.counts.live);
    const withSessions = courses.filter((s) => s.counts.total > 0).length;

    return [
        {
            label: "Live now",
            value: String(live),
            hint: live > 0 ? `In ${courses.filter((s) => s.counts.live > 0).length} course(s)` : "Nothing running",
        },
        { label: "Upcoming", value: String(sum((s) => s.counts.upcoming)), hint: "Scheduled, not started" },
        { label: "Held", value: String(sum((s) => s.counts.held)), hint: `${sum((s) => s.joined)} students joined` },
        { label: "Courses", value: String(withSessions), hint: `With sessions, of ${courses.length}` },
    ];
}

/**
 * Support starts from the courses, like Payments and Enrolments: totals
 * across them, then every course with its sessions rolled up. A session is
 * scheduled from inside its course (`/admin/support/courses/[courseId]`), so
 * it can't land on the wrong one.
 */
export default function AdminSupportPage() {
    const [filter, setFilter] = useState<Filter>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");

    // A per-admin preference, read after mount so both renders agree.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(VIEW_KEY);
            if (saved === "grid" || saved === "list") setView(saved);
        } catch {
            // Storage blocked — the default layout is fine.
        }
    }, []);
    const changeView = (next: ViewMode) => {
        setView(next);
        try {
            localStorage.setItem(VIEW_KEY, next);
        } catch {
            // Not remembered this time; still switches.
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "support-courses"],
        queryFn: adminService.supportCourses,
        // "Live now" follows the clock.
        refetchInterval: 60_000,
    });

    const all = data ?? [];
    const shown = all.filter((summary) => matches(summary, filter, searchTerm));
    const count = (value: Filter) => all.filter((summary) => matches(summary, value, "")).length;
    const hrefFor = (summary: AdminSupportCourse) => `/admin/support/courses/${summary.course.id}`;

    return (
        <DataShell
            header={
                <div className="space-y-5">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold sm:text-3xl">Support sessions</h1>
                            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                Scheduled and past sessions, course by course. Pick a course to schedule one or see who
                                joined.
                            </p>
                        </div>
                        <ViewToggle value={view} onChange={changeView} />
                    </header>
                    {isLoading ? <Skeleton className="h-24 rounded-xl" /> : <StatStrip cells={totals(all)} />}
                </div>
            }
            searchPlaceholder="Search courses…"
            onSearch={setSearchTerm}
            filters={[
                { value: "", label: "All courses", count: count("") },
                { value: "WITH", label: "With sessions", count: count("WITH") },
                { value: "WITHOUT", label: "None yet", count: count("WITHOUT") },
            ]}
            activeFilter={filter}
            onFilter={(value) => setFilter(value as Filter)}
            isLoading={isLoading}
            skeleton={
                <div className="@container">
                    <div className={COURSE_GRID}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-72 rounded-xl" />
                        ))}
                    </div>
                </div>
            }
            isEmpty={shown.length === 0}
            emptyMessage={all.length === 0 ? "No courses yet." : "No courses match."}
            emptyHint={
                all.length === 0
                    ? "Create a course first; its support sessions are scheduled here."
                    : "Try a different search or filter."
            }
        >
            {view === "grid" ? (
                <div className="@container">
                    <ul className={COURSE_GRID}>
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <SupportCourseCard summary={summary} href={hrefFor(summary)} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((summary) => (
                        <li key={summary.course.id}>
                            <SupportCourseRow summary={summary} href={hrefFor(summary)} />
                        </li>
                    ))}
                </ul>
            )}
        </DataShell>
    );
}
