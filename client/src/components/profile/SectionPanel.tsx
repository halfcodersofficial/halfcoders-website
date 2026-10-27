"use client";

import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProfileEmptyState } from "./ProfileEmptyState";
import type { LucideIcon } from "lucide-react";

interface SectionPanelProps {
    title: string;
    icon?: LucideIcon;
    description?: string;
    isLoading?: boolean;
    isSaving?: boolean;
    /** Whether there's anything to edit yet — hides the pencil while loading. */
    editable?: boolean;
    /** Seeds the form from the last-saved data. Called right before entering edit mode. */
    onEdit?: () => void;
    /** Resets the form back to the last-saved baseline. Called right before returning to view mode. */
    onCancel: () => void;
    /** Resolve to flip back to view mode; reject/throw to stay in edit (the mutation's own onError already toasts). */
    onSave: () => Promise<unknown>;
    /** Fires whenever view/edit mode changes — lets a page reveal other content only while this section is being edited. */
    onModeChange?: (mode: "view" | "edit") => void;
    renderView: ReactNode;
    renderEdit: ReactNode;
    /**
     * Set when nothing has been saved yet: the view shows this invitation
     * with a button into the form, instead of a grid of "Not added yet".
     */
    empty?: { title: string; description?: string };
    className?: string;
}

/**
 * The view/edit toggle pattern every singleton profile section shares: a
 * pencil button swaps read-only content for a form with Cancel/Save, and mode
 * lives here rather than in each page so every section behaves identically.
 * While editing, the panel is ringed and the actions sit in a footer bar.
 */
export function SectionPanel({
    title,
    icon: Icon,
    description,
    isLoading,
    isSaving,
    editable = true,
    onEdit,
    onCancel,
    onSave,
    renderView,
    renderEdit,
    onModeChange,
    empty,
    className,
}: SectionPanelProps) {
    const [mode, setMode] = useState<"view" | "edit">("view");

    const enterMode = (next: "view" | "edit") => {
        setMode(next);
        onModeChange?.(next);
    };

    const startEdit = () => {
        onEdit?.();
        enterMode("edit");
    };

    const cancel = () => {
        onCancel();
        enterMode("view");
    };

    const save = async () => {
        try {
            await onSave();
            enterMode("view");
        } catch {
            // Stay in edit — the mutation's onError already surfaced a toast.
        }
    };

    const isEditing = mode === "edit";

    return (
        <section
            className={cn(
                "overflow-hidden rounded-card border bg-card shadow-card transition-[border-color,box-shadow] duration-200",
                isEditing ? "border-primary/40 ring-4 ring-primary/10" : "border-border",
                className,
            )}
        >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    {Icon && (
                        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                            <Icon className="size-5" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold leading-tight tracking-tight">{title}</h2>
                        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
                {isEditing ? (
                    <span className="rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">editing…</span>
                ) : (
                    editable &&
                    !isLoading &&
                    !empty && (
                        <Button type="button" variant="outline" size="sm" className="px-4" onClick={startEdit}>
                            <Pencil className="size-3.5" /> Edit
                        </Button>
                    )
                )}
            </header>

            <div className="px-5 py-5 sm:px-6">
                {isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Skeleton className="h-16 rounded-md" />
                        <Skeleton className="h-16 rounded-md" />
                        <Skeleton className="h-16 rounded-md" />
                    </div>
                ) : isEditing ? (
                    renderEdit
                ) : empty ? (
                    <ProfileEmptyState
                        icon={Icon}
                        title={empty.title}
                        description={empty.description}
                        action={
                            editable && (
                                <Button type="button" className="px-5" onClick={startEdit}>
                                    <Pencil className="size-3.5" /> Fill it in
                                </Button>
                            )
                        }
                    />
                ) : (
                    renderView
                )}
            </div>

            {isEditing && (
                <footer className="flex justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3 sm:px-6">
                    <Button type="button" variant="outline" onClick={cancel} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" className="px-5" onClick={save} isLoading={isSaving}>
                        Save changes
                    </Button>
                </footer>
            )}
        </section>
    );
}
