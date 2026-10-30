"use client";

import { BookOpen, GraduationCap, Search, UserCog } from "lucide-react";
import { useId, useRef, useState } from "react";
import { CourseMeta, CourseThumb } from "@/components/admin/CourseSummary";
import { count } from "@/components/admin/broadcast/composer";
import { FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BroadcastAudience } from "@/types/admin.types";

export type Audience = "ALL_STUDENTS" | "ALL_MENTORS" | "COURSE";

type CourseEntry = BroadcastAudience["courses"][number];

const OPTIONS = [
    { value: "ALL_STUDENTS", label: "All students", caption: "Every active student", icon: GraduationCap },
    { value: "ALL_MENTORS", label: "All mentors", caption: "Every active mentor", icon: UserCog },
    { value: "COURSE", label: "One course", caption: "Its enrolled students", icon: BookOpen },
] as const;

interface AudiencePickerProps {
    value: string;
    courseId: string;
    onAudience: (audience: Audience) => void;
    onCourse: (courseId: string) => void;
    audience: BroadcastAudience | undefined;
    isLoading: boolean;
    isError: boolean;
    /** The ids the form focuses on a failed send. */
    audienceId: string;
    courseFieldId: string;
    courseError?: string;
}

/**
 * Who a broadcast reaches, with how many each choice reaches right now — the
 * same count the send will report. "One course" opens the courses as rows
 * (picture, title, students), never a dropdown: with a list of titles alone
 * it's too easy to message the wrong cohort.
 */
