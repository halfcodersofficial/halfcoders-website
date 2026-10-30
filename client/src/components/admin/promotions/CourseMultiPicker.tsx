"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";

interface CourseMultiPickerProps {
    label: string;
    /** Course ids, in the order they were picked — the order students see. */
    value: string[];
    onChange: (ids: string[]) => void;
    /** Courses that can't be picked here (the course the promotion is on). */
    exclude?: string[];
    hint?: string;
    error?: string;
    required?: boolean;
    /** Keeps the label for screen readers only — when a section heading beside it already says it. */
    hideLabel?: boolean;
}

/**
 * Several courses, picked from a searchable list: the picks sit above it as
 * chips in the order they were made, each removable. Every course the
 * console knows is listed — drafts too, flagged, since a promotion is often
 * set up before its courses go live (a draft is never given or sold).
 */
export default function CourseMultiPicker({ label, value, onChange, exclude = [], hint, error, required, hideLabel = false }: CourseMultiPickerProps) {
    const id = useId();
    const [term, setTerm] = useState("");
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "courses", "picker"],
        queryFn: () => adminService.courses({ limit: 100, sortBy: "title", sortOrder: "asc" }),
        staleTime: 60_000,
    });

    const courses = useMemo(() => (data?.data ?? []).filter((course) => !exclude.includes(course.id)), [data, exclude]);
    const byId = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
    const search = term.trim().toLowerCase();
    const shown = search ? courses.filter((course) => course.title.toLowerCase().includes(search)) : courses;

    const toggle = (courseId: string) =>
        onChange(value.includes(courseId) ? value.filter((picked) => picked !== courseId) : [...value, courseId]);

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
                {label}
                {required && (
                    <span className="ml-0.5 text-destructive" aria-hidden>
                        *
                    </span>
                )}
            </Label>

            {value.length > 0 && (
                <ol className="flex flex-wrap gap-2" aria-label="Picked">
                    {value.map((courseId, index) => (
                        <li
                            key={courseId}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-2.5 pr-1 text-sm"
                        >
                            <span className="text-xs font-semibold text-primary tabular-nums">{index + 1}</span>
                            <span className="truncate">{byId.get(courseId)?.title ?? "A course"}</span>
                            <button
                                type="button"
                                onClick={() => toggle(courseId)}
                                className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label={`Remove ${byId.get(courseId)?.title ?? "this course"}`}
                            >
                                <X className="size-3.5" />
                            </button>
                        </li>
                    ))}
                </ol>
            )}

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id={id}
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Search courses…"
                    autoComplete="off"
                    className="pl-9"
                    aria-invalid={error ? true : undefined}
                />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {isLoading ? (
                    <div className="space-y-2 p-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-10" />
                        ))}
                    </div>
                ) : shown.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No courses match.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {shown.map((course) => {
                            const picked = value.includes(course.id);
                            const price = course.discountPrice ?? course.price;
                            return (
                                <li key={course.id}>
                                    <label
                                        className={cn(
                                            "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-secondary/60",
                                            picked && "bg-primary/5",
                                        )}
                                    >
                                        <input type="checkbox" checked={picked} onChange={() => toggle(course.id)} className="size-4 shrink-0 accent-primary" />
                                        <span className="relative aspect-video w-14 shrink-0 overflow-hidden rounded bg-secondary">
                                            <SafeImage
                                                src={course.thumbnail}
                                                alt=""
                                                fill
                                                sizes="56px"
                                                className="object-cover"
                                                fallback={<BookOpen className="size-4 text-muted-foreground" />}
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{course.title}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {price > 0 ? formatBDT(price) : "Free"}
                                                {course.status !== "PUBLISHED" && (
                                                    <span className="ml-1.5 font-semibold text-amber-600">· {course.status === "DRAFT" ? "Draft" : "Archived"}</span>
                                                )}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}
