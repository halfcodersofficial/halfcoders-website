"use client";

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { COURSE_GRID, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import EnrollStudentModal from "@/components/admin/EnrollStudentModal";
import { EnrollmentCourseCard, EnrollmentCourseRow, withAccess } from "@/components/admin/enrollments/EnrollmentCourseCard";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { adminService } from "@/services/admin";
import type { AdminEnrollmentCourse } from "@/types/admin.types";

const VIEW_KEY = "admin.enrolments.view";

type Filter = "" | "STUDENTS";

const matches = (summary: AdminEnrollmentCourse, filter: Filter, term: string) =>
    (filter === "" || summary.counts.total > 0) &&
    (!term || summary.course.title.toLowerCase().includes(term.toLowerCase()));

/** Students across every course: learning now, finished, how far on average, and who's lost access. */
function totals(courses: AdminEnrollmentCourse[]): StatCell[] {
    const sum = (pick: (summary: AdminEnrollmentCourse) => number) => courses.reduce((total, summary) => total + pick(summary), 0);
    const students = sum(withAccess);
    // Weighted by each course's students, like the per-course figure.
    const average = students > 0 ? Math.round(sum((s) => s.averageProgress * withAccess(s)) / students) : 0;
    const certificates = sum((s) => s.certificates);

    return [
        { label: "Learning now", value: String(sum((s) => s.counts.ACTIVE)), hint: `${sum((s) => s.manual)} enrolled by hand` },
        {
            label: "Completed",
            value: String(sum((s) => s.counts.COMPLETED)),
            hint: `${certificates} ${certificates === 1 ? "certificate" : "certificates"} issued`,
        },
        { label: "Average progress", value: `${average}%`, hint: "Of students with access" },
        {
            label: "Access removed",
            value: String(sum((s) => s.counts.CANCELLED + s.counts.EXPIRED)),
            hint: `${sum((s) => s.counts.EXPIRED)} expired`,
        },
    ];
}

/**
 * Enrolments start from the courses, like Payments: totals across all of
 * them, then every course with its students rolled up. A course opens its
 * student list at `/admin/enrollments/[courseId]`.
 */
export default function AdminEnrollmentsPage() {
    const [filter, setFilter] = useState<Filter>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");
    const [enrolling, setEnrolling] = useState(false);

    // The layout is a per-admin preference; read after mount so the server
    // render and the first client render agree.
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

    // Every course at once — tens, not thousands — so the totals always cover
    // everything and search/filter are instant.
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "enrollment-courses"],
        queryFn: adminService.enrollmentCourses,
    });

    const all = data ?? [];
    const shown = all.filter((summary) => matches(summary, filter, searchTerm));
    const count = (value: Filter) => all.filter((summary) => matches(summary, value, "")).length;
    const hrefFor = (summary: AdminEnrollmentCourse) => `/admin/enrollments/${summary.course.id}`;

    const enrolButton = (
        <Button onClick={() => setEnrolling(true)}>
            <UserPlus /> Enrol a student
        </Button>
    );

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <ConsoleEyebrow />
                                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Enrolments</h1>
                                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                    Who has access to what, and how far along they are. Pick a course to see its students.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <ViewToggle value={view} onChange={changeView} />
                                <ExportCsvButton path="/enrollments/manage/export" label="All enrolments (CSV)" />
                                {enrolButton}
                            </div>
                        </header>
                        {isLoading ? <Skeleton className="h-24 rounded-card" /> : <StatStrip cells={totals(all)} />}
                    </div>
                }
                searchPlaceholder="Search courses…"
                onSearch={setSearchTerm}
                filters={[
                    { value: "", label: "All courses", count: count("") },
                    { value: "STUDENTS", label: "With students", count: count("STUDENTS") },
                ]}
                activeFilter={filter}
                onFilter={(value) => setFilter(value as Filter)}
                isLoading={isLoading}
                skeleton={
                    view === "grid" ? (
                        <div className="@container">
                            <div className={COURSE_GRID}>
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={index} className="h-80 rounded-card" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-20 rounded-card" />
                            ))}
                        </div>
                    )
                }
                isEmpty={shown.length === 0}
                emptyMessage={all.length === 0 ? "No courses yet." : "No courses match."}
                emptyHint={
                    all.length === 0
                        ? "Students appear here, course by course, once a payment is confirmed or you enrol someone by hand."
                        : "Try a different search or filter."
                }
                emptyAction={all.length === 0 ? enrolButton : undefined}
            >
                {view === "grid" ? (
                    <div className="@container">
                        <ul className={COURSE_GRID}>
                            {shown.map((summary) => (
                                <li key={summary.course.id}>
                                    <EnrollmentCourseCard summary={summary} href={hrefFor(summary)} />
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <EnrollmentCourseRow summary={summary} href={hrefFor(summary)} />
                            </li>
                        ))}
                    </ul>
                )}
            </DataShell>

            <EnrollStudentModal open={enrolling} onOpenChange={setEnrolling} />
        </>
    );
}
