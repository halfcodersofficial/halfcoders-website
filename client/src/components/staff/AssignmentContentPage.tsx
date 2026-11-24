"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardCheck, Eye, EyeOff, HelpCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import LessonMaterialsEditor, { type MaterialsApi } from "@/components/staff/LessonMaterialsEditor";
import { pickerTileClass } from "@/components/staff/lessonForms";
import { quizQueryKey } from "@/components/staff/ModuleQuizEditor";
import WeekItemPager from "@/components/staff/WeekItemPager";
import { AssignmentModal } from "@/components/staff/WeekItemModals";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * One assignment, opened from its row in the Module Manager — the brief, and
 * what comes with it: lessons (videos, texts, links), built the same way a
 * module's are, and a quiz if it has one. Students open the lessons one by
 * one, take the quiz, then hand in their work.
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

    // Its quiz, if it has one — the quiz page's own query.
    const { data: quiz } = useQuery({
        queryKey: quizQueryKey({ assignmentId }),
        queryFn: () => curriculumAuthoring.getAssignmentQuiz(assignmentId),
    });

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
                <WeekItemPager courseId={courseId} area={area} kind="ASSIGNMENT" id={assignmentId} />
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

                {assignment.deadline && assignment.lateTiers.length > 0 && (
                    <div className="border-t border-border pt-4 text-sm text-muted-foreground">
                        <h2 className="mb-1 font-semibold text-foreground">Marking</h2>
                        By {formatDateTime(assignment.deadline)}: out of {assignment.totalMarks}
                        {assignment.lateTiers.map((tier) => (
                            <span key={tier.until}>
                                {" "}· by {formatDateTime(tier.until)}: out of {tier.maxMarks}
                            </span>
                        ))}{" "}
                        · after that, still out of {assignment.lateTiers[assignment.lateTiers.length - 1].maxMarks} — submissions close only when the
                        batch ends (the course moves to Previous).
                    </div>
                )}
            </section>

            <LessonMaterialsEditor
                queryKey={["assignment-materials", assignmentId]}
                api={materialsApi}
                intro="Anything students should watch, read or open before submitting — and a quiz, if you want one."
                listNote="students open them one by one, then hand in their work"
                emptyTitle="No lessons for this assignment yet"
                // The week's row shows a lesson count.
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] })}
                extraTile={
                    // The assignment's one quiz: added and edited on its own page.
                    <Link href={routes.assignmentQuiz(assignmentId)} className={pickerTileClass(false)}>
                        {quiz ? (
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        ) : (
                            <HelpCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">Quiz</span>
                            <span className="block text-xs text-muted-foreground">
                                {quiz
                                    ? `Added · ${quiz.questions.length} question${quiz.questions.length === 1 ? "" : "s"} — edit it`
                                    : "Questions to check what they learned"}
                            </span>
                        </span>
                    </Link>
                }
                footer={
                    quiz && (
                        <div className="flex items-center gap-x-3 px-3 py-3 sm:px-4">
                            <span className="w-2" aria-hidden />
                            <HelpCircle className="size-4 shrink-0 text-primary" aria-label="Quiz" />
                            <div className="min-w-0 flex-1">
                                <Link href={routes.assignmentQuiz(assignmentId)} className="block truncate text-sm font-medium hover:underline">
                                    Quiz: {quiz.title}
                                </Link>
                                <p className="truncate text-xs text-muted-foreground">
                                    {quiz.isPublished ? "Live" : "Draft"} · {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} ·
                                    taken after the lessons, before the hand-in
                                </p>
                            </div>
                            <Button asChild size="sm" variant="outline">
                                <Link href={routes.assignmentQuiz(assignmentId)}>
                                    <Pencil /> <span className="max-sm:sr-only">Edit</span>
                                </Link>
                            </Button>
                        </div>
                    )
                }
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
