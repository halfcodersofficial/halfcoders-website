"use client";

import { ArrowRight, Check, Mail, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import type { AdminUser } from "@/types/admin.types";

/** How many courses a card lists before "+N more". */
const SHOWN_COURSES = 2;

const UNITS: [number, string][] = [
    [365 * 24 * 60, "y"],
    [30 * 24 * 60, "mo"],
    [7 * 24 * 60, "w"],
    [24 * 60, "d"],
    [60, "h"],
    [1, "m"],
];

/** "Just now", "8h ago", "3d ago" — a relative time short enough for a stat cell. */
export const shortAgo = (value: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    const [size, unit] = UNITS.find(([unitMinutes]) => minutes >= unitMinutes) ?? [1, "m"];
    return minutes < 1 ? "Just now" : `${Math.floor(minutes / size)}${unit} ago`;
};

interface StudentCardProps {
    student: AdminUser;
    href: string;
    selected: boolean;
    onSelectedChange: (selected: boolean) => void;
    /** The ⋯ menu. */
    menu: ReactNode;
}

/**
 * A student at a glance in the register's card view: who they are, the
 * courses they're on with how far they've got, and how engaged they are.
 * The whole card opens the student; the checkbox and the menu sit above
 * that link.
 */
export default function StudentCard({ student, href, selected, onSelectedChange, menu }: StudentCardProps) {
    const courses = student.enrollments ?? [];
    const blocked = student.status !== "ACTIVE";
    const certificates = student._count?.certificates ?? 0;

    return (
        <Card
            className={cn(
                "group relative flex h-full flex-col shadow-card transition-[box-shadow,border-color,transform] duration-200",
                "hover:border-primary/40 hover:shadow-card-hover",
                "has-[[data-card-link]:focus-visible]:ring-2 has-[[data-card-link]:focus-visible]:ring-ring",
                blocked && "bg-secondary/30",
                selected && "border-primary ring-1 ring-primary",
            )}
        >
            <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-3.5">
                    <Avatar
                        src={student.image}
                        name={student.name}
                        size={48}
                        className={cn("shrink-0", blocked && "grayscale")}
                    />
                    <div className="min-w-0 flex-1">
                        <Link
                            href={href}
                            data-card-link
                            title={student.name}
                            className="block truncate font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
                        >
                            {student.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{student.studentId ?? "No ID yet"}</span>
                            {" · "}joined {formatDate(student.createdAt)}
                        </p>
                        {(blocked || !student.emailVerified) && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {blocked && <Badge variant="destructive">Blocked</Badge>}
                                {!student.emailVerified && <Badge variant="warning">Email unverified</Badge>}
                            </div>
                        )}
                    </div>
                    <label
                        className={cn(
                            "relative z-10 -m-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md transition-colors hover:bg-secondary",
                            "has-focus-visible:ring-2 has-focus-visible:ring-ring",
                        )}
                    >
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => onSelectedChange(event.target.checked)}
                            aria-label={`Select ${student.name}`}
                            className="peer sr-only"
                        />
                        <span
                            aria-hidden
                            className={cn(
                                "grid size-4.5 place-items-center rounded-[5px] border transition-colors",
                                selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                            )}
                        >
                            {selected && <Check className="size-3" strokeWidth={3} />}
                        </span>
                    </label>
                </div>

                <dl className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex min-w-0 items-center gap-2">
                        <dt className="sr-only">Email</dt>
                        <Mail className="size-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{student.email}</dd>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <dt className="sr-only">Phone</dt>
                        <Phone className="size-3.5 shrink-0" aria-hidden />
                        <dd className={cn("truncate", !student.phone && "text-muted-foreground/60")}>
                            {student.phone ?? "No phone"}
                        </dd>
                    </div>
                </dl>

                <section className="flex-1 border-t border-border pt-4" aria-label="Courses">
                    <p className="mb-2.5 flex items-center justify-between text-[11px] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                        Learning
                        {courses.length > 0 && (
                            <span className="font-medium normal-case tracking-normal">
                                {courses.length} {courses.length === 1 ? "course" : "courses"}
                            </span>
                        )}
                    </p>
                    {courses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Not on a course yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {courses.slice(0, SHOWN_COURSES).map((enrollment) => {
                                const done = enrollment.status === "COMPLETED";
                                return (
                                    <li key={enrollment.id} className="space-y-1.5">
                                        <div className="flex items-baseline justify-between gap-3 text-sm">
                                            <span className="min-w-0 truncate" title={enrollment.course.title}>
                                                {enrollment.course.title}
                                            </span>
                                            <span
                                                className={cn(
                                                    "shrink-0 text-xs font-semibold tabular-nums",
                                                    done && "text-success",
                                                )}
                                            >
                                                {done ? "Completed" : `${enrollment.progress}%`}
                                            </span>
                                        </div>
                                        <Progress value={enrollment.progress} className="h-1.5" barClassName="bg-brand" />
                                    </li>
                                );
                            })}
                            {courses.length > SHOWN_COURSES && (
                                <li className="text-xs text-muted-foreground">
                                    +{courses.length - SHOWN_COURSES} more
                                </li>
                            )}
                        </ul>
                    )}
                </section>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-border border-y border-border">
                <Stat label="XP" value={(student.totalXp ?? 0).toLocaleString()} />
                <Stat label={certificates === 1 ? "Certificate" : "Certificates"} value={certificates} />
                <Stat
                    label="Last active"
                    value={student.lastActiveAt ? shortAgo(student.lastActiveAt) : "Never"}
                    muted={!student.lastActiveAt}
                />
            </dl>

            <div className="flex items-center justify-between gap-2 px-5 py-2.5">
                <span
                    aria-hidden
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary"
                >
                    Open profile
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
                <div className="relative z-10">{menu}</div>
            </div>
        </Card>
    );
}

function Stat({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) {
    return (
        <div className="flex min-w-0 flex-col-reverse px-3 py-2.5 text-center">
            {/* Label first for screen readers; the value reads first on screen. */}
            <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
            <dd className={cn("truncate text-sm font-semibold tabular-nums", muted && "text-muted-foreground")}>{value}</dd>
        </div>
    );
}

/** A card-shaped placeholder while the register loads. */
export function StudentCardSkeleton() {
    return (
        <Card className="flex flex-col shadow-card">
            <div className="space-y-4 p-5">
                <div className="flex items-center gap-3.5">
                    <Skeleton className="size-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/2" />
                </div>
                <div className="space-y-2 border-t border-border pt-4">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-1.5 w-full" />
                </div>
            </div>
            <Skeleton className="h-14 rounded-none" />
            <div className="px-5 py-3">
                <Skeleton className="h-5 w-28" />
            </div>
        </Card>
    );
}
