"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { formatDate } from "@/lib/utils";
import { enrollmentService } from "@/services";

/**
 * Student progress for one course (plan §21). Mounted by both consoles;
 * `area` keeps its links inside the one the reader is in.
 */
export default function CourseStudents({
    courseId,
    area,
}: {
    courseId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["staff", "students", courseId, searchTerm, page],
        queryFn: () =>
            enrollmentService.courseStudents(courseId, {
                searchTerm: searchTerm || undefined,
                page,
                limit: 25,
            }),
    });

    if (isError) {
        return (
            <div className="container-page grid min-h-[50dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this course</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "You may not be assigned to it.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.home}>Back</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const students = data?.data ?? [];
    const meta = data?.meta;

    return (
        <div className="container-page max-w-4xl space-y-6 py-10">
            <header className="flex flex-wrap items-start gap-x-3 gap-y-4">
                <div className="basis-full">
                    <BackButton href={routes.courses} label="All courses" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Student progress</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {meta ? `${meta.total} enrolled` : "Everyone enrolled on this course"}
                    </p>
                </div>
            </header>

            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    setSearchTerm(searchInput.trim());
                    setPage(1);
                }}
            >
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search by name or email…"
                        className="pl-9"
                        aria-label="Search students"
                    />
                </div>
                <Button type="submit" variant="outline">Search</Button>
            </form>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-20" />
                    ))}
                </div>
            ) : students.length === 0 ? (
                <Card className="shadow-sm">
                    <CardContent className="py-16 text-center">
                        <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
                        <p className="font-medium">
                            {searchTerm ? "No students match that search." : "Nobody has enrolled yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {students.map((enrollment) => (
                        <Card key={enrollment.id} className="shadow-sm transition-colors hover:border-primary/30">
                            <CardContent className="flex flex-wrap items-center gap-4 p-5">
                                <Avatar
                                    src={enrollment.student.image}
                                    name={enrollment.student.name}
                                    size={40}
                                />

                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">{enrollment.student.name}</p>
                                        <Badge
                                            variant={
                                                enrollment.status === "COMPLETED"
                                                    ? "success"
                                                    : enrollment.status === "ACTIVE"
                                                        ? "secondary"
                                                        : "destructive"
                                            }
                                        >
                                            {enrollment.status}
                                        </Badge>
                                    </div>

                                    <p className="truncate text-xs text-muted-foreground">
                                        {enrollment.student.email} · started{" "}
                                        {formatDate(enrollment.startedAt)}
                                    </p>

                                    {/* Where they actually are, not just a percentage —
                                        it's what a mentor needs before a support call. */}
                                    {enrollment.currentMilestone && (
                                        <p className="truncate text-xs text-muted-foreground">
                                            Milestone{" "}
                                            {String(enrollment.currentMilestone.order).padStart(2, "0")}
                                            {enrollment.currentModule &&
                                                ` · Module ${String(enrollment.currentModule.order).padStart(2, "0")} — ${enrollment.currentModule.title}`}
                                        </p>
                                    )}

                                    <div className="flex max-w-sm items-center gap-2">
                                        <Progress value={enrollment.progress} className="h-1.5" />
                                        <span className="shrink-0 text-xs font-medium">
                                            {enrollment.progress}%
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right text-xs text-muted-foreground">
                                    <p className="inline-flex items-center gap-1">
                                        <ClipboardCheck className="size-3" />
                                        {enrollment._count?.submissions ?? 0} submitted
                                    </p>
                                    <p>{enrollment._count?.practiceCompletions ?? 0} practice done</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {meta && meta.totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="px-3 text-sm text-muted-foreground">
                        Page {meta.page} of {meta.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </nav>
            )}
        </div>
    );
}
