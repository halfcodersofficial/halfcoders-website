"use client";

import { Plus, X } from "lucide-react";
import { useField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/input";
import { useDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CourseFaq } from "@/types/domain.types";

export const MAX_FAQS = 20;

const EMPTY_ROW: CourseFaq = { question: "", answer: "" };

export const fromFaqRows = (rows: CourseFaq[]): CourseFaq[] =>
    rows
        .filter((row) => row.question.trim() !== "" || row.answer.trim() !== "")
        .map((row) => ({ question: row.question.trim(), answer: row.answer.trim() }));

/**
 * Per-course questions and answers. Same contract as `FeatureListEditor`:
 * the array lives in the form's values and flows through `useField()`.
 *
 * When a course has none, the public page falls back to the platform-wide
 * questions — so an empty list here is a fine state, not a broken one, and
 * the placeholder says so.
 */
export function FaqListEditor() {
    const field = useField();
    const t = useT();
    const digits = useDigits();
    const rows = (field?.value ?? []) as CourseFaq[];

    const commit = (next: CourseFaq[]) => field?.setValue(next);

    const setRow = (index: number, patch: Partial<CourseFaq>) =>
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const addRow = () => commit([...rows, { ...EMPTY_ROW }]);
    const removeRow = (index: number) => commit(rows.filter((_, i) => i !== index));

    return (
        <div className="space-y-3">
            {rows.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t(
                        "No questions yet — the course page shows no FAQ section until you add one.",
                        "এখনো কোনো প্রশ্ন নেই — প্রশ্ন যোগ না করা পর্যন্ত কোর্স পেজে প্রশ্নোত্তর অংশ দেখাবে না।",
                    )}
                </p>
            )}

            <ul className="space-y-3">
                {rows.map((row, index) => (
                    <li
                        key={index}
                        className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3"
                    >
                        <div className="flex items-start gap-2">
                            <span className="mt-2.5 shrink-0 text-xs font-bold uppercase tracking-wide text-primary">
                                {t("Q", "প্র")}{digits(index + 1)}
                            </span>
                            <input
                                id={index === 0 ? field?.id : undefined}
                                value={row.question}
                                placeholder={t(
                                    "Do I need to know JavaScript before starting?",
                                    "শুরু করার আগে কি JavaScript জানা লাগবে?",
                                )}
                                aria-label={t(`Question ${index + 1}`, `প্রশ্ন ${digits(index + 1)}`)}
                                aria-describedby={index === 0 ? field?.describedBy : undefined}
                                maxLength={200}
                                onChange={(event) => setRow(index, { question: event.target.value })}
                                onBlur={field?.onBlur}
                                className={cn(controlBase, "h-11 py-2 font-medium sm:h-10")}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t(`Remove question ${index + 1}`, `${digits(index + 1)} নম্বর প্রশ্ন মুছুন`)}
                                onClick={() => removeRow(index)}
                            >
                                <X className="size-4" />
                            </Button>
                        </div>

                        <textarea
                            value={row.answer}
                            placeholder={t("The answer students will read.", "শিক্ষার্থীরা যে উত্তরটি পড়বে।")}
                            aria-label={t(`Answer ${index + 1}`, `উত্তর ${digits(index + 1)}`)}
                            rows={2}
                            maxLength={2000}
                            onChange={(event) => setRow(index, { answer: event.target.value })}
                            onBlur={field?.onBlur}
                            className={cn(controlBase, "min-h-20 py-2.5 leading-relaxed")}
                        />
                    </li>
                ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addRow}
                    disabled={rows.length >= MAX_FAQS}
                >
                    <Plus className="size-4" /> {t("Add question", "প্রশ্ন যোগ করুন")}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {digits(rows.length)} / {digits(MAX_FAQS)}
                </span>
            </div>
        </div>
    );
}
