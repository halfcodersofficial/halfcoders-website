"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FolderPlus, Pencil, Play, Plus, Save, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CourseSummaryHeader, SegmentBar } from "@/components/admin/CourseSummary";
import RowActions from "@/components/admin/RowActions";
import LiveClassesPanel from "@/components/staff/LiveClassesPanel";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDuration, formatHoursMinutes } from "@/lib/utils";
import { optionalDurationField, optionalTextField, selectField, textField, youtubeUrlField } from "@/lib/validation";
import { conceptualAuthoring } from "@/services/conceptual";
import type { StaffConceptualCourse, StaffConceptualRecording, StaffConceptualTopic } from "@/types/conceptual.types";

const pad2 = (n: number) => String(n).padStart(2, "0");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const topicSchema = z.object({
    title: textField({ label: "Title", min: 3, max: 200 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
});

const recordingSchema = z.object({
    topicId: selectField("Pick a topic"),
    title: textField({ label: "Title", min: 3, max: 200 }),
    youtubeUrl: youtubeUrlField,
    duration: optionalDurationField,
    description: optionalTextField({ label: "Description", max: 2000 }),
});

type TopicDialog = { mode: "create" } | { mode: "edit"; topic: StaffConceptualTopic };
type RecordingDialog =
    | { mode: "create"; topicId: string }
    | { mode: "edit"; recording: StaffConceptualRecording };

/**
 * One course's conceptual sessions — the recordings of its live conceptual
 * classes, filed under topics. Topics and the recordings in them are dragged
 * into order; either can be kept as a draft. Students see a recording once it
 * and its topic are both live, and are notified the first time that happens.
 * Mounted by both consoles; `area` keeps every link inside the one the reader
 * came from.
 */
export default function ConceptualSessionsManager({ courseId, area }: { courseId: string; area: StaffArea }) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();
    const queryKey = ["conceptual", "manage", courseId];

    const [topicDialog, setTopicDialog] = useState<TopicDialog | null>(null);
    const [recordingDialog, setRecordingDialog] = useState<RecordingDialog | null>(null);
    const [previewing, setPreviewing] = useState<StaffConceptualRecording | null>(null);

    const { data, isLoading, isError, error } = useQuery({
        queryKey,
        queryFn: () => conceptualAuthoring.course(courseId),
    });

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey }),
            queryClient.invalidateQueries({ queryKey: ["conceptual", "manage-courses"] }),
        ]);

    const saveTopic = useMutation({
        mutationFn: ({ values, publish }: { values: z.output<typeof topicSchema>; publish: boolean }) =>
            topicDialog?.mode === "edit"
                ? conceptualAuthoring.updateTopic(topicDialog.topic.id, values)
                : conceptualAuthoring.createTopic({ courseId, ...values, isPublished: publish }),
        onSuccess: async () => {
            await refresh();
            toast.success(topicDialog?.mode === "edit" ? "Topic saved." : "Topic added.");
            setTopicDialog(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that topic.")),
    });

    const saveRecording = useMutation({
        mutationFn: ({ values, publish }: { values: z.output<typeof recordingSchema>; publish: boolean }) => {
            const fields = {
                title: values.title,
                youtubeUrl: values.youtubeUrl,
                duration: values.duration || undefined,
                description: values.description,
            };
            if (recordingDialog?.mode === "edit") {
                const { recording } = recordingDialog;
                return conceptualAuthoring.updateRecording(recording.id, {
                    ...fields,
                    // Emptied, it clears the duration that was there.
                    duration: values.duration || (recording.duration ? 0 : undefined),
                    topicId: values.topicId !== recording.topicId ? values.topicId : undefined,
                });
            }
            return conceptualAuthoring.createRecording({ ...fields, topicId: values.topicId, isPublished: publish });
        },
        onSuccess: async (_result, { publish }) => {
            await refresh();
            toast.success(
                recordingDialog?.mode === "edit"
                    ? "Recording saved."
                    : publish
                        ? "Recording added and live."
                        : "Recording added as a draft.",
            );
            setRecordingDialog(null);
        },
        // The API explains a link it can't read; show it as it is.
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that recording.")),
    });

    const publishTopic = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) => conceptualAuthoring.updateTopic(id, { isPublished: next }),
        onSuccess: async (_result, { next }) => {
            await refresh();
            toast.success(next ? "Topic is live." : "Topic hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that topic.")),
    });

    const publishRecording = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            conceptualAuthoring.updateRecording(id, { isPublished: next }),
        onSuccess: async (_result, { next }) => {
            await refresh();
            toast.success(next ? "Recording is live." : "Recording hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that recording.")),
    });

    const removeTopic = useMutation({
        mutationFn: (id: string) => conceptualAuthoring.deleteTopic(id),
        onSuccess: async () => {
            await refresh();
            toast.success("Topic deleted.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that topic.")),
    });

    const removeRecording = useMutation({
        mutationFn: (id: string) => conceptualAuthoring.deleteRecording(id),
        onSuccess: async () => {
            await refresh();
            toast.success("Recording deleted.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that recording.")),
    });

    /**
     * Drag-to-reorder, for topics and for the recordings inside one. The API
     * takes the complete new order; the rows move on drop, the handle spins
     * until it's saved, and a failure puts them back.
     */
    const reorder = useMutation({
        mutationFn: ({ topicId, orderedIds }: { topicId: string | null; orderedIds: string[]; movedId: string }) =>
            topicId
                ? conceptualAuthoring.reorderRecordings(topicId, orderedIds)
                : conceptualAuthoring.reorderTopics(courseId, orderedIds),
        onMutate: async ({ topicId, orderedIds }) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<StaffConceptualCourse>(queryKey);
            if (previous) {
                const inOrder = <T extends { id: string }>(rows: T[]) => {
                    const byId = new Map(rows.map((row) => [row.id, row]));
                    return orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 }));
                };
                queryClient.setQueryData<StaffConceptualCourse>(queryKey, {
                    ...previous,
                    topics: topicId
                        ? previous.topics.map((topic) =>
                            topic.id === topicId ? { ...topic, sessions: inOrder(topic.sessions) } : topic,
                        )
                        : inOrder(previous.topics),
                });
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't save the new order."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => refresh(),
    });

    if (isLoading) {
        return (
            <div className="w-full space-y-5">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-64 rounded-card" />
                <Skeleton className="h-48 rounded-card" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this course&apos;s conceptual sessions</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "You may not be assigned to this course.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.conceptualHome}>All courses</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const { course, topics, students } = data;
    const recordings = topics.flatMap((topic) => topic.sessions.map((session) => ({ session, topic })));
    const live = recordings.filter(({ session, topic }) => session.isPublished && topic.isPublished);
    const waitingOnTopic = recordings.filter(({ session, topic }) => session.isPublished && !topic.isPublished);
    const liveDuration = live.reduce((sum, { session }) => sum + session.duration, 0);
    const liveTopics = topics.filter((topic) => topic.isPublished).length;

    const addTopicButton = (
        <Button onClick={() => setTopicDialog({ mode: "create" })}>
            <FolderPlus /> Add topic
        </Button>
    );

    return (
        <div className="w-full space-y-6">
            {/* In the mentor console the course's own tab bar does this. */}
            {area === "admin" && <BackButton href={routes.conceptualHome} label="Conceptual sessions" />}

            <CourseSummaryHeader
                course={course}
                action={topics.length > 0 ? addTopicButton : undefined}
                details={
                    <>
                        <span className="inline-flex items-center gap-1.5">
                            <Video className="size-4" aria-hidden /> Recordings of the live conceptual classes
                        </span>
                        <span>Students are notified when a recording goes live.</span>
                    </>
                }
                stats={[
                    { label: "Topics", value: String(topics.length), hint: `${liveTopics} live` },
                    { label: "Recordings", value: String(recordings.length), hint: `${live.length} live` },
                    {
                        label: "Running time",
                        value: liveDuration > 0 ? formatHoursMinutes(liveDuration) : "—",
                        hint: "Of live recordings",
                    },
                    { label: "Students", value: String(students), hint: "Can watch what's live" },
                ]}
                bar={
                    <SegmentBar
                        emptyLabel="No recordings yet"
                        segments={[
                            { key: "live", count: live.length, label: "live", fill: "bg-success" },
                            {
                                key: "topic",
                                count: waitingOnTopic.length,
                                label: "waiting on a draft topic",
                                shortLabel: "topic draft",
                                fill: "bg-amber-500",
                            },
                            {
                                key: "draft",
                                count: recordings.length - live.length - waitingOnTopic.length,
                                label: "draft",
                                fill: "bg-muted-foreground/40",
                            },
                        ]}
                    />
                }
            />

            <LiveClassesPanel courseId={courseId} topics={topics} />

            {topics.length === 0 ? (
                <section className="rounded-card border border-dashed border-border px-6 py-14 text-center">
                    <Video className="mx-auto size-7 text-muted-foreground" aria-hidden />
                    <h2 className="mt-3 font-semibold">No topics yet</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                        Start with a topic — &ldquo;Algorithms week 04&rdquo;, say — then add each class&apos;s YouTube
                        recording under it. Only video, no quizzes or assignments.
                    </p>
                    <div className="mt-6">{addTopicButton}</div>
                </section>
            ) : (
                <SortableList
                    ids={topics.map((topic) => topic.id)}
                    disabled={reorder.isPending}
                    getLabel={(id) => topics.find((topic) => topic.id === id)?.title ?? "Topic"}
                    onReorder={(orderedIds, movedId) => reorder.mutate({ topicId: null, orderedIds, movedId })}
                >
                    <ol className="space-y-4">
                        {topics.map((topic) => (
                            <TopicCard
                                key={topic.id}
                                topic={topic}
                                canDrag={topics.length > 1}
                                isSavingPosition={reorder.isPending && reorder.variables?.movedId === topic.id}
                                savingRecordingId={
                                    reorder.isPending && reorder.variables?.topicId === topic.id
                                        ? reorder.variables.movedId
                                        : null
                                }
                                reorderDisabled={reorder.isPending}
                                isPublishing={publishTopic.isPending && publishTopic.variables?.id === topic.id}
                                publishingRecordingId={publishRecording.isPending ? publishRecording.variables?.id : undefined}
                                isDeleting={removeTopic.isPending && removeTopic.variables === topic.id}
                                deletingRecordingId={removeRecording.isPending ? removeRecording.variables : undefined}
                                onEdit={() => setTopicDialog({ mode: "edit", topic })}
                                onTogglePublish={() => publishTopic.mutate({ id: topic.id, next: !topic.isPublished })}
                                onDelete={async () => {
                                    if (
                                        await confirmAction({
                                            title: `Delete "${topic.title}"?`,
                                            text:
                                                topic.sessions.length > 0
                                                    ? `Its ${plural(topic.sessions.length, "recording")} go with it, and students lose them.`
                                                    : undefined,
                                            confirmText: "Delete topic",
                                        })
                                    ) {
                                        removeTopic.mutate(topic.id);
                                    }
                                }}
                                onAddRecording={() => setRecordingDialog({ mode: "create", topicId: topic.id })}
                                onEditRecording={(recording) => setRecordingDialog({ mode: "edit", recording })}
                                onPreviewRecording={setPreviewing}
                                onToggleRecording={(recording) =>
                                    publishRecording.mutate({ id: recording.id, next: !recording.isPublished })
                                }
                                onDeleteRecording={async (recording) => {
                                    if (
                                        await confirmAction({
                                            title: `Delete "${recording.title}"?`,
                                            confirmText: "Delete recording",
                                        })
                                    ) {
                                        removeRecording.mutate(recording.id);
                                    }
                                }}
                                onReorderRecordings={(orderedIds, movedId) =>
                                    reorder.mutate({ topicId: topic.id, orderedIds, movedId })
                                }
                            />
                        ))}
                    </ol>
                </SortableList>
            )}

            <Modal
                open={topicDialog !== null}
                onOpenChange={(open) => !open && setTopicDialog(null)}
                closeOnOutsideClick={false}
                title={topicDialog?.mode === "edit" ? "Edit topic" : "Add a topic"}
                description="A topic groups the recordings of one subject or week."
            >
                {topicDialog && (
                    <TopicForm
                        key={topicDialog.mode === "edit" ? topicDialog.topic.id : "new"}
                        topic={topicDialog.mode === "edit" ? topicDialog.topic : null}
                        isPending={saveTopic.isPending}
                        onSubmit={(values, publish) => saveTopic.mutate({ values, publish })}
                        onCancel={() => setTopicDialog(null)}
                    />
                )}
            </Modal>

            <Modal
                open={recordingDialog !== null}
                onOpenChange={(open) => !open && setRecordingDialog(null)}
                closeOnOutsideClick={false}
                title={recordingDialog?.mode === "edit" ? "Edit recording" : "Add a recording"}
                description="The class's unlisted YouTube upload — Half Coders keeps the link, never the file."
            >
                {recordingDialog && (
                    <RecordingForm
                        key={recordingDialog.mode === "edit" ? recordingDialog.recording.id : recordingDialog.topicId}
                        topics={topics}
                        recording={recordingDialog.mode === "edit" ? recordingDialog.recording : null}
                        topicId={
                            recordingDialog.mode === "edit" ? recordingDialog.recording.topicId : recordingDialog.topicId
                        }
                        isPending={saveRecording.isPending}
                        onSubmit={(values, publish) => saveRecording.mutate({ values, publish })}
                        onCancel={() => setRecordingDialog(null)}
                    />
                )}
            </Modal>

            <Modal
                open={previewing !== null}
                onOpenChange={(open) => !open && setPreviewing(null)}
                size="lg"
                title={previewing?.title ?? "Recording"}
                description="As students will see it."
            >
                {previewing && (
                    <ModalBody>
                        <div className="aspect-video overflow-hidden rounded-md bg-black">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${previewing.youtubeVideoId}?rel=0&modestbranding=1&autoplay=1`}
                                title={previewing.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="size-full"
                            />
                        </div>
                    </ModalBody>
                )}
            </Modal>
        </div>
    );
}

function TopicCard({
    topic,
    canDrag,
    isSavingPosition,
    savingRecordingId,
    reorderDisabled,
    isPublishing,
    publishingRecordingId,
    isDeleting,
    deletingRecordingId,
    onEdit,
    onTogglePublish,
    onDelete,
    onAddRecording,
    onEditRecording,
    onPreviewRecording,
    onToggleRecording,
    onDeleteRecording,
    onReorderRecordings,
}: {
    topic: StaffConceptualTopic;
    canDrag: boolean;
    isSavingPosition: boolean;
    savingRecordingId: string | null;
    reorderDisabled: boolean;
    isPublishing: boolean;
    publishingRecordingId: string | undefined;
    isDeleting: boolean;
    deletingRecordingId: string | undefined;
    onEdit: () => void;
    onTogglePublish: () => void;
    onDelete: () => void;
    onAddRecording: () => void;
    onEditRecording: (recording: StaffConceptualRecording) => void;
    onPreviewRecording: (recording: StaffConceptualRecording) => void;
    onToggleRecording: (recording: StaffConceptualRecording) => void;
    onDeleteRecording: (recording: StaffConceptualRecording) => void;
    onReorderRecordings: (orderedIds: string[], movedId: string) => void;
}) {
    const total = topic.sessions.reduce((sum, session) => sum + session.duration, 0);

    return (
        <SortableItem
            id={topic.id}
            as="li"
            aria-busy={isSavingPosition || isPublishing || isDeleting || undefined}
            className={cn(
                "overflow-hidden rounded-card border border-border bg-card shadow-card transition-opacity",
                isDeleting && "opacity-60",
            )}
        >
            <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:gap-4 sm:px-5 bg-surface">
                {canDrag && <DragHandle label={topic.title} isSaving={isSavingPosition} />}
                <p className="w-12 shrink-0 text-center leading-none">
                    <span className="block text-[0.625rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">Topic</span>
                    <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-primary">{pad2(topic.order)}</span>
                </p>
                <div className="min-w-0 flex-1">
                    <h2 className="flex min-w-0 items-center gap-2 font-semibold leading-snug">
                        <button type="button" onClick={onEdit} className="truncate text-left hover:underline">
                            {topic.title}
                        </button>
                        <span
                            className={cn(
                                "shrink-0 rounded-sm px-2 py-px text-[0.6875rem] font-semibold",
                                topic.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                            )}
                        >
                            {topic.isPublished ? "Live" : "Draft"}
                        </span>
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {plural(topic.sessions.length, "recording")}
                        {total > 0 && ` · ${formatHoursMinutes(total)}`}
                        {topic.description && ` · ${topic.description}`}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {!topic.isPublished && (
                        <Button size="sm" variant="ghost" className="hidden text-primary hover:text-primary sm:inline-flex" isLoading={isPublishing} onClick={onTogglePublish}>
                            Publish
                        </Button>
                    )}
                    <RowActions
                        label={`More for ${topic.title}`}
                        primary={
                            <Button size="sm" variant="outline" onClick={onAddRecording}>
                                <Plus /> <span className="max-sm:sr-only">Recording</span>
                            </Button>
                        }
                        items={[
                            { label: "Edit the topic", icon: Pencil, onSelect: onEdit },
                            {
                                label: topic.isPublished ? "Unpublish — hide from students" : "Publish",
                                icon: topic.isPublished ? EyeOff : Eye,
                                disabled: isPublishing,
                                onSelect: onTogglePublish,
                            },
                            { label: "Delete the topic", icon: Trash2, destructive: true, separatorBefore: true, disabled: isDeleting, onSelect: onDelete },
                        ]}
                    />
                </div>
            </header>

            {topic.sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No recordings in this topic yet.</p>
                    <Button size="sm" variant="brand-outline" onClick={onAddRecording}>
                        <Plus /> Add the first recording
                    </Button>
                </div>
            ) : (
                <>
                    <SortableList
                        ids={topic.sessions.map((session) => session.id)}
                        disabled={reorderDisabled}
                        getLabel={(id) => topic.sessions.find((session) => session.id === id)?.title ?? "Recording"}
                        onReorder={onReorderRecordings}
                    >
                        <ul className="divide-y divide-border">
                            {topic.sessions.map((recording) => (
                                <RecordingRow
                                    key={recording.id}
                                    recording={recording}
                                    topicIsLive={topic.isPublished}
                                    canDrag={topic.sessions.length > 1}
                                    isSavingPosition={savingRecordingId === recording.id}
                                    isPublishing={publishingRecordingId === recording.id}
                                    isDeleting={deletingRecordingId === recording.id}
                                    onEdit={() => onEditRecording(recording)}
                                    onPreview={() => onPreviewRecording(recording)}
                                    onTogglePublish={() => onToggleRecording(recording)}
                                    onDelete={() => onDeleteRecording(recording)}
                                />
                            ))}
                        </ul>
                    </SortableList>
                    <div className="border-t border-dashed border-border px-4 py-2.5 sm:px-5">
                        <Button size="sm" variant="ghost" onClick={onAddRecording}>
                            <Plus /> Add a recording
                        </Button>
                    </div>
                </>
            )}
        </SortableItem>
    );
}

function RecordingRow({
    recording,
    topicIsLive,
    canDrag,
    isSavingPosition,
    isPublishing,
    isDeleting,
    onEdit,
    onPreview,
    onTogglePublish,
    onDelete,
}: {
    recording: StaffConceptualRecording;
    topicIsLive: boolean;
    canDrag: boolean;
    isSavingPosition: boolean;
    isPublishing: boolean;
    isDeleting: boolean;
    onEdit: () => void;
    onPreview: () => void;
    onTogglePublish: () => void;
    onDelete: () => void;
}) {
    const watched = recording._count.watches;

    return (
        <SortableItem
            id={recording.id}
            as="li"
            aria-busy={isSavingPosition || isPublishing || isDeleting || undefined}
            className={cn("flex flex-wrap items-center gap-3 px-4 py-3 transition-[opacity,background-color] hover:bg-secondary/25 sm:flex-nowrap sm:px-5", isDeleting && "opacity-60")}
        >
            {canDrag && <DragHandle label={recording.title} isSaving={isSavingPosition} />}

            <button
                type="button"
                onClick={onPreview}
                aria-label={`Preview ${recording.title}`}
                className="group relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <SafeImage
                    src={recording.thumbnail}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    fallback={<Video className="size-5 text-muted-foreground" />}
                />
                <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/35">
                    <Play className="size-5 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                {recording.duration > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[0.625rem] font-medium tabular-nums text-white">
                        {formatDuration(recording.duration)}
                    </span>
                )}
            </button>

            <div className="min-w-0 flex-1">
                <button type="button" onClick={onEdit} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                    {recording.title}
                </button>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className={cn(
                                "size-1.5 rounded-full",
                                recording.isPublished ? (topicIsLive ? "bg-success" : "bg-amber-500") : "bg-muted-foreground/50",
                            )}
                            aria-hidden
                        />
                        {recording.isPublished ? (topicIsLive ? "Live" : "Waiting on its topic") : "Draft"}
                    </span>
                    {recording.isPublished && topicIsLive && (
                        <>
                            <span aria-hidden>·</span>
                            <span>watched by {plural(watched, "student")}</span>
                        </>
                    )}
                </p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
                {!recording.isPublished && (
                    <Button size="sm" variant="ghost" className="text-primary hover:text-primary" isLoading={isPublishing} onClick={onTogglePublish}>
                        Publish
                    </Button>
                )}
                <RowActions
                    label={`More for ${recording.title}`}
                    primary={
                        <Button size="sm" variant="outline" onClick={onEdit}>
                            <Pencil /> <span className="max-sm:sr-only">Edit</span>
                        </Button>
                    }
                    items={[
                        { label: "Watch it", icon: Play, onSelect: onPreview },
                        { label: "Unpublish — hide from students", icon: EyeOff, hidden: !recording.isPublished, disabled: isPublishing, onSelect: onTogglePublish },
                        { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, disabled: isDeleting, onSelect: onDelete },
                    ]}
                />
            </div>
        </SortableItem>
    );
}

function TopicForm({
    topic,
    isPending,
    onSubmit,
    onCancel,
}: {
    topic: StaffConceptualTopic | null;
    isPending: boolean;
    onSubmit: (values: z.output<typeof topicSchema>, publish: boolean) => void;
    onCancel: () => void;
}) {
    const [publish, setPublish] = useState(true);
    const form = useZodForm({
        schema: topicSchema,
        initialValues: { title: topic?.title ?? "", description: topic?.description ?? "" },
        onSubmit: (values) => onSubmit(values, publish),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <FormField form={form} name="title" label="Title" required counterMax={200}>
                    <Input placeholder="Algorithms week 04" autoFocus />
                </FormField>
                <FormField form={form} name="description" label="Description" hint="Optional — one line on what it covers.">
                    <Textarea rows={2} />
                </FormField>
                {!topic && (
                    <Checkbox
                        checked={publish}
                        onChange={(event) => setPublish(event.target.checked)}
                        description="Students see it once it has a live recording in it."
                    >
                        Publish immediately
                    </Checkbox>
                )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={isPending}>
                    {!isPending && (topic ? <Save /> : <Plus />)} {topic ? "Save topic" : "Add topic"}
                </Button>
            </ModalFooter>
        </form>
    );
}

function RecordingForm({
    topics,
    recording,
    topicId,
    isPending,
    onSubmit,
    onCancel,
}: {
    topics: StaffConceptualTopic[];
    recording: StaffConceptualRecording | null;
    topicId: string;
    isPending: boolean;
    onSubmit: (values: z.output<typeof recordingSchema>, publish: boolean) => void;
    onCancel: () => void;
}) {
    const [publish, setPublish] = useState(true);
    const form = useZodForm({
        schema: recordingSchema,
        initialValues: {
            topicId,
            title: recording?.title ?? "",
            youtubeUrl: recording?.youtubeUrl ?? "",
            duration: recording?.duration ? formatDuration(recording.duration) : "",
            description: recording?.description ?? "",
        },
        onSubmit: (values) => onSubmit(values, publish),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <FormField form={form} name="title" label="Title" required counterMax={200}>
                    <Input placeholder="Conceptual session one" autoFocus />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                    <FormField form={form} name="youtubeUrl" label="YouTube link" required hint="The unlisted video's share link.">
                        <Input placeholder="https://youtu.be/…" inputMode="url" />
                    </FormField>
                    <FormField form={form} name="duration" label="Duration" hint="As YouTube shows it.">
                        <Input placeholder="1:09:57" className="tabular-nums" />
                    </FormField>
                </div>
                {topics.length > 1 && (
                    <FormField
                        form={form}
                        name="topicId"
                        label="Topic"
                        required
                        hint={recording ? "Moving it puts it last in the other topic." : undefined}
                    >
                        <Select>
                            {topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {pad2(topic.order)} · {topic.title}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                )}
                <FormField form={form} name="description" label="Description" hint="Optional — what the class covered.">
                    <Textarea rows={3} />
                </FormField>
                {!recording && (
                    <Checkbox
                        checked={publish}
                        onChange={(event) => setPublish(event.target.checked)}
                        description="Students are notified once it's live in a live topic."
                    >
                        Publish immediately
                    </Checkbox>
                )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={isPending}>
                    {!isPending && (recording ? <Save /> : <Plus />)} {recording ? "Save recording" : "Add recording"}
                </Button>
            </ModalFooter>
        </form>
    );
}
