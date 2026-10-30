"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { enrollmentService } from "@/services";

export interface PickedStudent {
    id: string;
    name: string;
    email: string;
    image: string | null;
}

/** On the course now — a cancelled or expired enrolment can't be given anything with it. */
const HAS_COURSE = ["ACTIVE", "COMPLETED"];

/**
 * Students of one course, picked from a search of its enrolments: one (it
 * works like a radio list) or several (checkboxes). The picks sit above the
 * search as removable chips, so narrowing the list never hides who's chosen.
 * Anyone who no longer has the course shows, greyed, and can't be picked.
 */
export default function CourseStudentPicker({
    courseId,
    value,
    onChange,
    single = false,
    error,
}: {
    courseId: string;
    value: PickedStudent[];
    onChange: (students: PickedStudent[]) => void;
    single?: boolean;
    error?: string;
}) {
    const id = useId();
    const [term, setTerm] = useState("");
    const [search, setSearch] = useState("");

    // Asks the server once typing pauses, not on every key.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(term.trim()), 300);
        return () => clearTimeout(timer);
    }, [term]);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["admin", "course-students", courseId, search],
        queryFn: () => enrollmentService.courseStudents(courseId, { searchTerm: search || undefined, limit: 50, sortBy: "startedAt", sortOrder: "desc" }),
        placeholderData: (previous) => previous,
    });
    const rows = data?.data ?? [];
    const total = data?.meta?.total ?? rows.length;

    const picked = new Set(value.map((student) => student.id));
    const toggle = (student: PickedStudent) => {
        if (single) return onChange(picked.has(student.id) ? [] : [student]);
        onChange(picked.has(student.id) ? value.filter((entry) => entry.id !== student.id) : [...value, student]);
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="sr-only">
                {single ? "Student" : "Students"}
            </Label>

            {value.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Picked">
                    {value.map((student) => (
                        <li
                            key={student.id}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-1 pr-1 text-sm"
                        >
                            <Avatar src={student.image} name={student.name} size={20} />
                            <span className="truncate">{student.name}</span>
                            <button
                                type="button"
                                onClick={() => toggle(student)}
                                className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label={`Remove ${student.name}`}
                            >
                                <X className="size-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id={id}
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Search this course's students by name or email…"
                    autoComplete="off"
                    className="pl-9"
                    aria-invalid={error ? true : undefined}
                />
            </div>

            <div className={cn("max-h-72 overflow-y-auto rounded-md border border-border transition-opacity", isFetching && !isLoading && "opacity-70")}>
                {isLoading ? (
                    <div className="space-y-2 p-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-11" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                        {search ? "No students on this course match." : "Nobody has this course yet."}
                    </p>
                ) : (
                    <ul className="divide-y divide-border">
                        {rows.map(({ id: enrollmentId, status, progress, student }) => {
                            const has = HAS_COURSE.includes(status);
                            const checked = picked.has(student.id);
                            return (
                                <li key={enrollmentId}>
                                    <label
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 transition-colors",
                                            has ? "cursor-pointer hover:bg-secondary/60" : "cursor-not-allowed opacity-55",
                                            checked && "bg-primary/5",
                                        )}
                                    >
                                        <input
                                            type={single ? "radio" : "checkbox"}
                                            name={single ? `${id}-student` : undefined}
                                            checked={checked}
                                            disabled={!has}
                                            onChange={() => toggle(student)}
                                            className="size-4 shrink-0 accent-primary"
                                        />
                                        <Avatar src={student.image} name={student.name} size={32} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{student.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{student.email}</span>
                                        </span>
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                            {has ? `${progress}% done` : "No longer on the course"}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            {total > rows.length && (
                <p className="text-xs text-muted-foreground">
                    Showing the latest {rows.length} of {total} — search to find anyone else.
                </p>
            )}
            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}
