"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Eye, EyeOff, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import LessonMaterialsEditor, { type MaterialsApi } from "@/components/staff/LessonMaterialsEditor";
import { PracticeDayModal } from "@/components/staff/WeekItemModals";
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
 * One practice day, opened from its row in the Module Manager — what to do
 * (its summary and step-by-step instructions) and the lessons that come with
 * it: videos, texts and links, built exactly the way a module's and an
 * assignment's are. Students see it all on the practice day, above the button
 * that marks it done.
 */
export default function PracticeContentPage({
    courseId,
    practiceDayId,
    area,
}: {
    courseId: string;
    practiceDayId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { data: course } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    // The practice day itself comes from the same curriculum query the Module
    // Manager uses — arriving from there costs no extra request.
    const { data: milestones, isLoading, isError, error } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    const materialsApi = useMemo<MaterialsApi>(
        () => ({
            list: () => curriculumAuthoring.listPracticeMaterials(practiceDayId),
            create: (input) => curriculumAuthoring.createPracticeMaterial({ practiceDayId, ...input }),
            update: (id, payload) => curriculumAuthoring.updatePracticeMaterial(id, payload),
            remove: (id) => curriculumAuthoring.deletePracticeMaterial(id),
            reorder: (orderedIds) => curriculumAuthoring.reorderPracticeMaterials(practiceDayId, orderedIds),
        }),
        [practiceDayId],
    );

    const milestone = milestones?.find((m) => m.practiceDays.some((p) => p.id === practiceDayId)) ?? null;
    const practice = milestone?.practiceDays.find((p) => p.id === practiceDayId) ?? null;

    const refreshCurriculum = () => queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] });

    const togglePublished = useMutation({
        mutationFn: (next: boolean) => curriculumAuthoring.updatePracticeDay(practiceDayId, { isPublished: next }),
        onSuccess: async (_result, next) => {
            await refreshCurriculum();
            toast.success(next ? "Practice day published." : "Practice day hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that practice day.")),
    });

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !practice || !milestone) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this practice day</p>
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
                        {milestoneLabel} {pad(milestone.order)} · Practice day
                    </p>
                    <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{practice.title}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span
                            className={cn(
                                "rounded-sm px-2 py-px text-xs font-semibold",
                                practice.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                            )}
                        >
                            {practice.isPublished ? "Live" : "Draft"}
                        </span>
                        {!practice.isPublished && practice.releaseAt && <span>Publishes {formatDateTime(practice.releaseAt)}</span>}
                        <span aria-hidden>·</span>
                        <span>Students mark it done themselves — nothing to hand in</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="brand-outline" onClick={() => setDetailsOpen(true)}>
                        <Pencil /> Edit details
                    </Button>
                    <Button
                        variant={practice.isPublished ? "ghost" : "default"}
                        isLoading={togglePublished.isPending}
                        onClick={() => togglePublished.mutate(!practice.isPublished)}
                    >
                        {!togglePublished.isPending && (practice.isPublished ? <EyeOff /> : <Eye />)}
                        {practice.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                </div>
            </header>

            <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
                <div>
                    <h2 className="mb-1 flex items-center gap-2 font-semibold">
                        <Dumbbell className="size-4" /> What to practise
                    </h2>
                    {practice.description ? (
                        <p className="whitespace-pre-line text-sm text-muted-foreground">{practice.description}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No summary — the instructions below speak for it.</p>
                    )}
                </div>

                <div className="border-t border-border pt-4">
                    <h2 className="mb-1 font-semibold">Instructions</h2>
                    {practice.instructions ? (
                        <div
                            className="text-sm leading-relaxed text-muted-foreground"
                            // Escaped and link-restricted by renderLightMarkdown.
                            dangerouslySetInnerHTML={{ __html: renderLightMarkdown(practice.instructions) }}
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
            </section>

            <LessonMaterialsEditor
                queryKey={["practice-materials", practiceDayId]}
                api={materialsApi}
                intro="Videos to watch, notes to read and links to open while practising — the same three a module's lessons are."
                listNote="students see them on the practice day, above “Mark as complete”"
                emptyTitle="No lessons for this practice day yet"
                // The week's row shows a lesson count.
                onChanged={refreshCurriculum}
            />

            <PracticeDayModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                milestone={milestone}
                milestoneLabel={milestoneLabel}
                practice={practice}
                onSaved={() => void refreshCurriculum()}
            />
        </div>
    );
}
