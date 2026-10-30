"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CalendarDays,
    CheckCheck,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    Copy,
    Eye,
    EyeOff,
    Layers,
    Pencil,
    Plus,
    Save,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import OutlineSchedule, {
    formatItemTime,
    OUTLINE_KIND_META,
    outlineItemStatus,
    weekLabelFor,
} from "@/components/shared/OutlineSchedule";
import RowActions from "@/components/admin/RowActions";
import CurriculumClosedNotice from "@/components/staff/CurriculumClosedNotice";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, RadioGroup, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { useNow } from "@/hooks/useNow";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { classModeOptions } from "@/components/shared/CourseClassification";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { CLASS_MODES, hasCurriculumTools, marksClassMode, MODE_META } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { optionalDateTimeField, optionalTextField, textField } from "@/lib/validation";
import { curriculumAuthoring } from "@/services/curriculum";
import type { ClassMode } from "@/types/api.types";
import type { OutlineItem, OutlineItemKind, OutlineWeek } from "@/types/domain.types";

const KINDS: OutlineItemKind[] = ["MODULE", "PRACTICE", "NO_MODULE"];

/**
 * No-module days and practice days are bootcamp things — a self-paced course
 * has no days to skip, and its outline is modules only.
 */
const kindsFor = (isTraditional: boolean): OutlineItemKind[] => (isTraditional ? ["MODULE"] : KINDS);

/**
 * A no-module or practice day in a traditional outline — left over from when
 * the course was a bootcamp. Students never see it; staff can only remove it.
 */
const isBootcampLeftover = (item: OutlineItem, isTraditional: boolean) => isTraditional && item.kind !== "MODULE";

/** Pre-filled so a gap or practice day is one click — only a module needs a real name. */
const DEFAULT_TITLE: Partial<Record<OutlineItemKind, string>> = {
    PRACTICE: "Practice day",
    NO_MODULE: "No module",
};

const itemSchema = z.object({
    kind: z.enum(["MODULE", "PRACTICE", "NO_MODULE"]),
    title: textField({ label: "Title", min: 2, max: 200 }),
    scheduledAt: optionalDateTimeField,
    weekId: z.string().min(1, "Pick a week"),
    note: optionalTextField({ label: "Note", max: 500 }),
    /** Only asked on a course that runs both online and offline; empty is "not marked". */
    mode: z.enum(["", ...CLASS_MODES]),
});

type ItemValues = {
    kind: OutlineItemKind;
    title: string;
    scheduledAt: string;
    weekId: string;
    note: string;
    mode: "" | ClassMode;
};

type ItemModalState =
    | { mode: "add"; weekId: string; kind: OutlineItemKind }
    | { mode: "edit"; item: OutlineItem; weekId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mirrors the server's item reorder: the week's dates stay in place and the
 * items are dealt back into them in the new order, so a dragged item takes
 * the date of the slot it lands in.
 */
const redealDates = (items: OutlineItem[], orderedIds: string[]): OutlineItem[] => {
    const slots = items.map((item) => item.scheduledAt);
    const byId = new Map(items.map((item) => [item.id, item]));
    return orderedIds.map((id, index) => ({ ...byId.get(id)!, scheduledAt: slots[index] }));
};

/** Items still hidden from students — a traditional outline's only, so a leftover isn't one. */
const draftsIn = (week: OutlineWeek) =>
    week.items.filter((item) => !item.isPublished && !isBootcampLeftover(item, true)).length;

/** A traditional outline's reorder — undated, so the items simply move. */
const reorderById = (items: OutlineItem[], orderedIds: string[]): OutlineItem[] => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return orderedIds.map((id) => byId.get(id)!);
};

/**
 * Where a new item most likely goes: the day after the week's last dated item,
 * at the same time. An empty week starts tomorrow at 10:00.
 */
const suggestDate = (week: OutlineWeek | undefined): string => {
    const lastDated = [...(week?.items ?? [])].reverse().find((item) => item.scheduledAt);
    if (lastDated?.scheduledAt) {
        return toLocalDateTimeValue(new Date(new Date(lastDated.scheduledAt).getTime() + DAY_MS));
    }
    const tomorrow = new Date(Date.now() + DAY_MS);
    tomorrow.setHours(10, 0, 0, 0);
    return toLocalDateTimeValue(tomorrow);
};

/**
 * The Outline Maker — the plan students read after enrolling. It is a plan,
 * not content: nothing here publishes, moves or waits for a real module, and
 * the Module Manager never touches it. On a bootcamp course it's dated, and
 * an item shows as "Published" once its planned time passes; on a
 * traditional one it's undated, and each item is published by hand.
 */
