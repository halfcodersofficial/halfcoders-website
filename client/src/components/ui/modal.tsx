"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The console's popup for every form and detail view SweetAlert itself can't
 * host: live validation, custom controls, lists, several steps. The list
 * behind stays where it is, the popup has one job and one primary button, and
 * closing it puts the admin back exactly where they were.
 *
 * From `sm` up it's a card in the middle of the screen; on a phone it's a
 * sheet along the bottom edge, full width, so a long form gets the whole
 * screen and the actions sit under the thumb. Either way the header and the
 * footer stay put and only the body scrolls.
 *
 * Radix underneath: focus moves in and back out, Escape closes, the page
 * behind is inert, and the content unmounts on close so a form inside starts
 * clean every time.
 *
 * Pass `title` (and `description`) for a single-step popup and the header is
 * drawn for you. Leave them out to compose the header from ModalHeader, as a
 * multi-step form does so it can change its own header as it goes. Either
 * way the rest is ModalBody and ModalFooter.
 */
interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Draws the header. Leave out to compose it from ModalHeader instead. */
    title?: ReactNode;
    /** One line on what the popup is for. Read out with the title. */
    description?: ReactNode;
    /**
     * `sm` a question with a field or two; `md` a short form; `lg` a long one,
     * or a detail view with lists in it; `xl` a form beside its own preview.
     */
    size?: "sm" | "md" | "lg" | "xl";
    /**
     * Off keeps a stray backdrop click from throwing away a half-filled form —
     * SweetAlert's `allowOutsideClick: false`. Escape and the × still close.
     */
    closeOnOutsideClick?: boolean;
    className?: string;
    children: ReactNode;
}

const SIZE = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
} as const;

export function Modal({
    open,
    onOpenChange,
    title,
    description,
    size = "md",
    closeOnOutsideClick = true,
    className,
    children,
}: ModalProps) {
    const t = useT();
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                {/* The overlay doubles as the layout — bottom-anchored on a
                    phone, centred above — so the popup's transform is free
                    for its entrance. */}
                <Dialog.Overlay className="fixed inset-0 z-50 grid items-end bg-primary-950/45 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:place-items-center sm:p-6">
                    <Dialog.Content
                        className={cn(
                            "modal-pop relative flex w-full flex-col border-border bg-card text-card-foreground focus:outline-none",
                            // Phone: a sheet off the bottom edge, nearly full height at most.
                            "max-h-[94dvh] rounded-t-[1.375rem] border-t",
                            // Above: a card, clear of the screen's edges.
                            "sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border",
                            SIZE[size],
                            className,
                        )}
                        style={{ boxShadow: "var(--shadow-panel)" }}
                        // Where lib/confirm.ts mounts a SweetAlert asked from inside.
                        data-modal=""
                        onInteractOutside={closeOnOutsideClick ? undefined : (event) => event.preventDefault()}
                        // Escape answers a SweetAlert opened from inside this
                        // popup (lib/confirm.ts) — it shouldn't close the popup too.
                        onEscapeKeyDown={(event) => {
                            if (document.querySelector(".swal2-container")) event.preventDefault();
                        }}
                        // Radix warns when a dialog has no description; a popup
                        // drawn without one says so explicitly rather than
                        // pointing at an element that doesn't exist.
                        {...(title !== undefined && !description ? { "aria-describedby": undefined } : {})}
                    >
                        {title !== undefined && (
                            <ModalHeader>
                                <ModalTitle>{title}</ModalTitle>
                                {description && <ModalDescription>{description}</ModalDescription>}
                            </ModalHeader>
                        )}

                        {children}

                        <Dialog.Close
                            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-3.5 sm:top-3.5"
                            aria-label={t("Close", "বন্ধ করুন")}
                        >
                            <X className="size-4.5" />
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/**
 * The title block, ruled off from the body. Clear of the corner × on the
 * right; `ModalSteps` goes after the description in a multi-step form.
 */
export const ModalHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("shrink-0 border-b border-border py-4 pl-5 pr-14 sm:py-5 sm:pl-6 sm:pr-16", className)} {...props} />
);

export const ModalTitle = ({ className, ...props }: Dialog.DialogTitleProps) => (
    <Dialog.Title className={cn("text-lg font-semibold leading-snug tracking-tight sm:text-xl", className)} {...props} />
);

export const ModalDescription = ({ className, ...props }: Dialog.DialogDescriptionProps) => (
    <Dialog.Description className={cn("mt-1 max-w-prose text-sm text-muted-foreground", className)} {...props} />
);

/** Apply to the `<form>` that holds `ModalBody` and `ModalFooter`: body scrolls, footer stays put. */
export const modalFormClass = "flex min-h-0 flex-1 flex-col";

/**
 * The scrolling middle — a size container, so what's inside can lay itself
 * out by the popup's width rather than the window's. Clips sideways so a
 * step sliding in doesn't flash a scrollbar.
 */
export const ModalBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn("@container min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 sm:px-6", className)}
        {...props}
    />
);

/**
 * The action row, on a faint band under the body. Primary button goes last
 * (right); a destructive or secondary action can take `sm:mr-auto` to sit
 * apart at the left. On a phone the buttons share the width, thumb-sized.
 */
export const ModalFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/70 px-5 py-3.5 sm:rounded-b-2xl sm:px-6",
            "pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5",
            "max-sm:[&>a]:flex-1 max-sm:[&>button]:flex-1",
            className,
        )}
        {...props}
    />
);

interface ModalStepsProps {
    steps: readonly string[];
    /** Index of the step on screen; `steps.length` marks them all complete. */
    current: number;
    /** Makes the steps it returns true for clickable — typically the ones already done. */
    canSelect?: (index: number) => boolean;
    onSelect?: (index: number) => void;
}

/**
 * Where a multi-step form is: one segment per step, filled as they're done,
 * each with its number (a tick once done) and name. Shares the width evenly,
 * so it fits a phone as well as the widest popup.
 */
export function ModalSteps({ steps, current, canSelect, onSelect }: ModalStepsProps) {
    return (
        <ol className="mt-4 grid auto-cols-fr grid-flow-col gap-2">
            {steps.map((label, index) => {
                const done = index < current;
                const active = index === current;
                const selectable = Boolean(onSelect && canSelect?.(index));

                const body = (
                    <>
                        <span
                            aria-hidden
                            className={cn(
                                "block h-1 rounded-full transition-colors duration-300",
                                done || active ? "bg-primary" : "bg-border",
                            )}
                        />
                        <span className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
                            <span
                                aria-hidden
                                className={cn(
                                    "grid size-4.5 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold tabular-nums transition-colors",
                                    done && "bg-primary text-primary-foreground",
                                    active && "bg-primary/10 text-primary ring-1 ring-primary",
                                    !done && !active && "bg-secondary text-muted-foreground",
                                )}
                            >
                                {done ? <Check className="size-2.5" strokeWidth={3.5} /> : index + 1}
                            </span>
                            <span
                                className={cn(
                                    "truncate",
                                    active ? "font-semibold text-foreground" : "text-muted-foreground",
                                    selectable && "group-hover:text-foreground",
                                )}
                            >
                                {label}
                            </span>
                        </span>
                    </>
                );

                return (
                    <li key={label} className="min-w-0" aria-current={active ? "step" : undefined}>
                        {selectable ? (
                            <button
                                type="button"
                                onClick={() => onSelect?.(index)}
                                className="group block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                                aria-label={`Go to step ${index + 1}: ${label}`}
                            >
                                {body}
                            </button>
                        ) : (
                            body
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
