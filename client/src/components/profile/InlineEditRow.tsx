"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";

interface InlineEditRowProps {
    renderView: ReactNode;
    renderEdit: ReactNode;
    onEdit?: () => void;
    onCancel: () => void;
    onSave: () => Promise<unknown>;
    onDelete?: () => Promise<unknown>;
    /** What the confirm dialog asks before `onDelete` runs. */
    deleteConfirm?: { title: string; text?: string };
    isSaving?: boolean;
    isDeleting?: boolean;
    className?: string;
}

/**
 * One item card inside a `RepeatableList` — the same view/edit toggle as
 * `SectionPanel`, scoped to a single item, plus a delete action. Used by
 * Skill Set, Job Experience, Got Hired and Important Links' project cards.
 */
export function InlineEditRow({
    renderView,
    renderEdit,
    onEdit,
    onCancel,
    onSave,
    onDelete,
    deleteConfirm,
    isSaving,
    isDeleting,
    className,
}: InlineEditRowProps) {
    const [mode, setMode] = useState<"view" | "edit">("view");

    const startEdit = () => {
        onEdit?.();
        setMode("edit");
    };

    const cancel = () => {
        onCancel();
        setMode("view");
    };

    const save = async () => {
        try {
            await onSave();
            setMode("view");
        } catch {
            // Stay in edit — the mutation's onError already surfaced a toast.
        }
    };

    const remove = async () => {
        if (!onDelete) return;
        const confirmed = await confirmAction({
            title: deleteConfirm?.title ?? "Remove this?",
            text: deleteConfirm?.text,
            confirmText: "Remove",
        });
        if (confirmed) await onDelete();
    };

    return (
        <div
            className={cn(
                "group rounded-md border bg-card transition-[border-color,box-shadow] duration-200",
                mode === "view"
                    ? "border-border p-4 hover:border-primary/30 hover:shadow-card"
                    : "overflow-hidden border-primary/40 ring-4 ring-primary/10",
                className,
            )}
        >
            {mode === "view" ? (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{renderView}</div>
                    <div className="flex shrink-0 gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-muted-foreground hover:text-primary"
                            onClick={startEdit}
                            aria-label="Edit"
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                        {onDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={remove}
                                isLoading={isDeleting}
                                aria-label="Remove"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-4 p-4">{renderEdit}</div>
                    <div className="flex justify-end gap-2 border-t border-border bg-secondary/40 px-4 py-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                           
                            onClick={cancel}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="button" size="sm" className="px-5" onClick={save} isLoading={isSaving}>
                            Save
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
