"use client";

import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DraggableAttributes,
    type DraggableSyntheticListeners,
    type Modifier,
    type UniqueIdentifier,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Menu } from "lucide-react";
import {
    createContext,
    useContext,
    useId,
    type CSSProperties,
    type ElementType,
    type HTMLAttributes,
    type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Drag-to-reorder for the console's lists, the way LinkedIn does it: a ≡
 * handle on each row, grab it and drop the row where it belongs.
 *
 * Built on dnd-kit rather than native HTML drag-and-drop, which has no touch
 * support and no keyboard story. Here the handle is a real button: Tab to it,
 * Space or Enter to pick the row up, arrow keys to move it, Space or Enter to
 * drop, Escape to cancel — and each step is announced to screen readers.
 *
 * `SortableList` renders no markup of its own, so the caller keeps its
 * `<ul>`/`<li>` (or cards) and wraps each row in `SortableItem`.
 */

/** Rows only ever move up and down; sideways drift while dragging is noise. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface SortableListProps {
    ids: string[];
    /** Called once on drop with the complete new order, and only if it changed. */
    onReorder: (orderedIds: string[], movedId: string) => void;
    /** Locks every row — e.g. while the previous move is still saving. */
    disabled?: boolean;
    /** How a row is named in the pick-up / move / drop announcements. */
    getLabel?: (id: string) => string;
    children: ReactNode;
}

export function SortableList({ ids, onReorder, disabled, getLabel, children }: SortableListProps) {
    // dnd-kit numbers its screen-reader ids from a global counter otherwise,
    // which differs between the server render and the browser's.
    const contextId = useId();
    const sensors = useSensors(
        // A few pixels of travel before a drag starts, so a click on the
        // handle stays a click.
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const label = (id: UniqueIdentifier) => getLabel?.(String(id)) ?? "Item";
    const position = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from < 0 || to < 0) return;
        onReorder(arrayMove(ids, from, to), String(active.id));
    };

    return (
        <DndContext
            id={contextId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            accessibility={{
                screenReaderInstructions: {
                    draggable:
                        "To reorder, press Space or Enter to pick this up, use the arrow keys to move it, then press Space or Enter to drop it. Press Escape to cancel.",
                },
                announcements: {
                    onDragStart: ({ active }) =>
                        `Picked up ${label(active.id)}. Position ${position(active.id)} of ${ids.length}.`,
                    onDragOver: ({ active, over }) =>
                        over
                            ? `${label(active.id)} is over position ${position(over.id)} of ${ids.length}.`
                            : `${label(active.id)} is not over a position.`,
                    onDragEnd: ({ active, over }) =>
                        over
                            ? `${label(active.id)} dropped at position ${position(over.id)} of ${ids.length}.`
                            : `${label(active.id)} dropped.`,
                    onDragCancel: ({ active }) =>
                        `Cancelled. ${label(active.id)} is back at position ${position(active.id)}.`,
                },
            }}
        >
            <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
                {children}
            </SortableContext>
        </DndContext>
    );
}

interface ItemContextValue {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    isDragging: boolean;
}

const ItemContext = createContext<ItemContextValue | null>(null);

type SortableItemProps = {
    id: string;
    /** The row's own element — `li` inside a `ul`, `section` for a card. */
    as?: ElementType;
    className?: string;
    children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "id" | "className" | "children">;

/** One draggable row. Only its `DragHandle` starts a drag. */
export function SortableItem({ id, as: Tag = "div", className, style, children, ...rest }: SortableItemProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id });

    const moving: CSSProperties = {
        ...style,
        // Translate, not Transform: rows of different heights would otherwise
        // be stretched to each other's size mid-drag.
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <ItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef, isDragging }}>
            <Tag
                ref={setNodeRef}
                style={moving}
                data-dragging={isDragging || undefined}
                className={cn(className, isDragging && "relative z-20 bg-card shadow-lg ring-1 ring-primary/30")}
                {...rest}
            >
                {children}
            </Tag>
        </ItemContext.Provider>
    );
}

/**
 * The ≡ grip. Turns into a spinner while this row's new position is saving,
 * so the move reads as "processing" until the server has it.
 */
export function DragHandle({
    label,
    isSaving = false,
    className,
}: {
    /** What's being moved, e.g. "Week 03" — read as "Reorder Week 03". */
    label: string;
    isSaving?: boolean;
    className?: string;
}) {
    const context = useContext(ItemContext);
    if (!context) return null;

    const { attributes, listeners, setActivatorNodeRef, isDragging } = context;

    return (
        <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={isSaving ? `Saving the new position of ${label}` : `Reorder ${label}`}
            title={isSaving ? "Saving the new order…" : "Drag to reorder"}
            className={cn(
                "grid size-9 shrink-0 touch-none place-items-center rounded-md text-muted-foreground transition-colors",
                "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragging ? "cursor-grabbing text-primary" : "cursor-grab",
                "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent",
                className,
            )}
        >
            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        </button>
    );
}
