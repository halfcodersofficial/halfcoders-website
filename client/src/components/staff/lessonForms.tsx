"use client";

import { FileText, Link2, type LucideIcon, PlayCircle, Plus, Save } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { useZodForm } from "@/hooks/useZodForm";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { cn, formatDuration } from "@/lib/utils";
import { optionalDurationField, optionalTextField, textField, urlField, youtubeUrlField } from "@/lib/validation";
import type { LessonType } from "@/types/domain.types";

/**
 * The lesson forms and bits shared by a module's lessons and an assignment's —
 * one Video / Text / Resource form each, the type picker tiles and the one-line
 * summary a lesson row shows.
 */

export const TYPE_META: Record<LessonType, { label: string; description: string; icon: LucideIcon }> = {
    VIDEO: { label: "Video", description: "An unlisted YouTube video", icon: PlayCircle },
    TEXT: { label: "Text", description: "A written lesson, typed here", icon: FileText },
    RESOURCE: { label: "Resource", description: "A link to a PDF, repo or doc", icon: Link2 },
};

export const LESSON_TYPES: LessonType[] = ["VIDEO", "TEXT", "RESOURCE"];

/** Anything these forms can edit — a module lesson or an assignment's. */
export interface EditableLesson {
    type: LessonType;
    title: string;
    description: string | null;
    youtubeUrl: string | null;
    youtubeVideoId?: string | null;
    content: string | null;
    resourceUrl: string | null;
    /** Seconds. Module lessons have one; assignment lessons don't. */
    duration?: number;
}

/** Whatever a lesson form collected — only the fields its type uses are set. */
export type LessonFields = {
    title: string;
    description: string;
    youtubeUrl?: string;
    duration?: string;
    content?: string;
    resourceUrl?: string;
};

const titleField = textField({ label: "Title", min: 3, max: 200 });
const descriptionField = optionalTextField({ label: "Description", max: 2000 });

const videoSchema = z.object({
    title: titleField,
    youtubeUrl: youtubeUrlField,
    duration: optionalDurationField,
    description: descriptionField,
});

const textSchema = z.object({
    title: titleField,
    content: textField({ label: "Lesson text", max: 50_000 }),
    description: descriptionField,
});

const resourceSchema = z.object({
    title: titleField,
    // Only http(s): this becomes an <a href> on the student's page.
    resourceUrl: urlField().refine((value) => /^https?:\/\//i.test(value), {
        message: "Enter a full link starting with https://",
    }),
    description: descriptionField,
});

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const hostnameOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/**
 * The Video / Text / Resource tiles that start a new lesson. `active` marks
 * the one whose form is open; picking it again closes the form.
 */
