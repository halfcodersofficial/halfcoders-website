"use client";

import { BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export interface CoursePickerItem {
    id: string;
    title: string;
    thumbnail: string | null;
    /** 0–100. */
    progress: number;
    /** One line under the title: where they are, how the quizzes went. */
    hint: string;
}

/**
 * Which of the student's courses to look at: a card each — the cover, the
 * whole title (two lines, never cut to a few words), how far they've got and
 * a line about it. Only drawn when there's more than one course.
 */
export function CoursePicker({ items, value, onChange }: { items: CoursePickerItem[]; value: string; onChange: (id: string) => void }) {
    if (items.length < 2) return null;

    return (
        <div role="group" aria-label="Course" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
                const active = item.id === value;
                return (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            "flex min-w-0 items-center gap-3 rounded-card border bg-card p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40",
                        )}
                    >
                        <span className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">
                            <SafeImage
                                src={item.thumbnail}
                                alt=""
                                fill
                                sizes="80px"
                                className="object-cover"
                                fallback={<BookOpen className="size-4 text-muted-foreground" />}
                            />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1.5">
                            <span className="line-clamp-2 text-sm font-medium leading-snug" title={item.title}>
                                {item.title}
                            </span>
                            <span className="flex items-center gap-2">
                                <Progress value={item.progress} className="h-1" barClassName="bg-brand" />
                                <span className="shrink-0 text-xs font-semibold tabular-nums">{item.progress}%</span>
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
