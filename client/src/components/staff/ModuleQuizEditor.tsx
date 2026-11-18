"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Check,
    CheckCircle2,
    Circle,
    Eye,
    HelpCircle,
    ImagePlus,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from "lucide-react";
import Link from "next/link";
import { type ClipboardEvent, type DragEvent, type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import RowActions from "@/components/admin/RowActions";
import ModuleContentHeader from "@/components/staff/ModuleContentHeader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { optionalTextField, textField } from "@/lib/validation";
import { curriculumAuthoring } from "@/services/curriculum";
import type { AdminQuiz, AdminQuizQuestion, QuizOptionInput } from "@/types/admin.types";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/** What the API's upload takes — the same limits, checked before sending. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The first image in a drop or a paste, if there is one. */
const imageFrom = (files: FileList | null | undefined) =>
    Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ?? null;

const quizMetaSchema = z.object({
    title: textField({ label: "Quiz title", min: 3, max: 200 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
});

type OptionRow = { id?: string; text: string; isCorrect: boolean };

const emptyOptionRows = (): OptionRow[] => [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
];

/** What's wrong with a question draft, or null. Mirrors the server's own checks
 *  (`quiz.validation.ts`) so a mentor sees the problem before submitting. */
const questionDraftError = (question: string, options: OptionRow[]): string | null => {
    if (question.trim().length < 3) return "Question must be at least 3 characters";
    if (options.length < MIN_OPTIONS) return `A question needs at least ${MIN_OPTIONS} options`;
    if (options.some((o) => o.text.trim().length === 0)) return "Every option needs text";
    if (options.filter((o) => o.isCorrect).length !== 1) return "Mark exactly one option as correct";
    return null;
};

type QuestionValues = { question: string; imageUrl: string | null; explanation?: string; options: OptionRow[] };

/**
 * A picture for the question — a screenshot of code, a diagram, some output —
 * shown to students with its text. Picked, dropped or pasted; it's stored as
 * soon as it's chosen, and the question keeps it once saved.
 */
function QuestionImageField({
    quizId,
    value,
    onChange,
    onBusyChange,
    uploadRef,
}: {
    quizId: string;
    value: string | null;
    onChange: (url: string | null) => void;
    /** True while an image is on its way up — the form waits for it. */
    onBusyChange: (busy: boolean) => void;
    /** Lets the form hand a pasted image to this field. */
    uploadRef: RefObject<((file: File) => void) | null>;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const isUploading = progress !== null;

    const upload = async (file: File) => {
        if (isUploading) return;
        if (!IMAGE_TYPES.includes(file.type)) {
            toast.error("Pick a JPEG, PNG or WebP image.");
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            toast.error("That image is over 5 MB — pick a smaller one.");
            return;
        }
        setProgress(0);
        onBusyChange(true);
        try {
            onChange(await curriculumAuthoring.uploadQuizImage(quizId, file, setProgress));
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Couldn't upload that image."));
        } finally {
            setProgress(null);
            onBusyChange(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };
    uploadRef.current = (file) => void upload(file);

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        const file = imageFrom(event.dataTransfer.files);
        if (file) void upload(file);
    };

    return (
        <div className="space-y-1.5">
            <p className="text-sm font-medium">
                Image <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <p className="text-xs text-muted-foreground">
                Code, a diagram or some output — shown with the question so it&apos;s easier to understand. You can also paste a screenshot.
            </p>

            {value ? (
                <div className="space-y-2">
                    {/* Any size, straight from Cloudinary — a plain <img> keeps its own proportions. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={value}
                        alt="The question's image"
                        className={cn("max-h-72 w-auto max-w-full rounded-md border border-border bg-white object-contain", isUploading && "opacity-50")}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" isLoading={isUploading} onClick={() => inputRef.current?.click()}>
                            {!isUploading && <RefreshCw className="size-4" />} {isUploading ? `Uploading… ${progress}%` : "Replace"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isUploading}
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => onChange(null)}
                        >
                            <X className="size-4" /> Remove image
                        </Button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                        "flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-sm transition-colors",
                        dragging ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                >
                    <ImagePlus className="size-5" aria-hidden />
                    <span className="font-medium">{isUploading ? `Uploading… ${progress}%` : "Add an image"}</span>
                    <span className="text-xs">Click, drop or paste · JPEG, PNG or WebP · up to 5 MB</span>
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                }}
            />
        </div>
    );
}

function QuestionForm({
    quizId,
    initial,
    onCancel,
    onSubmit,
    isSubmitting,
    submitLabel,
}: {
    quizId: string;
    initial?: { question: string; imageUrl: string | null; explanation: string; options: OptionRow[] };
    onCancel: () => void;
    onSubmit: (values: QuestionValues) => void;
    isSubmitting: boolean;
    submitLabel: string;
}) {
    const [question, setQuestion] = useState(initial?.question ?? "");
    const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
    const [explanation, setExplanation] = useState(initial?.explanation ?? "");
    const [options, setOptions] = useState<OptionRow[]>(initial?.options ?? emptyOptionRows());
    const [touched, setTouched] = useState(false);
    const [imageBusy, setImageBusy] = useState(false);
    const uploadImageRef = useRef<((file: File) => void) | null>(null);

    const error = questionDraftError(question, options);

    const updateOption = (index: number, patch: Partial<OptionRow>) =>
        setOptions((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const markCorrect = (index: number) =>
        setOptions((current) => current.map((row, i) => ({ ...row, isCorrect: i === index })));

    // A screenshot pasted anywhere in the form becomes the question's image.
    const onPaste = (event: ClipboardEvent) => {
        const file = imageFrom(event.clipboardData?.files);
        if (!file) return;
        event.preventDefault();
        uploadImageRef.current?.(file);
    };

    return (
        <form
            className="space-y-4"
            onPaste={onPaste}
            onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (error) return;
                onSubmit({ question: question.trim(), imageUrl, explanation: explanation.trim() || undefined, options });
            }}
        >
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Question</label>
                <Textarea
                    autoFocus
                    rows={2}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What does DFS stand for?"
                    maxLength={1000}
                />
            </div>

            <QuestionImageField quizId={quizId} value={imageUrl} onChange={setImageUrl} onBusyChange={setImageBusy} uploadRef={uploadImageRef} />

            <div className="space-y-2">
                <label className="text-sm font-medium">Options — mark the correct one</label>
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label={option.isCorrect ? "Correct option" : "Mark as the correct option"}
                            onClick={() => markCorrect(index)}
                            className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                                option.isCorrect
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50",
                            )}
                        >
                            {option.isCorrect ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                        </button>
                        <Input
                            value={option.text}
                            onChange={(e) => updateOption(index, { text: e.target.value })}
                            placeholder={`Option ${index + 1}`}
                            maxLength={300}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Remove option"
                            disabled={options.length <= MIN_OPTIONS}
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                ))}

                {options.length < MAX_OPTIONS && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOptions((current) => [...current, { text: "", isCorrect: false }])}
                    >
                        <Plus className="size-4" /> Add option
                    </Button>
                )}
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">
                    Explanation <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                    rows={2}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Shown to the student right after they answer."
                    maxLength={2000}
                />
            </div>

            {touched && error && (
                <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
                <Button type="submit" size="sm" isLoading={isSubmitting} disabled={imageBusy} title={imageBusy ? "Wait for the image to finish uploading" : undefined}>
                    {submitLabel}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

const toOptionRows = (question: AdminQuizQuestion): OptionRow[] =>
    question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));

const toOptionInputs = (options: OptionRow[]): QuizOptionInput[] =>
    options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));

/**
 * The quiz for one module — mounted by both consoles, same as
 * `ModuleLessonsEditor`. A module has at most one quiz (see the `Quiz` model),
 * so this is "create the quiz" or "edit the quiz", never a list.
 */
export default function ModuleQuizEditor({
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

    const [creatingQuiz, setCreatingQuiz] = useState(false);
    const [editingMeta, setEditingMeta] = useState(false);
    const [addingQuestion, setAddingQuestion] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

    const { data: quiz, isLoading, isError, error } = useQuery({
        queryKey: ["quiz", moduleId],
        queryFn: () => curriculumAuthoring.getModuleQuiz(moduleId),
    });

    // The quiz goes live with its module — the header's query, already cached.
    const { data: milestones } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });
    const courseModule = milestones?.flatMap((milestone) => milestone.modules).find((m) => m.id === moduleId);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["quiz", moduleId] });
        void queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] });
    };

    const createQuizForm = useZodForm({
        schema: quizMetaSchema,
        initialValues: { title: "", description: "" },
        onSubmit: (values) =>
            createQuiz.mutate({ title: values.title, description: values.description || undefined }),
    });

    const editMetaForm = useZodForm({
        schema: quizMetaSchema,
        initialValues: { title: quiz?.title ?? "", description: quiz?.description ?? "" },
        onSubmit: (values) =>
            updateQuizMeta.mutate({ title: values.title, description: values.description || null }),
    });

    const createQuiz = useMutation({
        mutationFn: (values: { title: string; description?: string }) =>
            curriculumAuthoring.createQuiz({ moduleId, ...values }),
        onSuccess: () => {
            toast.success("Quiz created. Add its first question below.");
            setCreatingQuiz(false);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't create that quiz.")),
    });

    const updateQuizMeta = useMutation({
        mutationFn: (values: { title: string; description: string | null }) =>
            curriculumAuthoring.updateQuiz(quiz!.id, values),
        onSuccess: () => {
            toast.success("Quiz details saved.");
            setEditingMeta(false);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save those details.")),
    });

    const { reset: resetMetaForm } = editMetaForm;
    useEffect(() => {
        if (quiz) resetMetaForm({ title: quiz.title, description: quiz.description ?? "" });
    }, [quiz, resetMetaForm]);

    // Only for a quiz written after its module went live — otherwise it goes
    // live with the module, by itself.
    const makeLive = useMutation({
        mutationFn: () => curriculumAuthoring.updateQuiz(quiz!.id, { isPublished: true }),
        onSuccess: () => {
            toast.success("Quiz is live — students can take it now.");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't make the quiz live.")),
    });

    const deleteQuiz = useMutation({
        mutationFn: () => curriculumAuthoring.deleteQuiz(quiz!.id),
        onSuccess: () => {
            toast.success("Quiz deleted.");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that quiz.")),
    });

    const addQuestion = useMutation({
        mutationFn: (values: QuestionValues) =>
            curriculumAuthoring.createQuestion(quiz!.id, {
                question: values.question,
                imageUrl: values.imageUrl ?? undefined,
                explanation: values.explanation,
                options: toOptionInputs(values.options),
            }),
        onSuccess: () => {
            toast.success("Question added.");
            setAddingQuestion(false);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that question.")),
    });

    const updateQuestion = useMutation({
        mutationFn: ({
            questionId,
            values,
        }: {
            questionId: string;
            values: QuestionValues;
        }) =>
            curriculumAuthoring.updateQuestion(questionId, {
                question: values.question,
                imageUrl: values.imageUrl,
                explanation: values.explanation ?? null,
                options: toOptionInputs(values.options),
            }),
        onSuccess: () => {
            toast.success("Question updated.");
            setEditingQuestionId(null);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that question.")),
    });

    const removeQuestion = useMutation({
        mutationFn: (questionId: string) => curriculumAuthoring.deleteQuestion(questionId),
        onSuccess: () => {
            toast.success("Question deleted.");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that question.")),
    });

    /**
     * Drag-to-reorder, optimistic like every other list in the editor: the
     * questions move (and renumber) on drop, the handle spins until the
     * server has it, and a failure puts them back.
     */
    const reorder = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderQuestions(quiz!.id, orderedIds),
        onMutate: async ({ orderedIds }) => {
            await queryClient.cancelQueries({ queryKey: ["quiz", moduleId] });
            const previous = queryClient.getQueryData<AdminQuiz | null>(["quiz", moduleId]);
            if (previous) {
                const byId = new Map(previous.questions.map((question) => [question.id, question]));
                queryClient.setQueryData<AdminQuiz>(["quiz", moduleId], {
                    ...previous,
                    questions: orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                });
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(["quiz", moduleId], context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder the questions."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["quiz", moduleId] }),
    });

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this quiz</p>
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

    const PANEL = "rounded-card border border-border bg-card shadow-card";
    const hasQuestions = Boolean(quiz && quiz.questions.length > 0);
    // A draft quiz in a module that's already live waits on staff; any other draft waits on the module.
    const waitsOnStaff = Boolean(quiz && !quiz.isPublished && courseModule?.isPublished);

    return (
        <div className="w-full space-y-6">
            <ModuleContentHeader courseId={courseId} moduleId={moduleId} area={area} active="quiz" />

            {quiz && (
                <section aria-label="The quiz" className={cn(PANEL, "px-5 py-4 sm:px-6")}>
                    {editingMeta ? (
                        <form className="space-y-4" noValidate onSubmit={editMetaForm.handleSubmit}>
                            <FormField form={editMetaForm} name="title" label="Quiz title" required counterMax={200}>
                                <Input autoFocus />
                            </FormField>
                            <FormField form={editMetaForm} name="description" label="Description" optional counterMax={2000}>
                                <Textarea rows={2} />
                            </FormField>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" isLoading={updateQuizMeta.isPending}>
                                    Save
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingMeta(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-lg font-semibold">{quiz.title}</span>
                                    <span
                                        className={cn(
                                            "rounded-sm px-2 py-px text-xs font-semibold",
                                            quiz.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                                        )}
                                    >
                                        {quiz.isPublished ? "Live" : "Draft"}
                                    </span>
                                </p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · students answer them all and submit once, then see
                                    their score and the right answers.
                                </p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    Students take it{" "}
                                    <span className="font-medium text-foreground">
                                        {quiz.position === null
                                            ? "after the last lesson"
                                            : quiz.position === 0
                                                ? "before the first lesson"
                                                : `after lesson ${String(quiz.position).padStart(2, "0")}`}
                                    </span>{" "}
                                    —{" "}
                                    <Link href={routes.module(moduleId)} className="font-medium text-primary hover:underline">
                                        drag it in the lesson list to move it
                                    </Link>
                                    .
                                </p>
                                {quiz.description && <p className="mt-2 text-sm">{quiz.description}</p>}
                                {/* When students get it: with the module, never on its own — and no separate notification. */}
                                {!quiz.isPublished && courseModule && (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {waitsOnStaff
                                            ? hasQuestions
                                                ? "The module is already live — make the quiz live when its questions are ready."
                                                : "The module is already live — add the questions, then make the quiz live."
                                            : courseModule.releaseAt
                                              ? `Goes live together with the module, ${formatDateTime(courseModule.releaseAt)}.`
                                              : "Goes live together with the module — nothing to publish here."}
                                        {!waitsOnStaff && !hasQuestions && " Add at least one question by then, or it stays a draft."}
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                {waitsOnStaff && (
                                    <Button
                                        size="sm"
                                        isLoading={makeLive.isPending}
                                        disabled={!hasQuestions}
                                        title={hasQuestions ? undefined : "Add at least one question first"}
                                        onClick={() => makeLive.mutate()}
                                    >
                                        {!makeLive.isPending && <Eye />} Make it live
                                    </Button>
                                )}
                                <RowActions
                                    label="More for the quiz"
                                    items={[
                                        { label: "Edit the title and description", icon: Pencil, onSelect: () => setEditingMeta(true) },
                                        {
                                            label: "Delete the quiz",
                                            icon: Trash2,
                                            destructive: true,
                                            separatorBefore: true,
                                            onSelect: async () => {
                                                if (
                                                    await confirmAction({
                                                        title: "Delete this quiz?",
                                                        text: "Every question and option goes with it. Refused once a student has taken it.",
                                                        confirmText: "Delete quiz",
                                                    })
                                                ) {
                                                    deleteQuiz.mutate();
                                                }
                                            },
                                        },
                                    ]}
                                />
                            </div>
                        </div>
                    )}
                </section>
            )}

            {!quiz ? (
                creatingQuiz ? (
                    <section aria-label="New quiz" className={cn(PANEL, "border-primary/30 p-5 sm:p-6")}>
                        <form className="space-y-4" noValidate onSubmit={createQuizForm.handleSubmit}>
                            <FormField form={createQuizForm} name="title" label="Quiz title" required counterMax={200}>
                                <Input placeholder="Module 03 Quiz" autoFocus />
                            </FormField>
                            <FormField form={createQuizForm} name="description" label="Description" optional counterMax={2000}>
                                <Textarea rows={2} placeholder="Check your understanding of this module." />
                            </FormField>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" isLoading={createQuiz.isPending}>
                                    Create quiz
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingQuiz(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </section>
                ) : (
                    <div className="rounded-card border border-dashed border-border px-6 py-16 text-center">
                        <HelpCircle className="mx-auto size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 font-medium">No quiz here yet</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">A short single-choice check students take right after the lessons.</p>
                        <Button className="mt-5" onClick={() => setCreatingQuiz(true)}>
                            <Plus /> Create quiz
                        </Button>
                    </div>
                )
            ) : (
                <SortableList
                    ids={quiz.questions.map((question) => question.id)}
                    disabled={reorder.isPending}
                    getLabel={(id) => `Question ${quiz.questions.findIndex((question) => question.id === id) + 1}`}
                    onReorder={(orderedIds, movedId) => reorder.mutate({ orderedIds, movedId })}
                >
                    <ol className="space-y-3">
                        {quiz.questions.map((question, index) => (
                            <SortableItem
                                key={question.id}
                                id={question.id}
                                as="li"
                                aria-busy={(reorder.isPending && reorder.variables?.movedId === question.id) || undefined}
                                className={cn(PANEL, editingQuestionId === question.id && "border-primary/30")}
                            >
                                {editingQuestionId === question.id ? (
                                    <div className="p-5 sm:p-6">
                                        <QuestionForm
                                            quizId={quiz.id}
                                            initial={{
                                                question: question.question,
                                                imageUrl: question.imageUrl,
                                                explanation: question.explanation ?? "",
                                                options: toOptionRows(question),
                                            }}
                                            submitLabel="Save question"
                                            isSubmitting={updateQuestion.isPending}
                                            onCancel={() => setEditingQuestionId(null)}
                                            onSubmit={(values) => updateQuestion.mutate({ questionId: question.id, values })}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex gap-3 px-4 py-4 sm:px-5">
                                        <div className="flex shrink-0 flex-col items-center gap-1">
                                            <span className="font-mono text-sm font-semibold tabular-nums text-primary">Q{String(index + 1).padStart(2, "0")}</span>
                                            {quiz.questions.length > 1 && (
                                                <DragHandle label={`Question ${index + 1}`} isSaving={reorder.isPending && reorder.variables?.movedId === question.id} />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start gap-3">
                                                <p className="min-w-0 flex-1 font-medium leading-snug">{question.question}</p>
                                                <RowActions
                                                    label={`More for question ${index + 1}`}
                                                    primary={
                                                        <Button size="sm" variant="outline" onClick={() => setEditingQuestionId(question.id)}>
                                                            <Pencil /> Edit
                                                        </Button>
                                                    }
                                                    items={[
                                                        {
                                                            label: "Delete",
                                                            icon: Trash2,
                                                            destructive: true,
                                                            onSelect: async () => {
                                                                if (await confirmAction({ title: "Delete this question?", confirmText: "Delete question" })) {
                                                                    removeQuestion.mutate(question.id);
                                                                }
                                                            },
                                                        },
                                                    ]}
                                                />
                                            </div>
                                            {question.imageUrl && (
                                                // Any size, straight from Cloudinary — a plain <img> keeps its own proportions.
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={question.imageUrl}
                                                    alt={`Image for question ${index + 1}`}
                                                    loading="lazy"
                                                    className="mt-3 max-h-48 w-auto max-w-full rounded-md border border-border bg-white object-contain"
                                                />
                                            )}
                                            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                                                {question.options.map((option) => (
                                                    <li
                                                        key={option.id}
                                                        className={cn(
                                                            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                                                            option.isCorrect ? "border-primary/40 bg-primary/5 font-medium" : "border-border text-muted-foreground",
                                                        )}
                                                    >
                                                        {option.isCorrect ? (
                                                            <Check className="size-4 shrink-0 text-primary" aria-label="Correct answer" />
                                                        ) : (
                                                            <Circle className="size-3.5 shrink-0" aria-hidden />
                                                        )}
                                                        <span className="min-w-0">{option.text}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {question.explanation && (
                                                <p className="mt-3 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground">
                                                    <span className="font-medium text-foreground">Why: </span>
                                                    {question.explanation}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </SortableItem>
                        ))}
                    </ol>

                    <div className="mt-3">
                        {addingQuestion ? (
                            <section aria-label="New question" className={cn(PANEL, "border-primary/30 p-5 sm:p-6")}>
                                <QuestionForm
                                    quizId={quiz.id}
                                    submitLabel="Add question"
                                    isSubmitting={addQuestion.isPending}
                                    onCancel={() => setAddingQuestion(false)}
                                    onSubmit={(values) => addQuestion.mutate(values)}
                                />
                            </section>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAddingQuestion(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                            >
                                <Plus className="size-4" aria-hidden /> Add {quiz.questions.length === 0 ? "the first" : "a"} question
                            </button>
                        )}
                    </div>
                </SortableList>
            )}
        </div>
    );
}
