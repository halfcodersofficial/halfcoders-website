"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import TestimonialEditor, { type SavedTestimonial } from "@/components/admin/testimonials/TestimonialEditor";
import TestimonialRow, { type Placement } from "@/components/admin/testimonials/TestimonialRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableList } from "@/components/ui/sortable";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { adminService } from "@/services/admin";
import type { AdminTestimonial } from "@/types/admin.types";

const KEY = ["admin", "testimonials"] as const;

/** How many the homepage strip shows — `take` in the API's public testimonial list. */
const HOMEPAGE_SLOTS = 12;
/** How many a course page shows — `take` in the API's course page query. */
const COURSE_SLOTS = 6;

type Filter = "" | "LIVE" | "DRAFT" | "VIDEO";

const matches = (testimonial: AdminTestimonial, filter: Filter, term: string) =>
    (filter === "" ||
        (filter === "LIVE" && testimonial.isPublished) ||
        (filter === "DRAFT" && !testimonial.isPublished) ||
        (filter === "VIDEO" && Boolean(testimonial.videoUrl))) &&
    (!term ||
        [testimonial.name, testimonial.designation, testimonial.quote, testimonial.course?.title, testimonial.student?.name].some(
            (text) => text?.toLowerCase().includes(term),
        ));

/** Each testimonial's place on the homepage and its course page — both follow the list's order. */
function placementsOf(testimonials: AdminTestimonial[]) {
    const placements = new Map<string, Placement>();
    const perCourse = new Map<string, number>();
    let live = 0;

    for (const testimonial of testimonials) {
        if (!testimonial.isPublished) {
            placements.set(testimonial.id, { liveRank: null, onHomepage: false, courseRank: null });
            continue;
        }
        live += 1;
        let courseRank: number | null = null;
        if (testimonial.course) {
            courseRank = (perCourse.get(testimonial.course.id) ?? 0) + 1;
            perCourse.set(testimonial.course.id, courseRank);
        }
        placements.set(testimonial.id, { liveRank: live, onHomepage: live <= HOMEPAGE_SLOTS, courseRank });
    }
    return placements;
}

function totals(testimonials: AdminTestimonial[], onDrafts: () => void): StatCell[] {
    const live = testimonials.filter((testimonial) => testimonial.isPublished);
    const drafts = testimonials.length - live.length;
    const open = HOMEPAGE_SLOTS - live.length;
    const average = live.reduce((sum, testimonial) => sum + testimonial.rating, 0) / (live.length || 1);

    return [
        {
            label: "On the homepage",
            value: `${Math.min(live.length, HOMEPAGE_SLOTS)} / ${HOMEPAGE_SLOTS}`,
            hint:
                open > 0
                    ? `${open} slot${open === 1 ? "" : "s"} open`
                    : open === 0
                      ? "Every slot filled"
                      : `${-open} more live, waiting for a slot`,
        },
        {
            label: "Live",
            value: String(live.length),
            hint: `${live.filter((testimonial) => testimonial.videoUrl).length} with video`,
        },
        {
            label: "Drafts",
            value: String(drafts),
            hint: drafts > 0 ? "Saved, shown nowhere" : "Nothing held back",
            onClick: drafts > 0 ? onDrafts : undefined,
        },
        {
            label: "Average rating",
            value: live.length > 0 ? `${average.toFixed(1)} ★` : "—",
            hint: live.length > 0 ? "Across the live ones" : "Nothing live yet",
        },
    ];
}

/**
 * Testimonials: what students say about Half Coders, as one ordered list. Its order
 * is the site's — the first twelve live ones fill the homepage strip, and each
 * course page shows its own first six — so the list says where each one
 * lands, and drag-to-reorder changes it. Adding and editing happen in a
 * popup beside a live preview of the cards those pages draw.
 */
