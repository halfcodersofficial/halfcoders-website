"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, FolderPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { pad2 } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { extractYoutubeId, optionalDurationField, optionalTextField, textField, youtubeUrlField } from "@/lib/validation";
import { conceptualAuthoring } from "@/services/conceptual";
import type { StaffConceptualCourseSummary } from "@/types/conceptual.types";

const NEW_TOPIC = "__new__";

const schema = z
    .object({
        courseId: z.string().min(1, "Pick a course"),
        topicId: z.string().min(1, "Pick a topic, or start a new one"),
        newTopic: z.string().trim(),
        title: textField({ label: "Title", min: 3, max: 200 }),
        youtubeUrl: youtubeUrlField,
        duration: optionalDurationField,
        description: optionalTextField({ label: "Description", max: 2000 }),
    })
    .superRefine((values, ctx) => {
        if (values.topicId !== NEW_TOPIC) return;
        if (values.newTopic.length < 3) ctx.addIssue({ code: "custom", path: ["newTopic"], message: "Name the new topic — at least 3 characters" });
        if (values.newTopic.length > 200) ctx.addIssue({ code: "custom", path: ["newTopic"], message: "Keep the topic name under 200 characters" });
    });

/**
 * Files one recording from anywhere on the mentor's Conceptual page: the
 * course (when they teach more than one), its topic — or a new one — the
 * YouTube link, previewed the moment it's pasted, and whether it goes live
 * now. A recording only reaches students inside a live topic, so when the
 * topic isn't live the form offers to publish it too.
 */
export default function AddRecordingModal({
    open,
    onOpenChange,
    courses,
    initialCourseId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courses: StaffConceptualCourseSummary[];
    initialCourseId?: string;
}) {
    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg" closeOnOutsideClick={false} title="Add a recording" description="File a live class's recording under its topic.">
            {open && <AddRecordingForm key={initialCourseId ?? "any"} courses={courses} initialCourseId={initialCourseId} onDone={() => onOpenChange(false)} />}
        </Modal>
    );
}

