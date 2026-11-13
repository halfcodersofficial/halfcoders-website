"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, PlayCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import RowActions from "@/components/admin/RowActions";
import { LessonDetail, type LessonFields, LessonForm, LessonTypePicker, TYPE_META } from "@/components/staff/lessonForms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import type { LessonType } from "@/types/domain.types";
import type { LessonMaterial } from "@/types/learning.types";

const pad = (n: number) => String(n).padStart(2, "0");

/** What a lesson's create call takes — its parent's id is added by the caller. */
export interface MaterialInput {
    type: LessonType;
    title: string;
    description?: string;
    youtubeUrl?: string;
    content?: string;
    resourceUrl?: string;
}

/** How to read and write one parent's lessons — an assignment's, or a practice day's. */
export interface MaterialsApi {
    list: () => Promise<LessonMaterial[]>;
    create: (input: MaterialInput) => Promise<void>;
    update: (materialId: string, payload: Record<string, unknown>) => Promise<void>;
    remove: (materialId: string) => Promise<void>;
    reorder: (orderedIds: string[]) => Promise<void>;
}

/**
 * The lessons that come with an assignment or a practice day — videos, texts
 * and links, built the same way a module's are: pick a type and fill it in
 * above, then edit, delete and drag them into order in the list below. Every
 * change is optimistic where it can be and toasts what happened.
 */
