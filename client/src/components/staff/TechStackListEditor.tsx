"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { TechStackIconPicker } from "@/components/staff/TechStackIconPicker";
import { useField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/input";
import { useDigits, useT } from "@/lib/i18n";
import { TECH_STACK_ICONS, techStackIcon } from "@/lib/techStackIcons";
import { cn } from "@/lib/utils";
import type { CourseTechStackItem } from "@/types/domain.types";

export const MAX_TECH_STACK = 20;

export type TechStackRow = CourseTechStackItem;

export const toTechStackRows = (items: CourseTechStackItem[] | undefined): TechStackRow[] =>
    (items ?? []).map((item) => ({ icon: item.icon, name: item.name }));

export const fromTechStackRows = (rows: TechStackRow[]): CourseTechStackItem[] =>
    rows
        .filter((row) => row.name.trim() !== "")
        .map((row) => ({ icon: row.icon, name: row.name.trim() }));

/**
 * The tech-stack chips: an icon and a name, one row each. Same contract as
 * `FeatureListEditor` — the array lives in the form's values and flows
 * through `useField()` — but with only one text input, since a tech-stack
 * chip has no description.
 *
 * The icon comes from `TechStackIconPicker` — hundreds of tools and subjects
 * for every kind of course, too many for a dropdown. "Add" opens it to pick
 * several at once, each becoming a chip named after its icon ("Excel",
 * "React", "Public speaking"); a row's own icon button swaps just that icon.
 */
export function TechStackListEditor() {
    const field = useField();
    const t = useT();
    const digits = useDigits();
    const rows = (field?.value ?? []) as TechStackRow[];
    // The row the picker is choosing an icon for, or "new" to add chips.
    const [picking, setPicking] = useState<number | "new" | null>(null);

    const commit = (next: TechStackRow[]) => field?.setValue(next);

    const setRow = (index: number, patch: Partial<TechStackRow>) =>
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const removeRow = (index: number) => commit(rows.filter((_, i) => i !== index));

    const labelOf = (key: string) => TECH_STACK_ICONS[key]?.label ?? "";

    /** A row's new icon. A name still blank, or still the old icon's own label, follows it; one the admin wrote stays. */
    const pickIcon = (key: string) => {
        if (typeof picking !== "number") return;
        const row = rows[picking];
        const followsIcon = row.name.trim() === "" || row.name === labelOf(row.icon);
        setRow(picking, followsIcon ? { icon: key, name: labelOf(key) } : { icon: key });
        setPicking(null);
    };

    /** New chips, one per picked icon, each named after it. */
    const addChips = (keys: string[]) => {
        commit([...rows, ...keys.map((key) => ({ icon: key, name: labelOf(key) }))]);
        setPicking(null);
    };

    const inputClass = cn(controlBase, "h-11 py-2 sm:h-10");

    return (
        <div className="space-y-3">
            {rows.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t(
                        "No tech-stack chips yet. Add the tools and skills students will actually use — “Excel”, “Photoshop”, “React”.",
                        "এখনো কোনো টেক স্ট্যাক নেই। শিক্ষার্থীরা যে টুল ও দক্ষতা আসলেই ব্যবহার করবে সেগুলো যোগ করুন — “Excel”, “Photoshop”, “React”।",
                    )}
                </p>
            )}

            <ul className="space-y-3">
                {rows.map((row, index) => {
                    const Icon = techStackIcon(row.icon);
                    const nameMissing = row.name.trim() === "";

                    return (
                        // Index as key: rows have no id, and keying by content
                        // would remount an input mid-typing.
                        <li
                            key={index}
                            className="grid gap-2 rounded-md border border-border bg-secondary/30 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                        >
                            <div className="flex items-center gap-2">
                                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                    <Icon className="size-5" />
                                </span>
                                <button
                                    type="button"
                                    aria-haspopup="dialog"
                                    aria-label={t(
                                        `Icon for tech stack item ${index + 1}: ${TECH_STACK_ICONS[row.icon]?.label ?? row.icon}. Change`,
                                        `${digits(index + 1)} নম্বর টেক স্ট্যাকের আইকন: ${TECH_STACK_ICONS[row.icon]?.label ?? row.icon}। বদলান`,
                                    )}
                                    onClick={() => setPicking(index)}
                                    className={cn(inputClass, "flex w-44 cursor-pointer items-center justify-between gap-2 text-left")}
                                >
                                    <span className="truncate">{TECH_STACK_ICONS[row.icon]?.label ?? row.icon}</span>
                                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                </button>
                            </div>

                            <input
                                id={index === 0 ? field?.id : undefined}
                                value={row.name}
                                placeholder={t("Name — e.g. React", "নাম — যেমন React")}
                                aria-label={t(`Name for tech stack item ${index + 1}`, `${digits(index + 1)} নম্বর টেক স্ট্যাকের নাম`)}
                                aria-invalid={nameMissing && field?.error ? true : undefined}
                                aria-describedby={index === 0 ? field?.describedBy : undefined}
                                maxLength={40}
                                onChange={(event) => setRow(index, { name: event.target.value })}
                                onBlur={field?.onBlur}
                                className={inputClass}
                            />

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="justify-self-end text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t(`Remove tech stack item ${index + 1}`, `${digits(index + 1)} নম্বর টেক স্ট্যাক মুছুন`)}
                                onClick={() => removeRow(index)}
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
                    onClick={() => setPicking("new")}
                    disabled={rows.length >= MAX_TECH_STACK}
                >
                    <Plus className="size-4" /> {t("Add tech stack item", "টেক স্ট্যাক যোগ করুন")}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {digits(rows.length)} / {digits(MAX_TECH_STACK)}
                </span>
            </div>

            {picking === "new" ? (
                <TechStackIconPicker
                    open
                    onOpenChange={(open) => !open && setPicking(null)}
                    onPickMany={addChips}
                    limit={MAX_TECH_STACK - rows.length}
                    max={MAX_TECH_STACK}
                    taken={rows.map((row) => row.icon)}
                />
            ) : (
                <TechStackIconPicker
                    open={picking !== null}
                    onOpenChange={(open) => !open && setPicking(null)}
                    value={picking !== null ? rows[picking]?.icon : undefined}
                    onPick={pickIcon}
                />
            )}
        </div>
    );
}