export default function OutlineMakerPage({ courseId, area }: { courseId: string; area: StaffArea }) {
    const routes = staffCourseRoutes(area, courseId);
    const queryClient = useQueryClient();
    const [view, setView] = useState<"edit" | "preview">("edit");

    // Open state and target are kept apart so the modal's content doesn't
    // flip while it is still animating out.
    const [modalOpen, setModalOpen] = useState(false);
    const [modalState, setModalState] = useState<ItemModalState | null>(null);

    // Weeks start open; this holds the ones closed. Kept here rather than in
    // each card so "Collapse all" can drive them, and so a refetch after a
    // save doesn't spring a closed week back open.
    const [collapsedWeeks, setCollapsedWeeks] = useState<ReadonlySet<string>>(() => new Set());
    const toggleWeek = (weekId: string) =>
        setCollapsedWeeks((current) => {
            const next = new Set(current);
            if (next.has(weekId)) next.delete(weekId);
            else next.add(weekId);
            return next;
        });

    const openItemModal = (state: ItemModalState) => {
        setModalState(state);
        setModalOpen(true);
    };

    const { data: course, isLoading: isCourseLoading } = useQuery({
        queryKey: ["staff", "course", courseId],
        queryFn: () => curriculumAuthoring.getCourse(courseId),
    });

    const { data: weeks, isLoading, isError, error } = useQuery({
        queryKey: ["outline", courseId],
        queryFn: () => curriculumAuthoring.getOutline(courseId),
    });

    const weekLabel = course?.milestoneLabel ?? "Week";
    // Dates are a bootcamp thing. A traditional (self-paced) course's outline
    // is undated: its items are ordered by hand and published or not, right
    // away — no scheduling.
    const isTraditional = course?.courseType === "TRADITIONAL";
    // A course that runs online and offline says which each item is.
    const marksMode = marksClassMode(course?.mode);
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["outline", courseId] });

    const addWeek = useMutation({
        mutationFn: () => curriculumAuthoring.createOutlineWeek({ courseId }),
        onSuccess: async (week) => {
            await refresh();
            toast.success(`${weekLabelFor(week, weekLabel)} added.`);
            // A new week lands at the bottom of a possibly long page.
            requestAnimationFrame(() =>
                document
                    .querySelector(`[data-outline-week="${week.id}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" }),
            );
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that.")),
    });

    const copyFromModules = useMutation({
        mutationFn: () => curriculumAuthoring.copyOutlineFromModules(courseId),
        onSuccess: async () => {
            await refresh();
            toast.success("Copied. Edit freely — changes here never touch the modules.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't copy the modules.")),
    });

    // Traditional only. With a week, publishes just that week's drafts.
    const publishAll = useMutation({
        mutationFn: ({ weekId }: { weekId?: string }) => curriculumAuthoring.publishAllOutlineItems(courseId, weekId),
        onSuccess: async ({ count }) => {
            await refresh();
            toast.success(
                count > 0
                    ? `Published ${count} ${count === 1 ? "item" : "items"} — students can see them now.`
                    : "Nothing left to publish.",
            );
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't publish those.")),
    });

    const confirmPublishAll = async (drafts: number, scope: string, weekId?: string) => {
        if (
            await confirmAction({
                title: `Publish ${drafts} draft ${drafts === 1 ? "item" : "items"}${scope}?`,
                text: "Students see them right away. Real modules aren't affected.",
                confirmText: "Publish",
                tone: "default",
            })
        ) {
            publishAll.mutate({ weekId });
        }
    };

    const outlineKey = ["outline", courseId];

    /**
     * Both reorders are optimistic: the list takes its new shape the moment
     * the row is dropped, the handle spins until the server has it, and a
     * failure puts everything back. Settling waits on the refetch, so the
     * spinner clears only once the saved order is what's on screen.
     */
    const reorderWeeks = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderOutlineWeeks(courseId, orderedIds),
        onMutate: async ({ orderedIds }) => {
            await queryClient.cancelQueries({ queryKey: outlineKey });
            const previous = queryClient.getQueryData<OutlineWeek[]>(outlineKey);
            if (previous) {
                const byId = new Map(previous.map((week) => [week.id, week]));
                queryClient.setQueryData<OutlineWeek[]>(
                    outlineKey,
                    orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                );
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(outlineKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder those."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => refresh(),
    });

    const reorderItems = useMutation({
        mutationFn: ({ weekId, orderedIds }: { weekId: string; orderedIds: string[]; movedId: string }) =>
            curriculumAuthoring.reorderOutlineItems(weekId, orderedIds),
        onMutate: async ({ weekId, orderedIds }) => {
            await queryClient.cancelQueries({ queryKey: outlineKey });
            const previous = queryClient.getQueryData<OutlineWeek[]>(outlineKey);
            if (previous) {
                queryClient.setQueryData<OutlineWeek[]>(
                    outlineKey,
                    previous.map((week) =>
                        week.id === weekId
                            ? {
                                ...week,
                                items: isTraditional
                                    ? reorderById(week.items, orderedIds)
                                    : redealDates(week.items, orderedIds),
                            }
                            : week,
                    ),
                );
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(outlineKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder those."));
        },
        onSuccess: () => toast.success(isTraditional ? "Reordered." : "Reordered — the items swapped dates."),
        onSettled: () => refresh(),
    });

    // Waits on the course too, so a traditional outline never flashes the
    // bootcamp dates first.
    if (isLoading || isCourseLoading) {
        return (
            <div className="container-page space-y-4 py-10">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    // An upcoming course has no running outline yet; the API refuses every add.
    if (course && !hasCurriculumTools(course.phase)) {
        return <CurriculumClosedNotice tool="Outline Maker" area={area} courseId={courseId} />;
    }

    if (isError || !weeks) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this outline</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "You may not be assigned to this course.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.home}>Back</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const itemCount = weeks.reduce((sum, week) => sum + week.items.length, 0);
    const draftCount = isTraditional ? weeks.reduce((sum, week) => sum + draftsIn(week), 0) : 0;
    const canCopy = weeks.length === 0 && (course?._count.milestones ?? 0) > 0;

    const now = Date.now();
    const allItems = weeks.flatMap((week) => week.items);
    const dated = allItems.filter((item) => item.kind !== "NO_MODULE" && item.scheduledAt);
    const gone = dated.filter((item) => new Date(item.scheduledAt!).getTime() <= now).length;
    const nextUp = dated.filter((item) => new Date(item.scheduledAt!).getTime() > now).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];

    return (
        <div className="container-page max-w-5xl space-y-6 py-8">
            <header className="space-y-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                {/* In the mentor console the course's own tab bar does this. */}
                {area === "admin" && <BackButton href={routes.courses} label="All courses" />}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0 max-w-2xl">
                        <ConsoleEyebrow />
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Outline Maker</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isTraditional ? (
                                <>
                                    The outline students read after enrolling — undated, since the course is self-paced. They see the items you publish, in the
                                    order you drag them.
                                </>
                            ) : (
                                <>The schedule students read after enrolling. An item shows as published once its planned time passes.</>
                            )}{" "}
                            A plan only: it never publishes or moves a real {(course?.moduleLabel ?? "module").toLowerCase()} — that lives in the{" "}
                            <Link href={routes.modules} className="font-medium text-primary hover:underline">
                                Module Manager
                            </Link>
                            .
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {area === "admin" && (
                            <Button asChild variant="brand-outline">
                                <Link href={routes.modules}>
                                    <Layers /> Module Manager
                                </Link>
                            </Button>
                        )}
                        <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-1">
                            {(
                                [
                                    { value: "edit", label: "Edit", icon: Pencil },
                                    { value: "preview", label: "Student view", icon: Eye },
                                ] as const
                            ).map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={view === value}
                                    onClick={() => setView(value)}
                                    className={cn(
                                        "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                                        view === value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <Icon className="size-4" /> {label}
                                </button>
                            ))}
                        </div>
                        {view === "edit" && (
                            <Button onClick={() => addWeek.mutate()} isLoading={addWeek.isPending}>
                                {!addWeek.isPending && <Plus />} New {weekLabel.toLowerCase()}
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-4">
                <OutlineFigure label={`${weekLabel}s`} value={weeks.length} />
                <OutlineFigure label="Planned items" value={itemCount} />
                {isTraditional ? (
                    <>
                        <OutlineFigure label="Published" value={itemCount - draftCount} hint="students see these" />
                        <OutlineFigure label="Drafts" value={draftCount} hint={draftCount ? "hidden until you publish" : "nothing waiting"} />
                    </>
                ) : (
                    <>
                        <OutlineFigure label="Gone live" value={gone} hint={`of ${dated.length} dated`} />
                        <OutlineFigure
                            label="Next up"
                            value={nextUp ? new Date(nextUp.scheduledAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                            hint={nextUp ? nextUp.title : "nothing planned ahead"}
                        />
                    </>
                )}
            </dl>

            {view === "preview" && isTraditional ? (
                // The syllabus brings its own week cards, as on the student page.
                <OutlineSchedule weeks={weeks} weekLabel={weekLabel} undated />
            ) : view === "preview" ? (
                <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
                    <OutlineSchedule weeks={weeks} weekLabel={weekLabel} />
                </div>
            ) : weeks.length === 0 ? (
                <div className="rounded-card border border-dashed border-border px-6 py-14 text-center">
                        <CalendarDays className="mx-auto size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 font-medium">No {weekLabel.toLowerCase()}s planned yet</p>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            Add a {weekLabel.toLowerCase()}, then give it {isTraditional ? "" : "dated "}
                            {(course?.moduleLabel ?? "module").toLowerCase()} titles
                            {isTraditional ? "." : ", practice days and no-module days."}
                            {canCopy && " Or start from a copy of the Module Manager's structure — a one-time copy that never syncs."}
                        </p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <Button onClick={() => addWeek.mutate()} isLoading={addWeek.isPending}>
                                {!addWeek.isPending && <Plus />} Add first {weekLabel.toLowerCase()}
                            </Button>
                            {canCopy && (
                                <Button
                                    variant="outline"
                                    onClick={() => copyFromModules.mutate()}
                                    isLoading={copyFromModules.isPending}
                                >
                                    {!copyFromModules.isPending && <Copy />} Copy from Module Manager
                                </Button>
                            )}
                        </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {(weeks.length > 1 || draftCount > 0) && (
                        <div className="flex flex-wrap justify-end gap-2">
                            {draftCount > 0 && (
                                <Button
                                    size="sm"
                                    isLoading={publishAll.isPending && !publishAll.variables?.weekId}
                                    disabled={publishAll.isPending}
                                    title="Show every draft item to students now"
                                    onClick={() => confirmPublishAll(draftCount, " across the outline")}
                                >
                                    {!(publishAll.isPending && !publishAll.variables?.weekId) && <CheckCheck />}
                                    {` Publish all (${draftCount})`}
                                </Button>
                            )}
                            {weeks.length > 1 &&
                                (collapsedWeeks.size === weeks.length ? (
                                    <Button size="sm" variant="ghost" onClick={() => setCollapsedWeeks(new Set())}>
                                        <ChevronsUpDown /> Expand all
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setCollapsedWeeks(new Set(weeks.map((week) => week.id)))}
                                    >
                                        <ChevronsDownUp /> Collapse all
                                    </Button>
                                ))}
                        </div>
                    )}

                    <SortableList
                        ids={weeks.map((week) => week.id)}
                        disabled={reorderWeeks.isPending}
                        getLabel={(id) => {
                            const week = weeks.find((w) => w.id === id);
                            return week ? weekLabelFor(week, weekLabel) : weekLabel;
                        }}
                        onReorder={(orderedIds, movedId) => reorderWeeks.mutate({ orderedIds, movedId })}
                    >
                        <div className="space-y-4">
                        {weeks.map((week) => (
                            <WeekCard
                                key={week.id}
                                week={week}
                                weekLabel={weekLabel}
                                isTraditional={isTraditional}
                                marksMode={marksMode}
                                isOpen={!collapsedWeeks.has(week.id)}
                                onToggle={() => toggleWeek(week.id)}
                                canDrag={weeks.length > 1}
                                isSavingPosition={reorderWeeks.isPending && reorderWeeks.variables?.movedId === week.id}
                                savingItemId={
                                    reorderItems.isPending && reorderItems.variables?.weekId === week.id
                                        ? reorderItems.variables.movedId
                                        : null
                                }
                                itemsLocked={reorderItems.isPending}
                                onReorderItems={(orderedIds, movedId) =>
                                    reorderItems.mutate({ weekId: week.id, orderedIds, movedId })
                                }
                                onAddItem={(kind) => openItemModal({ mode: "add", weekId: week.id, kind })}
                                onEditItem={(item) => openItemModal({ mode: "edit", item, weekId: week.id })}
                                onPublishAll={() =>
                                    confirmPublishAll(draftsIn(week), ` in ${weekLabelFor(week, weekLabel)}`, week.id)
                                }
                                isPublishingAll={publishAll.isPending && publishAll.variables?.weekId === week.id}
                                publishAllLocked={publishAll.isPending}
                                onChanged={refresh}
                            />
                        ))}
                        </div>
                    </SortableList>

                    <button
                        type="button"
                        onClick={() => addWeek.mutate()}
                        disabled={addWeek.isPending}
                        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                    >
                        <Plus className="size-4" aria-hidden /> Add {weekLabel.toLowerCase()}
                    </button>
                </div>
            )}

            <Modal
                open={modalOpen}
                onOpenChange={setModalOpen}
                closeOnOutsideClick={false}
                title={modalState?.mode === "edit" ? "Edit outline item" : "Add to the outline"}
                description={
                    isTraditional
                        ? "Added as a draft — press Publish on its row when students should see it. The real module is published separately in the Module Manager."
                        : "Planned date only — the real module keeps its own release date in the Module Manager."
                }
            >
                {modalState && (
                    <ItemForm
                        key={modalState.mode === "edit" ? modalState.item.id : `${modalState.weekId}-${modalState.kind}`}
                        state={modalState}
                        weeks={weeks}
                        weekLabel={weekLabel}
                        isTraditional={isTraditional}
                        marksMode={marksMode}
                        onSaved={refresh}
                        onClose={() => setModalOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
}

/** A figure in the strip at the top. */
function OutlineFigure({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="min-w-0 bg-card px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
            {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

function WeekCard({
    week,
    weekLabel,
    isTraditional,
    marksMode,
    isOpen,
    onToggle,
    canDrag,
    isSavingPosition,
    savingItemId,
    itemsLocked,
    onReorderItems,
    onAddItem,
    onEditItem,
    onPublishAll,
    isPublishingAll,
    publishAllLocked,
    onChanged,
}: {
    week: OutlineWeek;
    weekLabel: string;
    /** Undated rows, each with its own Publish switch, in hand-dragged order. */
    isTraditional: boolean;
    /** The course runs online and offline, so each row says which. */
    marksMode: boolean;
    /** Collapsed, only the header shows — handy for dragging weeks around. */
    isOpen: boolean;
    onToggle: () => void;
    /** False when this is the only week — there's nowhere to drag it. */
    canDrag: boolean;
    /** This week was just dropped somewhere and its new place is saving. */
    isSavingPosition: boolean;
    /** The item in this week whose new date slot is saving, if any. */
    savingItemId: string | null;
    itemsLocked: boolean;
    onReorderItems: (orderedIds: string[], movedId: string) => void;
    onAddItem: (kind: OutlineItemKind) => void;
    onEditItem: (item: OutlineItem) => void;
    /** Traditional only — publishes this week's drafts. */
    onPublishAll: () => void;
    /** This week's drafts are being published. */
    isPublishingAll: boolean;
    /** Some publish-all — this week's or the whole outline's — is running. */
    publishAllLocked: boolean;
    onChanged: () => Promise<unknown>;
}) {
    const now = useNow();
    const [renaming, setRenaming] = useState(false);
    const [title, setTitle] = useState(week.title ?? "");
    const label = weekLabelFor(week, weekLabel);
    const panelId = useId();

    const rename = useMutation({
        mutationFn: () => curriculumAuthoring.updateOutlineWeek(week.id, { title }),
        onSuccess: async () => {
            await onChanged();
            setRenaming(false);
            toast.success(`${label} saved.`);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const remove = useMutation({
        mutationFn: () => curriculumAuthoring.deleteOutlineWeek(week.id),
        onSuccess: async () => {
            await onChanged();
            toast.success(`${label} deleted.`);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that.")),
    });

    const removeItem = useMutation({
        mutationFn: (itemId: string) => curriculumAuthoring.deleteOutlineItem(itemId),
        onSuccess: async () => {
            await onChanged();
            toast.success("Removed from the outline.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't remove that.")),
    });

    const togglePublished = useMutation({
        mutationFn: ({ itemId, next }: { itemId: string; next: boolean }) =>
            curriculumAuthoring.updateOutlineItem(itemId, { isPublished: next }),
        onSuccess: async (_data, { next }) => {
            await onChanged();
            toast.success(next ? "Published — students can see it now." : "Unpublished — hidden from students.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that.")),
    });

    const drafts = isTraditional ? draftsIn(week) : 0;

    const kinds = kindsFor(isTraditional);

    const counts = kinds.map((kind) => ({ kind, count: week.items.filter((item) => item.kind === kind).length }))
        .filter(({ count }) => count > 0)
        .map(({ kind, count }) => `${count} ${OUTLINE_KIND_META[kind].label.toLowerCase()}${count === 1 ? "" : "s"}`);

    return (
        <SortableItem
            id={week.id}
            as="section"
            aria-busy={isSavingPosition || undefined}
            aria-label={label}
            data-outline-week={week.id}
            className="scroll-mt-24 overflow-hidden rounded-card border border-border bg-card shadow-card"
        >
            <div className={cn("px-4 py-4 sm:px-5", isOpen && "border-b border-border")}>
                {renaming ? (
                    <form
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            rename.mutate();
                        }}
                    >
                        <label htmlFor={`week-title-${week.id}`} className="sr-only">
                            {label} theme
                        </label>
                        <Input
                            id={`week-title-${week.id}`}
                            autoFocus
                            value={title}
                            maxLength={160}
                            placeholder={`Theme for ${label} (optional)`}
                            onChange={(event) => setTitle(event.target.value)}
                            className="min-w-60 flex-1"
                        />
                        <Button type="submit" size="sm" isLoading={rename.isPending}>
                            {!rename.isPending && <Save />} Save
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setTitle(week.title ?? "");
                                setRenaming(false);
                            }}
                        >
                            Cancel
                        </Button>
                    </form>
                ) : (
                    <div className="flex items-center gap-3 sm:gap-4">
                        {canDrag && <DragHandle label={label} isSaving={isSavingPosition} />}
                        <p className="w-12 shrink-0 text-center leading-none sm:w-14">
                            <span className="block text-[0.625rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{weekLabel}</span>
                            <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-primary">{String(week.order).padStart(2, "0")}</span>
                        </p>
                        <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle} className="min-w-0 flex-1 text-left">
                            <span className={cn("block truncate font-semibold", !week.title && "text-muted-foreground")}>{week.title ?? "No theme yet"}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {isSavingPosition ? "Saving the new order…" : counts.length > 0 ? counts.join(" · ") : "Nothing planned yet"}
                            </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                            {drafts > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-primary hover:text-primary"
                                    isLoading={isPublishingAll}
                                    disabled={publishAllLocked}
                                    title={`Show this ${weekLabel.toLowerCase()}'s ${drafts} draft ${drafts === 1 ? "item" : "items"} to students now`}
                                    onClick={onPublishAll}
                                >
                                    {!isPublishingAll && <CheckCheck />} Publish all
                                </Button>
                            )}
                            <RowActions
                                label={`More for ${label}`}
                                items={[
                                    { label: week.title ? "Change the theme" : "Give it a theme", icon: Pencil, onSelect: () => setRenaming(true) },
                                    {
                                        label: "Delete",
                                        icon: Trash2,
                                        destructive: true,
                                        separatorBefore: true,
                                        disabled: remove.isPending,
                                        onSelect: async () => {
                                            if (
                                                await confirmAction({
                                                    title: `Delete ${label}?`,
                                                    text:
                                                        week.items.length > 0
                                                            ? `Its ${week.items.length} planned item(s) go with it. Real modules aren't affected.`
                                                            : "Real modules aren't affected.",
                                                    confirmText: "Delete",
                                                })
                                            ) {
                                                remove.mutate();
                                            }
                                        },
                                    },
                                ]}
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="w-9 px-0"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`}
                                onClick={onToggle}
                            >
                                <ChevronDown className={cn("transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Unmounted when closed, like the FAQ — a long outline stays light. */}
            {isOpen && (
                <div id={panelId}>
                    {week.items.length > 0 && (
                        <SortableList
                            ids={week.items.map((item) => item.id)}
                            disabled={itemsLocked}
                            getLabel={(id) => week.items.find((item) => item.id === id)?.title ?? "Item"}
                            onReorder={onReorderItems}
                        >
                            <ul className="divide-y divide-border">
                                {week.items.map((item) => {
                                    const meta = OUTLINE_KIND_META[item.kind];
                                    const Icon = meta.icon;
                                    const status = outlineItemStatus(item, now);
                                    const date = item.scheduledAt ? new Date(item.scheduledAt) : null;
                                    const isGap = item.kind === "NO_MODULE";
                                    const isLeftover = isBootcampLeftover(item, isTraditional);
                                    const statusTone = isLeftover
                                        ? "font-medium text-amber-700 dark:text-amber-400"
                                        : status.variant === "success"
                                          ? "text-success"
                                          : status.variant === "warning"
                                            ? "text-primary"
                                            : "text-muted-foreground";

                                    return (
                                        <SortableItem
                                            key={item.id}
                                            id={item.id}
                                            as="li"
                                            aria-busy={savingItemId === item.id || undefined}
                                            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-secondary/25 sm:flex-nowrap sm:px-4"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                                {/* Bootcamp items live in date order, so dragging one
                                                    moves it into another's date slot — the dates stay
                                                    put. A traditional outline simply moves the row. */}
                                                {week.items.length > 1 ? <DragHandle label={item.title} isSaving={savingItemId === item.id} /> : <span className="w-2" aria-hidden />}
                                                {!isTraditional && (
                                                    <p className="w-20 shrink-0 text-sm tabular-nums">
                                                        {date ? (
                                                            <>
                                                                <span className="block font-medium">{date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                                                                {!isGap && item.scheduledAt && <span className="block text-xs text-muted-foreground">{formatItemTime(item.scheduledAt)}</span>}
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground">Date TBA</span>
                                                        )}
                                                    </p>
                                                )}
                                                <Icon className={cn("size-4 shrink-0", isGap ? "text-muted-foreground/60" : "text-muted-foreground")} aria-hidden />
                                                <div className="min-w-0">
                                                    {isLeftover ? (
                                                        <p className="truncate text-sm font-medium">{item.title}</p>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditItem(item)}
                                                            className={cn("block max-w-full truncate text-left text-sm font-medium hover:underline", isGap && "text-muted-foreground")}
                                                        >
                                                            {item.title}
                                                        </button>
                                                    )}
                                                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                                        <span className={statusTone}>
                                                            {isLeftover
                                                                ? "Bootcamp only — hidden from students"
                                                                : isTraditional
                                                                  ? item.isPublished
                                                                      ? "Published"
                                                                      : "Draft"
                                                                  : status.label}
                                                        </span>
                                                        {marksMode && !isGap && !isLeftover && (
                                                            <>
                                                                <span aria-hidden>·</span>
                                                                <span className="shrink-0">{item.mode ? MODE_META[item.mode].label : "online or offline not set"}</span>
                                                            </>
                                                        )}
                                                        {/* A gap day's status already says what it is. */}
                                                        {!isLeftover && (!isGap || item.note) && (
                                                            <>
                                                                <span aria-hidden>·</span>
                                                                <span className="truncate">{isGap ? item.note : `${meta.label}${item.note ? ` · ${item.note}` : ""}`}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="ml-auto flex shrink-0 items-center gap-1">
                                                {isTraditional && !isLeftover && !item.isPublished && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-primary hover:text-primary"
                                                        isLoading={togglePublished.isPending && togglePublished.variables?.itemId === item.id}
                                                        title="Show to students now"
                                                        onClick={() => togglePublished.mutate({ itemId: item.id, next: true })}
                                                    >
                                                        Publish
                                                    </Button>
                                                )}
                                                <RowActions
                                                    label={`More for ${item.title}`}
                                                    primary={
                                                        isLeftover ? undefined : (
                                                            <Button size="sm" variant="outline" onClick={() => onEditItem(item)}>
                                                                <Pencil /> <span className="max-sm:sr-only">Edit</span>
                                                            </Button>
                                                        )
                                                    }
                                                    items={[
                                                        {
                                                            label: "Unpublish — hide from students",
                                                            icon: EyeOff,
                                                            hidden: !isTraditional || isLeftover || !item.isPublished,
                                                            onSelect: () => togglePublished.mutate({ itemId: item.id, next: false }),
                                                        },
                                                        {
                                                            label: "Remove from the outline",
                                                            icon: Trash2,
                                                            destructive: true,
                                                            separatorBefore: true,
                                                            disabled: removeItem.isPending && removeItem.variables === item.id,
                                                            onSelect: async () => {
                                                                if (
                                                                    await confirmAction({
                                                                        title: `Remove "${item.title}" from the outline?`,
                                                                        text: "Only the plan changes — no real module is touched.",
                                                                        confirmText: "Remove",
                                                                    })
                                                                ) {
                                                                    removeItem.mutate(item.id);
                                                                }
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

                    <div className={cn("flex flex-wrap items-center gap-1 px-4 py-2.5 sm:px-5", week.items.length > 0 && "border-t border-dashed border-border")}>
                        <span className="mr-1 text-xs text-muted-foreground">Add</span>
                        {kinds.map((kind) => {
                            const Icon = OUTLINE_KIND_META[kind].icon;
                            return (
                                <Button key={kind} size="sm" variant="ghost" onClick={() => onAddItem(kind)}>
                                    <Icon /> {OUTLINE_KIND_META[kind].label}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}
        </SortableItem>
    );
}

function ItemForm({
    state,
    weeks,
    weekLabel,
    isTraditional,
    marksMode,
    onSaved,
    onClose,
}: {
    state: ItemModalState;
    weeks: OutlineWeek[];
    weekLabel: string;
    /** No date to pick — a traditional outline is undated. */
    isTraditional: boolean;
    /** The course runs online and offline — ask which this item is. */
    marksMode: boolean;
    onSaved: () => Promise<unknown>;
    onClose: () => void;
}) {
    // Set by "Save & add next" just before submitting, read once the save lands.
    const addAnother = useRef(false);
    const isEdit = state.mode === "edit";

    const initialValues: ItemValues = isEdit
        ? {
            kind: state.item.kind,
            title: state.item.title,
            scheduledAt: state.item.scheduledAt ? toLocalDateTimeValue(new Date(state.item.scheduledAt)) : "",
            weekId: state.weekId,
            note: state.item.note ?? "",
            mode: state.item.mode ?? "",
        }
        : {
            kind: state.kind,
            title: DEFAULT_TITLE[state.kind] ?? "",
            scheduledAt: isTraditional ? "" : suggestDate(weeks.find((week) => week.id === state.weekId)),
            weekId: state.weekId,
            note: "",
            mode: "",
        };

    const toPayload = (values: z.output<typeof itemSchema>) => ({
        weekId: values.weekId,
        kind: values.kind,
        title: values.title,
        note: values.note,
        // The server refuses a date on a traditional outline, so none is sent.
        ...(isTraditional
            ? {}
            : { scheduledAt: values.scheduledAt ? localDateTimeToISO(values.scheduledAt) : null }),
        // Nor a mark on a course that runs one way only. A no-module day has none.
        ...(marksMode && { mode: values.kind === "NO_MODULE" ? null : values.mode || null }),
    });

    const save = useMutation({
        mutationFn: (values: z.output<typeof itemSchema>) =>
            isEdit
                ? curriculumAuthoring.updateOutlineItem(state.item.id, toPayload(values))
                : curriculumAuthoring.createOutlineItem({ ...toPayload(values), note: values.note || undefined }),
        onSuccess: async (_result, values) => {
            await onSaved();
            if (addAnother.current) {
                addAnother.current = false;
                toast.success("Added. Next one's ready.");
                // Same kind and week, the following day — a week is usually
                // planned one day after another.
                const next = !isTraditional && values.scheduledAt
                    ? toLocalDateTimeValue(new Date(new Date(values.scheduledAt).getTime() + DAY_MS))
                    : "";
                form.reset({
                    kind: values.kind,
                    title: DEFAULT_TITLE[values.kind] ?? "",
                    scheduledAt: next,
                    weekId: values.weekId,
                    note: "",
                    // A run of days in the same place is the usual pattern.
                    mode: values.mode,
                });
                return;
            }
            toast.success(isEdit ? "Outline item saved." : "Added to the outline.");
            onClose();
        },
        onError: (err) => {
            addAnother.current = false;
            toast.error(getApiErrorMessage(err, "Couldn't save that."));
        },
    });

    const form = useZodForm({
        schema: itemSchema,
        initialValues,
        onSubmit: (values) => save.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-5">
                <RequiredLegend />

                {/* A traditional outline is modules only — nothing to pick. */}
                {kindsFor(isTraditional).length > 1 && <KindPicker form={form} kinds={kindsFor(isTraditional)} />}

                <FormField form={form} name="title" label="Title" required counterMax={200}>
                    <Input
                        autoFocus
                        placeholder={form.values.kind === "MODULE" ? "Intro to JavaScript" : undefined}
                    />
                </FormField>

                {!isTraditional && (
                    <FormField
                        form={form}
                        name="scheduledAt"
                        label={form.values.kind === "NO_MODULE" ? "Date" : "Planned date & time"}
                        optional
                        hint={
                            form.values.kind === "NO_MODULE"
                                ? "The day with no module. Leave empty to show “Date TBA”."
                                : "Students see this as Published once this time passes. Leave empty to show “Date TBA”."
                        }
                    >
                        <DateTimeInput />
                    </FormField>
                )}

                {marksMode && form.values.kind !== "NO_MODULE" && (
                    <FormField form={form} name="mode" label="Where it happens" optional hint="Students see it on the outline.">
                        <RadioGroup inline options={classModeOptions()} />
                    </FormField>
                )}

                <FormField form={form} name="weekId" label={weekLabel} required>
                    <Select>
                        {weeks.map((week) => (
                            <option key={week.id} value={week.id}>
                                {weekLabelFor(week, weekLabel)}
                                {week.title ? ` — ${week.title}` : ""}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField
                    form={form}
                    name="note"
                    label="Note"
                    optional
                    counterMax={500}
                    hint="A line under the title — what to prepare, where a session happens."
                >
                    <Textarea rows={2} />
                </FormField>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                {!isEdit && (
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={save.isPending}
                        onClick={() => {
                            addAnother.current = true;
                        }}
                    >
                        Save & add next
                    </Button>
                )}
                <Button
                    type="submit"
                    isLoading={save.isPending}
                    onClick={() => {
                        addAnother.current = false;
                    }}
                >
                    {!save.isPending && (isEdit ? <Save /> : <Plus />)} {isEdit ? "Save changes" : "Add"}
                </Button>
            </ModalFooter>
        </form>
    );
}

/**
 * Real radio inputs under the styled cards, so the choice is one tab stop and
 * arrow keys move between them — the native radio-group behaviour.
 */
function KindPicker({ form, kinds }: { form: ZodFormApi<ItemValues>; kinds: OutlineItemKind[] }) {
    return (
        <fieldset>
            <legend className="mb-2 text-sm font-medium">Type</legend>
            <div className={cn("grid gap-2", kinds.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                {kinds.map((kind) => {
                    const meta = OUTLINE_KIND_META[kind];
                    const Icon = meta.icon;
                    const checked = form.values.kind === kind;

                    return (
                        <label
                            key={kind}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                checked
                                    ? "border-primary bg-primary/10 font-medium text-primary"
                                    : "border-border hover:bg-secondary/60",
                            )}
                        >
                            <input
                                type="radio"
                                name="outline-kind"
                                value={kind}
                                checked={checked}
                                className="sr-only"
                                onChange={() => {
                                    // Swap in the new kind's default title, but
                                    // never overwrite one the admin typed.
                                    const previousDefault = DEFAULT_TITLE[form.values.kind] ?? "";
                                    const title = form.values.title.trim();
                                    form.setValues({
                                        kind,
                                        ...(title === "" || title === previousDefault
                                            ? { title: DEFAULT_TITLE[kind] ?? "" }
                                            : {}),
                                    });
                                }}
                            />
                            <Icon className="size-4 shrink-0" aria-hidden />
                            {meta.label}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
