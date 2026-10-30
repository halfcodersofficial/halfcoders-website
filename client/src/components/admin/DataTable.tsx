"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
    id: string;
    header: string;
    cell: (row: T) => ReactNode;
    /** Extra classes for the cell — a width, `text-right`, `whitespace-nowrap`. */
    className?: string;
    /** Shown as the card heading on small screens. Defaults to the first column. */
    primary?: boolean;
    /** Leave this column out of the small-screen cards. */
    hideOnMobile?: boolean;
    /**
     * Enables a clickable sort control in the header. Sorting only reorders
     * the rows already on screen — it's a convenience for scanning the
     * current page, not a substitute for a server-side sort — so it's
     * ignored unless `sortValue` can pull a comparable primitive out of the
     * row (`cell` returns JSX, which isn't one).
     */
    sortable?: boolean;
    sortValue?: (row: T) => string | number | Date;
}

interface DataTableProps<T> {
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    /** Rendered at the right of the row — see `RowActions`. */
    actions?: (row: T) => ReactNode;
    /** Row-level emphasis, e.g. an order that needs attention. */
    rowClassName?: (row: T) => string | undefined;
    /** Turns on a checkbox column and a "select all on this page" header box. */
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectionChange?: (ids: Set<string>) => void;
}

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

const compare = (a: string | number | Date, b: string | number | Date) => {
    if (a instanceof Date || b instanceof Date) {
        return new Date(a).getTime() - new Date(b).getTime();
    }
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * The one list layout every admin register uses.
 *
 * A real `<table>` from `md` up — columns line up, a status is always in the
 * same place, and thirty rows fit on a screen where the old card list fit
 * eight. Below `md` the same columns become a stack of cards, each labelled,
 * because a six-column table on a phone is a horizontal scroll nobody wants.
 *
 * `selectable` and a `sortable` column are both opt-in and additive — a page
 * that doesn't pass them renders exactly as before.
 */
export default function DataTable<T>({
    rows,
    columns,
    rowKey,
    actions,
    rowClassName,
    selectable = false,
    selectedIds,
    onSelectionChange,
}: DataTableProps<T>) {
    const primary = columns.find((column) => column.primary) ?? columns[0];
    const secondary = columns.filter((column) => column !== primary && !column.hideOnMobile);

    const [sort, setSort] = useState<SortState>(null);

    const sortedRows = useMemo(() => {
        if (!sort) return rows;
        const column = columns.find((c) => c.id === sort.columnId);
        if (!column?.sortValue) return rows;

        const withValue = column.sortValue;
        const sorted = [...rows].sort((a, b) => compare(withValue(a), withValue(b)));
        return sort.direction === "asc" ? sorted : sorted.reverse();
    }, [rows, sort, columns]);

    const toggleSort = (columnId: string) => {
        setSort((current) => {
            if (current?.columnId !== columnId) return { columnId, direction: "asc" };
            if (current.direction === "asc") return { columnId, direction: "desc" };
            return null;
        });
    };

    const selected = selectedIds ?? new Set<string>();
    const pageIds = sortedRows.map(rowKey);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    const someSelected = !allSelected && pageIds.some((id) => selected.has(id));

    const toggleAll = () => {
        if (!onSelectionChange) return;
        onSelectionChange(allSelected ? new Set() : new Set(pageIds));
    };

    const toggleRow = (id: string) => {
        if (!onSelectionChange) return;
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange(next);
    };

    const checkboxClass =
        "size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

    return (
        <>
            <div className="relative hidden overflow-x-auto rounded-card border border-border bg-card shadow-card md:block">
                <table className="w-full text-sm">
                    <thead className="bg-surface text-left font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                        <tr>
                            {selectable && (
                                <th scope="col" className="w-10 px-4 py-2.5">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all rows on this page"
                                        checked={allSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = someSelected;
                                        }}
                                        onChange={toggleAll}
                                        className={checkboxClass}
                                    />
                                </th>
                            )}
                            {columns.map((column) => {
                                const isSortable = column.sortable && column.sortValue;
                                const isActive = sort?.columnId === column.id;

                                return (
                                    <th
                                        key={column.id}
                                        scope="col"
                                        className={cn("px-4 py-2.5 font-medium", column.className)}
                                    >
                                        {isSortable ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(column.id)}
                                                className={cn(
                                                    "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                                                    isActive && "text-foreground",
                                                )}
                                            >
                                                {column.header}
                                                {isActive ? (
                                                    sort.direction === "asc" ? (
                                                        <ArrowUp className="size-3.5" />
                                                    ) : (
                                                        <ArrowDown className="size-3.5" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="size-3.5 opacity-40" />
                                                )}
                                            </button>
                                        ) : (
                                            column.header
                                        )}
                                    </th>
                                );
                            })}
                            {actions && (
                                <th scope="col" className="px-4 py-2.5 text-right">
                                    <span className="sr-only">Actions</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.map((row) => {
                            const id = rowKey(row);
                            const isSelected = selected.has(id);

                            return (
                                <tr
                                    key={id}
                                    className={cn(
                                        "border-t border-border transition-colors hover:bg-surface/70",
                                        isSelected && "bg-primary/5 hover:bg-primary/10",
                                        rowClassName?.(row),
                                    )}
                                >
                                    {selectable && (
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="checkbox"
                                                aria-label="Select row"
                                                checked={isSelected}
                                                onChange={() => toggleRow(id)}
                                                className={checkboxClass}
                                            />
                                        </td>
                                    )}
                                    {columns.map((column) => (
                                        <td key={column.id} className={cn("px-4 py-3 align-middle", column.className)}>
                                            {column.cell(row)}
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="px-4 py-2 text-right align-middle">{actions(row)}</td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul className="space-y-3 md:hidden">
                {sortedRows.map((row) => {
                    const id = rowKey(row);
                    const isSelected = selected.has(id);

                    return (
                        <li
                            key={id}
                            className={cn(
                                "rounded-card border border-border bg-card p-4 shadow-card transition-colors",
                                isSelected && "border-primary/40 bg-primary/5",
                                rowClassName?.(row),
                            )}
                        >
                            <div className="flex items-start gap-3">
                                {selectable && (
                                    <input
                                        type="checkbox"
                                        aria-label="Select row"
                                        checked={isSelected}
                                        onChange={() => toggleRow(id)}
                                        className={cn(checkboxClass, "mt-0.5")}
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm">{primary.cell(row)}</div>

                                    {secondary.length > 0 && (
                                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                                            {secondary.map((column) => (
                                                <div key={column.id} className="min-w-0">
                                                    <dt className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                                                        {column.header}
                                                    </dt>
                                                    <dd className="mt-0.5 min-w-0">{column.cell(row)}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}

                                    {actions && (
                                        <div className="mt-3 border-t border-border pt-3">{actions(row)}</div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
