"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared by the rows of an `<Accordion single>`: which one is open. It stays
 * `undefined` until the reader first toggles a row, so until then each row
 * follows its own `defaultOpen` — the server render and first paint agree,
 * with no effect needed to settle which row starts open.
 */
interface AccordionGroup {
    openId: string | null | undefined;
    setOpenId: (id: string | null) => void;
}

const AccordionGroupContext = createContext<AccordionGroup | null>(null);

type AccordionVariant = "boxed" | "plain";
const AccordionVariantContext = createContext<AccordionVariant>("boxed");

interface AccordionItemProps {
    /** Rendered inside the trigger button — keep it to text and inline chips. */
    title: ReactNode;
    /** Right-aligned metadata in the trigger row (lesson counts, durations). */
    meta?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    /** Lets a parent drive every item at once — see `useAccordionGroup`. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** For a Bangla question: `langOf(question)`. */
    lang?: string;
    className?: string;
}

/**
 * A single collapsible row.
 *
 * This is deliberately not `<details>/<summary>`. A list that needs an
 * "expand all" control can only drive a native `details` by mutating the DOM
 * node's `open` property — which React then fights on the next render.
 * Controlled state is the boring option that actually works.
 *
 * The answer stays mounted so it can slide open (a grid row growing from 0fr
 * to 1fr); while closed it is `inert`, so nothing in it can take focus or be
 * read out.
 */
export function AccordionItem({
    title,
    meta,
    children,
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    lang,
    className,
}: AccordionItemProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const id = useId();
    const triggerId = `${id}-trigger`;
    const panelId = `${id}-panel`;
    const group = useContext(AccordionGroupContext);
    const plain = useContext(AccordionVariantContext) === "plain";

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled
        ? controlledOpen
        : group
            ? group.openId === undefined ? defaultOpen : group.openId === panelId
            : uncontrolledOpen;

    const toggle = () => {
        if (!isControlled) {
            if (group) group.setOpenId(isOpen ? null : panelId);
            else setUncontrolledOpen((value) => !value);
        }
        onOpenChange?.(!isOpen);
    };

    return (
        <div className={cn("border-b border-border last:border-b-0", className)}>
            <h3 lang={lang}>
                <button
                    id={triggerId}
                    type="button"
                    onClick={toggle}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={cn(
                        "flex w-full items-center gap-4 py-4 text-left font-sans transition-colors",
                        plain ? "hover:text-primary" : "px-5 hover:bg-surface focus-visible:-outline-offset-2 sm:px-6",
                    )}
                >
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug">
                        {title}
                    </span>
                    {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                            isOpen && "rotate-180 text-primary",
                        )}
                        aria-hidden
                    />
                </button>
            </h3>

            <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                inert={!isOpen}
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
            >
                <div className="overflow-hidden">
                    <div className={cn("pb-5 text-sm leading-relaxed text-muted-foreground", !plain && "px-5 sm:px-6")}>{children}</div>
                </div>
            </div>
        </div>
    );
}

/**
 * `single`: opening a row closes whichever was open, so one answer shows at a
 * time. Give at most one of its rows `defaultOpen`.
 *
 * `variant="boxed"` sits the rows in a bordered card; `"plain"` is an open
 * list between two hairlines, for a band that is already a surface.
 */
export function Accordion({
    children,
    className,
    single = false,
    variant = "boxed",
}: {
    children: ReactNode;
    className?: string;
    single?: boolean;
    variant?: AccordionVariant;
}) {
    const [openId, setOpenId] = useState<string | null | undefined>(undefined);
    const group = useMemo(() => (single ? { openId, setOpenId } : null), [single, openId]);

    return (
        <AccordionGroupContext.Provider value={group}>
            <AccordionVariantContext.Provider value={variant}>
                <div
                    className={cn(
                        variant === "boxed" ? "overflow-hidden rounded-card border border-border bg-card" : "border-y border-border",
                        className,
                    )}
                >
                    {children}
                </div>
            </AccordionVariantContext.Provider>
        </AccordionGroupContext.Provider>
    );
}