function AddRecordingForm({
    courses,
    initialCourseId,
    onDone,
}: {
    courses: StaffConceptualCourseSummary[];
    initialCourseId?: string;
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [publish, setPublish] = useState(true);
    const [publishTopic, setPublishTopic] = useState(true);

    const form = useZodForm({
        schema,
        initialValues: {
            courseId: initialCourseId ?? (courses.length === 1 ? courses[0].course.id : ""),
            topicId: "",
            newTopic: "",
            title: "",
            youtubeUrl: "",
            duration: "",
            description: "",
        },
        onSubmit: (values) => save.mutate(values),
    });
    const { courseId, topicId } = form.values;

    // The same query the course's own manager reads, so its topics are already warm.
    const detail = useQuery({
        queryKey: ["conceptual", "manage", courseId],
        queryFn: () => conceptualAuthoring.course(courseId),
        enabled: Boolean(courseId),
    });
    const topics = detail.data?.topics ?? [];

    // Most often it belongs to the latest topic; with none yet, it starts one.
    const { setValue } = form;
    useEffect(() => {
        if (!detail.data || topicId) return;
        const latest = detail.data.topics.at(-1);
        setValue("topicId", latest ? latest.id : NEW_TOPIC);
    }, [detail.data, topicId, setValue]);

    const chosen = topics.find((topic) => topic.id === topicId);
    const isNew = topicId === NEW_TOPIC;
    const topicLive = isNew ? false : (chosen?.isPublished ?? false);
    const videoId = extractYoutubeId(form.values.youtubeUrl);

    const pickCourse = (id: string) => form.setValues({ courseId: id, topicId: "", newTopic: "" });

    const save = useMutation({
        mutationFn: async (values: z.output<typeof schema>) => {
            const publishTopicToo = publish && !topicLive && publishTopic;
            let targetTopicId = values.topicId;
            if (isNew) {
                const topic = await conceptualAuthoring.createTopic({
                    courseId: values.courseId,
                    title: values.newTopic,
                    isPublished: publishTopicToo,
                });
                targetTopicId = topic.id;
            }
            await conceptualAuthoring.createRecording({
                topicId: targetTopicId,
                title: values.title,
                youtubeUrl: values.youtubeUrl,
                duration: values.duration || undefined,
                description: values.description || undefined,
                isPublished: publish,
            });
            // Publishing the topic last tells students about everything that's now live in it, this one included.
            if (publishTopicToo && !isNew) await conceptualAuthoring.updateTopic(targetTopicId, { isPublished: true });
            return { live: publish && (topicLive || publishTopicToo), waiting: publish && !topicLive && !publishTopicToo };
        },
        onSuccess: async ({ live, waiting }) => {
            await queryClient.invalidateQueries({ queryKey: ["conceptual"] });
            toast.success(
                live
                    ? "Recording added and live — students are being told."
                    : waiting
                      ? "Recording added — it goes live when its topic does."
                      : "Recording added as a draft.",
            );
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add that recording.")),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-5">
                {courses.length > 1 && (
                    <fieldset>
                        <legend className="text-sm font-medium">Course</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {courses.map(({ course }) => {
                                const selected = course.id === courseId;
                                return (
                                    <label
                                        key={course.id}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
                                        )}
                                    >
                                        <input type="radio" name="course" value={course.id} checked={selected} onChange={() => pickCourse(course.id)} className="sr-only" />
                                        <span className="relative grid aspect-video w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">
                                            <SafeImage src={course.thumbnail} alt="" fill sizes="56px" className="object-cover" fallback={<BookOpen className="size-4 text-muted-foreground" />} />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.title}</span>
                                        {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                                    </label>
                                );
                            })}
                        </div>
                        {form.errorFor("courseId") && <p className="mt-1.5 text-xs text-destructive">{form.errorFor("courseId")}</p>}
                    </fieldset>
                )}

                {courseId && (
                    <fieldset>
                        <legend className="text-sm font-medium">Topic</legend>
                        {detail.isLoading ? (
                            <div className="mt-2 flex gap-2">
                                <Skeleton className="h-9 w-32 rounded-full" />
                                <Skeleton className="h-9 w-40 rounded-full" />
                            </div>
                        ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {topics.map((topic) => (
                                    <TopicChip
                                        key={topic.id}
                                        selected={topicId === topic.id}
                                        onSelect={() => form.setValue("topicId", topic.id)}
                                        label={`${pad2(topic.order)} · ${topic.title}`}
                                        hint={topic.isPublished ? undefined : "not live"}
                                    />
                                ))}
                                <TopicChip
                                    selected={isNew}
                                    onSelect={() => form.setValue("topicId", NEW_TOPIC)}
                                    label="New topic"
                                    icon={<FolderPlus className="size-3.5" aria-hidden />}
                                />
                            </div>
                        )}
                        {form.errorFor("topicId") && !isNew && <p className="mt-1.5 text-xs text-destructive">{form.errorFor("topicId")}</p>}
                        {isNew && (
                            <div className="mt-3">
                                <FormField form={form} name="newTopic" label="New topic's name" required counterMax={200}>
                                    <Input placeholder="Algorithms week 04" />
                                </FormField>
                            </div>
                        )}
                    </fieldset>
                )}

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                    <div className="space-y-4">
                        <FormField form={form} name="youtubeUrl" label="YouTube link" required hint="The unlisted video's share link.">
                            <Input placeholder="https://youtu.be/…" inputMode="url" spellCheck={false} />
                        </FormField>
                        <FormField form={form} name="title" label="Title" required counterMax={200}>
                            <Input placeholder="Conceptual session one" />
                        </FormField>
                    </div>
                    {/* The video, as soon as the link reads as one — the quickest way to catch the wrong paste. */}
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium">Preview</p>
                        <div className="relative mt-2 aspect-video overflow-hidden rounded-lg bg-secondary ring-1 ring-border">
                            {videoId ? (
                                <SafeImage src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="The video's thumbnail" fill sizes="152px" className="object-cover" fallback={null} />
                            ) : (
                                <span className="grid size-full place-items-center px-2 text-center text-[0.6875rem] text-muted-foreground">Paste a link</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                    <FormField form={form} name="duration" label="Duration" hint="As YouTube shows it.">
                        <Input placeholder="1:09:57" className="tabular-nums" />
                    </FormField>
                    <FormField form={form} name="description" label="Description" hint="Optional — what the class covered.">
                        <Textarea rows={2} />
                    </FormField>
                </div>

                <div className="space-y-1 rounded-xl bg-secondary/40 px-4 py-3">
                    <Checkbox checked={publish} onChange={(event) => setPublish(event.target.checked)} description="Students are told the first time it's live.">
                        Publish now
                    </Checkbox>
                    {publish && !topicLive && (courseId && (isNew || chosen)) && (
                        <Checkbox
                            checked={publishTopic}
                            onChange={(event) => setPublishTopic(event.target.checked)}
                            description={
                                publishTopic
                                    ? "So students see it straight away."
                                    : "It will wait, hidden, until you publish the topic."
                            }
                        >
                            {isNew ? "Publish the new topic too" : `Publish “${chosen?.title}” too — it isn't live yet`}
                        </Checkbox>
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {!save.isPending && <Plus />} Add recording
                </Button>
            </ModalFooter>
        </form>
    );
}

function TopicChip({
    selected,
    onSelect,
    label,
    hint,
    icon,
}: {
    selected: boolean;
    onSelect: () => void;
    label: string;
    hint?: string;
    icon?: React.ReactNode;
}) {
    return (
        <label
            className={cn(
                "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                selected ? "border-primary bg-primary/10 font-medium text-primary" : "border-border hover:bg-secondary/50",
            )}
        >
            <input type="radio" name="topic" checked={selected} onChange={onSelect} className="sr-only" />
            {icon}
            <span className="truncate">{label}</span>
            {hint && <span className="shrink-0 text-xs text-muted-foreground">· {hint}</span>}
        </label>
    );
}
