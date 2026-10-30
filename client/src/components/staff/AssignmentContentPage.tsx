"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ClipboardCheck, Eye, EyeOff, Pencil, PlayCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
    LessonDetail,
    type LessonFields,
    LessonForm,
    LessonTypePicker,
    TYPE_META,
} from "@/components/staff/lessonForms";
import RowActions from "@/components/admin/RowActions";
import RubricEditor from "@/components/staff/RubricEditor";
import { AssignmentModal } from "@/components/staff/WeekItemModals";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";
import type { LessonType } from "@/types/domain.types";
import type { AssignmentMaterial } from "@/types/learning.types";

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

    const [adding, setAdding] = useState<LessonType | null>(null);
    // Remounts the open add form after a save, so it's empty for the next one.
    const [addFormKey, setAddFormKey] = useState(0);
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<AssignmentMaterial | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { data: course } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    // The assignment itself comes from the same curriculum query the Module
    // Manager uses — arriving from there costs no extra request.
    const { data: milestones, isLoading: curriculumLoading } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    const materialsKey = ["assignment-materials", assignmentId];
    const { data: materials, isLoading, isError, error } = useQuery({
        queryKey: materialsKey,
        queryFn: () => curriculumAuthoring.listAssignmentMaterials(assignmentId),
    });

    const milestone = milestones?.find((m) => m.assignments.some((a) => a.id === assignmentId)) ?? null;
    const assignment = milestone?.assignments.find((a) => a.id === assignmentId) ?? null;

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: materialsKey }),
            // The week's row shows a lesson count.
            queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] }),
        ]);

    const create = useMutation({
        mutationFn: ({ type, fields }: { type: LessonType; fields: LessonFields }) =>
            curriculumAuthoring.createAssignmentMaterial({
                assignmentId,
                type,
                title: fields.title,
                description: fields.description || undefined,
                youtubeUrl: fields.youtubeUrl,
                content: fields.content,
                resourceUrl: fields.resourceUrl,
            }),
        onSuccess: async (_result, { type }) => {
            await refresh();
            toast.success(`${TYPE_META[type].label} lesson added.`);
            setAddFormKey((key) => key + 1);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that lesson.")),
    });

    const update = useMutation({
        mutationFn: ({ lesson, fields }: { lesson: AssignmentMaterial; fields: LessonFields }) => {
            const specific =
                lesson.type === "VIDEO"
                    ? { youtubeUrl: fields.youtubeUrl }
                    : lesson.type === "TEXT"
                        ? { content: fields.content }
                        : { resourceUrl: fields.resourceUrl };
            return curriculumAuthoring.updateAssignmentMaterial(lesson.id, {
                title: fields.title,
                description: fields.description,
                ...specific,
            });
        },
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson saved.");
            setEditOpen(false);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that lesson.")),
    });

    const remove = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deleteAssignmentMaterial(id),
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson deleted.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that lesson.")),
    });

    /** Optimistic, like every other list: rows move on drop, the handle spins until saved. */
    const reorder = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderAssignmentMaterials(assignmentId, orderedIds),
        onMutate: async ({ orderedIds }) => {
            await queryClient.cancelQueries({ queryKey: materialsKey });
            const previous = queryClient.getQueryData<AssignmentMaterial[]>(materialsKey);
            if (previous) {
                const byId = new Map(previous.map((m) => [m.id, m]));
                queryClient.setQueryData<AssignmentMaterial[]>(
                    materialsKey,
                    orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                );
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(materialsKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder the lessons."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => refresh(),
    });

    const togglePublished = useMutation({
        mutationFn: (next: boolean) => curriculumAuthoring.updateAssignment(assignmentId, { isPublished: next }),
        onSuccess: async (_result, next) => {
            await queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] });
            toast.success(next ? "Assignment published." : "Assignment hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that assignment.")),
    });

    if (isLoading || curriculumLoading) {
        return (
            <div className="container-page space-y-4 py-10">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !materials || !assignment || !milestone) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
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
        <div className="container-page max-w-5xl space-y-6 py-8">
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
                                <button
                                    type="button"
                                    onClick={() => setDetailsOpen(true)}
                                    className="font-medium text-primary hover:underline"
                                >
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

            <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
                    <div>
                        <h2 className="font-semibold">Add a lesson</h2>
                        <p className="text-sm text-muted-foreground">
                            Anything students should watch, read or open before submitting.
                        </p>
                    </div>

                    <LessonTypePicker active={adding} onPick={setAdding} />

                    {adding && (
                        <div className="border-t border-border pt-4">
                            <LessonForm
                                key={`${adding}-${addFormKey}`}
                                type={adding}
                                layout="inline"
                                withDuration={false}
                                isPending={create.isPending}
                                submitLabel={`Add ${TYPE_META[adding].label.toLowerCase()} lesson`}
                                onSubmit={(fields) => create.mutate({ type: adding, fields })}
                                onCancel={() => setAdding(null)}
                            />
                        </div>
                    )}
            </section>

            <section aria-labelledby="materials-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <header className="border-b border-border px-5 py-3.5 bg-surface">
                    <h2 id="materials-title" className="font-semibold">
                        {materials.length} lesson{materials.length === 1 ? "" : "s"}{" "}
                        <span className="font-normal text-muted-foreground">· students see them with the brief, above their hand-in</span>
                    </h2>
                </header>

                {materials.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <PlayCircle className="mx-auto size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 font-medium">No lessons for this assignment yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">Pick Video, Text or Resource above to add the first one.</p>
                    </div>
                ) : (
                    <SortableList
                        ids={materials.map((m) => m.id)}
                        disabled={reorder.isPending}
                        getLabel={(id) => materials.find((m) => m.id === id)?.title ?? "Lesson"}
                        onReorder={(orderedIds, movedId) => reorder.mutate({ orderedIds, movedId })}
                    >
                        <ul className="divide-y divide-border">
                            {materials.map((material) => {
                                const meta = TYPE_META[material.type];
                                const Icon = meta.icon;
                                const isSavingPosition = reorder.isPending && reorder.variables?.movedId === material.id;
                                const isDeleting = remove.isPending && remove.variables === material.id;
                                const openEdit = () => {
                                    setEditing(material);
                                    setEditOpen(true);
                                };

                                return (
                                    <SortableItem
                                        key={material.id}
                                        id={material.id}
                                        as="li"
                                        aria-busy={isSavingPosition || isDeleting || undefined}
                                        className={cn("flex items-center gap-x-3 px-3 py-3 transition-[opacity,background-color] hover:bg-secondary/25 sm:px-4", isDeleting && "opacity-60")}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            {materials.length > 1 ? <DragHandle label={material.title} isSaving={isSavingPosition} /> : <span className="w-2" aria-hidden />}
                                            <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{pad(material.order)}</span>
                                            <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={meta.label} />
                                            <div className="min-w-0">
                                                <button type="button" onClick={openEdit} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                                                    {material.title}
                                                </button>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {meta.label} · <LessonDetail lesson={material} />
                                                </p>
                                            </div>
                                        </div>
                                        <RowActions
                                            label={`More for ${material.title}`}
                                            primary={
                                                <Button size="sm" variant="outline" onClick={openEdit}>
                                                    <Pencil /> <span className="max-sm:sr-only">Edit</span>
                                                </Button>
                                            }
                                            items={[
                                                {
                                                    label: "Delete",
                                                    icon: Trash2,
                                                    destructive: true,
                                                    disabled: isDeleting,
                                                    onSelect: async () => {
                                                        if (await confirmAction({ title: `Delete "${material.title}"?`, confirmText: "Delete lesson" })) remove.mutate(material.id);
                                                    },
                                                },
                                            ]}
                                        />
                                    </SortableItem>
                                );
                            })}
                        </ul>
                    </SortableList>
                )}
            </section>

            <Modal
                open={editOpen}
                onOpenChange={setEditOpen}
                closeOnOutsideClick={false}
                size={editing?.type === "TEXT" ? "lg" : "md"}
                title={editing ? `Edit ${TYPE_META[editing.type].label.toLowerCase()} lesson` : "Edit lesson"}
                description="A lesson's type is fixed once it's created."
            >
                {editing && (
                    <LessonForm
                        key={editing.id}
                        type={editing.type}
                        lesson={editing}
                        layout="modal"
                        withDuration={false}
                        isPending={update.isPending}
                        submitLabel="Save changes"
                        onSubmit={(fields) => update.mutate({ lesson: editing, fields })}
                        onCancel={() => setEditOpen(false)}
                    />
                )}
            </Modal>

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
