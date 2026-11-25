"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpToLine, Save, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";
import type { AdminCourse } from "@/types/admin.types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Every course that isn't deleted, in the catalogue's current order — a page at a time from the API. */
const allCourses = async () => {
    const courses: AdminCourse[] = [];
    for (let page = 1; page <= 20; page++) {
        const { data, meta } = await adminService.courses({ page, limit: 100 });
        courses.push(...data);
        if (!meta || page >= meta.totalPages) break;
    }
    return courses;
};

/**
 * The order courses are listed in — the catalogue's "Recommended", the
 * footer's courses, and this console's list. Drag a course by its handle (or
 * pick it up with the keyboard), or send it to the top or bottom; nothing is
 * saved until "Save order".
 */
export default function CourseOrderModal({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "courses", "order"],
        queryFn: allCourses,
        enabled: open,
    });
    const [ids, setIds] = useState<string[]>([]);

    // Each time it opens, start from what's saved.
    useEffect(() => {
        if (open && data) setIds(data.map((course) => course.id));
    }, [open, data]);

    const byId = useMemo(() => new Map((data ?? []).map((course) => [course.id, course])), [data]);
    const changed = data ? ids.some((id, index) => data[index]?.id !== id) : false;

    const save = useMutation({
        mutationFn: () => adminService.reorderCourses(ids),
        onSuccess: () => {
            toast.success("Course order saved — the catalogue shows them in this order.");
            onSaved();
            onOpenChange(false);
        },
        onError: (saveError) => toast.error(getApiErrorMessage(saveError, "Couldn't save the order.")),
    });

    const moveTo = (id: string, where: "top" | "bottom") =>
        setIds((current) => {
            const rest = current.filter((other) => other !== id);
            return where === "top" ? [id, ...rest] : [...rest, id];
        });

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            closeOnOutsideClick={false}
            title="Arrange courses"
            description="Drag a course by its handle to move it. Students see them in this order in the catalogue — first at the top."
        >
            <ModalBody className="px-0 py-0 sm:px-0">
                {isLoading ? (
                    <div className="space-y-2 p-5">
                        {Array.from({ length: 5 }, (_, index) => (
                            <Skeleton key={index} className="h-14 rounded-lg" />
                        ))}
                    </div>
                ) : isError ? (
                    <p className="p-6 text-center text-sm text-destructive">{getApiErrorMessage(error, "Couldn't load the courses.")}</p>
                ) : (
                    <SortableList
                        ids={ids}
                        disabled={save.isPending}
                        getLabel={(id) => byId.get(id)?.title ?? "Course"}
                        onReorder={(orderedIds) => setIds(orderedIds)}
                    >
                        <ol className="divide-y divide-border">
                            {ids.map((id, index) => {
                                const course = byId.get(id);
                                if (!course) return null;
                                return (
                                    <SortableItem key={id} id={id} as="li" className="group flex items-center gap-3 bg-card px-4 py-3 sm:px-5">
                                        <DragHandle label={course.title} />
                                        <span className="w-7 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{pad(index + 1)}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{course.title}</p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                                {course.category?.title ?? "No category"}
                                                {course.isFeatured && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Star className="size-3" aria-hidden /> Featured
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <StatusPill kind="course" value={course.status} className="hidden sm:inline-flex" />
                                        <span className="flex shrink-0 gap-0.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                aria-label={`Move ${course.title} to the top`}
                                                title="Move to the top"
                                                disabled={index === 0 || save.isPending}
                                                onClick={() => moveTo(id, "top")}
                                            >
                                                <ArrowUpToLine className="size-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                aria-label={`Move ${course.title} to the bottom`}
                                                title="Move to the bottom"
                                                disabled={index === ids.length - 1 || save.isPending}
                                                onClick={() => moveTo(id, "bottom")}
                                            >
                                                <ArrowDownToLine className="size-4" />
                                            </Button>
                                        </span>
                                    </SortableItem>
                                );
                            })}
                        </ol>
                    </SortableList>
                )}
            </ModalBody>
            <ModalFooter>
                {changed && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="sm:mr-auto"
                        disabled={save.isPending}
                        onClick={() => setIds((data ?? []).map((course) => course.id))}
                    >
                        Undo changes
                    </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button type="button" onClick={() => save.mutate()} isLoading={save.isPending} disabled={!changed || isLoading}>
                    {!save.isPending && <Save />} Save order
                </Button>
            </ModalFooter>
        </Modal>
    );
}