export function LessonTypePicker({
    active,
    onPick,
}: {
    active: LessonType | null;
    onPick: (type: LessonType | null) => void;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-3">
            {LESSON_TYPES.map((type) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                const isActive = active === type;
                return (
                    <button
                        key={type}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onPick(isActive ? null : type)}
                        className={cn(
                            "flex items-start gap-3 rounded-card border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/40",
                        )}
                    >
                        <Icon className={cn("mt-0.5 size-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">{meta.label}</span>
                            <span className="block text-xs text-muted-foreground">{meta.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** The one-line detail under a lesson's title — length, reading time or where it links. */
export function LessonDetail({ lesson }: { lesson: EditableLesson }) {
    if (lesson.type === "TEXT") {
        const words = wordCount(lesson.content ?? "");
        return (
            <>
                {words} words · ~{Math.max(1, Math.round(words / 200))} min read
            </>
        );
    }
    if (lesson.type === "RESOURCE" && lesson.resourceUrl) {
        return (
            <a href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {hostnameOf(lesson.resourceUrl)}
            </a>
        );
    }
    return (
        <>
            {lesson.duration !== undefined && formatDuration(lesson.duration)}
            {lesson.youtubeUrl && (
                <>
                    {lesson.duration !== undefined && " · "}
                    <a href={lesson.youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {lesson.youtubeVideoId ?? lesson.youtubeUrl}
                    </a>
                </>
            )}
        </>
    );
}

interface LessonFormProps {
    type: LessonType;
    /** Set to edit that lesson; leave out to create one. */
    lesson?: EditableLesson;
    /** `inline` sits in the page's add panel; `modal` fills an edit modal. */
    layout: "inline" | "modal";
    isPending: boolean;
    submitLabel: string;
    onSubmit: (fields: LessonFields) => void;
    onCancel: () => void;
    /** Module videos keep a running time; assignment videos don't. Defaults to true. */
    withDuration?: boolean;
}

/** One form per type, each with its own schema — they share only the frame. */
export function LessonForm(props: LessonFormProps) {
    if (props.type === "TEXT") return <TextLessonForm {...props} />;
    if (props.type === "RESOURCE") return <ResourceLessonForm {...props} />;
    return <VideoLessonForm {...props} />;
}

function FormFrame({
    layout,
    onSubmit,
    isPending,
    submitLabel,
    onCancel,
    children,
}: Pick<LessonFormProps, "layout" | "isPending" | "submitLabel" | "onCancel"> & {
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    children: ReactNode;
}) {
    const submit = (
        <Button type="submit" isLoading={isPending}>
            {!isPending && (layout === "modal" ? <Save /> : <Plus />)} {submitLabel}
        </Button>
    );
    const cancel = (
        <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
        </Button>
    );

    if (layout === "modal") {
        return (
            <form className={modalFormClass} noValidate onSubmit={onSubmit}>
                <ModalBody className="space-y-4">{children}</ModalBody>
                <ModalFooter>
                    {cancel}
                    {submit}
                </ModalFooter>
            </form>
        );
    }

    return (
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
            {children}
            <div className="flex flex-wrap gap-2">
                {submit}
                {cancel}
            </div>
        </form>
    );
}

function VideoLessonForm({
    lesson,
    onSubmit,
    layout,
    isPending,
    submitLabel,
    onCancel,
    withDuration = true,
}: LessonFormProps) {
    const frame = { layout, isPending, submitLabel, onCancel };
    const form = useZodForm({
        schema: videoSchema,
        initialValues: {
            title: lesson?.title ?? "",
            youtubeUrl: lesson?.youtubeUrl ?? "",
            duration: lesson?.duration ? formatDuration(lesson.duration) : "",
            description: lesson?.description ?? "",
        },
        onSubmit: (values) => onSubmit(values),
    });

    return (
        <FormFrame {...frame} onSubmit={form.handleSubmit}>
            <FormField form={form} name="title" label="Title" required counterMax={200}>
                <Input placeholder="Introduction to React" autoFocus />
            </FormField>

            <div className={cn("grid gap-4", withDuration && "sm:grid-cols-[1fr_160px]")}>
                <FormField form={form} name="youtubeUrl" label="YouTube link" required hint="The unlisted video's share link.">
                    <Input
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="https://youtu.be/W6NZfCO5SIk"
                    />
                </FormField>
                {withDuration && (
                    <FormField form={form} name="duration" label="Duration" optional hint="As shown on YouTube.">
                        <Input inputMode="numeric" placeholder="18:42" />
                    </FormField>
                )}
            </div>

            <FormField form={form} name="description" label="Description" optional counterMax={2000}>
                <Textarea rows={2} placeholder="What this lesson covers" />
            </FormField>
        </FormFrame>
    );
}

function TextLessonForm({ lesson, onSubmit, layout, isPending, submitLabel, onCancel }: LessonFormProps) {
    const frame = { layout, isPending, submitLabel, onCancel };
    const [showPreview, setShowPreview] = useState(false);

    const form = useZodForm({
        schema: textSchema,
        initialValues: {
            title: lesson?.title ?? "",
            content: lesson?.content ?? "",
            description: lesson?.description ?? "",
        },
        onSubmit: (values) => onSubmit(values),
    });

    return (
        <FormFrame {...frame} onSubmit={form.handleSubmit}>
            <FormField form={form} name="title" label="Title" required counterMax={200}>
                <Input placeholder="How the event loop works" autoFocus />
            </FormField>

            <FormField
                form={form}
                name="content"
                label="Lesson text"
                required
                counterMax={50_000}
                hint={
                    <>
                        Supports <span className="font-mono"># Heading</span>,{" "}
                        <span className="font-mono">**bold**</span>, <span className="font-mono">`code`</span>,{" "}
                        <span className="font-mono">[link](https://…)</span> and{" "}
                        <span className="font-mono">- bullet</span> lines.
                    </>
                }
                labelAction={
                    <button
                        type="button"
                        onClick={() => setShowPreview((open) => !open)}
                        aria-expanded={showPreview}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        {showPreview ? "Hide preview" : "Show preview"}
                    </button>
                }
            >
                <Textarea rows={14} placeholder={"# What you'll learn\n\nWrite the lesson here…"} />
            </FormField>

            {showPreview && (
                <div className="rounded-md border border-border bg-secondary/20 p-4">
                    <p className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                        Preview — as students see it
                    </p>
                    <div
                        className="text-sm leading-relaxed"
                        // Escaped and link-restricted by renderLightMarkdown.
                        dangerouslySetInnerHTML={{
                            __html: renderLightMarkdown(
                                form.values.content,
                                "<p class=\"text-muted-foreground\">Nothing to preview yet.</p>",
                            ),
                        }}
                    />
                </div>
            )}

            <FormField
                form={form}
                name="description"
                label="Summary"
                optional
                counterMax={2000}
                hint="One or two lines shown above the text."
            >
                <Textarea rows={2} />
            </FormField>
        </FormFrame>
    );
}

function ResourceLessonForm({ lesson, onSubmit, layout, isPending, submitLabel, onCancel }: LessonFormProps) {
    const frame = { layout, isPending, submitLabel, onCancel };
    const form = useZodForm({
        schema: resourceSchema,
        initialValues: {
            title: lesson?.title ?? "",
            resourceUrl: lesson?.resourceUrl ?? "",
            description: lesson?.description ?? "",
        },
        onSubmit: (values) => onSubmit(values),
    });

    return (
        <FormFrame {...frame} onSubmit={form.handleSubmit}>
            <FormField form={form} name="title" label="Title" required counterMax={200}>
                <Input placeholder="Week 1 cheat sheet" autoFocus />
            </FormField>

            <FormField
                form={form}
                name="resourceUrl"
                label="Link"
                required
                hint="A PDF, Google Drive file, GitHub repo, slide deck — anything students open in a new tab."
            >
                <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://" />
            </FormField>

            <FormField
                form={form}
                name="description"
                label="What it's for"
                optional
                counterMax={2000}
                hint="Tell students what to do with it."
            >
                <Textarea rows={3} />
            </FormField>
        </FormFrame>
    );
}
