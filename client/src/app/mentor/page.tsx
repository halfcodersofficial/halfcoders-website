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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services";
import type { MentorDashboard } from "@/types/mentor.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const today = () =>
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" });

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
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                        {today()}
                    </p>
                    <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
                </div>
                {data && data.courses.length > 0 && (
                    <Button asChild variant="brand-outline">
                        <Link href="/mentor/support?new=1">
                            <CalendarPlus /> Schedule session
                        </Link>
                    </Button>
                )}
            </header>

            {isLoading ? (
                <div className="space-y-6" aria-busy>
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <Skeleton className="h-96 rounded-3xl" />
                        <Skeleton className="h-96 rounded-3xl" />
                    </div>
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            ) : isError || !data ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load your dashboard.</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
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
                    <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                        You&apos;re no longer assigned to a course — your sessions above still run.
                    </p>
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
        <section className={cn("relative isolate overflow-hidden rounded-3xl border border-border bg-brand-soft px-6 py-16 text-center", RISE)}>
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 size-64 rounded-full bg-primary/10 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 -z-10 size-56 rounded-full bg-accent/15 blur-2xl" />
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
                <BookOpen className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight">No courses assigned yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                An admin assigns you to the courses you teach. They&apos;ll appear here with your review queue, your
                support sessions and the week ahead.
            </p>
            <Button asChild variant="brand-outline" className="mt-6">
                <Link href="/mentor/profile">Set up how students see you</Link>
            </Button>
        </section>
    );
}