export default function LessonMaterialsEditor({
    queryKey,
    api,
    intro,
    listNote,
    emptyTitle,
    onChanged,
}: {
    /** The list's cache key — unique to its parent. */
    queryKey: readonly unknown[];
    api: MaterialsApi;
    /** Under "Add a lesson": what these lessons are for. */
    intro: string;
    /** Beside the count over the list: where students see them. */
    listNote: string;
    /** The empty list's headline. */
    emptyTitle: string;
    /** After any change — e.g. to refresh a lesson count elsewhere. */
    onChanged?: () => Promise<unknown> | void;
}) {
    const queryClient = useQueryClient();
    const [adding, setAdding] = useState<LessonType | null>(null);
    // Remounts the open add form after a save, so it's empty for the next one.
    const [addFormKey, setAddFormKey] = useState(0);
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<LessonMaterial | null>(null);

    const { data: materials, isLoading, isError, error, refetch } = useQuery({ queryKey, queryFn: api.list });

    const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey }), onChanged?.()]);

    const create = useMutation({
        mutationFn: ({ type, fields }: { type: LessonType; fields: LessonFields }) =>
            api.create({
                type,
                title: fields.title,
                description: fields.description || undefined,
                youtubeUrl: fields.youtubeUrl,
                content: fields.content,
                resourceUrl: fields.resourceUrl,
            }),
        onSuccess: async (_result, { type }) => {
            await refresh();
            toast.success(`${TYPE_META[type].label} lesson added.`);
            setAddFormKey((key) => key + 1);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't add that lesson.")),
    });

    const update = useMutation({
        mutationFn: ({ lesson, fields }: { lesson: LessonMaterial; fields: LessonFields }) => {
            const specific =
                lesson.type === "VIDEO"
                    ? { youtubeUrl: fields.youtubeUrl }
                    : lesson.type === "TEXT"
                      ? { content: fields.content }
                      : { resourceUrl: fields.resourceUrl };
            return api.update(lesson.id, { title: fields.title, description: fields.description, ...specific });
        },
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson saved.");
            setEditOpen(false);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that lesson.")),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api.remove(id),
        onSuccess: async () => {
            await refresh();
            toast.success("Lesson deleted.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete that lesson.")),
    });

    /** Optimistic, like every other list: rows move on drop, the handle spins until saved. */
    const reorder = useMutation({
        mutationFn: ({ orderedIds }: { orderedIds: string[]; movedId: string }) => api.reorder(orderedIds),
        onMutate: async ({ orderedIds }) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<LessonMaterial[]>(queryKey);
            if (previous) {
                const byId = new Map(previous.map((m) => [m.id, m]));
                queryClient.setQueryData<LessonMaterial[]>(
                    queryKey,
                    orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })),
                );
            }
            return { previous };
        },
        onError: (err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't reorder the lessons."));
        },
        onSuccess: () => toast.success("Reordered."),
        onSettled: () => refresh(),
    });

    return (
        <>
            <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
                <div>
                    <h2 className="font-semibold">Add a lesson</h2>
                    <p className="text-sm text-muted-foreground">{intro}</p>
                </div>

                <LessonTypePicker active={adding} onPick={setAdding} />

                {adding && (
                    <div className="border-t border-border pt-4">
                        <LessonForm
                            key={`${adding}-${addFormKey}`}
                            type={adding}
                            layout="inline"
                            withDuration={false}
                            isPending={create.isPending}
                            submitLabel={`Add ${TYPE_META[adding].label.toLowerCase()} lesson`}
                            onSubmit={(fields) => create.mutate({ type: adding, fields })}
                            onCancel={() => setAdding(null)}
                        />
                    </div>
                )}
            </section>

            <section aria-labelledby="materials-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <header className="border-b border-border bg-surface px-5 py-3.5">
                    <h2 id="materials-title" className="font-semibold">
                        {materials ? `${materials.length} lesson${materials.length === 1 ? "" : "s"}` : "Lessons"}{" "}
                        <span className="font-normal text-muted-foreground">· {listNote}</span>
                    </h2>
                </header>

                {isLoading ? (
                    <div className="space-y-px p-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-14 rounded-md" />
                        ))}
                    </div>
                ) : isError || !materials ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium">Couldn&apos;t load the lessons</p>
                        <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again in a moment.")}</p>
                        <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
                            Try again
                        </Button>
                    </div>
                ) : materials.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <PlayCircle className="mx-auto size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 font-medium">{emptyTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Pick Video, Text or Resource above to add the first one.</p>
                    </div>
                ) : (
                    <SortableList
                        ids={materials.map((m) => m.id)}
                        disabled={reorder.isPending}
                        getLabel={(id) => materials.find((m) => m.id === id)?.title ?? "Lesson"}
                        onReorder={(orderedIds, movedId) => reorder.mutate({ orderedIds, movedId })}
                    >
                        <ul className="divide-y divide-border">
                            {materials.map((material) => {
                                const meta = TYPE_META[material.type];
                                const Icon = meta.icon;
                                const isSavingPosition = reorder.isPending && reorder.variables?.movedId === material.id;
                                const isDeleting = remove.isPending && remove.variables === material.id;
                                const openEdit = () => {
                                    setEditing(material);
                                    setEditOpen(true);
                                };

                                return (
                                    <SortableItem
                                        key={material.id}
                                        id={material.id}
                                        as="li"
                                        aria-busy={isSavingPosition || isDeleting || undefined}
                                        className={cn(
                                            "flex items-center gap-x-3 px-3 py-3 transition-[opacity,background-color] hover:bg-secondary/25 sm:px-4",
                                            isDeleting && "opacity-60",
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            {materials.length > 1 ? <DragHandle label={material.title} isSaving={isSavingPosition} /> : <span className="w-2" aria-hidden />}
                                            <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{pad(material.order)}</span>
                                            <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={meta.label} />
                                            <div className="min-w-0">
                                                <button type="button" onClick={openEdit} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                                                    {material.title}
                                                </button>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {meta.label} · <LessonDetail lesson={material} />
                                                </p>
                                            </div>
                                        </div>
                                        <RowActions
                                            label={`More for ${material.title}`}
                                            primary={
                                                <Button size="sm" variant="outline" onClick={openEdit}>
                                                    <Pencil /> <span className="max-sm:sr-only">Edit</span>
                                                </Button>
                                            }
                                            items={[
                                                {
                                                    label: "Delete",
                                                    icon: Trash2,
                                                    destructive: true,
                                                    disabled: isDeleting,
                                                    onSelect: async () => {
                                                        if (await confirmAction({ title: `Delete "${material.title}"?`, confirmText: "Delete lesson" })) remove.mutate(material.id);
                                                    },
                                                },
                                            ]}
                                        />
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
                        withDuration={false}
                        isPending={update.isPending}
                        submitLabel="Save changes"
                        onSubmit={(fields) => update.mutate({ lesson: editing, fields })}
                        onCancel={() => setEditOpen(false)}
                    />
                )}
            </Modal>
        </>
    );
}
