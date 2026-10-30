"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ActivityFeed from "@/components/admin/dashboard/ActivityFeed";
import NeedsYou, { needsYouCount } from "@/components/admin/dashboard/NeedsYou";
import PeriodPanel from "@/components/admin/dashboard/PeriodPanel";
import TopCourses from "@/components/admin/dashboard/TopCourses";
import ConsoleHero, { HERO_OUTLINE } from "@/components/shared/ConsoleHero";
import { Eyebrow } from "@/components/site/code";
import EmptyState from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT } from "@/lib/utils";
import { notificationService } from "@/services";
import { adminService } from "@/services/admin";
import type { AdminDashboard } from "@/types/admin.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/**
 * The admin dashboard, in the order an admin works through it: what's
 * waiting on them (in the hero, under the greeting), how the last 30 days
 * went against the 30 before, the latest activity, how each course is doing
 * — and the all-time totals last, quietly, for reference.
 */
export default function AdminDashboardPage() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["admin", "dashboard"],
        queryFn: adminService.dashboard,
    });
    // Shared with the sidebar badge, so it's one request between them.
    const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: notificationService.unreadCount });

    const needs = data && {
        pendingOrders: data.pendingOrders,
        waitingStudents: data.summary.waitingStudents,
        liveSessions: data.summary.activeSupportSessions,
        unread: unread.data?.count ?? 0,
    };
    const needCount = needs ? needsYouCount(needs) : 0;

    return (
        <div className="space-y-6">
            <ConsoleHero
                className={RISE}
                description="Here's what's waiting on you, and how the platform is doing."
                actions={
                    <>
                        <Button asChild variant="outline" className={HERO_OUTLINE}>
                            <Link href="/admin/broadcast">
                                <Send /> Broadcast
                            </Link>
                        </Button>
                        <Button asChild variant="brand">
                            <Link href="/admin/courses?new=1">
                                <Plus /> New course
                            </Link>
                        </Button>
                    </>
                }
                status={
                    needs && (
                        <span className="flex items-center gap-1.5">
                            <span aria-hidden className={cn("size-1.5 rounded-full", needCount ? "bg-syn-number" : "bg-syn-string")} />
                            {needCount ? `${needCount} ${needCount === 1 ? "thing needs" : "things need"} you` : "All clear"}
                        </span>
                    )
                }
            >
                {needs ? (
                    <NeedsYou {...needs} />
                ) : (
                    isLoading && (
                        <div className="space-y-3 border-t border-editor-line px-6 py-5 sm:px-8" aria-busy>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-12" />
                        </div>
                    )
                )}
            </ConsoleHero>

            {isLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-96 rounded-card" />
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <Skeleton className="h-80 rounded-card" />
                        <Skeleton className="h-80 rounded-card" />
                    </div>
                </div>
            ) : isError || !data ? (
                <EmptyState
                    title="Couldn't load the dashboard."
                    description="Check your connection and try again."
                    action={
                        <Button variant="outline" onClick={() => refetch()}>
                            Try again
                        </Button>
                    }
                />
            ) : (
                <Board data={data} />
            )}
        </div>
    );
}

function Board({ data }: { data: AdminDashboard }) {
    const { summary } = data;

    return (
        <>
            <div className={RISE} style={{ animationDelay: "120ms" }}>
                <PeriodPanel data={data} />
            </div>

            {/* Wide screens: courses with the all-time totals under them, and the
                activity feed down the side of both — so neither column is left with
                a block of empty space. Narrow screens keep this order top to bottom.
                The 1fr second row takes whatever height the feed needs beyond the courses. */}
            <div
                className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:grid-rows-[auto_1fr]", RISE)}
                style={{ animationDelay: "180ms" }}
            >
                <TopCourses courses={data.topCourses} />
                <ActivityFeed data={data} className="xl:col-start-2 xl:row-span-2 xl:row-start-1" />

                {/* All time, for reference — quiet, each figure opening its screen. */}
                <section aria-labelledby="all-time-title" className="xl:col-start-1 xl:row-start-2 xl:self-start">
                    <h2 id="all-time-title" className="mb-2">
                        <Eyebrow>All time</Eyebrow>
                    </h2>
                    {/* 1px gaps over the border colour draw the dividers at every column count. */}
                    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-3">
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
                        <Total
                            href="/admin/certificates"
                            label="Certificates"
                            value={summary.certificates.toLocaleString("en-US")}
                            hint="issued"
                        />
                    </ul>
                </section>
            </div>
        </>
    );
}

function Total({ href, label, value, hint }: { href: string; label: string; value: ReactNode; hint?: string }) {
    return (
        <li className="bg-card">
            <Link href={href} className="group block h-full px-5 py-4 transition-colors hover:bg-surface">
                <span className="block text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
                <span className="mt-1 block font-mono text-xl font-bold tracking-tight tabular-nums">{value}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </Link>
        </li>
    );
}
