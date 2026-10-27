"use client";

import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/input";
import { useDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One row per item, instead of a textarea holding a delimited blob.
 *
 * A list typed into a textarea is hard to work with once it outgrows the box:
 * the entries scroll out of sight, there is nothing to click to delete the
 * third one, and a stray delimiter silently merges or splits entries without
 * saying so. Giving each entry its own input makes the count visible, makes
 * removal a button, and makes it impossible to typo a delimiter.
 *
 * The field's value stays the delimited string it always was — the schemas
 * that parse and cap these lists, and the API contract, are unchanged. This
 * only replaces how the string is typed.
 */

const SEPARATORS = {
    /** One entry per line — course outcomes, requirements. */
    lines: { split: /\r?\n/, join: "\n" },
    /** Comma separated — mentor expertise tags. */
    commas: { split: /,/, join: ", " },
} as const;

interface ListInputProps {
    placeholder?: string;
    /** Wording for the add button, e.g. "Add outcome". */
    addLabel?: string;
    /** Names each row for screen readers: "Outcome 1", "Outcome 2". */
    itemLabel: string;
    /** Matches the schema's ceiling; adding stops here. */
    max?: number;
    separator?: keyof typeof SEPARATORS;
}

/**
 * "" means an empty list; anything else keeps its rows, blanks included.
 * Entries are trimmed because the separators are stored with padding — a saved
 * "React, Node.js" would otherwise put a leading space in the second input.
 */
const parse = (value: string, split: RegExp): string[] =>
    value.trim() === "" ? [""] : value.split(split).map((item) => item.trim());

export function ListInput({
    placeholder,
    addLabel,
    itemLabel,
    max,
    separator = "lines",
}: ListInputProps) {
    const field = useField();
    const t = useT();
    const digits = useDigits();
    const { split, join } = SEPARATORS[separator];

    const value = (field?.value ?? "") as string;

    // Rows live here rather than being derived from the string on every render,
    // because a blank row has no representation in the delimited value — it
    // would vanish the moment it was added.
    const [rows, setRows] = useState<string[]>(() => parse(value, split));
    const lastEmitted = useRef(value);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusRow, setFocusRow] = useState<number | null>(null);

    // Re-sync when the value changes from outside — the course editor calls
    // form.reset() once the course loads, long after this mounted.
    useEffect(() => {
        if (value !== lastEmitted.current) {
            lastEmitted.current = value;
            setRows(parse(value, split));
        }
    }, [value, split]);

    useEffect(() => {
        if (focusRow === null) return;
        inputs.current[focusRow]?.focus();
        setFocusRow(null);
    }, [focusRow]);

    const commit = (next: string[]) => {
        setRows(next);
        // All-blank collapses to "", so an emptied list clears the field rather
        // than saving a string of separators.
        const joined = next.every((row) => row.trim() === "") ? "" : next.join(join);
        lastEmitted.current = joined;
        field?.setValue(joined);
    };

    const filled = rows.filter((row) => row.trim() !== "").length;
    const atMax = max !== undefined && filled >= max;

    const setRow = (index: number, next: string) => {
        const parts = next.split(split);

        if (parts.length === 1) {
            commit(rows.map((row, i) => (i === index ? next : row)));
            return;
        }

        // The text carries separators — almost always a list pasted in one go.
        // Expanding it into rows keeps the bulk paste the old textarea allowed,
        // and stops a delimiter from being stored inside a single entry.
        const expanded = [...rows];
        expanded.splice(index, 1, ...parts.map((part) => part.trim()));
        commit(expanded);
        setFocusRow(index + parts.length - 1);
    };

    const addRow = (afterIndex: number) => {
        const next = [...rows];
        next.splice(afterIndex + 1, 0, "");
        commit(next);
        setFocusRow(afterIndex + 1);
    };

    const removeRow = (index: number) => {
        // Never leave zero inputs — an empty list still needs somewhere to type.
        const next = rows.length === 1 ? [""] : rows.filter((_, i) => i !== index);
        commit(next);
        setFocusRow(Math.max(0, index - 1));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
        // Enter continues the list, the way pressing it in the textarea used to.
        if (event.key === "Enter") {
            event.preventDefault();
            if (!atMax) addRow(index);
            return;
        }
        // Backspace in an already-empty row removes it, so a list can be
        // cleared without reaching for the mouse.
        if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
            event.preventDefault();
            removeRow(index);
        }
    };

    return (
        <div className="space-y-2">
            <ul className="space-y-2">
                {rows.map((row, index) => (
                    // The index is the identity here: rows have no stable key,
                    // and keying by content would remount an input mid-typing.
                    <li key={index} className="flex items-center gap-2">
                        <span
                            className="hidden shrink-0 text-muted-foreground sm:block"
                            aria-hidden
                        >
                            <GripVertical className="size-4" />
                        </span>

                        <input
                            ref={(node) => {
                                inputs.current[index] = node;
                            }}
                            // The label points at the first row, so clicking it
                            // lands somewhere sensible.
                            id={index === 0 ? field?.id : undefined}
                            value={row}
                            placeholder={index === 0 ? placeholder : undefined}
                            aria-label={`${itemLabel} ${digits(index + 1)}`}
                            aria-invalid={field?.error ? true : undefined}
                            aria-describedby={index === 0 ? field?.describedBy : undefined}
                            onChange={(event) => setRow(index, event.target.value)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                            onBlur={field?.onBlur}
                            className={cn(controlBase, "h-11 py-2 sm:h-10")}
                        />

                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t(
                                `Remove ${itemLabel.toLowerCase()} ${index + 1}`,
                                `${itemLabel} ${digits(index + 1)} মুছুন`,
                            )}
                            onClick={() => removeRow(index)}
                        >
                            <X className="size-4" />
                        </Button>
                    </li>
                ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addRow(rows.length - 1)}
                    disabled={atMax}
                >
                    <Plus className="size-4" /> {addLabel ?? t("Add item", "যোগ করুন")}
                </Button>

                {max !== undefined && (
                    <span
                        className={cn(
                            "text-xs tabular-nums",
                            filled > max ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                    >
                        {digits(filled)} / {digits(max)}
                    </span>
                )}
            </div>
        </div>
    );
}
