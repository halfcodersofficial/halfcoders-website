"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { curriculumAuthoring } from "@/services/curriculum";
import CurriculumPdfCard from "@/components/admin/CurriculumPdfCard";

/**
 * The pre-enrolment roadmap PDF, on its own page — what a prospective student
 * downloads before joining, entirely separate from both the planned outline
 * students read once they're in (`OutlineMakerPage`) and the real modules
 * (`ModuleManagerPage`).
 *
 * Mounted by both consoles; the API scopes mentors to their own assigned
 * courses the same way it does for every other staff route.
 */
export default function PreEnrollmentOutlinePage({
    courseId,
    area,
}: {
    courseId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();

    const { data: course, isLoading, isError, error } = useQuery({
        queryKey: ["staff", "course-detail", courseId],
        queryFn: () => curriculumAuthoring.getCourseDetail(courseId),
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["staff", "course-detail", courseId] });
        void queryClient.invalidateQueries({ queryKey: ["staff", "course", courseId] });
    };

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !course) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
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

    return (
        <div className="w-full space-y-6">
            <header className="flex flex-wrap items-start gap-x-3 gap-y-4">
                {/* In the mentor console the course's own tab bar does this. */}
                {area === "admin" && (
                    <div className="basis-full">
                        <BackButton href={routes.courses} label="All courses" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Pre-enrolment outline</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {course.title} — what students see before they enrol.
                    </p>
                </div>
            </header>

            <CurriculumPdfCard
                courseId={courseId}
                curriculumPdfUrl={course.curriculumPdfUrl}
                curriculumPdfFileName={course.curriculumPdfFileName}
                curriculumPdfUpdatedAt={course.curriculumPdfUpdatedAt}
                onChanged={refresh}
            />
        </div>
    );
}
