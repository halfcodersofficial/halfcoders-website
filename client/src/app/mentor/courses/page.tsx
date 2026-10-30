"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import MentorCourseCard from "@/components/mentor/MentorCourseCard";
import { plural } from "@/components/mentor/dashboard/time";
import EmptyState from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { useNow } from "@/hooks/useNow";
import { dashboardService } from "@/services";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/**
 * Every course this mentor teaches, as a card each — from the dashboard's own
 * query, so it's one request between them. A course opens on its overview,
 * where its tabs lead to everything else.
 */
export default function MentorCoursesPage() {
    const now = useNow(60_000);
    const [term, setTerm] = useState("");
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });

    if (isLoading) {
        return (
            <div className="container-page space-y-6 py-8 sm:py-10">
                <Skeleton className="h-12 w-64" />
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-96 rounded-card" />
                    ))}
                </div>
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="container-page py-16 text-center">
                <p className="font-medium">Couldn&apos;t load your courses.</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    const { courses } = data;
    const students = courses.reduce((sum, course) => sum + course.stats.students, 0);
    const shown = term.trim() ? courses.filter((course) => course.title.toLowerCase().includes(term.trim().toLowerCase())) : courses;

    return (
        <div className="container-page space-y-6 py-8 sm:py-10">
            <header className={`flex flex-wrap items-end justify-between gap-4 ${RISE}`}>
                <div className="min-w-0">
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My courses</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                        {courses.length === 0 ? (
                            "Nothing assigned yet."
                        ) : (
                            <>
                                {plural(courses.length, "course")} you teach ·{" "}
                                <span className="font-medium text-foreground">{plural(students, "student")}</span> enrolled
                                {data.summary.pendingSubmissions > 0 && (
                                    <>
                                        {" "}
                                        ·{" "}
                                        <Link href="/mentor/reviews" className="font-medium text-primary hover:underline">
                                            {plural(data.summary.pendingSubmissions, "hand-in")} to review
                                        </Link>
                                    </>
                                )}
                            </>
                        )}
                    </p>
                </div>
                {courses.length > 6 && (
                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Find a course" aria-label="Find a course" className="pl-9" />
                    </div>
                )}
            </header>

            {courses.length === 0 ? (
                <EmptyState
                    className={RISE}
                    icon={BookOpen}
                    title="No courses assigned yet"
                    description="An admin assigns you to the courses you teach. Each one shows up here, with its content, schedule and results a click away."
                />
            ) : shown.length === 0 ? (
                <EmptyState title={`No course matches “${term.trim()}”.`} description="Try a shorter word, or clear the search." />
            ) : (
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((course, index) => (
                        <li key={course.id} className={RISE} style={{ animationDelay: `${60 + index * 50}ms` }}>
                            <MentorCourseCard course={course} now={now} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
