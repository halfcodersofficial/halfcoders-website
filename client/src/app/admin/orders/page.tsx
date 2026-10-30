"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { COURSE_GRID, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import { OrderCourseCard, OrderCourseRow } from "@/components/admin/orders/OrderCourseCard";
import PaymentsHeader from "@/components/admin/orders/PaymentsHeader";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminOrderCourse } from "@/types/admin.types";

const VIEW_KEY = "admin.payments.view";

/** "PENDING" is what the dashboard's "Review payments" link asks for. */
type Filter = "" | "PENDING" | "ORDERED";

const matches = (summary: AdminOrderCourse, filter: Filter, term: string) =>
    (filter === "" || (filter === "PENDING" ? summary.counts.PENDING > 0 : summary.counts.total > 0)) &&
    (!term || summary.course.title.toLowerCase().includes(term.toLowerCase()));

/**
 * Money across every course, as one strip: what's been collected, what's
 * waiting on an admin, and what didn't go through. "Awaiting" is also a way
 * in — it filters the courses down to the ones that need confirming.
 */
function totals(courses: AdminOrderCourse[], onAwaiting: () => void): StatCell[] {
    const sum = (pick: (summary: AdminOrderCourse) => number) => courses.reduce((total, summary) => total + pick(summary), 0);
    const pending = sum((s) => s.counts.PENDING);

    return [
        { label: "Collected", value: formatBDT(sum((s) => s.collected)), hint: `${sum((s) => s.counts.PAID)} paid orders` },
        {
            label: "Awaiting payment",
            value: `${pending} ${pending === 1 ? "order" : "orders"}`,
            hint: pending > 0 ? `${formatBDT(sum((s) => s.awaiting))} to confirm` : "Nothing to confirm",
            alert: pending > 0,
            onClick: pending > 0 ? onAwaiting : undefined,
        },
        { label: "Failed", value: String(sum((s) => s.counts.FAILED)), hint: "Payment never arrived" },
        { label: "Refunded", value: String(sum((s) => s.counts.REFUNDED)), hint: "Access withdrawn" },
    ];
}

function PaymentsOverview() {
    const searchParams = useSearchParams();
    const [filter, setFilter] = useState<Filter>(searchParams.get("status") === "PENDING" ? "PENDING" : "");
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");

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

    // Every course at once — there are tens, not thousands — so the totals
    // always cover everything and search/filter are instant.
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "order-courses"],
        queryFn: () => adminService.orderCourses(),
    });

    const all = data ?? [];
    const shown = all.filter((summary) => matches(summary, filter, searchTerm));
    const count = (value: Filter) => all.filter((summary) => matches(summary, value, "")).length;
    const hrefFor = (summary: AdminOrderCourse) =>
        `/admin/orders/${summary.course.id}${filter === "PENDING" ? "?status=PENDING" : ""}`;

    return (
        <DataShell
            header={
                <div className="space-y-5">
                    <PaymentsHeader
                        description="Pick a course to see its orders, student by student. Confirm a payment to grant access."
                        actions={
                            <>
                                <ViewToggle value={view} onChange={changeView} />
                                <ExportCsvButton path="/orders/manage/export" label="All orders (CSV)" />
                            </>
                        }
                    />
                    {isLoading ? <Skeleton className="h-24 rounded-card" /> : <StatStrip cells={totals(all, () => setFilter("PENDING"))} />}
                </div>
            }
            searchPlaceholder="Search courses…"
            onSearch={setSearchTerm}
            filters={[
                { value: "", label: "All courses", count: count("") },
                { value: "PENDING", label: "Awaiting payment", count: count("PENDING") },
                { value: "ORDERED", label: "With orders", count: count("ORDERED") },
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
            emptyMessage={
                filter === "PENDING" && !searchTerm
                    ? "Nothing awaiting confirmation."
                    : all.length === 0
                      ? "No courses yet."
                      : "No courses match."
            }
            emptyHint={
                filter === "PENDING" && !searchTerm
                    ? "Every order has been settled. Courses with a new order waiting show up here."
                    : all.length === 0
                      ? "Orders appear here, course by course, once a course is created and students start buying."
                      : "Try a different search or filter."
            }
        >
            {view === "grid" ? (
                <div className="@container">
                    <ul className={COURSE_GRID}>
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <OrderCourseCard summary={summary} href={hrefFor(summary)} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((summary) => (
                        <li key={summary.course.id}>
                            <OrderCourseRow summary={summary} href={hrefFor(summary)} />
                        </li>
                    ))}
                </ul>
            )}
        </DataShell>
    );
}

export default function AdminOrdersPage() {
    return (
        <Suspense fallback={<Skeleton className="h-96" />}>
            <PaymentsOverview />
        </Suspense>
    );
}
