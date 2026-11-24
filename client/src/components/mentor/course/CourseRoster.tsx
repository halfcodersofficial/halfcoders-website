"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { percentLabel, percentTone, weekLabel } from "@/components/admin/studentDetail/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getApiErrorMessage } from "@/lib/httpClient";
import { paginationRange } from "@/lib/pagination";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { enrollmentService } from "@/services";
import { curriculumAuthoring } from "@/services/curriculum";
import type { ApiMeta } from "@/types/api.types";
import type { CourseStudent } from "@/types/mentor.types";

const PAGE_SIZE = 20;

const STATUS_TABS = [
    { value: "", label: "Everyone" },
    { value: "ACTIVE", label: "Learning" },
    { value: "COMPLETED", label: "Finished" },
] as const;

const SORTS = [
    { value: "recent", label: "Newest first", sortBy: "createdAt", sortOrder: "desc" },
    { value: "ahead", label: "Furthest ahead", sortBy: "progress", sortOrder: "desc" },
    { value: "behind", label: "Furthest behind", sortBy: "progress", sortOrder: "asc" },
    { value: "name", label: "Name, A–Z", sortBy: "student.name", sortOrder: "asc" },
] as const;

/**
 * A course's students, for its mentor: everyone on it and how far each has
 * got — where they are now, lessons, modules, assignments, quizzes and
 * practice days, and when they were last active. A row opens that student's
 * whole record. Names and photos only: contact details stay with admins.
 */