export default function AudiencePicker({
    value,
    courseId,
    onAudience,
    onCourse,
    audience,
    isLoading,
    isError,
    audienceId,
    courseFieldId,
    courseError,
}: AudiencePickerProps) {
    const chosen = audience?.courses.find((entry) => entry.course.id === courseId);

    const figureFor = (option: Audience) => {
        if (option === "ALL_STUDENTS") return audience && count(audience.students);
        if (option === "ALL_MENTORS") return audience && count(audience.mentors);
        return chosen ? count(chosen.recipients) : "—";
    };

    return (
        <div>
            <div
                role="radiogroup"
                aria-label="Audience"
                className="grid overflow-hidden rounded-card border border-border bg-card shadow-card sm:grid-cols-3"
            >
                {OPTIONS.map((option, index) => {
                    const checked = value === option.value;
                    const figure = figureFor(option.value);

                    return (
                        <label
                            key={option.value}
                            className={cn(
                                "relative flex cursor-pointer items-center gap-4 p-4 transition-colors sm:flex-col sm:items-stretch sm:gap-0 sm:p-5",
                                index > 0 && "border-t border-border sm:border-l sm:border-t-0",
                                checked ? "bg-primary/6" : "hover:bg-secondary/40",
                                "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-ring",
                            )}
                        >
                            <input
                                type="radio"
                                id={index === 0 ? audienceId : undefined}
                                name={audienceId}
                                value={option.value}
                                checked={checked}
                                onChange={() => onAudience(option.value)}
                                className="sr-only"
                            />
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute inset-y-0 left-0 w-0.5 bg-primary transition-opacity sm:inset-x-0 sm:bottom-auto sm:h-0.5 sm:w-auto",
                                    checked ? "opacity-100" : "opacity-0",
                                )}
                            />

                            <span className="flex shrink-0 items-center gap-2 sm:mb-5 sm:justify-between">
                                <option.icon
                                    className={cn("size-4 transition-colors", checked ? "text-primary" : "text-muted-foreground")}
                                    aria-hidden
                                />
                                <span
                                    aria-hidden
                                    className={cn(
                                        "size-4 rounded-full border transition-[border-width,border-color] max-sm:hidden",
                                        checked ? "border-[5px] border-primary" : "border-border",
                                    )}
                                />
                            </span>

                            <span className="min-w-0 flex-1 sm:order-3 sm:flex-none">
                                <span className="block text-sm font-semibold">{option.label}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {option.value === "COURSE" && chosen ? chosen.course.title : option.caption}
                                </span>
                            </span>

                            <span className="shrink-0 text-right sm:order-2 sm:mb-1.5 sm:text-left">
                                {isLoading ? (
                                    <Skeleton className="h-8 w-16 sm:h-9" />
                                ) : (
                                    <span
                                        className={cn(
                                            "block text-2xl font-bold leading-none tabular-nums tracking-tight transition-colors sm:text-[2rem]",
                                            checked ? "text-primary" : "text-foreground",
                                            figure === "—" && "text-muted-foreground",
                                        )}
                                    >
                                        {figure ?? "—"}
                                    </span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>

            {value === "COURSE" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
                    <CourseChooser
                        courses={audience?.courses}
                        chosen={chosen}
                        onCourse={onCourse}
                        isLoading={isLoading}
                        isError={isError}
                        fieldId={courseFieldId}
                        invalid={Boolean(courseError)}
                    />
                    {courseError && (
                        <div className="mt-2">
                            <FieldError id={`${courseFieldId}-error`}>{courseError}</FieldError>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * The course, once chosen, collapses to one confirming row with "Change";
 * until then it's a searchable list. A course nobody is enrolled on can't be
 * picked — sending to no one would only look like it worked.
 */
function CourseChooser({
    courses,
    chosen,
    onCourse,
    isLoading,
    isError,
    fieldId,
    invalid,
}: {
    courses: CourseEntry[] | undefined;
    chosen: CourseEntry | undefined;
    onCourse: (courseId: string) => void;
    isLoading: boolean;
    isError: boolean;
    fieldId: string;
    invalid: boolean;
}) {
    const groupName = useId();
    const [browsing, setBrowsing] = useState(false);
    const [term, setTerm] = useState("");
    const changeRef = useRef<HTMLButtonElement>(null);

    const collapse = () => {
        setBrowsing(false);
        setTerm("");
        requestAnimationFrame(() => changeRef.current?.focus({ preventScroll: true }));
    };

    if (chosen && !browsing) {
        return (
            <div className="flex items-center gap-3 rounded-card border border-primary/30 bg-primary/4 p-2.5 pr-3">
                <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <CourseThumb course={chosen.course} sizes="80px" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={chosen.course.title}>
                        {chosen.course.title}
                    </p>
                    <CourseMeta course={chosen.course} />
                </div>
                <p className="shrink-0 text-right max-[420px]:hidden">
                    <span className="block text-sm font-semibold tabular-nums">{count(chosen.recipients)}</span>
                    <span className="block text-[0.6875rem] text-muted-foreground">enrolled</span>
                </p>
                <button
                    ref={changeRef}
                    type="button"
                    onClick={() => setBrowsing(true)}
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                    Change
                </button>
            </div>
        );
    }

    const needle = term.trim().toLowerCase();
    const shown = (courses ?? []).filter((entry) => !needle || entry.course.title.toLowerCase().includes(needle));

    return (
        <div
            className={cn(
                "overflow-hidden rounded-card border bg-card",
                invalid ? "border-destructive" : "border-border",
            )}
            // Tabbing out of the list with a course picked folds it away, the
            // way a click on a course does.
            onBlur={(event) => {
                if (chosen && !event.currentTarget.contains(event.relatedTarget)) setBrowsing(false);
            }}
        >
            <div className="border-b border-border p-2">
                <Input
                    id={fieldId}
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Find a course…"
                    aria-label="Find a course"
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? `${fieldId}-error` : undefined}
                    addonStart={<Search className="size-4" aria-hidden />}
                />
            </div>

            {isLoading ? (
                <div className="space-y-px p-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-14 rounded-md" />
                    ))}
                </div>
            ) : isError ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Couldn&apos;t load the courses. Reload to try again.</p>
            ) : shown.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                    {needle ? <>No course matches &ldquo;{term.trim()}&rdquo;.</> : "No courses yet."}
                </p>
            ) : (
                <ul role="radiogroup" aria-label="Course" className="max-h-80 divide-y divide-border overflow-y-auto overscroll-contain">
                    {shown.map(({ course, recipients }) => {
                        const checked = course.id === chosen?.course.id;
                        const empty = recipients === 0;

                        return (
                            <li key={course.id}>
                                <label
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 transition-colors",
                                        empty ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-secondary/40",
                                        checked && "bg-primary/6",
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name={groupName}
                                        value={course.id}
                                        checked={checked}
                                        disabled={empty}
                                        onChange={() => onCourse(course.id)}
                                        // A click (detail ≥ 1) settles the choice; arrow keys
                                        // only move it, so the list stays open under them.
                                        onClick={(event) => {
                                            if (event.detail > 0) collapse();
                                        }}
                                        className="size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
                                    />
                                    <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                                        <CourseThumb course={course} sizes="64px" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{course.title}</span>
                                        <CourseMeta course={course} />
                                    </span>
                                    <span className="shrink-0 text-right">
                                        {empty ? (
                                            <span className="text-[0.6875rem] text-muted-foreground">No students yet</span>
                                        ) : (
                                            <>
                                                <span className="block text-sm font-semibold tabular-nums">{count(recipients)}</span>
                                                <span className="block text-[0.6875rem] text-muted-foreground">enrolled</span>
                                            </>
                                        )}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
