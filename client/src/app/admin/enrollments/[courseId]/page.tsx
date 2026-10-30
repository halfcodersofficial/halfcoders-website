"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Award, BarChart3, ChevronRight, CreditCard, MapPin, RotateCcw, Settings2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { CourseSummaryHeader, since } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import EnrollStudentModal from "@/components/admin/EnrollStudentModal";
import { enrollmentFill, EnrollmentStatusBar, withAccess } from "@/components/admin/enrollments/EnrollmentCourseCard";
import { EnrollmentDetailModal, whereTheyAre } from "@/components/admin/enrollments/EnrollmentDetailModal";
import { useEnrollmentActions } from "@/components/admin/enrollments/useEnrollmentActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminEnrollment, AdminEnrollmentCourse } from "@/types/admin.types";

/** Student · progress · joined · status · action, shared by the header row and every student row. */
const COLUMNS = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_8rem_6.5rem] md:items-center md:gap-5";

const SORTS = [
    { value: "createdAt:desc", label: "Newest first" },
    { value: "progress:desc", label: "Furthest along" },
    { value: "progress:asc", label: "Furthest behind" },
];

function CourseHeader({ summary, onEnrol }: { summary: AdminEnrollmentCourse; onEnrol: () => void }) {
    const { course, counts } = summary;
    const students = withAccess(summary);

    return (
        <CourseSummaryHeader
            course={course}
            action={
                !course.isDeleted &&
                course.status === "PUBLISHED" && (
                    <Button size="sm" onClick={onEnrol}>
                        <UserPlus /> Enrol a student
                    </Button>
                )
            }
            details={
                <>
                    {summary.lastEnrolledAt && <span>{since("Last enrolled", summary.lastEnrolledAt, "")}</span>}
                    <Link href={`/admin/orders/${course.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        <CreditCard className="size-3.5" /> Payments
                    </Link>
                    {!course.isDeleted && (
                        <>
                            <Link
                                href={`/admin/courses/${course.id}/students`}
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                                <BarChart3 className="size-3.5" /> Lesson progress
                            </Link>
                            <Link href={`/admin/courses/${course.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                                <Settings2 className="size-3.5" /> Course settings
                            </Link>
                        </>
                    )}
                </>
            }
            stats={[
                { label: "Learning now", value: String(counts.ACTIVE), hint: `${summary.manual} enrolled by hand` },
                {
                    label: "Completed",
                    value: String(counts.COMPLETED),
                    hint: `${summary.certificates} ${summary.certificates === 1 ? "certificate" : "certificates"} issued`,
                },
                { label: "Average progress", value: `${summary.averageProgress}%`, hint: `Across ${students} with access` },
                {
                    label: "Access removed",
                    value: String(counts.CANCELLED + counts.EXPIRED),
                    hint: counts.EXPIRED > 0 ? `${counts.EXPIRED} expired` : "Can be restored",
                },
            ]}
            bar={<EnrollmentStatusBar counts={counts} />}
        />
    );
}

/** One student on the course. The row opens the detail; access removed can be restored straight from here. */
function StudentRow({
    enrollment,
    onOpen,
    onRestore,
    isRestoring,
}: {
    enrollment: AdminEnrollment;
    onOpen: () => void;
    onRestore: () => void;
    isRestoring: boolean;
}) {
    const position = whereTheyAre(enrollment);
    const cancelled = enrollment.status === "CANCELLED";
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`${enrollment.student.name}, ${enrollment.progress}%`}
            onClick={onOpen}
            onKeyDown={onKeyDown}
            className={cn(
                "group relative flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3.5 transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-5",
                COLUMNS,
            )}
        >
            <span aria-hidden className={cn("absolute inset-y-2 left-0 w-0.5 rounded-r-full", enrollmentFill(enrollment.status))} />

            <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                <Avatar src={enrollment.student.image} name={enrollment.student.name} size={38} />
                <div className="min-w-0">
                    <p className="truncate font-semibold">{enrollment.student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{enrollment.student.phone ?? enrollment.student.email}</p>
                </div>
            </div>

            <span className="md:hidden">
                <StatusPill kind="enrollment" value={enrollment.status} />
            </span>

            <div className={cn("w-full min-w-0 md:w-auto", cancelled && "opacity-60")}>
                <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${enrollment.progress}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">{enrollment.progress}%</span>
                </div>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{position ?? "Not started yet"}</span>
                </p>
            </div>

            <div className="min-w-0 max-md:w-full">
                <p className="truncate text-sm">
                    {formatDate(enrollment.startedAt)}
                    <span className="text-xs text-muted-foreground">
                        {" "}
                        · {formatDistanceToNowStrict(new Date(enrollment.startedAt), { addSuffix: true })}
                    </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {enrollment.order ? (
                        <>
                            Paid · <span className="font-mono">{enrollment.order.orderNumber}</span>
                        </>
                    ) : (
                        "Enrolled by hand"
                    )}
                </p>
            </div>

            <div className="hidden min-w-0 md:block">
                <StatusPill kind="enrollment" value={enrollment.status} />
                {enrollment.certificate?.status === "ISSUED" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <Award className="size-3" /> Certified
                    </p>
                )}
            </div>

            <div className="hidden items-center justify-end md:flex">
                {cancelled ? (
                    <Button
                        size="sm"
                        variant="outline"
                        isLoading={isRestoring}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRestore();
                        }}
                    >
                        <RotateCcw /> Restore
                    </Button>
                ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                        Details <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                )}
            </div>
        </div>
    );
}

export default function AdminCourseEnrollmentsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    const [status, setStatus] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [sort, setSort] = useState(SORTS[0].value);
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState<string | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    const actions = useEnrollmentActions();

    const summaryQuery = useQuery({
        queryKey: ["admin", "enrollment-courses", courseId],
        queryFn: () => adminService.enrollmentCourse(courseId),
    });

    const [sortBy, sortOrder] = sort.split(":");
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "enrollments", { courseId, status, searchTerm, sort, page }],
        queryFn: () =>
            adminService.enrollments({
                courseId,
                status: status || undefined,
                searchTerm: searchTerm || undefined,
                sortBy,
                sortOrder,
                page,
                limit: 20,
            }),
    });

    const enrollments = data?.data ?? [];
    const openEnrollment = openId ? (enrollments.find((enrollment) => enrollment.id === openId) ?? null) : null;
    const summary = summaryQuery.data;
    const counts = summary?.counts;

    if (summaryQuery.isError) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/enrollments" label="All courses" />
                <div className="rounded-card border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <DataShell
                exportCsv={{
                    path: "/enrollments/manage/export",
                    params: { courseId, status: status || undefined, searchTerm: searchTerm || undefined, sortBy, sortOrder },
                }}
                header={
                    <div className="space-y-4">
                        <BackButton href="/admin/enrollments" label="All courses" />
                        {summary ? (
                            <CourseHeader summary={summary} onEnrol={() => setEnrolling(true)} />
                        ) : (
                            <Skeleton className="h-72 rounded-card" />
                        )}
                    </div>
                }
                searchPlaceholder="Search by student name, email or phone…"
                onSearch={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
                filters={[
                    { value: "", label: "All", count: counts?.total },
                    { value: "ACTIVE", label: "Learning", count: counts?.ACTIVE },
                    { value: "COMPLETED", label: "Completed", count: counts?.COMPLETED },
                    { value: "CANCELLED", label: "Cancelled", count: counts?.CANCELLED },
                    ...(counts?.EXPIRED ? [{ value: "EXPIRED", label: "Expired", count: counts.EXPIRED }] : []),
                ]}
                activeFilter={status}
                onFilter={(value) => {
                    setStatus(value);
                    setPage(1);
                }}
                controls={
                    <Select
                        value={sort}
                        onChange={(event) => {
                            setSort(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Sort students"
                        className="w-auto min-w-40"
                    >
                        {SORTS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Select>
                }
                isLoading={isLoading}
                isEmpty={enrollments.length === 0}
                emptyMessage={
                    searchTerm ? "No students match." : status ? "No students with this status." : "No students on this course yet."
                }
                emptyHint={
                    searchTerm
                        ? "Try a different name, email or phone number."
                        : "Students appear here once their payment is confirmed, or when you enrol them by hand."
                }
                meta={data?.meta}
                onPage={setPage}
            >
                <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    <div
                        className={cn(
                            "hidden border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground",
                            COLUMNS,
                        )}
                    >
                        <span>Student</span>
                        <span>Progress</span>
                        <span>Enrolled</span>
                        <span>Status</span>
                        <span className="sr-only">Action</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {enrollments.map((enrollment) => (
                            <li key={enrollment.id}>
                                <StudentRow
                                    enrollment={enrollment}
                                    onOpen={() => setOpenId(enrollment.id)}
                                    onRestore={() => actions.restore(enrollment)}
                                    isRestoring={actions.isRestoring}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </DataShell>

            <EnrollmentDetailModal enrollment={openEnrollment} onClose={() => setOpenId(null)} />

            <EnrollStudentModal
                open={enrolling}
                onOpenChange={setEnrolling}
                initialCourse={summary ? { id: summary.course.id, label: summary.course.title } : null}
            />
        </>
    );
}
