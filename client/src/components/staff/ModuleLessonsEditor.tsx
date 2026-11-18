"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Gift, HelpCircle, ListPlus, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
    LessonDetail,
    type LessonFields,
    LessonForm,
    LessonTypePicker,
    pickerTileClass,
    TYPE_META,
} from "@/components/staff/lessonForms";
import RowActions from "@/components/admin/RowActions";
import ModuleContentHeader from "@/components/staff/ModuleContentHeader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { extractYoutubeId, optionalTextField, textField } from "@/lib/validation";
import { curriculumAuthoring, type CurriculumVideo } from "@/services/curriculum";
import type { AdminQuiz } from "@/types/admin.types";
import type { LessonType } from "@/types/domain.types";

const MAX_BULK_ROWS = 30;

/** The quiz's row in the sortable list — never a lesson id. */
const QUIZ_ROW = "quiz-row";

const quizSchema = z.object({
    title: textField({ label: "Quiz title", min: 3, max: 200 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
});

/** One video in the "add many" form — `key` only tells React the rows apart. */
type BulkRow = { key: number; title: string; youtubeUrl: string };

/**
 * What's wrong with one row, if anything — the same checks the single-lesson
 * form runs, so a batch fails on the row to fix rather than half-importing.
 * A row left completely empty is skipped, not an error.
 */
const bulkRowErrors = (row: BulkRow) => {
    const title = row.title.trim();
    const link = row.youtubeUrl.trim();
    if (!title && !link) return null;
    const errors: { title?: string; youtubeUrl?: string } = {};
    if (!title) errors.title = "Give it a title";
    else if (title.length < 3) errors.title = "At least 3 characters";
    if (!link) errors.youtubeUrl = "Paste its YouTube link";
    else if (!extractYoutubeId(link)) errors.youtubeUrl = "That isn't a YouTube link";
    return errors.title || errors.youtubeUrl ? errors : null;
};

const isEmptyRow = (row: BulkRow) => !row.title.trim() && !row.youtubeUrl.trim();

/**
 * One module's lessons — video, text or resource — with its quiz as a row
 * among them, dragged to wherever students should take it. Mounted by both
 * consoles under their own prefix; `area` keeps every link inside the console
 * the reader came from.
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
    const router = useRouter();

    // "QUIZ" is the module's quiz, picked from the same tiles as a lesson.
    const [adding, setAdding] = useState<LessonType | "BULK" | "QUIZ" | null>(null);
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

    // The module's quiz, shown as a tile and a row among the lessons — the quiz page's own query.
    const { data: quiz } = useQuery({
        queryKey: ["quiz", moduleId],
        queryFn: () => curriculumAuthoring.getModuleQuiz(moduleId),
    });

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ["videos", moduleId] }),
            queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] }),
            // Adding or deleting a lesson above the quiz moves it along on the server.
            queryClient.invalidateQueries({ queryKey: ["quiz", moduleId] }),
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
        mutationFn: (rows: { title: string; youtubeUrl: string }[]) =>
            curriculumAuthoring.bulkCreateVideos({ moduleId, isPublished: publishOnAdd, videos: rows }),
        onSuccess: async (_result, rows) => {
            await refresh();
            toast.success(`${rows.length} video${rows.length === 1 ? "" : "s"} added.`);
            setAdding(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add those videos.")),
    });

    /** A module has one quiz: made here, then straight on to its questions. */
    const createQuiz = useMutation({
        mutationFn: (values: z.output<typeof quizSchema>) =>
            curriculumAuthoring.createQuiz({ moduleId, title: values.title, description: values.description || undefined }),
        onSuccess: async () => {
            await refresh();
            toast.success("Quiz added. Now add its questions.");
            router.push(routes.quiz(moduleId));
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that quiz.")),
    });

    const quizForm = useZodForm({
        schema: quizSchema,
        initialValues: { title: "", description: "" },
        onSubmit: (values) => createQuiz.mutate(values),
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
     * positions in one transaction — with the quiz's new place, when it was
     * part of the drag. Optimistic: the rows (and their numbers) move on drop,
     * the handle spins until the server has it, and a failure puts them back.
     * Settling waits on the refetch.
     */
    const reorder = useMutation({
        mutationFn: ({ orderedIds, quizPosition }: { orderedIds: string[]; movedId: string; quizPosition?: number | null }) =>
            curriculumAuthoring.reorderVideos(moduleId, orderedIds, quizPosition),
        onMutate: async ({ orderedIds, quizPosition }) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: ["videos", moduleId] }),
                queryClient.cancelQueries({ queryKey: ["quiz", moduleId] }),
            ]);
            const previous = queryClient.getQueryData<CurriculumVideo[]>(["videos", moduleId]);
            const previousQuiz = queryClient.getQueryData<AdminQuiz | null>(["quiz", moduleId]);
            if (previous) {
                const byId = new Map(previous.map((video) => [video.id, video]));
                queryClient.setQueryData<CurriculumVideo[]>(
                    ["videos", moduleId],
                    orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                );
            }
            if (previousQuiz && quizPosition !== undefined) {
                queryClient.setQueryData<AdminQuiz>(["quiz", moduleId], { ...previousQuiz, position: quizPosition });
            }
            return { previous, previousQuiz };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(["videos", moduleId], context.previous);
            if (context?.previousQuiz) queryClient.setQueryData(["quiz", moduleId], context.previousQuiz);
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
            <div className="w-full space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !videos) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
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

    const publishedCount = videos.filter((video) => video.isPublished).length;

    // The lessons with the quiz slotted in after the first `position` of them
    // (after all of them while it has none) — the order students meet them in.
    const rowIds = videos.map((video) => video.id);
    if (quiz) rowIds.splice(quiz.position === null ? videos.length : Math.min(quiz.position, videos.length), 0, QUIZ_ROW);

    /** A drop: the lessons' new order, and how many lessons now come before the quiz. */
    const onReorder = (orderedRowIds: string[], movedId: string) => {
        const orderedIds = orderedRowIds.filter((id) => id !== QUIZ_ROW);
        const quizIndex = orderedRowIds.indexOf(QUIZ_ROW);
        reorder.mutate({
            orderedIds,
            movedId,
            quizPosition: quizIndex === -1 ? undefined : quizIndex >= orderedIds.length ? null : quizIndex,
        });
    };

    const openEdit = (video: CurriculumVideo) => {
        setEditing(video);
        setEditOpen(true);
    };

    return (
        <div className="w-full space-y-6">
            <ModuleContentHeader courseId={courseId} moduleId={moduleId} area={area} active="lessons" />

            <section aria-labelledby="add-lesson-title" className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
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
                        <ListPlus /> Add many videos
                    </Button>
                </div>

                <div className="mt-4">
                    <LessonTypePicker
                        active={adding === "BULK" || adding === "QUIZ" ? null : adding}
                        onPick={(type) => setAdding(type)}
                        extra={
                            // The module's one quiz: added here, or — once it has one — opened from here.
                            quiz ? (
                                <Link href={routes.quiz(moduleId)} className={pickerTileClass(false)}>
                                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium">Quiz</span>
                                        <span className="block text-xs text-muted-foreground">
                                            Added · {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} — edit it
                                        </span>
                                    </span>
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    aria-pressed={adding === "QUIZ"}
                                    disabled={quiz === undefined}
                                    onClick={() => setAdding(adding === "QUIZ" ? null : "QUIZ")}
                                    className={pickerTileClass(adding === "QUIZ")}
                                >
                                    <HelpCircle
                                        className={cn("mt-0.5 size-5 shrink-0", adding === "QUIZ" ? "text-primary" : "text-muted-foreground")}
                                        aria-hidden
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium">Quiz</span>
                                        <span className="block text-xs text-muted-foreground">Questions to check what they learned</span>
                                    </span>
                                </button>
                            )
                        }
                    />
                </div>

                {adding === "QUIZ" && !quiz && (
                    <form className="mt-4 space-y-4 border-t border-border pt-4" noValidate onSubmit={quizForm.handleSubmit}>
                        <p className="text-sm text-muted-foreground">
                            One quiz per {moduleLabel}. Name it here, then add its questions on the next page — it goes live together with the{" "}
                            {moduleLabel}, so there&apos;s nothing to publish separately. It shows up in the list below — drag it to where students should
                            take it.
                        </p>
                        <FormField form={quizForm} name="title" label="Quiz title" required counterMax={200}>
                            <Input placeholder={`${course?.moduleLabel ?? "Module"} quiz`} autoFocus />
                        </FormField>
                        <FormField form={quizForm} name="description" label="Description" optional counterMax={2000}>
                            <Textarea rows={2} placeholder={`Check your understanding of this ${moduleLabel}.`} />
                        </FormField>
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" isLoading={createQuiz.isPending}>
                                {!createQuiz.isPending && <Plus />} Add quiz &amp; its questions
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}

                {adding !== null && adding !== "QUIZ" && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                        <Checkbox
                            checked={publishOnAdd}
                            onChange={(event) => setPublishOnAdd(event.target.checked)}
                            description={`Leave this off to build the ${moduleLabel} out first and publish it in one go.`}
                        >
                            Publish immediately
                        </Checkbox>

                        {adding === "BULK" ? (
                            <BulkVideoForm isPending={addBulk.isPending} onSubmit={(rows) => addBulk.mutate(rows)} onCancel={() => setAdding(null)} />
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

            <section aria-labelledby="lessons-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-surface">
                    <h2 id="lessons-title" className="font-semibold">
                        {videos.length} lesson{videos.length === 1 ? "" : "s"}{" "}
                        <span className="font-normal text-muted-foreground">
                            · {publishedCount} live{quiz ? " · and the quiz" : ""}
                        </span>
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
                        ids={rowIds}
                        disabled={reorder.isPending}
                        getLabel={(id) =>
                            id === QUIZ_ROW ? `Quiz: ${quiz?.title ?? ""}` : (videos.find((video) => video.id === id)?.title ?? "Lesson")
                        }
                        onReorder={onReorder}
                    >
                        <ul className="divide-y divide-border">
                            {rowIds.map((rowId) => {
                                if (rowId === QUIZ_ROW && quiz) {
                                    return (
                                        <QuizRow
                                            key={QUIZ_ROW}
                                            quiz={quiz}
                                            href={routes.quiz(moduleId)}
                                            sortable={rowIds.length > 1}
                                            isSaving={reorder.isPending && reorder.variables?.movedId === QUIZ_ROW}
                                        />
                                    );
                                }
                                const video = videos.find((entry) => entry.id === rowId);
                                if (!video) return null;
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
                                            {rowIds.length > 1 ? <DragHandle label={video.title} isSaving={isSavingPosition} /> : <span className="w-2" aria-hidden />}
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

/**
 * Several video lessons in one go: a title and a YouTube link per row, rows
 * added and removed as needed, then one button adds them all. The running
 * time is measured from YouTube, so there's nothing else to type. Problems
 * show under the row they belong to once "Add" has been tried.
 */
function BulkVideoForm({
    isPending,
    onSubmit,
    onCancel,
}: {
    isPending: boolean;
    onSubmit: (rows: { title: string; youtubeUrl: string }[]) => void;
    onCancel: () => void;
}) {
    const nextKey = useRef(3);
    const [rows, setRows] = useState<BulkRow[]>([
        { key: 1, title: "", youtubeUrl: "" },
        { key: 2, title: "", youtubeUrl: "" },
    ]);
    const [tried, setTried] = useState(false);
    // The row whose title takes the cursor — the first, then each one added.
    const [focusKey, setFocusKey] = useState(1);

    const filled = rows.filter((row) => !isEmptyRow(row));
    const errorsByKey = new Map(rows.map((row) => [row.key, bulkRowErrors(row)]));
    const hasErrors = [...errorsByKey.values()].some(Boolean);

    const update = (key: number, patch: Partial<BulkRow>) =>
        setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    const addRow = () => {
        const key = nextKey.current++;
        setRows((current) => [...current, { key, title: "", youtubeUrl: "" }]);
        setFocusKey(key);
    };
    const removeRow = (key: number) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setTried(true);
        if (hasErrors || filled.length === 0) return;
        onSubmit(filled.map((row) => ({ title: row.title.trim(), youtubeUrl: row.youtubeUrl.trim() })));
    };

    return (
        <form className="space-y-3" noValidate onSubmit={submit}>
            <div>
                <p className="text-sm font-medium">Videos</p>
                <p className="text-xs text-muted-foreground">A title and an unlisted YouTube link for each. Empty rows are skipped.</p>
            </div>

            <ol className="space-y-2">
                {rows.map((row, index) => {
                    const errors = tried ? errorsByKey.get(row.key) : null;
                    const number = index + 1;
                    return (
                        <li key={row.key} className="flex items-start gap-2">
                            <span className="mt-3 w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground sm:mt-2.5">
                                {String(number).padStart(2, "0")}
                            </span>
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                                <div>
                                    <Input
                                        aria-label={`Video ${number} title`}
                                        placeholder="Title — e.g. Intro to JavaScript"
                                        value={row.title}
                                        maxLength={200}
                                        autoFocus={row.key === focusKey}
                                        aria-invalid={errors?.title ? true : undefined}
                                        onChange={(event) => update(row.key, { title: event.target.value })}
                                    />
                                    {errors?.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
                                </div>
                                <div>
                                    <Input
                                        aria-label={`Video ${number} YouTube link`}
                                        placeholder="YouTube link — https://youtu.be/…"
                                        value={row.youtubeUrl}
                                        inputMode="url"
                                        spellCheck={false}
                                        aria-invalid={errors?.youtubeUrl ? true : undefined}
                                        onChange={(event) => update(row.key, { youtubeUrl: event.target.value })}
                                    />
                                    {errors?.youtubeUrl && <p className="mt-1 text-xs text-destructive">{errors.youtubeUrl}</p>}
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={`Remove video ${number}`}
                                title="Remove this row"
                                disabled={rows.length <= 1}
                                className="mt-1 text-destructive hover:bg-destructive/10 sm:mt-0.5"
                                onClick={() => removeRow(row.key)}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </li>
                    );
                })}
            </ol>

            {rows.length < MAX_BULK_ROWS ? (
                <Button type="button" size="sm" variant="outline" onClick={addRow}>
                    <Plus className="size-4" /> Add another video
                </Button>
            ) : (
                <p className="text-xs text-muted-foreground">
                    That&apos;s {MAX_BULK_ROWS} — the most at a time. Add these, then do the rest.
                </p>
            )}

            {tried && filled.length === 0 && <p className="text-sm text-destructive">Fill in at least one video.</p>}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="submit" isLoading={isPending}>
                    {filled.length > 1 ? `Add ${filled.length} videos` : "Add video"}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

/**
 * The module's quiz as a row among its lessons — dragged like one to set
 * where students take it. Its questions are edited on its own page.
 */
function QuizRow({ quiz, href, sortable, isSaving }: { quiz: AdminQuiz; href: string; sortable: boolean; isSaving: boolean }) {
    const questions = quiz.questions.length;
    return (
        <SortableItem
            id={QUIZ_ROW}
            as="li"
            aria-busy={isSaving || undefined}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-primary/4 px-3 py-3 transition-colors hover:bg-primary/8 sm:flex-nowrap sm:px-4"
        >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {sortable ? <DragHandle label={`Quiz: ${quiz.title}`} isSaving={isSaving} /> : <span className="w-2" aria-hidden />}
                <span className="w-6 shrink-0" aria-hidden />
                <HelpCircle className="size-4 shrink-0 text-primary" aria-label="Quiz" />
                <div className="min-w-0">
                    <Link href={href} className="block max-w-full truncate text-sm font-medium hover:underline">
                        Quiz: {quiz.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <span className={cn("size-1.5 rounded-full", quiz.isPublished ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
                            {quiz.isPublished ? "Live" : "Draft"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                            {questions} question{questions === 1 ? "" : "s"}
                        </span>
                        {sortable && (
                            <>
                                <span aria-hidden>·</span>
                                <span>Drag it to where students should take it</span>
                            </>
                        )}
                    </p>
                </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button asChild size="sm" variant="outline">
                    <Link href={href}>
                        <Pencil /> <span className="max-sm:sr-only">Edit quiz</span>
                    </Link>
                </Button>
            </div>
        </SortableItem>
    );
}
