"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
    COURSE_GRID,
    CourseSummaryCard,
    CourseSummaryRow,
    SegmentBar,
    since,
    StatStrip,
    type StatCell,
} from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatHoursMinutes } from "@/lib/utils";
import { conceptualAuthoring } from "@/services/conceptual";
import type { StaffConceptualCourseSummary } from "@/types/conceptual.types";

type Filter = "" | "WITH" | "WITHOUT";

const matches = (summary: StaffConceptualCourseSummary, filter: Filter, term: string) =>
    (filter === "" || (filter === "WITH") === summary.recordings.total > 0) &&
    (!term || summary.course.title.toLowerCase().includes(term.toLowerCase()));

const drafts = (summary: StaffConceptualCourseSummary) => summary.recordings.total - summary.recordings.live;

const lastAdded = (summary: StaffConceptualCourseSummary) => since("Last added", summary.lastAddedAt, "No recordings yet");

/** What students can watch, against what's still a draft. */
function RecordingsBar({ summary, legend = true }: { summary: StaffConceptualCourseSummary; legend?: boolean }) {
    return (
        <SegmentBar
            segments={[
                { key: "live", count: summary.recordings.live, label: "live", fill: "bg-success" },
                { key: "draft", count: drafts(summary), label: "not live yet", shortLabel: "not live", fill: "bg-muted-foreground/40" },
            ]}
            legend={legend}
            short
            emptyLabel="No recordings yet"
        />
    );
}

function totals(courses: StaffConceptualCourseSummary[]): StatCell[] {
    const sum = (pick: (summary: StaffConceptualCourseSummary) => number) => courses.reduce((total, s) => total + pick(s), 0);
    const live = sum((s) => s.recordings.live);
    const duration = sum((s) => s.liveDuration);
    const withRecordings = courses.filter((s) => s.recordings.total > 0).length;

    return [
        { label: "Live recordings", value: String(live), hint: `${sum(drafts)} not live yet` },
        { label: "Topics", value: String(sum((s) => s.topics.total)), hint: `${sum((s) => s.topics.live)} live` },
        { label: "Running time", value: duration > 0 ? formatHoursMinutes(duration) : "—", hint: "Of live recordings" },
        { label: "Courses", value: String(withRecordings), hint: `With recordings, of ${courses.length}` },
    ];
}

/**
 * Conceptual sessions start from the courses, like Payments and Enrolments:
 * totals across them, then every course with its recordings counted. A course
 * opens its topics and recordings. Admins see every course; a mentor, the
 * ones assigned to them.
 */
export default function ConceptualCoursesOverview({ area }: { area: StaffArea }) {
    const viewKey = `${area}.conceptual.view`;
    const [filter, setFilter] = useState<Filter>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");

    // A per-person preference, read after mount so both renders agree.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(viewKey);
            if (saved === "grid" || saved === "list") setView(saved);
        } catch {
            // Storage blocked — the default layout is fine.
        }
    }, [viewKey]);
    const changeView = (next: ViewMode) => {
        setView(next);
        try {
            localStorage.setItem(viewKey, next);
        } catch {
            // Not remembered this time; still switches.
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ["conceptual", "manage-courses"],
        queryFn: conceptualAuthoring.courses,
    });

    const all = data ?? [];
    const shown = all.filter((summary) => matches(summary, filter, searchTerm));
    const count = (value: Filter) => all.filter((summary) => matches(summary, value, "")).length;
    const hrefFor = (summary: StaffConceptualCourseSummary) => staffCourseRoutes(area, summary.course.id).conceptual;

    return (
        <div className={cn(area === "mentor" && "container-page py-10")}>
            <DataShell
                header={
                    <div className="space-y-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold sm:text-3xl">Conceptual sessions</h1>
                                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                    Recordings of the live conceptual classes, filed by topic. Pick a course to add or
                                    manage its recordings.
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
                    { value: "WITH", label: "With recordings", count: count("WITH") },
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
                        ? area === "mentor"
                            ? "Courses you're assigned to appear here."
                            : "Create a course first; its conceptual sessions are managed here."
                        : "Try a different search or filter."
                }
            >
                {view === "grid" ? (
                    <div className="@container">
                        <ul className={COURSE_GRID}>
                            {shown.map((summary) => (
                                <li key={summary.course.id}>
                                    <CourseSummaryCard
                                        course={summary.course}
                                        href={hrefFor(summary)}
                                        badge={
                                            drafts(summary) > 0 && (
                                                <Badge variant="secondary" className="bg-card/95 shadow-sm">
                                                    {drafts(summary)} not live
                                                </Badge>
                                            )
                                        }
                                        figure={
                                            <div className="flex items-end justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                                        Live recordings
                                                    </p>
                                                    <p className="text-xl font-bold tabular-nums tracking-tight">
                                                        {summary.recordings.live}
                                                        <span className="ml-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">
                                                            · {summary.topics.total} {summary.topics.total === 1 ? "topic" : "topics"}
                                                        </span>
                                                    </p>
                                                </div>
                                                {summary.liveDuration > 0 && (
                                                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                                                        {formatHoursMinutes(summary.liveDuration)}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                        bar={<RecordingsBar summary={summary} />}
                                        note={lastAdded(summary)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <CourseSummaryRow
                                    course={summary.course}
                                    href={hrefFor(summary)}
                                    badge={
                                        drafts(summary) > 0 && <Badge variant="secondary">{drafts(summary)} not live</Badge>
                                    }
                                    figure={
                                        <>
                                            <p className="font-bold tabular-nums">{summary.recordings.live} live</p>
                                            <p className="text-xs text-muted-foreground">
                                                {summary.topics.total} {summary.topics.total === 1 ? "topic" : "topics"}
                                            </p>
                                        </>
                                    }
                                    bar={<RecordingsBar summary={summary} legend={false} />}
                                    note={lastAdded(summary)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </DataShell>
        </div>
    );
}
