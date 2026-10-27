"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ActivityFeed from "@/components/admin/dashboard/ActivityFeed";
import NeedsYou from "@/components/admin/dashboard/NeedsYou";
import PeriodPanel from "@/components/admin/dashboard/PeriodPanel";
import TopCourses from "@/components/admin/dashboard/TopCourses";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT } from "@/lib/utils";
import { notificationService } from "@/services";
import { adminService } from "@/services/admin";
import type { AdminDashboard } from "@/types/admin.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const today = () =>
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" });

/**
 * The admin dashboard, in the order an admin works through it: what's
 * waiting on them, how the last 30 days went against the 30 before, the
 * latest activity, how each course is doing — and the all-time totals last,
 * quietly, for reference.
 */
export default function AdminDashboardPage() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["admin", "dashboard"],
        queryFn: adminService.dashboard,
    });
    // Shared with the sidebar badge, so it's one request between them.
    const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: notificationService.unreadCount });

    return (
        <div className="max-w-7xl space-y-6">
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                        {today()}
                    </p>
                    <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="brand-outline">
                        <Link href="/admin/broadcast">
                            <Send /> Broadcast
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/courses?new=1">
                            <Plus /> New course
                        </Link>
                    </Button>
                </div>
            </header>

            {isLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-96 rounded-2xl" />
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <Skeleton className="h-80 rounded-2xl" />
                        <Skeleton className="h-80 rounded-2xl" />
                    </div>
                </div>
            ) : isError || !data ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load the dashboard.</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
            ) : (
                <Board data={data} unread={unread.data?.count ?? 0} />
            )}
        </div>
    );
}

function Board({ data, unread }: { data: AdminDashboard; unread: number }) {
    const { summary } = data;

    return (
        <>
            <div className={RISE} style={{ animationDelay: "60ms" }}>
                <NeedsYou
                    pendingOrders={data.pendingOrders}
                    waitingStudents={summary.waitingStudents}
                    liveSessions={summary.activeSupportSessions}
                    unread={unread}
                />
            </div>

            <div className={RISE} style={{ animationDelay: "120ms" }}>
                <PeriodPanel data={data} />
            </div>

            <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start", RISE)} style={{ animationDelay: "180ms" }}>
                <TopCourses courses={data.topCourses} />
                <ActivityFeed data={data} />
            </div>

            {/* All time, for reference — one quiet line, each figure opening its screen. */}
            <section aria-labelledby="all-time-title" className={RISE} style={{ animationDelay: "240ms" }}>
                <h2 id="all-time-title" className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    All time
                </h2>
                {/* 1px gaps over the border colour draw the dividers at every column count. */}
                <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:grid-cols-3 xl:grid-cols-6">
                    <Total href="/admin/students" label="Students" value={summary.totalStudents.toLocaleString("en-US")} />
                    <Total href="/admin/mentors" label="Mentors" value={summary.totalMentors.toLocaleString("en-US")} />
                    <Total
                        href="/admin/courses"
                        label="Courses"
                        value={summary.publishedCourses.toLocaleString("en-US")}
                        hint={`published, of ${summary.totalCourses}`}
                    />
                    <Total
                        href="/admin/enrollments"
                        label="Enrolments"
                        value={summary.totalEnrollments.toLocaleString("en-US")}
                        hint={`${summary.completedEnrollments} completed`}
                    />
                    <Total href="/admin/orders" label="Revenue" value={formatBDT(summary.totalRevenue)} hint="settled orders" />
                    <Total href="/admin/certificates" label="Certificates" value={summary.certificates.toLocaleString("en-US")} hint="issued" />
                </ul>
            </section>
        </>
    );
}

function Total({ href, label, value, hint }: { href: string; label: string; value: ReactNode; hint?: string }) {
    return (
        <li className="bg-card">
            <Link href={href} className="group block h-full px-5 py-4 transition-colors hover:bg-secondary/40">
                <span className="block text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
                <span className="mt-1 block text-xl font-bold tracking-tight">{value}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </Link>
        </li>
    );
}