export default function AdminTestimonialsPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<Filter>("");
    const [term, setTerm] = useState("");
    /** `undefined` closed; `null` a new one; otherwise the one being edited. */
    const [editing, setEditing] = useState<AdminTestimonial | null | undefined>(undefined);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [flashId, setFlashId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: adminService.testimonials });
    const all = useMemo(() => data ?? [], [data]);
    const placements = useMemo(() => placementsOf(all), [all]);

    /** Everywhere the change shows: this list, the homepage strip, and the cached course pages. */
    const afterChange = () => {
        void queryClient.invalidateQueries({ queryKey: KEY });
        void queryClient.invalidateQueries({ queryKey: ["public", "testimonials"] });
        void refreshCoursePages();
    };

    const optimistic = async (change: (list: AdminTestimonial[]) => AdminTestimonial[]) => {
        await queryClient.cancelQueries({ queryKey: KEY });
        const previous = queryClient.getQueryData<AdminTestimonial[]>(KEY);
        if (previous) queryClient.setQueryData(KEY, change(previous));
        return { previous };
    };
    const rollback = (context?: { previous?: AdminTestimonial[] }) => {
        if (context?.previous) queryClient.setQueryData(KEY, context.previous);
    };

    const toggle = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) => adminService.updateTestimonial(id, { isPublished: next }),
        onMutate: ({ id, next }) =>
            optimistic((list) => list.map((testimonial) => (testimonial.id === id ? { ...testimonial, isPublished: next } : testimonial))),
        onSuccess: (_result, { next }) => {
            toast.success(next ? "Live on the site." : "Taken down — it's a draft now.");
            afterChange();
        },
        onError: (error, _variables, context) => {
            rollback(context);
            toast.error(getApiErrorMessage(error, "Couldn't change that."));
        },
    });

    const reorder = useMutation({
        mutationFn: (ids: string[]) => adminService.reorderTestimonials(ids),
        onMutate: (ids) =>
            optimistic((list) => {
                const byId = new Map(list.map((testimonial) => [testimonial.id, testimonial]));
                return ids.flatMap((id, index) => {
                    const testimonial = byId.get(id);
                    return testimonial ? [{ ...testimonial, order: index }] : [];
                });
            }),
        onSuccess: afterChange,
        onError: (error, _ids, context) => {
            rollback(context);
            toast.error(getApiErrorMessage(error, "Couldn't save the new order."));
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
        onSettled: () => setMovingId(null),
    });

    const remove = useMutation({
        mutationFn: (testimonial: AdminTestimonial) => adminService.deleteTestimonial(testimonial.id),
        onMutate: (testimonial) => optimistic((list) => list.filter((item) => item.id !== testimonial.id)),
        onSuccess: () => {
            toast.success("Testimonial deleted.");
            afterChange();
        },
        onError: (error, _testimonial, context) => {
            rollback(context);
            toast.error(getApiErrorMessage(error, "Couldn't delete that."));
        },
    });

    const askDelete = async (testimonial: AdminTestimonial) => {
        const confirmed = await confirmAction({
            title: "Delete this testimonial?",
            text: `${testimonial.name}'s testimonial is removed for good. To take it off the site for now, switch it to a draft instead.`,
            confirmText: "Delete",
        });
        if (confirmed) remove.mutate(testimonial);
    };

    const onSaved = ({ id, created }: SavedTestimonial) => {
        setEditing(undefined);
        toast.success(created ? "Added — it's at the top of the list." : "Changes saved.");
        afterChange();
        setFlashId(id);
    };

    // Bring the row just saved into view, ring it briefly, then let it go.
    useEffect(() => {
        if (!flashId) return;
        document
            .querySelector(`[data-testimonial-id="${CSS.escape(flashId)}"]`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        const timer = window.setTimeout(() => setFlashId(null), 2400);
        return () => window.clearTimeout(timer);
    }, [flashId, data]);

    const needle = term.trim().toLowerCase();
    const shown = all.filter((testimonial) => matches(testimonial, filter, needle));
    const sortable = filter === "" && !needle && all.length > 1;
    const count = (value: Filter) => all.filter((testimonial) => matches(testimonial, value, "")).length;

    const liveTotal = all.filter((testimonial) => testimonial.isPublished).length;
    // The line under the homepage's last slot, when live ones carry on past it.
    const foldAfter =
        sortable && liveTotal > HOMEPAGE_SLOTS
            ? all.find((testimonial) => placements.get(testimonial.id)?.liveRank === HOMEPAGE_SLOTS)?.id
            : undefined;

    const newButton = (
        <Button onClick={() => setEditing(null)}>
            <Plus /> New testimonial
        </Button>
    );

    const rows = shown.map((testimonial) => (
        <FoldedRow key={testimonial.id} fold={testimonial.id === foldAfter}>
            <TestimonialRow
                testimonial={testimonial}
                placement={placements.get(testimonial.id) ?? { liveRank: null, onHomepage: false, courseRank: null }}
                courseSlots={COURSE_SLOTS}
                sortable={sortable}
                savingOrder={movingId === testimonial.id}
                flash={flashId === testimonial.id}
                onToggle={(next) => toggle.mutate({ id: testimonial.id, next })}
                onEdit={() => setEditing(testimonial)}
                onDelete={() => askDelete(testimonial)}
            />
        </FoldedRow>
    ));

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <ConsoleEyebrow />
                                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Testimonials</h1>
                                <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                                    What students say about Half Coders. The order here is the site&apos;s: the first{" "}
                                    {HOMEPAGE_SLOTS} live ones fill the homepage, and each course page shows its own first{" "}
                                    {COURSE_SLOTS}.
                                </p>
                            </div>
                            <div className="shrink-0">{newButton}</div>
                        </header>
                        {isLoading ? (
                            <Skeleton className="h-24 rounded-card" />
                        ) : (
                            all.length > 0 && <StatStrip cells={totals(all, () => setFilter("DRAFT"))} />
                        )}
                    </div>
                }
                searchPlaceholder="Search name, quote or course…"
                onSearch={setTerm}
                filters={[
                    { value: "", label: "All", count: count("") },
                    { value: "LIVE", label: "Live", count: count("LIVE") },
                    { value: "DRAFT", label: "Drafts", count: count("DRAFT") },
                    { value: "VIDEO", label: "Video", count: count("VIDEO") },
                ]}
                activeFilter={filter}
                onFilter={(value) => setFilter(value as Filter)}
                isLoading={isLoading}
                skeleton={
                    <div className="space-y-px overflow-hidden rounded-card border border-border">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-24 rounded-none" />
                        ))}
                    </div>
                }
                isEmpty={shown.length === 0}
                emptyMessage={all.length === 0 ? "No testimonials yet." : "Nothing matches."}
                emptyHint={
                    all.length === 0
                        ? "Add the first one — the homepage's testimonial section stays hidden until one is live."
                        : "Try a different search or filter."
                }
                emptyAction={all.length === 0 ? newButton : undefined}
            >
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        {sortable
                            ? "Drag ≡ to change the order — the homepage and course pages follow it."
                            : all.length > 1
                              ? `Showing ${shown.length} of ${all.length}. Clear the search and filter to reorder.`
                              : null}
                    </p>
                    <ol className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
                        {sortable ? (
                            <SortableList
                                ids={shown.map((testimonial) => testimonial.id)}
                                disabled={reorder.isPending}
                                getLabel={(id) => `${all.find((testimonial) => testimonial.id === id)?.name ?? "This"}'s testimonial`}
                                onReorder={(ids, movedId) => {
                                    setMovingId(movedId);
                                    reorder.mutate(ids);
                                }}
                            >
                                {rows}
                            </SortableList>
                        ) : (
                            rows
                        )}
                    </ol>
                </div>
            </DataShell>

            <TestimonialEditor
                open={editing !== undefined}
                onOpenChange={(open) => !open && setEditing(undefined)}
                testimonial={editing ?? null}
                onSaved={onSaved}
            />
        </>
    );
}

/** A row, and under it the line where the homepage's slots run out. */
function FoldedRow({ fold, children }: { fold: boolean; children: ReactNode }) {
    return (
        <>
            {children}
            {fold && (
                <li
                    role="separator"
                    aria-label={`The homepage shows the first ${HOMEPAGE_SLOTS} live testimonials; the ones below wait for a slot.`}
                    className="flex items-center gap-3 bg-primary/3 px-5 py-2 text-xs font-medium text-primary"
                >
                    <span className="flex-1 border-t border-dashed border-primary/40" aria-hidden />
                    Homepage ends here — live ones below wait for a slot
                    <span className="flex-1 border-t border-dashed border-primary/40" aria-hidden />
                </li>
            )}
        </>
    );
}
