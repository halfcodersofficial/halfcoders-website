"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ClipboardCheck, Eye, EyeOff, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import LessonMaterialsEditor, { type MaterialsApi } from "@/components/staff/LessonMaterialsEditor";
import RubricEditor from "@/components/staff/RubricEditor";
import { AssignmentModal } from "@/components/staff/WeekItemModals";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * One assignment, opened from its row in the Module Manager — the brief and
 * instructions, and the lessons that come with it (videos, texts, links),
 * built the same way a module's are. Students see all of it together, above
 * their submission box.
 */
export default function AssignmentContentPage({
    courseId,
    assignmentId,
    area,
}: {
    courseId: string;
    assignmentId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { data: course } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    // The assignment itself comes from the same curriculum query the Module
    // Manager uses — arriving from there costs no extra request.
    const { data: milestones, isLoading, isError, error } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    const materialsApi = useMemo<MaterialsApi>(
        () => ({
            list: () => curriculumAuthoring.listAssignmentMaterials(assignmentId),
            create: (input) => curriculumAuthoring.createAssignmentMaterial({ assignmentId, ...input }),
            update: (id, payload) => curriculumAuthoring.updateAssignmentMaterial(id, payload),
            remove: (id) => curriculumAuthoring.deleteAssignmentMaterial(id),
            reorder: (orderedIds) => curriculumAuthoring.reorderAssignmentMaterials(assignmentId, orderedIds),
        }),
        [assignmentId],
    );

    const milestone = milestones?.find((m) => m.assignments.some((a) => a.id === assignmentId)) ?? null;
    const assignment = milestone?.assignments.find((a) => a.id === assignmentId) ?? null;

    const togglePublished = useMutation({
        mutationFn: (next: boolean) => curriculumAuthoring.updateAssignment(assignmentId, { isPublished: next }),
        onSuccess: async (_result, next) => {
            await queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] });
            toast.success(next ? "Assignment published." : "Assignment hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that assignment.")),
    });

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !assignment || !milestone) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this assignment</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "It may have been deleted, or you may not be assigned to this course.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.modules}>Back to the Module Manager</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const milestoneLabel = course?.milestoneLabel ?? "Milestone";

    return (
        <div className="w-full space-y-6">
            <header className="flex flex-wrap items-start gap-x-3 gap-y-4">
                <div className="basis-full">
                    <BackButton href={routes.modules} label="Module Manager" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold font-mono uppercase tracking-wider text-primary">
                        {milestoneLabel} {pad(milestone.order)} · Assignment
                    </p>
                    <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{assignment.title}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span
                            className={cn(
                                "rounded-sm px-2 py-px text-xs font-semibold",
                                assignment.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                            )}
                        >
                            {assignment.isPublished ? "Live" : "Draft"}
                        </span>
                        <span>Out of {assignment.totalMarks}</span>
                        {assignment.deadline && (
                            <>
                                <span aria-hidden>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <CalendarClock className="size-3.5" aria-hidden /> Due {formatDateTime(assignment.deadline)}
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="brand-outline" onClick={() => setDetailsOpen(true)}>
                        <Pencil /> Edit details
                    </Button>
                    <Button
                        variant={assignment.isPublished ? "ghost" : "default"}
                        isLoading={togglePublished.isPending}
                        onClick={() => togglePublished.mutate(!assignment.isPublished)}
                    >
                        {!togglePublished.isPending && (assignment.isPublished ? <EyeOff /> : <Eye />)}
                        {assignment.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                </div>
            </header>

            <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
                <div>
                    <h2 className="mb-1 flex items-center gap-2 font-semibold">
                        <ClipboardCheck className="size-4" /> What the student has to do
                    </h2>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{assignment.description}</p>
                </div>

                <div className="border-t border-border pt-4">
                    <h2 className="mb-1 font-semibold">Instructions</h2>
                    {assignment.instructions ? (
                        <div
                            className="text-sm leading-relaxed text-muted-foreground"
                            // Escaped and link-restricted by renderLightMarkdown.
                            dangerouslySetInnerHTML={{ __html: renderLightMarkdown(assignment.instructions) }}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            None yet —{" "}
                            <button type="button" onClick={() => setDetailsOpen(true)} className="font-medium text-primary hover:underline">
                                add step-by-step instructions
                            </button>
                            .
                        </p>
                    )}
                </div>

                {assignment.deadline && assignment.lateTiers.length > 0 && (
                    <div className="border-t border-border pt-4 text-sm text-muted-foreground">
                        <h2 className="mb-1 font-semibold text-foreground">Marking</h2>
                        By {formatDateTime(assignment.deadline)}: out of {assignment.totalMarks}
                        {assignment.lateTiers.map((tier) => (
                            <span key={tier.until}>
                                {" "}· by {formatDateTime(tier.until)}: out of {tier.maxMarks}
                            </span>
                        ))}{" "}
                        · then submissions close.
                    </div>
                )}
            </section>

            <RubricEditor assignmentId={assignmentId} />

            <LessonMaterialsEditor
                queryKey={["assignment-materials", assignmentId]}
                api={materialsApi}
                intro="Anything students should watch, read or open before submitting."
                listNote="students see them with the brief, above their hand-in"
                emptyTitle="No lessons for this assignment yet"
                // The week's row shows a lesson count.
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] })}
            />

            <AssignmentModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                milestone={milestone}
                milestoneLabel={milestoneLabel}
                assignment={assignment}
                onSaved={() => void queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] })}
            />
        </div>
    );
}
