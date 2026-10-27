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
import type { CourseFeature } from "@/types/domain.types";

export const MAX_FEATURES = 12;

/** A row as the form holds it — description always a string, never undefined. */
export type FeatureRow = { icon: string; title: string; description: string };

const EMPTY_ROW: FeatureRow = { icon: "video", title: "", description: "" };

export const toFeatureRows = (features: CourseFeature[] | undefined): FeatureRow[] =>
    (features ?? []).map((f) => ({ icon: f.icon, title: f.title, description: f.description ?? "" }));

export const fromFeatureRows = (rows: FeatureRow[]): CourseFeature[] =>
    rows
        .filter((row) => row.title.trim() !== "")
        .map((row) => ({
            icon: row.icon,
            title: row.title.trim(),
            ...(row.description.trim() ? { description: row.description.trim() } : {}),
        }));

/**
 * The "How this course is structured" tiles: icon, title, one line of
 * description. Reads and writes the array through `FormField`'s context, the
 * same way `ListInput` does, so the form's dirty state and save button see it.
 *
 * The icon is chosen from a fixed list, not typed — see `courseFeatureIcons`.
 */
export function FeatureListEditor() {
    const field = useField();
    const t = useT();
    const digits = useDigits();
    const rows = (field?.value ?? []) as FeatureRow[];

    const commit = (next: FeatureRow[]) => field?.setValue(next);

    const setRow = (index: number, patch: Partial<FeatureRow>) =>
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const addRow = () => commit([...rows, { ...EMPTY_ROW }]);
    const removeRow = (index: number) => commit(rows.filter((_, i) => i !== index));

    const inputClass = cn(controlBase, "h-11 py-2 sm:h-10");

    return (
        <div className="space-y-3">
            {rows.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t(
                        "No feature tiles yet. Four to six short ones read best — “60+ video lessons”, “1:1 mentor support”, “Job-ready projects”.",
                        "এখনো কোনো ফিচার টাইল নেই। চার থেকে ছয়টি ছোট টাইল সবচেয়ে ভালো দেখায় — “৬০+ ভিডিও লেসন”, “১:১ মেন্টর সাপোর্ট”, “চাকরির উপযোগী প্রজেক্ট”।",
                    )}
                </p>
            )}

            <ul className="space-y-3">
                {rows.map((row, index) => {
                    const Icon = featureIcon(row.icon);
                    const titleMissing = row.title.trim() === "";

                    return (
                        // Index as key: rows have no id, and keying by content
                        // would remount an input mid-typing.
                        <li
                            key={index}
                            className="grid gap-2 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start"
                        >
                            <div className="flex items-center gap-2">
                                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                    <Icon className="size-5" />
                                </span>
                                <select
                                    value={row.icon}
                                    aria-label={t(`Icon for feature ${index + 1}`, `${digits(index + 1)} নম্বর ফিচারের আইকন`)}
                                    onChange={(event) => setRow(index, { icon: event.target.value })}
                                    className={cn(inputClass, "w-40 cursor-pointer")}
                                >
                                    {COURSE_FEATURE_ICON_KEYS.map((key) => (
                                        <option key={key} value={key}>
                                            {t(COURSE_FEATURE_ICONS[key].label, COURSE_FEATURE_ICON_NAMES_BN[key] ?? COURSE_FEATURE_ICONS[key].label)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid gap-2">
                                <input
                                    id={index === 0 ? field?.id : undefined}
                                    value={row.title}
                                    placeholder={t("Title — e.g. 60+ recorded lessons", "শিরোনাম — যেমন ৬০+ রেকর্ডেড লেসন")}
                                    aria-label={t(`Title for feature ${index + 1}`, `${digits(index + 1)} নম্বর ফিচারের শিরোনাম`)}
                                    aria-invalid={titleMissing && field?.error ? true : undefined}
                                    aria-describedby={index === 0 ? field?.describedBy : undefined}
                                    maxLength={80}
                                    onChange={(event) => setRow(index, { title: event.target.value })}
                                    onBlur={field?.onBlur}
                                    className={inputClass}
                                />
                                <input
                                    value={row.description}
                                    placeholder={t("One line of detail (optional)", "এক লাইনের বিস্তারিত (ঐচ্ছিক)")}
                                    aria-label={t(`Description for feature ${index + 1}`, `${digits(index + 1)} নম্বর ফিচারের বিবরণ`)}
                                    maxLength={200}
                                    onChange={(event) => setRow(index, { description: event.target.value })}
                                    onBlur={field?.onBlur}
                                    className={inputClass}
                                />
                            </div>

                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="justify-self-end text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t(`Remove feature ${index + 1}`, `${digits(index + 1)} নম্বর ফিচার মুছুন`)}
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
                    onClick={addRow}
                    disabled={rows.length >= MAX_FEATURES}
                >
                    <Plus className="size-4" /> {t("Add feature", "ফিচার যোগ করুন")}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {digits(rows.length)} / {digits(MAX_FEATURES)}
                </span>
            </div>
        </div>
    );
}
