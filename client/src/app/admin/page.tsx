"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, GraduationCap, Plus, RotateCw, Send, UserCog, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ActivityFeed from "@/components/admin/dashboard/ActivityFeed";
import NeedsYou, { needsYouCount, type NeedsYouProps } from "@/components/admin/dashboard/NeedsYou";
import Panel from "@/components/admin/dashboard/Panel";
import PeriodPanel from "@/components/admin/dashboard/PeriodPanel";
import TopCourses from "@/components/admin/dashboard/TopCourses";
import ConsoleHero, { HERO_OUTLINE } from "@/components/shared/ConsoleHero";
import EmptyState from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { cn, formatBDT } from "@/lib/utils";
import { notificationService } from "@/services";
import { adminService } from "@/services/admin";
import type { AdminDashboard } from "@/types/admin.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * The admin dashboard, in the order an admin works through it: what's
 * waiting on them (in the hero, under the greeting), how the last 30 days
 * went against the 30 before, how each course is doing beside the latest
 * activity — and the all-time totals last, quietly, for reference.
 *
 * It keeps itself current: every minute while it's open, on coming back to
 * the tab, and on a push (lib/liveRefresh) — the hero says when it last did.
 */
export default function AdminDashboardPage() {
    const dashboard = useQuery({
        queryKey: ["admin", "dashboard"],
        queryFn: adminService.dashboard,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    // Each shared with the screen it counts for (and the sidebar badge), so it's one request between them.
    const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: notificationService.unreadCount });
    const refunds = useQuery({
        queryKey: ["admin", "refunds", "counts"],
        queryFn: adminService.refundRequestCounts,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const reviews = useQuery({
        queryKey: ["admin", "course-reviews", "counts"],
        queryFn: adminService.courseReviewCounts,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });

    const { data, isLoading } = dashboard;
    const needs: NeedsYouProps | undefined = data && {
        pendingOrders: data.pendingOrders,
        refunds: refunds.data?.PENDING ?? 0,
        waitingStudents: data.summary.waitingStudents,
        liveSessions: data.summary.activeSupportSessions,
        reviews: reviews.data?.PENDING ?? 0,
        unread: unread.data?.count ?? 0,
    };
    const needCount = needs ? needsYouCount(needs) : 0;
    const today = data?.trend.at(-1);

    const refreshing = dashboard.isFetching || refunds.isFetching || reviews.isFetching || unread.isFetching;
    const refresh = () => Promise.all([dashboard.refetch(), unread.refetch(), refunds.refetch(), reviews.refetch()]);

    return (
        <div className="space-y-6">
            <ConsoleHero
                className={RISE}
                description="Here's what's waiting on you, and how the platform is doing."
                toolbar={data && <Freshness updatedAt={dashboard.dataUpdatedAt} refreshing={refreshing} onRefresh={refresh} />}
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
                        <>
                            <span className="flex items-center gap-1.5">
                                <span aria-hidden className={cn("size-1.5 rounded-full", needCount ? "bg-syn-number" : "bg-syn-string")} />
                                {needCount ? `${plural(needCount, "thing needs", "things need")} you` : "All clear"}
                            </span>
                            {today && (
                                <span className="hidden truncate sm:inline">
                                    Today: {formatBDT(today.revenue)} · {plural(today.enrolments, "enrolment")} · {plural(today.learners, "new learner")}
                                </span>
                            )}
                        </>
                    )
                }
            >
                {needs ? (
                    <NeedsYou {...needs} />
                ) : (
                    isLoading && (
                        <div className="space-y-3 border-t border-editor-line px-6 pb-6 pt-4 sm:px-8" aria-busy>
                            <Skeleton className="h-3 w-20" />
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Skeleton className="h-36 rounded-md" />
                                <Skeleton className="h-36 rounded-md max-sm:hidden" />
                                <Skeleton className="h-36 rounded-md max-sm:hidden" />
                            </div>
                        </div>
                    )
                )}
            </ConsoleHero>

            {isLoading ? (
                <div className="space-y-6" aria-busy>
                    <Skeleton className="h-120 rounded-panel" />
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
                        <Skeleton className="h-96 rounded-panel" />
                        <Skeleton className="h-96 rounded-panel" />
                    </div>
                </div>
            ) : !data ? (
                // Only when there's nothing to show: a failed background refresh keeps the last good figures up.
                <EmptyState
                    title="Couldn't load the dashboard."
                    description="Check your connection and try again."
                    action={
                        <Button variant="outline" onClick={() => dashboard.refetch()}>
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

/** "Updated 3 min ago", in the hero's tab strip — and the button to do it now. */
function Freshness({ updatedAt, refreshing, onRefresh }: { updatedAt: number; refreshing: boolean; onRefresh: () => void }) {
    const now = useNow(30_000);
    const minutes = Math.max(0, Math.floor((now - updatedAt) / 60_000));
    const text = minutes < 1 ? "Updated just now" : minutes < 60 ? `Updated ${minutes} min ago` : `Updated ${Math.floor(minutes / 60)} h ago`;

    return (
        <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh the dashboard"
            className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 font-mono text-[0.7rem] text-editor-muted transition-colors hover:bg-editor-raised hover:text-editor-fg disabled:cursor-default disabled:hover:bg-transparent"
        >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden />
            <span className="max-sm:sr-only">{refreshing ? "Refreshing…" : text}</span>
        </button>
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
            <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:grid-rows-[auto_1fr]", RISE)} style={{ animationDelay: "180ms" }}>
                <TopCourses courses={data.topCourses} />
                <ActivityFeed data={data} className="xl:col-start-2 xl:row-span-2 xl:row-start-1" />

                {/* All time, for reference — quiet, each figure opening its screen. */}
                <Panel id="all-time-title" title="All time" file="totals.json" className="xl:col-start-1 xl:row-start-2 xl:self-start">
                    {/* 1px gaps over the border colour draw the dividers at every column count. */}
                    <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                        <Total href="/admin/students" icon={Users} label="Students" value={summary.totalStudents.toLocaleString("en-US")} />
                        <Total href="/admin/mentors" icon={UserCog} label="Mentors" value={summary.totalMentors.toLocaleString("en-US")} />
                        <Total
                            href="/admin/courses"
                            icon={BookOpen}
                            label="Courses"
                            value={summary.publishedCourses.toLocaleString("en-US")}
                            hint={`published, of ${summary.totalCourses}`}
                        />
                        <Total
                            href="/admin/enrollments"
                            icon={GraduationCap}
                            label="Enrolments"
                            value={summary.totalEnrollments.toLocaleString("en-US")}
                            hint={`${summary.completedEnrollments.toLocaleString("en-US")} completed`}
                        />
                        <Total href="/admin/orders" icon={Wallet} label="Revenue" value={formatBDT(summary.totalRevenue)} hint="settled orders" />
                        <Total
                            href="/admin/certificates"
                            icon={Award}
                            label="Certificates"
                            value={summary.certificates.toLocaleString("en-US")}
                            hint="issued"
                        />
                    </ul>
                </Panel>
            </div>
        </>
    );
}

function Total({ href, icon: Icon, label, value, hint }: { href: string; icon: LucideIcon; label: string; value: ReactNode; hint?: string }) {
    return (
        <li className="bg-card">
            <Link href={href} className="group block h-full px-5 py-4 transition-colors hover:bg-surface">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    <Icon className="size-3.5 text-syn-func" aria-hidden />
                    {label}
                </span>
                <span className="mt-1.5 block truncate font-mono text-xl font-bold tracking-tight tabular-nums">{value}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </Link>
        </li>
    );
}
