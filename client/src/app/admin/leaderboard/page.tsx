"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { COURSE_GRID, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { LeaderboardCourseCard, LeaderboardCourseRow, xp } from "@/components/admin/leaderboard/LeaderboardCourseCard";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/admin";
import type { AdminLeaderboardCourse } from "@/types/admin.types";

const VIEW_KEY = "admin.leaderboard.view";

type Filter = "" | "WITH" | "WITHOUT";

const matches = (summary: AdminLeaderboardCourse, filter: Filter, term: string) =>
    (filter === "" || (filter === "WITH") === summary.ranked > 0) &&
    (!term || summary.course.title.toLowerCase().includes(term.toLowerCase()));

function totals(courses: AdminLeaderboardCourse[]): StatCell[] {
    const sum = (pick: (summary: AdminLeaderboardCourse) => number) => courses.reduce((total, s) => total + pick(s), 0);
    const active = courses.filter((s) => s.xpThisWeek > 0).length;

    return [
        { label: "Students ranked", value: String(sum((s) => s.ranked)), hint: "With XP on a course" },
        { label: "Total XP", value: xp(sum((s) => s.totalXp)), hint: "Earned across every course" },
        {
            label: "This week",
            value: `+${xp(sum((s) => s.xpThisWeek))}`,
            hint: active > 0 ? `XP in ${active} course(s)` : "No XP earned yet",
        },
        { label: "Courses", value: String(courses.filter((s) => s.ranked > 0).length), hint: `With a board, of ${courses.length}` },
    ];
}

/**
 * The Leaderboard starts from the courses — XP is earned per course, so each
 * board belongs to one: totals across them, then every course with its
 * standings rolled up. A course opens its full board at
 * `/admin/leaderboard/courses/[courseId]`.
 */
export default function AdminLeaderboardPage() {
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
        queryKey: ["admin", "leaderboard-courses"],
        queryFn: adminService.leaderboardCourses,
    });

    const all = data ?? [];
    const shown = all.filter((summary) => matches(summary, filter, searchTerm));
    const count = (value: Filter) => all.filter((summary) => matches(summary, value, "")).length;
    const hrefFor = (summary: AdminLeaderboardCourse) => `/admin/leaderboard/courses/${summary.course.id}`;

    return (
        <DataShell
            header={
                <div className="space-y-5">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold sm:text-3xl">Leaderboard</h1>
                            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                XP standings, course by course — from lessons, assignments, practice and support. Pick a
                                course to see its full board.
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
                { value: "WITH", label: "With XP", count: count("WITH") },
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
                    ? "Create a course first; its students earn XP as they learn."
                    : "Try a different search or filter."
            }
        >
            {view === "grid" ? (
                <div className="@container">
                    <ul className={COURSE_GRID}>
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <LeaderboardCourseCard summary={summary} href={hrefFor(summary)} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((summary) => (
                        <li key={summary.course.id}>
                            <LeaderboardCourseRow summary={summary} href={hrefFor(summary)} />
                        </li>
                    ))}
                </ul>
            )}
        </DataShell>
    );
}
