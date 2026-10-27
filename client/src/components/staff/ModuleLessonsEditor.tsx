"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Gift, ListPlus, Pencil, PlayCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
    LessonDetail,
    type LessonFields,
    LessonForm,
    LessonTypePicker,
    TYPE_META,
} from "@/components/staff/lessonForms";
import RowActions from "@/components/admin/RowActions";
import ModuleContentHeader from "@/components/staff/ModuleContentHeader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Checkbox, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { extractYoutubeId } from "@/lib/validation";
import { curriculumAuthoring, type CurriculumVideo } from "@/services/curriculum";
import type { LessonType } from "@/types/domain.types";

const MAX_BULK_ROWS = 30;

/**
 * Parses the bulk paste box. One lesson per line:
 *
 *   Intro to JavaScript | https://youtu.be/xyz | 18:42
 *
 * Duration is optional. Anything unparseable is reported by line number rather
 * than silently dropped — losing a lesson from a 40-line paste without being
 * told would be worse than refusing the whole batch.
 */
const parseBulkInput = (raw: string) => {
    const rows = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const videos: { title: string; youtubeUrl: string; duration?: string }[] = [];
    const problems: string[] = [];

    rows.forEach((line, index) => {
        const label = `Line ${index + 1}`;
        const [title, youtubeUrl, duration] = line.split("|").map((part) => part.trim());

        if (!title || !youtubeUrl) {
            problems.push(`${label}: needs a title and a link separated by "|"`);
            return;
        }
        if (title.length < 3) {
            problems.push(`${label}: the title "${title}" is shorter than 3 characters`);
            return;
        }
        // Same check the single-lesson form runs, so a 40-line paste fails on
        // the offending line rather than half-importing and then erroring.
        if (!extractYoutubeId(youtubeUrl)) {
            problems.push(`${label}: "${youtubeUrl}" isn't a YouTube link`);
            return;
        }
        if (duration && !/^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(duration)) {
            problems.push(`${label}: "${duration}" isn't a duration like 18:42`);
            return;
        }

        videos.push({ title, youtubeUrl, duration: duration || undefined });
    });

    return { videos, problems };
};

const bulkSchema = z.object({
    bulkText: z
        .string()
        .trim()
        .min(1, "Paste at least one lesson, one per line")
        .superRefine((raw, ctx) => {
            const { videos, problems } = parseBulkInput(raw);

            if (problems.length > 0) {
                ctx.addIssue({
                    code: "custom",
                    message: `${problems.length} line${problems.length === 1 ? "" : "s"} need fixing — see below`,
                });
                return;
            }
            if (videos.length === 0) {
                ctx.addIssue({ code: "custom", message: "Paste at least one lesson, one per line" });
            }
            if (videos.length > MAX_BULK_ROWS) {
                ctx.addIssue({
                    code: "custom",
                    message: `Add at most ${MAX_BULK_ROWS} lessons at a time — this paste has ${videos.length}`,
                });
            }
        }),
});

/**
 * One module's lessons — video, text or resource — plus a shortcut to its
 * quiz. Mounted by both consoles under their own prefix; `area` keeps every
 * link inside the console the reader came from.
 */
