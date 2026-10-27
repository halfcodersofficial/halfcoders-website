"use client";

import { Plus } from "lucide-react";
import { Children, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileEmptyState } from "./ProfileEmptyState";
import type { LucideIcon } from "lucide-react";

interface RepeatableListProps {
    title: string;
    icon?: LucideIcon;
    addLabel: string;
    isLoading?: boolean;
    isEmpty: boolean;
    emptyIcon?: LucideIcon;
    emptyTitle: string;
    emptyDescription?: string;
    /** The add-form's fields, rendered inside the "add new" card while it's open. */
    renderAddForm: ReactNode;
    /** Seeds the add form with blank values. Called right before the add card opens. */
    onStartAdd?: () => void;
    /** Resets the add form. Called right before the add card closes. */
    onCancelAdd?: () => void;
    /** Resolve to close the add card; reject/throw to keep it open. */
    onSubmitAdd: () => Promise<unknown>;
    isSavingAdd?: boolean;
    /** The mapped rows — each one an `InlineEditRow`. */
    children: ReactNode;
}

/**
 * "+Add X" → an inline add-form card, then the existing items as cards.
 * Used by Skill Set, Job Experience, Got Hired and Important Links' project
 * cards — each supplies its own row shape and add-form fields.
 */
export function RepeatableList({
    title,
    icon: Icon,
    addLabel,
    isLoading,
    isEmpty,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    renderAddForm,
    onStartAdd,
    onCancelAdd,
    onSubmitAdd,
    isSavingAdd,
    children,
}: RepeatableListProps) {
    const [isAdding, setIsAdding] = useState(false);

    const startAdd = () => {
        onStartAdd?.();
        setIsAdding(true);
    };

    const cancelAdd = () => {
        onCancelAdd?.();
        setIsAdding(false);
    };

    const submitAdd = async () => {
        try {
            await onSubmitAdd();
            setIsAdding(false);
        } catch {
            // Stay open — the mutation's onError already surfaced a toast.
        }
    };

    const count = isEmpty ? 0 : Children.count(children);

    return (
        <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    {Icon && (
                        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-5" />
                        </span>
                    )}
                    <h2 className="flex items-center gap-2 text-lg font-bold leading-tight tracking-tight">
                        {title}
                        {count > 0 && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                                {count}
                            </span>
                        )}
                    </h2>
                </div>
                {!isAdding && !isLoading && !isEmpty && (
                    <Button type="button" size="sm" className="px-4" onClick={startAdd}>
                        <Plus className="size-3.5" /> {addLabel}
                    </Button>
                )}
            </header>

            <div className="px-5 py-5 sm:px-6">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-20 rounded-md" />
                        <Skeleton className="h-20 rounded-md" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isAdding && (
                            <div className="overflow-hidden rounded-md border border-primary/40 ring-4 ring-primary/10">
                                <p className="border-b border-border bg-primary/4 px-4 py-2.5 text-sm font-semibold text-primary">
                                    {addLabel}
                                </p>
                                <div className="space-y-4 p-4">{renderAddForm}</div>
                                <div className="flex justify-end gap-2 border-t border-border bg-secondary/40 px-4 py-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                       
                                        onClick={cancelAdd}
                                        disabled={isSavingAdd}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="button" size="sm" className="px-5" onClick={submitAdd} isLoading={isSavingAdd}>
                                        Add
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isEmpty && !isAdding ? (
                            <ProfileEmptyState
                                icon={emptyIcon}
                                title={emptyTitle}
                                description={emptyDescription}
                                action={
                                    <Button type="button" className="px-5" onClick={startAdd}>
                                        <Plus className="size-3.5" /> {addLabel}
                                    </Button>
                                }
                            />
                        ) : (
                            children
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
