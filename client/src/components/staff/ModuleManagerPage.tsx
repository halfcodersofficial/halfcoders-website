"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CalendarClock,
    CalendarDays,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    ClipboardCheck,
    Dumbbell,
    Eye,
    EyeOff,
    FileText,
    Layers,
    ListChecks,
    Pencil,
    PlayCircle,
    Plus,
    Save,
    Trash2,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import RowActions, { type RowAction } from "@/components/admin/RowActions";
import CurriculumClosedNotice from "@/components/staff/CurriculumClosedNotice";
import { AssignmentModal, PracticeDayModal } from "@/components/staff/WeekItemModals";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { DateTimePickerDialog, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { Input, RadioGroup, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { classModeOptions } from "@/components/shared/CourseClassification";
import { CLASS_MODES, hasCurriculumTools, marksClassMode, MODE_META } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { optionalTextField, textField } from "@/lib/validation";
import { curriculumAuthoring, type WeekItemKind } from "@/services/curriculum";
import type { MentorMilestone } from "@/types/mentor.types";

const groupSchema = z.object({
    title: textField({ label: "Title", min: 3, max: 160 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
});

const itemSchema = z.object({
    title: textField({ label: "Title", min: 3, max: 160 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
    /** Only asked on a course that runs both online and offline; empty is "not marked". */
    mode: z.enum(["", ...CLASS_MODES]),
});

type ModuleValues = z.input<typeof itemSchema>;
const EMPTY_MODULE: ModuleValues = { title: "", description: "", mode: "" };

/** Online or offline — asked only on a course that runs both. */
function ModeField({ form }: { form: ZodFormApi<ModuleValues> }) {
    return (
        <FormField form={form} name="mode" label="Where it happens" optional hint="Students see it beside the module.">
            <RadioGroup inline options={classModeOptions()} />
        </FormField>
    );
}

const labelSchema = z.object({
    milestoneLabel: textField({ label: "Top-level group name", min: 1, max: 40 }),
    moduleLabel: textField({ label: "Group name inside those", min: 1, max: 40 }),
});

/** Where an item stands for students: live (and since when), scheduled to go live, or a draft. */
function StatusText({
    isPublished,
    publishedAt,
    releaseAt,
    canSchedule,
}: {
    isPublished: boolean;
    publishedAt?: string | null;
    releaseAt: string | null;
    canSchedule: boolean;
}) {
    if (isPublished) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Live{publishedAt ? ` since ${formatDate(publishedAt)}` : ""}
            </span>
        );
    }
    if (canSchedule && releaseAt) {
        return (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
                <CalendarClock className="size-3.5" aria-hidden /> Goes live {formatDateTime(releaseAt)}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
            Draft
        </span>
    );
}

/**
 * One row of a week — a module, an assignment or a practice day. What it is
 * and where it stands on the left; its way in, a one-tap Publish while it's
 * a draft, and everything rarer behind ⋯ on the right.
 */
function ItemRow({
    itemKey,
    sortable,
    saving,
    icon: Icon,
    typeLabel,
    title,
    href,
    onOpen,
    status,
    meta,
    note,
    primary,
    onPublish,
    actions,
    children,
}: {
    itemKey: string;
    sortable: boolean;
    saving: boolean;
    icon: LucideIcon;
    typeLabel: string;
    title: string;
    href?: string;
    onOpen?: () => void;
    status: ReactNode;
    meta: (string | false | null | undefined)[];
    note?: ReactNode;
    primary?: ReactNode;
    onPublish?: () => void;
    actions: RowAction[];
    /** Replaces the row — an inline edit form. */
    children?: ReactNode;
}) {
    return (
        <SortableItem id={itemKey} aria-busy={saving || undefined} className="px-3 py-3 transition-colors hover:bg-secondary/25 sm:px-4">
            {children ?? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {sortable ? <DragHandle label={title} isSaving={saving} /> : <span className="w-2" aria-hidden />}
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                            <p className="flex min-w-0 items-baseline gap-2">
                                {href ? (
                                    <Link href={href} className="truncate text-sm font-medium hover:underline">
                                        {title}
                                    </Link>
                                ) : onOpen ? (
                                    <button type="button" onClick={onOpen} className="truncate text-left text-sm font-medium hover:underline">
                                        {title}
                                    </button>
                                ) : (
                                    <span className="truncate text-sm font-medium">{title}</span>
                                )}
                                <span className="hidden shrink-0 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
                                    {typeLabel}
                                </span>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {status}
                                {meta.filter(Boolean).map((part) => (
                                    <Fragment key={String(part)}>
                                        <span aria-hidden>·</span>
                                        <span>{part}</span>
                                    </Fragment>
                                ))}
                            </p>
                            {note}
                        </div>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        {onPublish && (
                            <Button size="sm" variant="ghost" className="text-primary hover:text-primary" onClick={onPublish} title="Make it visible to students">
                                Publish
                            </Button>
                        )}
                        <RowActions label={`More for ${title}`} primary={primary} items={actions} />
                    </div>
                </div>
            )}
        </SortableItem>
    );
}

/** A figure in the strip at the top. */
function Figure({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="bg-card px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
            {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

/** What's being scheduled in the page's one release dialog. */
type Scheduling = { kind: WeekItemKind; id: string; title: string; releaseAt: string | null };

type WeekModule = MentorMilestone["modules"][number];
type WeekAssignment = MentorMilestone["assignments"][number];
type WeekPractice = MentorMilestone["practiceDays"][number];

/** One row of a week's single list — `key` is its sortable id, `${kind}:${id}`. */
type WeekItem =
    | { kind: "MODULE"; key: string; entry: WeekModule }
    | { kind: "ASSIGNMENT"; key: string; entry: WeekAssignment }
    | { kind: "PRACTICE"; key: string; entry: WeekPractice };

const KIND_RANK: Record<WeekItemKind, number> = { MODULE: 0, ASSIGNMENT: 1, PRACTICE: 2 };

/**
 * A week's modules, assignments and practice days as the one list students
 * see, in its saved order. Ties (rows that predate `position`) fall back to
 * modules first, then each kind's own order.
 */
const weekItems = (milestone: MentorMilestone): WeekItem[] =>
    [
        ...milestone.modules.map((entry) => ({ kind: "MODULE" as const, key: `MODULE:${entry.id}`, entry })),
        ...milestone.assignments.map((entry) => ({ kind: "ASSIGNMENT" as const, key: `ASSIGNMENT:${entry.id}`, entry })),
        ...milestone.practiceDays.map((entry) => ({ kind: "PRACTICE" as const, key: `PRACTICE:${entry.id}`, entry })),
    ].sort(
        (a, b) =>
            a.entry.position - b.entry.position ||
            KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
            a.entry.order - b.entry.order,
    );

/**
 * A week after a drop — positions follow the new list, and each kind's own
 * order follows its positions, the same way the server saves it.
 */
const applyWeekOrder = (milestone: MentorMilestone, orderedKeys: string[]): MentorMilestone => {
    const positionOf = new Map(orderedKeys.map((key, index) => [key, index + 1]));
    const renumber = <T extends { id: string; order: number; position: number }>(kind: WeekItemKind, list: T[]) =>
        list
            .map((entry) => ({ ...entry, position: positionOf.get(`${kind}:${entry.id}`) ?? entry.position }))
            .sort((a, b) => a.position - b.position)
            .map((entry, index) => ({ ...entry, order: index + 1 }));

    return {
        ...milestone,
        modules: renumber("MODULE", milestone.modules),
        assignments: renumber("ASSIGNMENT", milestone.assignments),
        practiceDays: renumber("PRACTICE", milestone.practiceDays),
    };
};

type MilestoneFormState = { mode: "add" } | { mode: "edit"; milestone: MentorMilestone } | null;
type ModuleFormState =
    | { mode: "add"; milestoneId: string }
    | { mode: "edit"; milestoneId: string; module: WeekModule }
    | null;

/**
 * The Module Manager — the course's real content. Its top-level groups
 * (Milestones, or whatever a course calls them), the modules inside those,
 * and one click from each to its lessons, quiz, assignments and practice
 * days. Every module keeps its own publish date here, independent of the
 * planned schedule in the Outline Maker — neither ever moves the other.
 */
export default function ModuleManagerPage({
    courseId,
    area,
}: {
    courseId: string;
    area: StaffArea;
}) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();

    const router = useRouter();

    const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(null);
    const [moduleForm, setModuleForm] = useState<ModuleFormState>(null);
    const [editingLabels, setEditingLabels] = useState(false);
    const [scheduling, setScheduling] = useState<Scheduling | null>(null);

    // Which assignment / practice day a modal is for (null id: a new one).
    // Kept apart from the open flags so a modal's content doesn't vanish
    // while it animates out.
    const [assignmentPanel, setAssignmentPanel] = useState({ milestoneId: "", assignmentId: null as string | null });
    const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
    const openAssignmentPanel = (milestoneId: string, assignmentId: string | null = null) => {
        setAssignmentPanel({ milestoneId, assignmentId });
        setAssignmentPanelOpen(true);
    };
    const [practicePanel, setPracticePanel] = useState({ milestoneId: "", practiceId: null as string | null });
    const [practicePanelOpen, setPracticePanelOpen] = useState(false);
    const openPracticePanel = (milestoneId: string, practiceId: string | null = null) => {
        setPracticePanel({ milestoneId, practiceId });
        setPracticePanelOpen(true);
    };

    // Weeks start open; this holds the ones closed. Kept here so "Collapse
    // all" can drive them and a refetch after a save doesn't reopen them.
    const [collapsedWeeks, setCollapsedWeeks] = useState<ReadonlySet<string>>(() => new Set());
    const toggleWeek = (milestoneId: string) =>
        setCollapsedWeeks((current) => {
            const next = new Set(current);
            if (next.has(milestoneId)) next.delete(milestoneId);
            else next.add(milestoneId);
            return next;
        });

    const { data: course, isLoading: isCourseLoading } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    const { data: milestones, isLoading, isError, error } = useQuery({
        queryKey: ["curriculum", courseId],
        queryFn: () => curriculumAuthoring.listMilestones(courseId),
    });

    // Read from the live list, so a modal always edits the latest version.
    const assignmentMilestone = milestones?.find((m) => m.id === assignmentPanel.milestoneId) ?? null;
    const panelAssignment =
        assignmentMilestone?.assignments.find((a) => a.id === assignmentPanel.assignmentId) ?? null;
    const practiceMilestone = milestones?.find((m) => m.id === practicePanel.milestoneId) ?? null;
    const panelPractice = practiceMilestone?.practiceDays.find((p) => p.id === practicePanel.practiceId) ?? null;

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["curriculum", courseId] });
        void queryClient.invalidateQueries({ queryKey: ["staff", "course", courseId] });
    };

    const mutationHandlers = (successMessage: string, fallback: string) => ({
        onSuccess: () => {
            toast.success(successMessage);
            refresh();
        },
        onError: (err: unknown) => toast.error(getApiErrorMessage(err, fallback)),
    });

    const milestoneLabel = (course?.milestoneLabel ?? "Milestone").toLowerCase();
    const moduleLabel = (course?.moduleLabel ?? "Module").toLowerCase();
    // Scheduled releases are a bootcamp thing — a traditional course is
    // self-paced, so everything there is just published or not, right away.
    const canSchedule = course?.courseType === "BOOTCAMP";
    // Practice days are bootcamp only too. One left over from when a
    // traditional course was a bootcamp can only be removed.
    const allowsPractice = canSchedule;
    // A course that runs online and offline says which each module is.
    const marksMode = marksClassMode(course?.mode);

    const saveLabels = useMutation({
        mutationFn: (values: z.output<typeof labelSchema>) =>
            curriculumAuthoring.updateContent(courseId, values),
        onSuccess: (_data, values) => {
            toast.success("Terminology saved.");
            setEditingLabels(false);
            // Paint the new labels immediately rather than waiting on the
            // invalidated query's own round trip — otherwise the read-only
            // view flashes the old words for as long as that refetch takes.
            queryClient.setQueryData(
                ["staff", "course", courseId],
                (current: typeof course) => (current ? { ...current, ...values } : current),
            );
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const labelForm = useZodForm({
        schema: labelSchema,
        initialValues: { milestoneLabel: "Milestone", moduleLabel: "Module" },
        onSubmit: (values) => saveLabels.mutate(values),
    });

    const { reset: resetLabelForm } = labelForm;
    useEffect(() => {
        if (course) {
            resetLabelForm({ milestoneLabel: course.milestoneLabel, moduleLabel: course.moduleLabel });
        }
    }, [course, resetLabelForm]);

    const createMilestone = useMutation({
        mutationFn: (values: z.output<typeof groupSchema>) =>
            curriculumAuthoring.createMilestone({
                courseId,
                title: values.title,
                description: values.description || undefined,
            }),
        onSuccess: () => {
            toast.success(`${course?.milestoneLabel ?? "Milestone"} added.`);
            setMilestoneForm(null);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that.")),
    });

    const editMilestone = useMutation({
        mutationFn: ({ id, values }: { id: string; values: z.output<typeof groupSchema> }) =>
            curriculumAuthoring.updateMilestone(id, {
                title: values.title,
                description: values.description || null,
            }),
        onSuccess: () => {
            toast.success(`${course?.milestoneLabel ?? "Milestone"} saved.`);
            setMilestoneForm(null);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const milestoneFormApi = useZodForm({
        schema: groupSchema,
        initialValues: { title: "", description: "" },
        onSubmit: (values) => {
            if (milestoneForm?.mode === "edit") {
                editMilestone.mutate({ id: milestoneForm.milestone.id, values });
            } else {
                createMilestone.mutate(values);
            }
        },
    });

    const { reset: resetMilestoneForm } = milestoneFormApi;
    const openMilestoneForm = (state: MilestoneFormState) => {
        setModuleForm(null);
        setMilestoneForm(state);
        if (state?.mode === "edit") {
            resetMilestoneForm({
                title: state.milestone.title,
                description: state.milestone.description ?? "",
            });
        } else {
            resetMilestoneForm({ title: "", description: "" });
        }
    };

    const createModule = useMutation({
        mutationFn: (values: z.output<typeof itemSchema>) => {
            if (moduleForm?.mode !== "add") throw new Error("No group selected");
            return curriculumAuthoring.createModule({
                milestoneId: moduleForm.milestoneId,
                title: values.title,
                description: values.description || undefined,
                ...(marksMode && values.mode && { mode: values.mode }),
            });
        },
        onSuccess: (created) => {
            // The very next thing anyone does with a new module is fill it,
            // so offer that straight from the confirmation.
            toast.success(`${course?.moduleLabel ?? "Module"} added.`, {
                action: { label: "Add lessons", onClick: () => router.push(routes.module(created.id)) },
            });
            setModuleForm(null);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that.")),
    });

    // Title (and place) only. The description is edited on the module's own
    // page — this form never shows it, so it mustn't send it either.
    const editModule = useMutation({
        mutationFn: ({ id, values }: { id: string; values: z.output<typeof itemSchema> }) =>
            curriculumAuthoring.updateModule(id, {
                title: values.title,
                ...(marksMode && values.mode && { mode: values.mode }),
            }),
        onSuccess: () => {
            toast.success(`${course?.moduleLabel ?? "Module"} saved.`);
            setModuleForm(null);
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const moduleFormApi = useZodForm({
        schema: itemSchema,
        initialValues: EMPTY_MODULE,
        onSubmit: (values) => {
            if (moduleForm?.mode === "edit") {
                editModule.mutate({ id: moduleForm.module.id, values });
            } else {
                createModule.mutate(values);
            }
        },
    });

    const { reset: resetModuleForm } = moduleFormApi;
    const openModuleForm = (state: ModuleFormState) => {
        setMilestoneForm(null);
        setModuleForm(state);
        if (state?.mode === "edit") {
            resetModuleForm({ title: state.module.title, description: "", mode: state.module.mode ?? "" });
        } else {
            resetModuleForm(EMPTY_MODULE);
        }
    };

    const toggleMilestone = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updateMilestone(id, { isPublished: next }),
        ...mutationHandlers("Updated.", "Couldn't update that."),
    });

    const toggleModule = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updateModule(id, { isPublished: next }),
        ...mutationHandlers("Updated.", "Couldn't update that."),
    });

    const scheduleModule = useMutation({
        mutationFn: ({ id, releaseAt }: { id: string; releaseAt: string | null }) =>
            curriculumAuthoring.updateModule(id, { releaseAt }),
        ...mutationHandlers(
            "Release schedule updated. It goes live on its own at that time.",
            "Couldn't schedule that.",
        ),
    });

    const curriculumKey = ["curriculum", courseId];

    /**
     * Drag-to-reorder, for weeks and for the rows inside one. Optimistic:
     * the list takes its new shape on drop (positions renumbered, so "Week 02"
     * labels update at once), the dragged row's handle spins until the server
     * has it, and a failure puts everything back. Settling waits on the
     * refetch, so the spinner clears only once the saved order is on screen.
     */
    const optimistically = async (update: (current: MentorMilestone[]) => MentorMilestone[]) => {
        await queryClient.cancelQueries({ queryKey: curriculumKey });
        const previous = queryClient.getQueryData<MentorMilestone[]>(curriculumKey);
        if (previous) queryClient.setQueryData<MentorMilestone[]>(curriculumKey, update(previous));
        return { previous };
    };

    const rollback = (err: unknown, context?: { previous?: MentorMilestone[] }) => {
        if (context?.previous) queryClient.setQueryData(curriculumKey, context.previous);
        toast.error(getApiErrorMessage(err, "Couldn't reorder those."));
    };

    const reorderMilestones = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderMilestones(courseId, orderedIds),
        onMutate: ({ orderedIds }) =>
            optimistically((current) => {
                const byId = new Map(current.map((milestone) => [milestone.id, milestone]));
                return orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 }));
            }),
        onError: (err, _variables, context) => rollback(err, context),
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => queryClient.invalidateQueries({ queryKey: curriculumKey }),
    });

    // A week's modules, assignments and practice days share one order —
    // `orderedKeys` are the rows' `${kind}:${id}` keys, top to bottom.
    const reorderWeek = useMutation({
        mutationFn: ({ milestoneId, orderedKeys }: { milestoneId: string; orderedKeys: string[]; movedKey: string }) =>
            curriculumAuthoring.reorderWeekItems(
                milestoneId,
                orderedKeys.map((key) => {
                    const [kind, id] = key.split(":");
                    return { kind: kind as WeekItemKind, id };
                }),
            ),
        onMutate: ({ milestoneId, orderedKeys }) =>
            optimistically((current) =>
                current.map((milestone) =>
                    milestone.id === milestoneId ? applyWeekOrder(milestone, orderedKeys) : milestone,
                ),
            ),
        onError: (err, _variables, context) => rollback(err, context),
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => queryClient.invalidateQueries({ queryKey: curriculumKey }),
    });

    const removeMilestone = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deleteMilestone(id),
        ...mutationHandlers("Deleted.", "Couldn't delete that."),
    });

    const removeModule = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deleteModule(id),
        ...mutationHandlers("Deleted.", "Couldn't delete that."),
    });

    // ---- A week's assignments and practice days, listed beside its modules.
    const toggleAssignment = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updateAssignment(id, { isPublished: next }),
        ...mutationHandlers("Updated.", "Couldn't update that."),
    });

    const removeAssignment = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deleteAssignment(id),
        // The API refuses once students have submitted, and says so.
        ...mutationHandlers("Assignment deleted.", "Couldn't delete that assignment."),
    });

    const scheduleAssignment = useMutation({
        mutationFn: ({ id, releaseAt }: { id: string; releaseAt: string | null }) =>
            curriculumAuthoring.updateAssignment(id, { releaseAt }),
        ...mutationHandlers(
            "Release schedule updated. It goes live on its own at that time.",
            "Couldn't schedule that.",
        ),
    });

    const togglePractice = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            curriculumAuthoring.updatePracticeDay(id, { isPublished: next }),
        ...mutationHandlers("Updated.", "Couldn't update that."),
    });

    const schedulePractice = useMutation({
        mutationFn: ({ id, releaseAt }: { id: string; releaseAt: string | null }) =>
            curriculumAuthoring.updatePracticeDay(id, { releaseAt }),
        ...mutationHandlers(
            "Release schedule updated. It goes live on its own at that time.",
            "Couldn't schedule that.",
        ),
    });

    const removePractice = useMutation({
        mutationFn: (id: string) => curriculumAuthoring.deletePracticeDay(id),
        ...mutationHandlers("Practice day deleted.", "Couldn't delete that practice day."),
    });

    // Waits on the course too, so an upcoming one never flashes an empty editor first.
    if (isLoading || isCourseLoading) {
        return (
            <div className="container-page max-w-5xl space-y-5 py-8">
                <Skeleton className="h-12 w-72" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-48 rounded-2xl" />
            </div>
        );
    }

    // An upcoming course has no modules yet; the API refuses every add.
    if (course && !hasCurriculumTools(course.phase)) {
        return <CurriculumClosedNotice tool="Module Manager" area={area} courseId={courseId} />;
    }

    if (isError || !milestones) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this course</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "You may not be assigned to it.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.home}>Back</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const milestoneName = course?.milestoneLabel ?? "Milestone";
    const moduleName = course?.moduleLabel ?? "Module";
    const allModules = milestones.flatMap((milestone) => milestone.modules);
    const allAssignments = milestones.flatMap((milestone) => milestone.assignments);
    const lessons = allModules.reduce((sum, entry) => sum + entry._count.videos, 0);
    const scheduled = canSchedule
        ? milestones.flatMap((milestone) => [...milestone.modules, ...milestone.assignments, ...milestone.practiceDays]).filter((entry) => !entry.isPublished && entry.releaseAt).length
        : 0;
    const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

    const askDelete = async (title: string, text: string | undefined, onConfirm: () => void) => {
        if (await confirmAction({ title: `Delete "${title}"?`, text, confirmText: "Delete" })) onConfirm();
    };
    const scheduleItem = (target: Scheduling, releaseAt: string | null) => {
        const mutation = target.kind === "MODULE" ? scheduleModule : target.kind === "ASSIGNMENT" ? scheduleAssignment : schedulePractice;
        mutation.mutate({ id: target.id, releaseAt });
    };
    const scheduleAction = (target: Scheduling, isPublished: boolean): RowAction => ({
        label: target.releaseAt ? "Change the release time" : "Schedule a release",
        icon: CalendarClock,
        hidden: !canSchedule || isPublished,
        onSelect: () => setScheduling(target),
    });

    return (
        <div className="container-page max-w-5xl space-y-6 py-8">
            <header className="space-y-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                {/* In the mentor console the course's own tab bar does this. */}
                {area === "admin" && <BackButton href={routes.courses} label="All courses" />}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0 max-w-2xl">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Module Manager</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The real course content. Students see only what&apos;s published
                            {canSchedule ? " — a scheduled item publishes itself at its time" : " — this course is self-paced, so nothing is scheduled"}.
                            Its dates are its own, apart from the{" "}
                            <Link href={routes.outline} className="font-medium text-primary hover:underline">
                                Outline Maker
                            </Link>
                            .
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {area === "admin" && (
                            <Button asChild variant="brand-outline">
                                <Link href={routes.outline}>
                                    <CalendarDays /> Outline Maker
                                </Link>
                            </Button>
                        )}
                        <Button onClick={() => (milestoneForm?.mode === "add" ? openMilestoneForm(null) : openMilestoneForm({ mode: "add" }))}>
                            {milestoneForm?.mode === "add" ? "Cancel" : (
                                <>
                                    <Plus /> New {milestoneLabel}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:grid-cols-4">
                <Figure label={`${milestoneName}s`} value={milestones.length} hint={`${milestones.filter((m) => m.isPublished).length} live`} />
                <Figure label={`${moduleName}s`} value={allModules.length} hint={`${allModules.filter((m) => m.isPublished).length} live`} />
                <Figure label="Lessons" value={lessons} hint={`in ${plural(allModules.length, moduleLabel)}`} />
                {canSchedule ? (
                    <Figure label="Scheduled" value={scheduled} hint={scheduled ? "publish themselves on time" : "nothing waiting"} />
                ) : (
                    <Figure label="Assignments" value={allAssignments.length} hint={`${allAssignments.filter((a) => a.isPublished).length} live`} />
                )}
            </dl>

            {/* What this course calls its levels — "Week" and "Module", "Phase" and "Session". */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-5 py-3">
                {editingLabels ? (
                    <form className="w-full space-y-3" noValidate onSubmit={labelForm.handleSubmit}>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField form={labelForm} name="milestoneLabel" label="Top-level group name" required hint='e.g. "Week", "Phase" — defaults to "Milestone".'>
                                <Input placeholder="Milestone" />
                            </FormField>
                            <FormField form={labelForm} name="moduleLabel" label="Group name inside those" required hint='e.g. "Session" — defaults to "Module".'>
                                <Input placeholder="Module" />
                            </FormField>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" isLoading={saveLabels.isPending}>
                                {!saveLabels.isPending && <Save />} Save
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingLabels(false)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Structure: <strong className="font-semibold text-foreground">{milestoneName}</strong>
                            <span aria-hidden> › </span>
                            <strong className="font-semibold text-foreground">{moduleName}</strong>
                            <span aria-hidden> › </span>lessons, quiz
                        </p>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLabels(true)}>
                            <Pencil /> Rename
                        </Button>
                    </>
                )}
            </div>

            {milestoneForm?.mode === "add" && (
                <section aria-label={`New ${milestoneLabel}`} className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm sm:p-6">
                    <form className="space-y-4" noValidate onSubmit={milestoneFormApi.handleSubmit}>
                        <FormField form={milestoneFormApi} name="title" label={`${milestoneName} title`} required counterMax={160}>
                            <Input autoFocus placeholder={`${milestoneName} ${String(milestones.length + 1).padStart(2, "0")}`} />
                        </FormField>
                        <FormField
                            form={milestoneFormApi}
                            name="description"
                            label="Description"
                            optional
                            counterMax={2000}
                            hint={`Shown to students above this ${milestoneLabel}'s contents.`}
                        >
                            <Textarea rows={2} />
                        </FormField>
                        <div className="flex gap-2">
                            <Button type="submit" isLoading={createMilestone.isPending}>
                                Add {milestoneLabel}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => openMilestoneForm(null)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                </section>
            )}

            {milestones.length === 0 && !milestoneForm ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                    <Layers className="mx-auto size-7 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">No {milestoneLabel}s yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        Start with the first {milestoneLabel}, then fill it with {moduleLabel}s, assignments{allowsPractice && " and practice days"}. A course needs one before it
                        can be published.
                    </p>
                    <Button className="mt-5" onClick={() => openMilestoneForm({ mode: "add" })}>
                        <Plus /> New {milestoneLabel}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {milestones.length > 1 && (
                        <div className="flex justify-end">
                            {collapsedWeeks.size === milestones.length ? (
                                <Button size="sm" variant="ghost" onClick={() => setCollapsedWeeks(new Set())}>
                                    <ChevronsUpDown /> Expand all
                                </Button>
                            ) : (
                                <Button size="sm" variant="ghost" onClick={() => setCollapsedWeeks(new Set(milestones.map((milestone) => milestone.id)))}>
                                    <ChevronsDownUp /> Collapse all
                                </Button>
                            )}
                        </div>
                    )}

                    <SortableList
                        ids={milestones.map((milestone) => milestone.id)}
                        disabled={reorderMilestones.isPending}
                        getLabel={(id) => {
                            const milestone = milestones.find((m) => m.id === id);
                            return milestone ? `${milestoneName} ${String(milestone.order).padStart(2, "0")}` : milestoneLabel;
                        }}
                        onReorder={(orderedIds, movedId) => reorderMilestones.mutate({ orderedIds, movedId })}
                    >
                        <div className="space-y-4">
                            {milestones.map((milestone) => {
                                const isSavingPosition = reorderMilestones.isPending && reorderMilestones.variables?.movedId === milestone.id;
                                const number = String(milestone.order).padStart(2, "0");
                                const weekName = `${milestoneName} ${number}`;
                                const isOpen = !collapsedWeeks.has(milestone.id);
                                const panelId = `week-panel-${milestone.id}`;
                                // What's inside, so a collapsed week still says what it holds.
                                const summary = [
                                    plural(milestone.modules.length, moduleLabel),
                                    milestone.assignments.length > 0 && plural(milestone.assignments.length, "assignment"),
                                    milestone.practiceDays.length > 0 && plural(milestone.practiceDays.length, "practice day"),
                                ]
                                    .filter(Boolean)
                                    .join(" · ");
                                const items = weekItems(milestone);
                                const canSortItems = items.length > 1;
                                const isSavingItem = (key: string) => reorderWeek.isPending && reorderWeek.variables?.movedKey === key;
                                const editingWeek = milestoneForm?.mode === "edit" && milestoneForm.milestone.id === milestone.id;

                                return (
                                    <SortableItem
                                        key={milestone.id}
                                        id={milestone.id}
                                        aria-busy={isSavingPosition || undefined}
                                        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                                    >
                                        <div className={cn("px-4 py-4 sm:px-5", isOpen && "border-b border-border")}>
                                            {editingWeek ? (
                                                <form className="space-y-3" noValidate onSubmit={milestoneFormApi.handleSubmit}>
                                                    <FormField form={milestoneFormApi} name="title" label={`${milestoneName} title`} required counterMax={160}>
                                                        <Input autoFocus />
                                                    </FormField>
                                                    <FormField form={milestoneFormApi} name="description" label="Description" optional counterMax={2000}>
                                                        <Textarea rows={2} />
                                                    </FormField>
                                                    <div className="flex gap-2">
                                                        <Button type="submit" size="sm" isLoading={editMilestone.isPending}>
                                                            Save
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => openMilestoneForm(null)}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    {milestones.length > 1 && <DragHandle label={weekName} isSaving={isSavingPosition} />}
                                                    <p className="w-12 shrink-0 text-center leading-none sm:w-14">
                                                        <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">{milestoneName}</span>
                                                        <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-primary">{number}</span>
                                                    </p>
                                                    <button
                                                        type="button"
                                                        aria-expanded={isOpen}
                                                        aria-controls={panelId}
                                                        onClick={() => toggleWeek(milestone.id)}
                                                        className="min-w-0 flex-1 text-left"
                                                    >
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            <span className="truncate font-semibold">{milestone.title}</span>
                                                            <span
                                                                className={cn(
                                                                    "shrink-0 rounded-full px-2 py-px text-[0.6875rem] font-semibold",
                                                                    milestone.isPublished ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                                                                )}
                                                            >
                                                                {milestone.isPublished ? "Live" : "Draft"}
                                                            </span>
                                                        </span>
                                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                            {isSavingPosition ? "Saving the new order…" : summary}
                                                        </span>
                                                    </button>
                                                    <div className="flex shrink-0 items-center gap-1">
                                                        {!milestone.isPublished && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="hidden text-primary hover:text-primary sm:inline-flex"
                                                                onClick={() => toggleMilestone.mutate({ id: milestone.id, next: true })}
                                                            >
                                                                Publish
                                                            </Button>
                                                        )}
                                                        <RowActions
                                                            label={`More for ${weekName}`}
                                                            items={[
                                                                { label: `Edit the ${milestoneLabel}`, icon: Pencil, onSelect: () => openMilestoneForm({ mode: "edit", milestone }) },
                                                                {
                                                                    label: milestone.isPublished ? "Unpublish — hide from students" : "Publish",
                                                                    icon: milestone.isPublished ? EyeOff : Eye,
                                                                    onSelect: () => toggleMilestone.mutate({ id: milestone.id, next: !milestone.isPublished }),
                                                                },
                                                                {
                                                                    label: "Delete",
                                                                    icon: Trash2,
                                                                    destructive: true,
                                                                    separatorBefore: true,
                                                                    onSelect: () =>
                                                                        void askDelete(milestone.title, "Everything in it — its groups, lessons, assignments and practice days — goes with it.", () =>
                                                                            removeMilestone.mutate(milestone.id),
                                                                        ),
                                                                },
                                                            ]}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="w-9 px-0"
                                                            aria-expanded={isOpen}
                                                            aria-controls={panelId}
                                                            aria-label={`${isOpen ? "Collapse" : "Expand"} ${weekName}`}
                                                            onClick={() => toggleWeek(milestone.id)}
                                                        >
                                                            <ChevronDown className={cn("transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Unmounted when closed, like the FAQ. */}
                                        {isOpen && (
                                            <div id={panelId}>
                                                {milestone.description && !editingWeek && (
                                                    <p className="border-b border-border bg-secondary/20 px-5 py-2.5 text-xs text-muted-foreground">{milestone.description}</p>
                                                )}
                                                {items.length === 0 && (
                                                    <p className="px-5 py-5 text-sm text-muted-foreground">
                                                        Nothing in this {milestoneLabel} yet — add a {moduleLabel}, an assignment{allowsPractice && " or a practice day"} below.
                                                    </p>
                                                )}

                                                {/* One list, in the order students meet it: modules,
                                                    assignments and practice days drag between each other. */}
                                                <SortableList
                                                    ids={items.map((item) => item.key)}
                                                    disabled={reorderWeek.isPending}
                                                    getLabel={(key) => items.find((item) => item.key === key)?.entry.title ?? "Item"}
                                                    onReorder={(orderedKeys, movedKey) => reorderWeek.mutate({ milestoneId: milestone.id, orderedKeys, movedKey })}
                                                >
                                                    <div className="divide-y divide-border">
                                                        {items.map((item) => {
                                                            if (item.kind === "MODULE") {
                                                                const courseModule = item.entry;
                                                                const target: Scheduling = { kind: "MODULE", id: courseModule.id, title: courseModule.title, releaseAt: courseModule.releaseAt };
                                                                return (
                                                                    <ItemRow
                                                                        key={item.key}
                                                                        itemKey={item.key}
                                                                        sortable={canSortItems}
                                                                        saving={isSavingItem(item.key)}
                                                                        icon={Layers}
                                                                        typeLabel={moduleName}
                                                                        title={`${String(courseModule.order).padStart(2, "0")}. ${courseModule.title}`}
                                                                        href={routes.module(courseModule.id)}
                                                                        status={<StatusText isPublished={courseModule.isPublished} publishedAt={courseModule.publishedAt} releaseAt={courseModule.releaseAt} canSchedule={canSchedule} />}
                                                                        meta={[
                                                                            marksMode && (courseModule.mode ? MODE_META[courseModule.mode].label : "online or offline not set"),
                                                                            plural(courseModule._count.videos, "lesson"),
                                                                            courseModule._count.quizzes > 0 ? "quiz" : "no quiz",
                                                                        ]}
                                                                        onPublish={courseModule.isPublished ? undefined : () => toggleModule.mutate({ id: courseModule.id, next: true })}
                                                                        primary={
                                                                            <Button asChild size="sm" variant="outline">
                                                                                <Link href={routes.module(courseModule.id)}>
                                                                                    <PlayCircle /> {courseModule._count.videos > 0 ? "Lessons" : "Add lessons"}
                                                                                </Link>
                                                                            </Button>
                                                                        }
                                                                        actions={[
                                                                            {
                                                                                label: marksMode ? "Rename, or set online/offline" : `Rename the ${moduleLabel}`,
                                                                                icon: Pencil,
                                                                                onSelect: () => openModuleForm({ mode: "edit", milestoneId: milestone.id, module: courseModule }),
                                                                            },
                                                                            { label: "Quiz", icon: ListChecks, href: routes.quiz(courseModule.id) },
                                                                            scheduleAction(target, courseModule.isPublished),
                                                                            { label: "Unpublish — hide from students", icon: EyeOff, hidden: !courseModule.isPublished, onSelect: () => toggleModule.mutate({ id: courseModule.id, next: false }) },
                                                                            {
                                                                                label: "Delete",
                                                                                icon: Trash2,
                                                                                destructive: true,
                                                                                separatorBefore: true,
                                                                                onSelect: () =>
                                                                                    void askDelete(
                                                                                        courseModule.title,
                                                                                        `Its ${plural(courseModule._count.videos, "lesson")}${courseModule._count.quizzes > 0 ? " and its quiz" : ""} go with it.`,
                                                                                        () => removeModule.mutate(courseModule.id),
                                                                                    ),
                                                                            },
                                                                        ]}
                                                                    >
                                                                        {moduleForm?.mode === "edit" && moduleForm.module.id === courseModule.id ? (
                                                                            <form className="space-y-3 px-2" noValidate onSubmit={moduleFormApi.handleSubmit}>
                                                                                <FormField form={moduleFormApi} name="title" label={`${moduleName} title`} required>
                                                                                    <Input autoFocus />
                                                                                </FormField>
                                                                                {marksMode && <ModeField form={moduleFormApi} />}
                                                                                <div className="flex gap-2">
                                                                                    <Button type="submit" size="sm" isLoading={editModule.isPending}>
                                                                                        Save
                                                                                    </Button>
                                                                                    <Button type="button" size="sm" variant="ghost" onClick={() => openModuleForm(null)}>
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </form>
                                                                        ) : undefined}
                                                                    </ItemRow>
                                                                );
                                                            }

                                                            if (item.kind === "ASSIGNMENT") {
                                                                // Opens to its own lessons and brief, like a module.
                                                                const assignment = item.entry;
                                                                const lateUntil = assignment.lateTiers.at(-1)?.until;
                                                                const target: Scheduling = { kind: "ASSIGNMENT", id: assignment.id, title: assignment.title, releaseAt: assignment.releaseAt };
                                                                return (
                                                                    <ItemRow
                                                                        key={item.key}
                                                                        itemKey={item.key}
                                                                        sortable={canSortItems}
                                                                        saving={isSavingItem(item.key)}
                                                                        icon={ClipboardCheck}
                                                                        typeLabel="Assignment"
                                                                        title={assignment.title}
                                                                        href={routes.assignment(assignment.id)}
                                                                        status={<StatusText isPublished={assignment.isPublished} releaseAt={assignment.releaseAt} canSchedule={canSchedule} />}
                                                                        meta={[
                                                                            `${assignment.totalMarks} marks`,
                                                                            plural(assignment._count.materials, "lesson"),
                                                                            assignment._count.submissions > 0 && plural(assignment._count.submissions, "hand-in"),
                                                                        ]}
                                                                        note={
                                                                            assignment.deadline && (
                                                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                                                    Due {formatDateTime(assignment.deadline)}
                                                                                    {lateUntil && ` · late until ${formatDateTime(lateUntil)}`}
                                                                                </p>
                                                                            )
                                                                        }
                                                                        onPublish={assignment.isPublished ? undefined : () => toggleAssignment.mutate({ id: assignment.id, next: true })}
                                                                        primary={
                                                                            <Button asChild size="sm" variant="outline">
                                                                                <Link href={routes.assignment(assignment.id)}>
                                                                                    <FileText /> Open
                                                                                </Link>
                                                                            </Button>
                                                                        }
                                                                        actions={[
                                                                            { label: "Edit the brief and dates", icon: Pencil, onSelect: () => openAssignmentPanel(milestone.id, assignment.id) },
                                                                            scheduleAction(target, assignment.isPublished),
                                                                            { label: "Unpublish — hide from students", icon: EyeOff, hidden: !assignment.isPublished, onSelect: () => toggleAssignment.mutate({ id: assignment.id, next: false }) },
                                                                            {
                                                                                label: "Delete",
                                                                                icon: Trash2,
                                                                                destructive: true,
                                                                                separatorBefore: true,
                                                                                onSelect: () =>
                                                                                    void askDelete(
                                                                                        assignment.title,
                                                                                        "Its lessons go with it. If students have already handed in, unpublish it instead so their work and marks are kept.",
                                                                                        () => removeAssignment.mutate(assignment.id),
                                                                                    ),
                                                                            },
                                                                        ]}
                                                                    />
                                                                );
                                                            }

                                                            // A practice day has no lessons — just its text instructions.
                                                            const practice = item.entry;
                                                            const isLeftover = !allowsPractice;
                                                            const target: Scheduling = { kind: "PRACTICE", id: practice.id, title: practice.title, releaseAt: practice.releaseAt };
                                                            return (
                                                                <ItemRow
                                                                    key={item.key}
                                                                    itemKey={item.key}
                                                                    sortable={canSortItems}
                                                                    saving={isSavingItem(item.key)}
                                                                    icon={Dumbbell}
                                                                    typeLabel="Practice day"
                                                                    title={practice.title}
                                                                    onOpen={isLeftover ? undefined : () => openPracticePanel(milestone.id, practice.id)}
                                                                    status={
                                                                        isLeftover ? (
                                                                            <span className="font-medium text-amber-700 dark:text-amber-400">Bootcamp only — hidden from students, remove it</span>
                                                                        ) : (
                                                                            <StatusText isPublished={practice.isPublished} releaseAt={practice.releaseAt} canSchedule={canSchedule} />
                                                                        )
                                                                    }
                                                                    meta={[!isLeftover && (practice.instructions ? "instructions added" : "no instructions yet")]}
                                                                    onPublish={isLeftover || practice.isPublished ? undefined : () => togglePractice.mutate({ id: practice.id, next: true })}
                                                                    primary={
                                                                        isLeftover ? undefined : (
                                                                            <Button size="sm" variant="outline" onClick={() => openPracticePanel(milestone.id, practice.id)}>
                                                                                <FileText /> {practice.instructions ? "Instructions" : "Add instructions"}
                                                                            </Button>
                                                                        )
                                                                    }
                                                                    actions={[
                                                                        { label: "Edit", icon: Pencil, hidden: isLeftover, onSelect: () => openPracticePanel(milestone.id, practice.id) },
                                                                        { ...scheduleAction(target, practice.isPublished), hidden: isLeftover || !canSchedule || practice.isPublished },
                                                                        { label: "Unpublish — hide from students", icon: EyeOff, hidden: isLeftover || !practice.isPublished, onSelect: () => togglePractice.mutate({ id: practice.id, next: false }) },
                                                                        {
                                                                            label: "Delete",
                                                                            icon: Trash2,
                                                                            destructive: true,
                                                                            separatorBefore: true,
                                                                            onSelect: () => void askDelete(practice.title, undefined, () => removePractice.mutate(practice.id)),
                                                                        },
                                                                    ]}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </SortableList>

                                                <div className="border-t border-dashed border-border px-4 py-2.5 sm:px-5">
                                                    {moduleForm?.mode === "add" && moduleForm.milestoneId === milestone.id ? (
                                                        <form className="space-y-2 py-1" noValidate onSubmit={moduleFormApi.handleSubmit}>
                                                            <FormField form={moduleFormApi} name="title" label={`${moduleName} title`} required>
                                                                <Input autoFocus placeholder={`${moduleName} ${String(milestone.modules.length + 1).padStart(2, "0")}`} />
                                                            </FormField>
                                                            {marksMode && <ModeField form={moduleFormApi} />}
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button type="submit" size="sm" isLoading={createModule.isPending}>
                                                                    Add {moduleLabel}
                                                                </Button>
                                                                <Button type="button" size="sm" variant="ghost" onClick={() => openModuleForm(null)}>
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span className="mr-1 text-xs text-muted-foreground">Add</span>
                                                            <Button size="sm" variant="ghost" onClick={() => openModuleForm({ mode: "add", milestoneId: milestone.id })}>
                                                                <Plus /> {moduleLabel}
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => openAssignmentPanel(milestone.id)}>
                                                                <Plus /> assignment
                                                            </Button>
                                                            {allowsPractice && (
                                                                <Button size="sm" variant="ghost" onClick={() => openPracticePanel(milestone.id)}>
                                                                    <Plus /> practice day
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </SortableItem>
                                );
                            })}
                        </div>
                    </SortableList>
                </div>
            )}

            <DateTimePickerDialog
                open={scheduling !== null}
                onOpenChange={(open) => !open && setScheduling(null)}
                title={scheduling?.releaseAt ? `Reschedule "${scheduling.title}"` : `Schedule "${scheduling?.title ?? ""}"`}
                description="It publishes itself at this time — no need to come back and press Publish."
                value={scheduling?.releaseAt ? toLocalDateTimeValue(new Date(scheduling.releaseAt)) : ""}
                min={toLocalDateTimeValue(new Date())}
                onSet={(value) => scheduling && scheduleItem(scheduling, localDateTimeToISO(value))}
                onClear={scheduling?.releaseAt ? () => scheduleItem(scheduling, null) : undefined}
                clearLabel="Remove schedule"
            />

            <AssignmentModal
                open={assignmentPanelOpen}
                onOpenChange={setAssignmentPanelOpen}
                milestone={assignmentMilestone}
                milestoneLabel={milestoneName}
                assignment={panelAssignment}
                onSaved={refresh}
                onCreated={(assignmentId) =>
                    // The next thing anyone does with a new assignment is give it
                    // lessons — offer that straight from the confirmation.
                    toast.success("Assignment added.", {
                        action: { label: "Add lessons", onClick: () => router.push(routes.assignment(assignmentId)) },
                    })
                }
            />

            <PracticeDayModal
                open={practicePanelOpen}
                onOpenChange={setPracticePanelOpen}
                milestone={practiceMilestone}
                milestoneLabel={milestoneName}
                practice={panelPractice}
                onSaved={refresh}
            />
        </div>
    );
}