export default function ModuleLessonsEditor({
    courseId,
    moduleId,
    area,
}: {
    courseId: string;
    moduleId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();

    const [adding, setAdding] = useState<LessonType | "BULK" | null>(null);
    // Remounts the open add form after a save, so it's empty for the next lesson.
    const [addFormKey, setAddFormKey] = useState(0);
    // Applies to whichever add form is open, so it lives above all of them.
    const [publishOnAdd, setPublishOnAdd] = useState(true);

    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<CurriculumVideo | null>(null);

    // The course's own word for a module ("Session", "Day"…) — the header's query, already cached.
    const { data: course } = useQuery({ queryKey: ["staff", "course", courseId], queryFn: () => curriculumAuthoring.getCourse(courseId) });
    const moduleLabel = (course?.moduleLabel ?? "Module").toLowerCase();

    const { data: videos, isLoading, isError, error } = useQuery({
        queryKey: ["videos", moduleId],
        queryFn: () => curriculumAuthoring.listVideos(moduleId),
    });

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ["videos", moduleId] }),
            queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] }),
        ]);

    const create = useMutation({
        mutationFn: ({ type, fields }: { type: LessonType; fields: LessonFields }) =>
            curriculumAuthoring.createVideo({
                moduleId,
                type,
                title: fields.title,
                description: fields.description || undefined,
                youtubeUrl: fields.youtubeUrl,
                duration: fields.duration || undefined,
                content: fields.content,
                resourceUrl: fields.resourceUrl,
                isPublished: publishOnAdd,
            }),
        onSuccess: async (_result, { type }) => {
            await refresh();
            toast.success(`${TYPE_META[type].label} lesson added.`);
            // Stay open, emptied — lessons usually come several at a time.
            setAddFormKey((key) => key + 1);
        },
        // The API rejects non-YouTube links with a message worth showing verbatim.
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that lesson.")),
    });

    const update = useMutation({
        mutationFn: ({ lesson, fields }: { lesson: CurriculumVideo; fields: LessonFields }) => {
            const common = { title: fields.title, description: fields.description };
            const specific =
                lesson.type === "VIDEO"
                    ? { youtubeUrl: fields.youtubeUrl, duration: fields.duration || 0 }
                    : lesson.type === "TEXT"
                        ? { content: fields.content }
                        : { resourceUrl: fields.resourceUrl };
            return curriculumAuthoring.updateVideo(lesson.id, { ...common, ...specific });
        },
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson saved.");
            setEditOpen(false);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that lesson.")),
    });

    const addBulk = useMutation({
        mutationFn: (values: z.output<typeof bulkSchema>) =>
            curriculumAuthoring.bulkCreateVideos({
                moduleId,
                isPublished: publishOnAdd,
                videos: parseBulkInput(values.bulkText).videos,
            }),
        onSuccess: async () => {
            await refresh();
            toast.success("Lessons imported.");
            bulkForm.reset({ bulkText: "" });
            setAdding(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't import those lessons.")),
    });

    const bulkForm = useZodForm({
        schema: bulkSchema,
        initialValues: { bulkText: "" },
        onSubmit: (values) => addBulk.mutate(values),
    });

    // Every per-lesson action below awaits the refetch before settling, so a
    // row's spinner clears only once the list already shows the new state.
    const toggleOne = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updateVideo(id, { isPublished: next }),
        onSuccess: async (_result, { next }) => {
            await refresh();
            toast.success(next ? "Lesson published." : "Lesson hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that lesson.")),
    });

    /**
     * A free-preview lesson plays on the public course page without an
     * enrolment — the "watch a sample" every marketplace offers. It's the one
     * place a video id crosses the paywall, so it's an explicit per-lesson
     * choice rather than a default — and only videos can be one.
     */
    const togglePreview = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updateVideo(id, { isFreePreview: next }),
        onSuccess: async (_result, { next }) => {
            await refresh();
            toast.success(
                next
                    ? "Marked as a free preview — visitors can watch it from the course page."
                    : "No longer a free preview.",
            );
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that lesson.")),
    });

    const bulkPublish = useMutation({
        mutationFn: (next: boolean) =>
            curriculumAuthoring.bulkPublishVideos(
                (videos ?? []).map((video) => video.id),
                next,
            ),
        onSuccess: async (_result, next) => {
            await refresh();
            toast.success(next ? "All lessons published." : "All lessons hidden.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update those lessons.")),
    });

    /**
     * Drag-to-reorder. The API takes the *complete* ordered list and rewrites
     * positions in one transaction. Optimistic: the rows (and their numbers)
     * move on drop, the handle spins until the server has it, and a failure
     * puts them back. Settling waits on the refetch.
     */
    const reorder = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderVideos(moduleId, orderedIds),
        onMutate: async ({ orderedIds }) => {
            await queryClient.cancelQueries({ queryKey: ["videos", moduleId] });
            const previous = queryClient.getQueryData<CurriculumVideo[]>(["videos", moduleId]);
            if (previous) {
                const byId = new Map(previous.map((video) => [video.id, video]));
                queryClient.setQueryData<CurriculumVideo[]>(
                    ["videos", moduleId],
                    orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                );
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(["videos", moduleId], context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder the lessons."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => refresh(),
    });

    const remove = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deleteVideo(id),
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson deleted.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that lesson.")),
    });

    if (isLoading) {
        return (
            <div className="container-page space-y-4 py-10">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !videos) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this module</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "You may not be assigned to this course.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.modules}>Back to the Module Manager</Link>
                    </Button>
                </div>
            </div>
        );
    }

    // Only listed once the mentor has typed something, so an empty box isn't a
    // wall of complaints about lines that don't exist yet.
    const problems = bulkForm.values.bulkText.trim() ? parseBulkInput(bulkForm.values.bulkText).problems : [];
    const publishedCount = videos.filter((video) => video.isPublished).length;

    const openEdit = (video: CurriculumVideo) => {
        setEditing(video);
        setEditOpen(true);
    };

    return (
        <div className="container-page max-w-5xl space-y-6 py-8">
            <ModuleContentHeader courseId={courseId} moduleId={moduleId} area={area} active="lessons" />

            <section aria-labelledby="add-lesson-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 id="add-lesson-title" className="font-semibold">
                            Add a lesson
                        </h2>
                        <p className="text-sm text-muted-foreground">Pick what kind — you can mix them in one {moduleLabel}.</p>
                    </div>
                    <Button
                        size="sm"
                        variant={adding === "BULK" ? "secondary" : "ghost"}
                        aria-pressed={adding === "BULK"}
                        onClick={() => setAdding(adding === "BULK" ? null : "BULK")}
                    >
                        <ListPlus /> Paste many videos
                    </Button>
                </div>

                <div className="mt-4">
                    <LessonTypePicker active={adding === "BULK" ? null : adding} onPick={(type) => setAdding(type)} />
                </div>

                {adding !== null && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                        <Checkbox
                            checked={publishOnAdd}
                            onChange={(event) => setPublishOnAdd(event.target.checked)}
                            description={`Leave this off to build the ${moduleLabel} out first and publish it in one go.`}
                        >
                            Publish immediately
                        </Checkbox>

                        {adding === "BULK" ? (
                            <form className="space-y-3" noValidate onSubmit={bulkForm.handleSubmit}>
                                <FormField
                                    form={bulkForm}
                                    name="bulkText"
                                    label="One video per line"
                                    required
                                    hint={
                                        <>
                                            Format: <span className="font-mono">Title | YouTube link | duration</span> — duration optional, up to{" "}
                                            {MAX_BULK_ROWS} lessons per paste.
                                        </>
                                    }
                                >
                                    <Textarea
                                        rows={8}
                                        spellCheck={false}
                                        className="font-mono text-xs sm:text-xs"
                                        placeholder={"Intro to JavaScript | https://youtu.be/W6NZfCO5SIk | 18:42\nArrays and Objects | https://youtu.be/hdI2bqOjy3c | 25:10"}
                                    />
                                </FormField>

                                {problems.length > 0 && (
                                    <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                                        {problems.map((problem) => (
                                            <li key={problem}>{problem}</li>
                                        ))}
                                    </ul>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit" isLoading={addBulk.isPending}>
                                        Import lessons
                                    </Button>
                                    <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <LessonForm
                                key={`${adding}-${addFormKey}`}
                                type={adding}
                                layout="inline"
                                isPending={create.isPending}
                                submitLabel={`Add ${TYPE_META[adding].label.toLowerCase()} lesson`}
                                onSubmit={(fields) => create.mutate({ type: adding, fields })}
                                onCancel={() => setAdding(null)}
                            />
                        )}

                        {adding === "VIDEO" || adding === "BULK" ? (
                            <p className="text-xs text-muted-foreground">
                                Videos are unlisted YouTube uploads — Half Coders stores the link, never the file. Mark one or two as a{" "}
                                <span className="font-medium text-foreground">free preview</span> and visitors can watch them from the course page before buying.
                            </p>
                        ) : null}
                    </div>
                )}
            </section>

            <section aria-labelledby="lessons-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                    <h2 id="lessons-title" className="font-semibold">
                        {videos.length} lesson{videos.length === 1 ? "" : "s"} <span className="font-normal text-muted-foreground">· {publishedCount} live</span>
                    </h2>
                    {videos.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => bulkPublish.mutate(true)}
                                isLoading={bulkPublish.isPending && bulkPublish.variables === true}
                                disabled={publishedCount === videos.length || bulkPublish.isPending}
                            >
                                {!(bulkPublish.isPending && bulkPublish.variables === true) && <Eye />} Publish all
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => bulkPublish.mutate(false)}
                                isLoading={bulkPublish.isPending && bulkPublish.variables === false}
                                disabled={publishedCount === 0 || bulkPublish.isPending}
                            >
                                {!(bulkPublish.isPending && bulkPublish.variables === false) && <EyeOff />} Hide all
                            </Button>
                        </div>
                    )}
                </header>

                {videos.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <PlayCircle className="mx-auto size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 font-medium">No lessons in this {moduleLabel} yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">Pick Video, Text or Resource above to add the first one.</p>
                    </div>
                ) : (
                    <SortableList
                        ids={videos.map((video) => video.id)}
                        disabled={reorder.isPending}
                        getLabel={(id) => videos.find((video) => video.id === id)?.title ?? "Lesson"}
                        onReorder={(orderedIds, movedId) => reorder.mutate({ orderedIds, movedId })}
                    >
                        <ul className="divide-y divide-border">
                            {videos.map((video) => {
                                const meta = TYPE_META[video.type];
                                const Icon = meta.icon;
                                const isSavingPosition = reorder.isPending && reorder.variables?.movedId === video.id;
                                // A row spins for its own toggle, and for "Publish all" /
                                // "Hide all" whenever that bulk action changes this lesson.
                                const isPublishing =
                                    (toggleOne.isPending && toggleOne.variables?.id === video.id) ||
                                    (bulkPublish.isPending && video.isPublished !== bulkPublish.variables);
                                const isTogglingPreview = togglePreview.isPending && togglePreview.variables?.id === video.id;
                                const isDeleting = remove.isPending && remove.variables === video.id;

                                return (
                                    <SortableItem
                                        key={video.id}
                                        id={video.id}
                                        as="li"
                                        aria-busy={isSavingPosition || isPublishing || isTogglingPreview || isDeleting || undefined}
                                        className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-[opacity,background-color] hover:bg-secondary/25 sm:flex-nowrap sm:px-4", isDeleting && "opacity-60")}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            {videos.length > 1 ? <DragHandle label={video.title} isSaving={isSavingPosition} /> : <span className="w-2" aria-hidden />}
                                            <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{String(video.order).padStart(2, "0")}</span>
                                            <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={meta.label} />
                                            <div className="min-w-0">
                                                <button type="button" onClick={() => openEdit(video)} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                                                    {video.title}
                                                </button>
                                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className={cn("size-1.5 rounded-full", video.isPublished ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
                                                        {video.isPublished ? "Live" : "Draft"}
                                                    </span>
                                                    <span aria-hidden>·</span>
                                                    <span className="truncate">
                                                        {meta.label} · <LessonDetail lesson={video} />
                                                    </span>
                                                    {video.isFreePreview && (
                                                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                                                            <Gift className="size-3" aria-hidden /> Free preview
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="ml-auto flex shrink-0 items-center gap-1">
                                            {!video.isPublished && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-primary hover:text-primary"
                                                    isLoading={isPublishing}
                                                    disabled={bulkPublish.isPending}
                                                    onClick={() => toggleOne.mutate({ id: video.id, next: true })}
                                                >
                                                    Publish
                                                </Button>
                                            )}
                                            <RowActions
                                                label={`More for ${video.title}`}
                                                primary={
                                                    <Button size="sm" variant="outline" onClick={() => openEdit(video)}>
                                                        <Pencil /> <span className="max-sm:sr-only">Edit</span>
                                                    </Button>
                                                }
                                                items={[
                                                    {
                                                        label: video.isFreePreview ? "Stop the free preview" : "Make it a free preview",
                                                        icon: Gift,
                                                        hidden: video.type !== "VIDEO",
                                                        disabled: isTogglingPreview,
                                                        onSelect: () => togglePreview.mutate({ id: video.id, next: !video.isFreePreview }),
                                                    },
                                                    {
                                                        label: "Unpublish — hide from students",
                                                        icon: EyeOff,
                                                        hidden: !video.isPublished,
                                                        disabled: bulkPublish.isPending || isPublishing,
                                                        onSelect: () => toggleOne.mutate({ id: video.id, next: false }),
                                                    },
                                                    {
                                                        label: "Delete",
                                                        icon: Trash2,
                                                        destructive: true,
                                                        separatorBefore: true,
                                                        disabled: isDeleting,
                                                        onSelect: async () => {
                                                            if (await confirmAction({ title: `Delete "${video.title}"?`, confirmText: "Delete lesson" })) remove.mutate(video.id);
                                                        },
                                                    },
                                                ]}
                                            />
                                        </div>
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
                        isPending={update.isPending}
                        submitLabel="Save changes"
                        onSubmit={(fields) => update.mutate({ lesson: editing, fields })}
                        onCancel={() => setEditOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
}
