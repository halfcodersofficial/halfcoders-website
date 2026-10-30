"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarPlus } from "lucide-react";
import Link from "next/link";
import CourseRows from "@/components/mentor/dashboard/CourseRows";
import LatestSubmissions from "@/components/mentor/dashboard/LatestSubmissions";
import MentorPeriod from "@/components/mentor/dashboard/MentorPeriod";
import ReviewPanel from "@/components/mentor/dashboard/ReviewPanel";
import SupportStage from "@/components/mentor/dashboard/SupportStage";
import WeekAgenda from "@/components/mentor/dashboard/WeekAgenda";
import ConsoleHero from "@/components/shared/ConsoleHero";
import EmptyState from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services";
import type { MentorDashboard } from "@/types/mentor.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The mentor dashboard, in the order a mentor works through it: the support
 * desk and the review queue side by side, the week ahead, each course, the
 * latest hand-ins — and their own last 30 days at the foot. Students appear
 * by name only, on their work.
 */
export default function MentorDashboardPage() {
    // The sidebar's review badge reads this same query, so it's one request.
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["dashboard", "mentor"],
        queryFn: dashboardService.mentor,
        // Hand-ins and queues move while the page sits open.
        refetchInterval: 60_000,
    });

    return (
        <div className="container-page space-y-6 py-8 sm:py-10">
            <ConsoleHero
                className={RISE}
                description="Your support desk, your review queue and the week ahead."
                actions={
                    data &&
                    data.courses.length > 0 && (
                        <Button asChild variant="brand">
                            <Link href="/mentor/support?new=1">
                                <CalendarPlus /> Schedule session
                            </Link>
                        </Button>
                    )
                }
                status={
                    data && (
                        <>
                            <span className="flex items-center gap-1.5">
                                <span
                                    aria-hidden
                                    className={cn("size-1.5 rounded-full", data.summary.pendingSubmissions ? "bg-syn-number" : "bg-syn-string")}
                                />
                                {data.summary.pendingSubmissions
                                    ? `${plural(data.summary.pendingSubmissions, "hand-in", "hand-ins")} to review`
                                    : "Review queue clear"}
                            </span>
                            <span className="hidden sm:inline">{plural(data.courses.length, "course", "courses")}</span>
                        </>
                    )
                }
            />

            {isLoading ? (
                <div className="space-y-6" aria-busy>
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <Skeleton className="h-96 rounded-panel" />
                        <Skeleton className="h-96 rounded-panel" />
                    </div>
                    <Skeleton className="h-64 rounded-card" />
                    <Skeleton className="h-80 rounded-card" />
                </div>
            ) : isError || !data ? (
                <EmptyState
                    title="Couldn't load your dashboard."
                    description="Check your connection and try again."
                    action={
                        <Button variant="outline" onClick={() => refetch()}>
                            Try again
                        </Button>
                    }
                />
            ) : data.courses.length === 0 && data.upcomingSupport.length === 0 ? (
                <NotAssigned />
            ) : (
                <Board data={data} />
            )}
        </div>
    );
}

function Board({ data }: { data: MentorDashboard }) {
    // Waits and the agenda's now-line read off one clock.
    const now = useNow(30_000);

    return (
        <>
            <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]", RISE)} style={{ animationDelay: "60ms" }}>
                <SupportStage sessions={data.upcomingSupport} />
                <ReviewPanel pending={data.summary.pendingSubmissions} waiting={data.waitingReviews} now={now} />
            </div>

            <div className={RISE} style={{ animationDelay: "120ms" }}>
                <WeekAgenda agenda={data.agenda} now={now} />
            </div>

            <div className={RISE} style={{ animationDelay: "180ms" }}>
                {data.courses.length > 0 ? (
                    <CourseRows courses={data.courses} now={now} />
                ) : (
                    <EmptyState title="You're no longer assigned to a course." description="Your sessions above still run." />
                )}
            </div>

            <div className={RISE} style={{ animationDelay: "240ms" }}>
                <LatestSubmissions submissions={data.recentSubmissions} />
            </div>

            <div className={RISE} style={{ animationDelay: "300ms" }}>
                <MentorPeriod period={data.period} trend={data.trend} />
            </div>
        </>
    );
}

/** Before an admin assigns them anything, there's nothing to run — say so, once. */
function NotAssigned() {
    return (
        <EmptyState
            className={RISE}
            icon={BookOpen}
            title="No courses assigned yet"
            description="An admin assigns you to the courses you teach. They'll appear here with your review queue, your support sessions and the week ahead."
            action={
                <Button asChild variant="brand-outline">
                    <Link href="/mentor/profile">Set up how students see you</Link>
                </Button>
            }
        />
    );
}
