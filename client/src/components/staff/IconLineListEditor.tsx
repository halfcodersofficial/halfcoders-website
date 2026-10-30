"use client";

import { Plus, X } from "lucide-react";
import { useField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/input";
import {
    COURSE_FEATURE_ICON_KEYS,
    COURSE_FEATURE_ICON_NAMES_BN,
    COURSE_FEATURE_ICONS,
    featureIcon,
} from "@/lib/courseFeatureIcons";
import { useDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CourseIconLine } from "@/types/domain.types";

/** The saved lines, as rows the form can hold. */
export const toIconLineRows = (lines: CourseIconLine[] | undefined): CourseIconLine[] =>
    (lines ?? []).map((line) => ({ icon: line.icon, text: line.text }));

/** Rows as the API wants them: trimmed, and a row left empty dropped. */
export const fromIconLineRows = (rows: CourseIconLine[]): CourseIconLine[] =>
    rows
        .map((row) => ({ icon: row.icon, text: row.text.trim() }))
        .filter((row) => row.text !== "");

interface IconLineListEditorProps {
    max: number;
    /** Per line, matching the API's limit. */
    maxLength: number;
    /** What one line is called, for the row's screen-reader labels. */
    itemLabel: string;
    addLabel: string;
    placeholder: string;
    /** Shown while there are no lines — say what the page does then. */
    emptyText: string;
}

/**
 * A list of icon-and-text lines — the hero facts.
 * Reads and writes through `FormField`'s context like `FeatureListEditor`,
 * with the same fixed icon set, so the form's dirty state and save see it.
 */
export function IconLineListEditor({ max, maxLength, itemLabel, addLabel, placeholder, emptyText }: IconLineListEditorProps) {
    const field = useField();
    const t = useT();
    const digits = useDigits();
    const rows = (field?.value ?? []) as CourseIconLine[];

    const commit = (next: CourseIconLine[]) => field?.setValue(next);
    const setRow = (index: number, patch: Partial<CourseIconLine>) =>
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const inputClass = cn(controlBase, "h-11 py-2 sm:h-10");

    return (
        <div className="space-y-3">
            {rows.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {emptyText}
                </p>
            )}

            <ul className="space-y-2">
                {rows.map((row, index) => {
                    const Icon = featureIcon(row.icon);
                    const n = digits(index + 1);
                    return (
                        // Index as key: rows have no id, and keying by content
                        // would remount the input mid-typing.
                        <li key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                            <select
                                value={row.icon}
                                aria-label={t(`Icon for ${itemLabel} ${index + 1}`, `${n} নম্বর ${itemLabel}-এর আইকন`)}
                                onChange={(event) => setRow(index, { icon: event.target.value })}
                                className={cn(inputClass, "w-40 shrink-0 cursor-pointer")}
                            >
                                {COURSE_FEATURE_ICON_KEYS.map((key) => (
                                    <option key={key} value={key}>
                                        {t(COURSE_FEATURE_ICONS[key].label, COURSE_FEATURE_ICON_NAMES_BN[key] ?? COURSE_FEATURE_ICONS[key].label)}
                                    </option>
                                ))}
                            </select>
                            <input
                                id={index === 0 ? field?.id : undefined}
                                value={row.text}
                                placeholder={placeholder}
                                aria-label={t(`${itemLabel} ${index + 1}`, `${n} নম্বর ${itemLabel}`)}
                                aria-describedby={index === 0 ? field?.describedBy : undefined}
                                maxLength={maxLength}
                                onChange={(event) => setRow(index, { text: event.target.value })}
                                onBlur={field?.onBlur}
                                className={cn(inputClass, "min-w-0 flex-1 basis-48")}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t(`Remove ${itemLabel} ${index + 1}`, `${n} নম্বর ${itemLabel} মুছুন`)}
                                onClick={() => commit(rows.filter((_, i) => i !== index))}
                            >
                                <X className="size-4" />
                            </Button>
                        </li>
                    );
                })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => commit([...rows, { icon: "check", text: "" }])}
                    disabled={rows.length >= max}
                >
                    <Plus className="size-4" /> {addLabel}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {digits(rows.length)} / {digits(max)}
                </span>
            </div>
        </div>
    );
}