export default function CourseRoster({ courseId }: { courseId: string }) {
    const routes = staffCourseRoutes("mentor", courseId);
    const [searchInput, setSearchInput] = useState("");
    const searchTerm = useDebouncedValue(searchInput.trim(), 300);
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("recent");
    const [page, setPage] = useState(1);
    const order = SORTS.find((entry) => entry.value === sort) ?? SORTS[0];

    // The workspace reads this too — one request between them.
    const course = useQuery({ queryKey: ["staff", "course", courseId], queryFn: () => curriculumAuthoring.getCourse(courseId) });
    const list = useQuery({
        queryKey: ["staff", "students", courseId, { searchTerm, status, sort, page }],
        queryFn: () =>
            enrollmentService.courseStudents(courseId, {
                searchTerm: searchTerm || undefined,
                status: status || undefined,
                sortBy: order.sortBy,
                sortOrder: order.sortOrder,
                page,
                limit: PAGE_SIZE,
            }),
        placeholderData: keepPreviousData,
    });

    const students = list.data?.data ?? [];
    const meta = list.data?.meta;
    const labels = { milestone: course.data?.milestoneLabel ?? "Week", module: course.data?.moduleLabel ?? "Module" };
    // A change of filter starts from the first page.
    const refilter = (change: () => void) => {
        change();
        setPage(1);
    };

    return (
        <div className="w-full space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Students</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Everyone on this course and how far they&apos;ve got. Open a student to see everything they&apos;ve done — contact details stay with the
                        admins.
                    </p>
                </div>
                {meta && (
                    <p className="text-sm text-muted-foreground">
                        <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{meta.total}</span>{" "}
                        {searchTerm || status ? "found" : meta.total === 1 ? "student" : "students"}
                    </p>
                )}
            </header>

            <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Show" className="flex gap-1 rounded-md bg-secondary/60 p-1">
                    {STATUS_TABS.map((tab) => (
                        <button
                            key={tab.value || "all"}
                            type="button"
                            aria-pressed={status === tab.value}
                            onClick={() => refilter(() => setStatus(tab.value))}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                status === tab.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
                    <div className="w-full min-w-0 sm:w-48">
                        <Select value={sort} onChange={(event) => refilter(() => setSort(event.target.value as typeof sort))} aria-label="Order">
                            {SORTS.map((entry) => (
                                <option key={entry.value} value={entry.value}>
                                    {entry.label}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="relative w-full min-w-0 sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            type="search"
                            value={searchInput}
                            onChange={(event) => {
                                setSearchInput(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Find a student by name"
                            aria-label="Find a student by name"
                            className="pl-9"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                {list.isLoading ? (
                    <div className="space-y-px p-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="h-20 rounded-md" />
                        ))}
                    </div>
                ) : list.isError && !list.data ? (
                    <div className="p-10 text-center">
                        <p className="font-medium">Couldn&apos;t load the students.</p>
                        <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(list.error, "Try again in a moment.")}</p>
                        <Button variant="outline" className="mt-4" onClick={() => list.refetch()}>
                            Try again
                        </Button>
                    </div>
                ) : students.length === 0 ? (
                    <div className="px-8 py-14 text-center">
                        <span className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-primary/10 text-primary">
                            <Users className="size-5" aria-hidden />
                        </span>
                        <p className="mt-4 font-medium">
                            {searchTerm ? `Nobody called “${searchTerm}”.` : status ? "Nobody here." : "Nobody has enrolled yet."}
                        </p>
                        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                            {searchTerm || status ? "Try another name, or show everyone." : "Students show up here as soon as they join."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Column names, from where the row lays out as a table. */}
                        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))_minmax(0,0.9fr)_1rem] gap-4 border-b border-border bg-secondary/30 px-4 py-2 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground lg:grid">
                            <span>Student</span>
                            <span>Progress</span>
                            <span>Lessons</span>
                            <span>Assignments</span>
                            <span>Quizzes</span>
                            <span>Last active</span>
                            <span />
                        </div>
                        <ul aria-label="Students" className={cn("divide-y divide-border transition-opacity", list.isPlaceholderData && "opacity-60")}>
                            {students.map((row) => (
                                <li key={row.id}>
                                    <StudentRow row={row} href={routes.student(row.student.id)} labels={labels} />
                                </li>
                            ))}
                        </ul>
                        {meta && meta.totalPages > 1 && <Pages meta={meta} busy={list.isPlaceholderData} onPage={setPage} />}
                    </>
                )}
            </div>
        </div>
    );
}

function StudentRow({ row, href, labels }: { row: CourseStudent; href: string; labels: { milestone: string; module: string } }) {
    const { stats } = row;
    const where =
        row.status === "COMPLETED"
            ? "Finished the course"
            : row.currentMilestone
              ? [
                    weekLabel(labels.milestone, row.currentMilestone.order),
                    row.currentModule && `${labels.module} ${String(row.currentModule.order).padStart(2, "0")} — ${row.currentModule.title}`,
                ]
                    .filter(Boolean)
                    .join(" · ")
              : "Hasn't started yet";

    return (
        <Link
            href={href}
            className="group grid gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))_minmax(0,0.9fr)_1rem] lg:items-center"
        >
            <span className="flex min-w-0 items-center gap-3">
                <Avatar src={row.student.image} name={row.student.name} size={36} />
                <span className="min-w-0">
                    <span className="flex items-center gap-2">
                        <span className="truncate font-semibold group-hover:text-primary">{row.student.name}</span>
                        {row.status !== "ACTIVE" && <StatusPill kind="enrollment" value={row.status} />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" title={where}>
                        {where}
                    </span>
                </span>
            </span>

            <span className="flex items-center gap-2">
                <Progress value={row.progress} className="h-1.5" barClassName="bg-brand" />
                <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">{Math.round(row.progress)}%</span>
            </span>

            {/* On a phone the three counts sit in a row, each with its own label. */}
            <span className="grid grid-cols-3 gap-4 lg:contents">
                <Count
                    label="Lessons"
                    done={stats.lessons.completed}
                    total={stats.lessons.total}
                    hint={`${stats.modules.completed}/${stats.modules.total} ${labels.module.toLowerCase()}s`}
                />
                <Count label="Assignments" done={stats.assignments.submitted} total={stats.assignments.total} hint="handed in" />
                <Count
                    label="Quizzes"
                    done={stats.quizzes.taken}
                    total={stats.quizzes.total}
                    hint={
                        stats.quizzes.averagePercent !== null ? (
                            <span className={percentTone(stats.quizzes.averagePercent)}>{percentLabel(stats.quizzes.averagePercent)} avg.</span>
                        ) : (
                            "taken"
                        )
                    }
                />
            </span>

            <span className="text-xs text-muted-foreground">
                <span className="lg:hidden">Last active </span>
                {row.lastActivityAt ? formatDistanceToNow(new Date(row.lastActivityAt), { addSuffix: true }) : "Not yet"}
            </span>

            <ChevronRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" aria-hidden />
        </Link>
    );
}

function Count({ label, done, total, hint }: { label: string; done: number; total: number; hint: React.ReactNode }) {
    return (
        <span className="min-w-0">
            <span className="block text-[0.625rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground lg:hidden">{label}</span>
            <span className="block text-sm font-semibold tabular-nums">
                {done}
                <span className="font-normal text-muted-foreground">/{total}</span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        </span>
    );
}

/** The list's foot: which ones are showing, and the pages. */
function Pages({ meta, busy, onPage }: { meta: ApiMeta; busy: boolean; onPage: (page: number) => void }) {
    const { page, totalPages, limit, total } = meta;
    const square =
        "grid size-8 place-items-center rounded-md border font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    const idle = "border-border bg-card hover:border-primary/40 hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

    return (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-4 py-2.5">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                <span className="text-foreground">
                    {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
                </span>{" "}
                of {total}
            </p>
            <div className="flex items-center gap-1">
                <button type="button" className={cn(square, idle)} disabled={page <= 1 || busy} onClick={() => onPage(page - 1)} aria-label="Previous page">
                    <ChevronLeft className="size-4" aria-hidden />
                </button>
                {paginationRange(page, totalPages).map((entry, index) =>
                    entry === "…" ? (
                        <span key={`gap-${index}`} className="grid size-8 place-items-center text-xs text-muted-foreground">
                            …
                        </span>
                    ) : (
                        <button
                            key={entry}
                            type="button"
                            aria-current={entry === page ? "page" : undefined}
                            aria-label={`Page ${entry}`}
                            disabled={busy && entry !== page}
                            onClick={() => entry !== page && onPage(entry)}
                            className={cn(square, entry === page ? "border-primary bg-primary font-semibold text-primary-foreground" : idle)}
                        >
                            {entry}
                        </button>
                    ),
                )}
                <button
                    type="button"
                    className={cn(square, idle)}
                    disabled={page >= totalPages || busy}
                    onClick={() => onPage(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight className="size-4" aria-hidden />
                </button>
            </div>
        </nav>
    );
}
