"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import MentorCourseCard from "@/components/mentor/MentorCourseCard";
import { plural } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
                        <Skeleton key={index} className="h-96 rounded-2xl" />
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
                    <h1 className="text-2xl font-bold sm:text-3xl">My courses</h1>
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
                <section className={`relative isolate overflow-hidden rounded-3xl border border-border bg-brand-soft px-6 py-16 text-center ${RISE}`}>
                    <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 size-64 rounded-full bg-primary/10 blur-2xl" />
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
                        <BookOpen className="size-6" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-xl font-bold tracking-tight">No courses assigned yet</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        An admin assigns you to the courses you teach. Each one shows up here, with its content, schedule and results a click away.
                    </p>
                </section>
            ) : shown.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No course matches “{term.trim()}”.</p>
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
