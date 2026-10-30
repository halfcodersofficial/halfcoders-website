"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { COURSE_GRID, CourseSummaryCard, CourseSummaryRow, since, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdmissionTicketCourseSummary } from "@/types/admin.types";

const VIEW_KEY = "admin.admissionTickets.view";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Admission tickets, course by course: every course as a card, with its
 * ticket in brief (on or off, and the stub's "BATCH 03"); one opens that
 * course's ticket editor.
 */
export default function AdminAdmissionTicketsPage() {
    const [filter, setFilter] = useState("");
    const [term, setTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");

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

    const { data, isLoading } = useQuery({ queryKey: ["admin", "admission-ticket-courses"], queryFn: adminService.admissionTicketCourses });
    const all = data ?? [];

    const rank = (summary: AdmissionTicketCourseSummary) => (!summary.ticket ? 2 : summary.ticket.isActive ? 0 : 1);
    const search = term.trim().toLowerCase();
    const shown = all
        .filter(
            (summary) =>
                (filter === "" || (filter === "WITH") === Boolean(summary.ticket)) && (!search || summary.course.title.toLowerCase().includes(search)),
        )
        .sort((a, b) => rank(a) - rank(b));

    const withOne = all.filter((summary) => summary.ticket).length;
    const on = all.filter((summary) => summary.ticket?.isActive);
    const cells: StatCell[] = [
        { label: "With a ticket", value: String(withOne), hint: `Of ${plural(all.length, "course")}` },
        { label: "Given out now", value: String(on.length), hint: "Switched on" },
        { label: "Students with one", value: String(on.reduce((sum, summary) => sum + summary.students, 0)), hint: "Can open theirs now" },
        { label: "Without", value: String(all.length - withOne), hint: withOne === all.length ? "Every course has one" : "No ticket written" },
    ];

    const parts = (summary: AdmissionTicketCourseSummary, compact: boolean) => {
        const { ticket } = summary;
        const stub = ticket && [ticket.stubLabel, ticket.stubValue].filter(Boolean).join(" ");

        const figure = ticket ? (
            <p className="inline-flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-2xl font-bold tracking-tight text-primary">{stub || "Ticket"}</span>
                {!compact && !stub && <span className="text-xs text-muted-foreground">written</span>}
            </p>
        ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Plus className="size-4" aria-hidden />
                {compact ? "Set up" : "Set up a ticket"}
            </span>
        );

        return {
            badge: ticket ? (
                <span
                    className={cn(
                        "rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold text-white shadow-card",
                        ticket.isActive ? "bg-success/90" : "bg-foreground/70",
                    )}
                >
                    {ticket.isActive ? "On" : "Switched off"}
                </span>
            ) : undefined,
            figure,
            bar: (
                <p className="truncate text-xs text-muted-foreground">
                    {ticket?.isActive
                        ? `${plural(summary.students, "student")} can open theirs`
                        : `${plural(summary.students, "student")} on the course`}
                </p>
            ),
            note: ticket ? since("Saved", ticket.updatedAt, "Saved") : "No ticket yet",
        };
    };

    const hrefFor = (summary: AdmissionTicketCourseSummary) => `/admin/admission-tickets/courses/${summary.course.id}`;

    return (
        <DataShell
            header={
                <div className="space-y-5">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <ConsoleEyebrow />
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admission tickets</h1>
                            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                The picture a student gets on enrolling, to save and share. Pick a course to write what its ticket says.
                            </p>
                        </div>
                        <ViewToggle value={view} onChange={changeView} />
                    </header>
                    {isLoading ? <Skeleton className="h-24 rounded-card" /> : <StatStrip cells={cells} />}
                </div>
            }
            searchPlaceholder="Search courses…"
            onSearch={setTerm}
            filters={[
                { value: "", label: "All courses", count: all.length },
                { value: "WITH", label: "With a ticket", count: withOne },
                { value: "WITHOUT", label: "None yet", count: all.length - withOne },
            ]}
            activeFilter={filter}
            onFilter={setFilter}
            isLoading={isLoading}
            skeleton={
                <div className="@container">
                    <div className={COURSE_GRID}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-72 rounded-card" />
                        ))}
                    </div>
                </div>
            }
            isEmpty={shown.length === 0}
            emptyMessage={all.length === 0 ? "No courses yet." : "No courses match."}
            emptyHint={all.length === 0 ? "Create a course first." : "Try a different search or filter."}
        >
            {view === "grid" ? (
                <div className="@container">
                    <ul className={COURSE_GRID}>
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <CourseSummaryCard course={summary.course} href={hrefFor(summary)} {...parts(summary, false)} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((summary) => (
                        <li key={summary.course.id}>
                            <CourseSummaryRow course={summary.course} href={hrefFor(summary)} {...parts(summary, true)} />
                        </li>
                    ))}
                </ul>
            )}
        </DataShell>
    );
}
