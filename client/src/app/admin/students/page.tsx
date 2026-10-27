"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Ban, CheckCircle2, Eye, KeyRound, RotateCw, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import BulkActionBar from "@/components/admin/BulkActionBar";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import EnrollStudentModal from "@/components/admin/EnrollStudentModal";
import { type PickerOption, studentOption } from "@/components/admin/pickers";
import RowActions from "@/components/admin/RowActions";
import { StatusPill } from "@/components/admin/StatusPill";
import StudentCard, { StudentCardSkeleton } from "@/components/admin/StudentCard";
import { useStudentActions } from "@/components/admin/useStudentActions";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminUser } from "@/types/admin.types";

const SORTS = [
    { value: "newest", label: "Newest first", sortBy: "learningProfile.createdAt", sortOrder: "desc" },
    { value: "oldest", label: "Oldest first", sortBy: "learningProfile.createdAt", sortOrder: "asc" },
    { value: "name", label: "Name, A–Z", sortBy: "name", sortOrder: "asc" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

const PAGE_SIZE = 24;

/** This browser's last chosen layout — a per-admin convenience, so it lives in localStorage. */
const VIEW_KEY = "halfcoders.admin.students.view";

const isView = (value: unknown): value is ViewMode => value === "grid" || value === "list";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const detailHref = (student: Pick<AdminUser, "id">) => `/admin/students/${student.id}`;

/** Average progress across the courses they're on, or null with none. */
const averageProgress = (student: AdminUser) => {
    const courses = student.enrollments ?? [];
    if (courses.length === 0) return null;
    return Math.round(courses.reduce((sum, enrollment) => sum + enrollment.progress, 0) / courses.length);
};

export default function AdminStudentsPage() {
    return (
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <StudentsScreen />
        </Suspense>
    );
}

/**
 * The student register. Search, filters, sort, page and layout all live in
 * the URL, so opening a student and coming back lands on the same list —
 * and a filtered list can be shared as a link.
 */
function StudentsScreen() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const filter = searchParams.get("status") ?? "";
    const courseId = searchParams.get("course") ?? "";
    const sort: SortValue = SORTS.find((option) => option.value === searchParams.get("sort"))?.value ?? "newest";
    const searchTerm = searchParams.get("q") ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    // The URL's layout wins; otherwise the one this admin last picked here.
    const [storedView, setStoredView] = useState<ViewMode | null>(null);
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(VIEW_KEY);
            if (isView(saved)) setStoredView(saved);
        } catch {
            // Storage blocked — the default layout is fine.
        }
    }, []);
    const urlView = searchParams.get("view");
    const view: ViewMode = isView(urlView) ? urlView : storedView ?? "grid";

    // "Clear filters" remounts the toolbar with an empty search box. The URL
    // updates a beat later, so the box is seeded from here rather than from it.
    const [resetKey, setResetKey] = useState(0);
    const [searchSeed, setSearchSeed] = useState<string | null>(null);

    // `undefined` closed; `null` open with no student picked yet.
    const [enrolling, setEnrolling] = useState<PickerOption | null | undefined>(undefined);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const studentActions = useStudentActions();

    const sortBy = SORTS.find((option) => option.value === sort) ?? SORTS[0];

    const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
        queryKey: ["admin", "students", { filter, courseId, sort, searchTerm, page }],
        queryFn: () =>
            adminService.students({
                // "Unverified" is a different column from the status filter.
                ...(filter === "UNVERIFIED" ? { emailVerified: false } : { status: filter || undefined }),
                courseId: courseId || undefined,
                searchTerm: searchTerm || undefined,
                sortBy: sortBy.sortBy,
                sortOrder: sortBy.sortOrder,
                page,
                limit: PAGE_SIZE,
            }),
    });

    const { data: counts } = useQuery({
        queryKey: ["admin", "students", "counts"],
        queryFn: adminService.studentCounts,
    });

    const { data: courseList } = useQuery({
        queryKey: ["admin", "courses", "filter-options"],
        queryFn: () => adminService.courses({ limit: 100, sortBy: "title", sortOrder: "asc" }),
        staleTime: 5 * 60_000,
    });

    // Loops the same single-item endpoint rather than a dedicated bulk
    // route — nothing on the API batches this, and thirty sequential status
    // writes in parallel is cheap enough not to need one.
    const bulkStatus = useMutation({
        mutationFn: async ({ ids, next }: { ids: string[]; next: string }) => {
            const results = await Promise.allSettled(
                ids.map((id) => adminService.setUserStatus(id, next)),
            );
            return { total: ids.length, failed: results.filter((r) => r.status === "rejected").length };
        },
        onSuccess: ({ total, failed }, { next }) => {
            const succeeded = total - failed;
            const verb = next === "BLOCKED" ? "blocked" : "reactivated";
            if (failed === 0) {
                toast.success(`${plural(succeeded, "student")} ${verb}.`);
            } else {
                toast.error(`${succeeded} of ${total} ${verb} — ${failed} failed.`);
            }
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
        },
        onError: () => toast.error("Couldn't update those accounts."),
    });

    const students = data?.data ?? [];
    const filtered = Boolean(filter || searchTerm || courseId);
    const clearSelection = () => setSelected(new Set());

    /** Writes the given params (empty removes one) and, unless the page itself changed, goes back to page 1. */
    const setParams = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
        }
        if (!("page" in changes) && !("view" in changes)) next.delete("page");
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        if (!("view" in changes)) clearSelection();
    };

    const changeView = (next: ViewMode) => {
        try {
            window.localStorage.setItem(VIEW_KEY, next);
        } catch {
            // Storage blocked — the URL still carries it.
        }
        setStoredView(next);
        setParams({ view: next });
    };

    const clearFilters = () => {
        setParams({ status: null, course: null, q: null });
        setSearchSeed("");
        setResetKey((key) => key + 1);
    };

    const filters = [
        { value: "", label: "All", count: counts?.all },
        { value: "ACTIVE", label: "Active", count: counts?.active },
        { value: "BLOCKED", label: "Blocked", count: counts?.blocked },
        { value: "UNVERIFIED", label: "Unverified", count: counts?.unverified },
    ];

    const menuItems = (student: AdminUser) => {
        const isActive = student.status === "ACTIVE";
        return [
            {
                label: "Enrol in a course",
                icon: UserPlus,
                hidden: !isActive,
                onSelect: () => setEnrolling(studentOption(student)),
            },
            {
                label: "Reset password",
                icon: KeyRound,
                onSelect: () => void studentActions.resetPassword(student),
            },
            isActive
                ? {
                    label: "Block",
                    icon: Ban,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => void studentActions.block(student),
                }
                : {
                    label: "Reactivate",
                    icon: CheckCircle2,
                    separatorBefore: true,
                    onSelect: () => studentActions.reactivate(student),
                },
        ];
    };

    const columns: Column<AdminUser>[] = [
        {
            id: "student",
            header: "Student",
            primary: true,
            sortable: true,
            sortValue: (student) => student.name,
            cell: (student) => (
                <div className="flex min-w-0 max-w-56 items-center gap-3 xl:max-w-80">
                    <Avatar src={student.image} name={student.name} size={36} />
                    <div className="min-w-0">
                        <Link href={detailHref(student)} className="block truncate font-medium hover:underline">
                            {student.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground" title={student.email}>
                            {student.studentId && <span className="font-mono">{student.studentId} · </span>}
                            {student.email}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: "phone",
            header: "Phone",
            className: "whitespace-nowrap",
            cell: (student) => student.phone ?? <span className="text-muted-foreground">—</span>,
        },
        {
            id: "courses",
            header: "Courses",
            className: "min-w-36",
            sortable: true,
            sortValue: (student) => averageProgress(student) ?? -1,
            cell: (student) => {
                const courses = student.enrollments ?? [];
                const average = averageProgress(student);
                if (average === null) return <span className="text-muted-foreground">None yet</span>;
                return (
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                            {plural(courses.length, "course")} · <span className="font-medium text-foreground">{average}%</span> avg.
                        </p>
                        <Progress value={average} className="h-1.5 max-w-32" barClassName="bg-brand" />
                    </div>
                );
            },
        },
        {
            id: "xp",
            header: "XP",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (student) => student.totalXp ?? 0,
            cell: (student) => (student.totalXp ?? 0).toLocaleString(),
        },
        {
            id: "active",
            header: "Activity",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (student) => (student.lastActiveAt ? new Date(student.lastActiveAt) : new Date(0)),
            cell: (student) => (
                <div>
                    <p className={cn(!student.lastActiveAt && "text-muted-foreground")}>
                        {student.lastActiveAt
                            ? formatDistanceToNowStrict(new Date(student.lastActiveAt), { addSuffix: true })
                            : "No activity yet"}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(student.createdAt)}</p>
                </div>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: (student) => (
                <div className="flex flex-col items-start gap-1">
                    <StatusPill kind="user" value={student.status} />
                    {!student.emailVerified && <Badge variant="warning">Unverified</Badge>}
                </div>
            ),
        },
    ];

    return (
        <>
            <DataShell
                key={resetKey}
                exportCsv={{
                    path: "/users/students/export",
                    params: {
                        ...(filter === "UNVERIFIED" ? { emailVerified: false } : { status: filter || undefined }),
                        courseId: courseId || undefined,
                        searchTerm: searchTerm || undefined,
                        sortBy: sortBy.sortBy,
                        sortOrder: sortBy.sortOrder,
                    },
                }}
                title="Students"
                action={
                    <div className="flex items-center gap-2">
                        <ViewToggle value={view} onChange={changeView} />
                        <Button onClick={() => setEnrolling(null)}>
                            <UserPlus /> Enrol a student
                        </Button>
                    </div>
                }
                searchPlaceholder="Search by name, email, phone or student ID…"
                defaultSearch={searchSeed ?? searchTerm}
                onSearch={(term) => {
                    if (term !== searchTerm) setParams({ q: term });
                }}
                filters={filters}
                activeFilter={filter}
                onFilter={(value) => setParams({ status: value })}
                controls={
                    <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                        <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                            <Select
                                value={courseId}
                                onChange={(event) => setParams({ course: event.target.value })}
                                aria-label="Course"
                            >
                                <option value="">All courses</option>
                                {(courseList?.data ?? []).map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                            <Select
                                value={sort}
                                onChange={(event) =>
                                    setParams({ sort: event.target.value === "newest" ? null : event.target.value })
                                }
                                aria-label="Sort"
                            >
                                {SORTS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        {filtered && (
                            <Button variant="ghost" onClick={clearFilters}>
                                <X /> Clear filters
                            </Button>
                        )}
                    </div>
                }
                isLoading={isLoading}
                skeleton={
                    view === "grid" ? (
                        <ul className={GRID}>
                            {Array.from({ length: 8 }).map((_, index) => (
                                <li key={index}>
                                    <StudentCardSkeleton />
                                </li>
                            ))}
                        </ul>
                    ) : undefined
                }
                isEmpty={students.length === 0}
                emptyMessage={isError ? "Couldn't load the students." : filtered ? "No students match." : "No students yet."}
                emptyHint={
                    isError
                        ? getApiErrorMessage(error, "Check your connection and try again.")
                        : filtered
                            ? "Try a different search, filter or course."
                            : "Students appear here once they register."
                }
                emptyAction={
                    isError ? (
                        <Button variant="outline" isLoading={isRefetching} onClick={() => void refetch()}>
                            <RotateCw /> Try again
                        </Button>
                    ) : filtered ? (
                        <Button variant="brand-outline" onClick={clearFilters}>
                            <X /> Clear filters
                        </Button>
                    ) : undefined
                }
                meta={data?.meta}
                onPage={(next) => {
                    setParams({ page: next > 1 ? String(next) : null });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }}
            >
                {view === "grid" ? (
                    <ul className={GRID}>
                        {students.map((student) => (
                            <li key={student.id}>
                                <StudentCard
                                    student={student}
                                    href={detailHref(student)}
                                    selected={selected.has(student.id)}
                                    onSelectedChange={(checked) => {
                                        const next = new Set(selected);
                                        if (checked) next.add(student.id);
                                        else next.delete(student.id);
                                        setSelected(next);
                                    }}
                                    menu={<RowActions items={menuItems(student)} label={`More for ${student.name}`} />}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <DataTable
                        rows={students}
                        columns={columns}
                        rowKey={(student) => student.id}
                        actions={(student) => (
                            <RowActions
                                primary={
                                    <Button asChild size="sm" variant="outline" className="w-9 px-0" title="Details">
                                        <Link href={detailHref(student)} aria-label={`Details for ${student.name}`}>
                                            <Eye />
                                        </Link>
                                    </Button>
                                }
                                items={menuItems(student)}
                            />
                        )}
                        rowClassName={(student) => (student.status !== "ACTIVE" ? "bg-secondary/30" : undefined)}
                        selectable
                        selectedIds={selected}
                        onSelectionChange={setSelected}
                    />
                )}
            </DataShell>

            <BulkActionBar
                count={selected.size}
                onClear={clearSelection}
                selectAll={
                    view === "grid"
                        ? { total: students.length, onSelect: () => setSelected(new Set(students.map(({ id }) => id))) }
                        : undefined
                }
                actions={[
                    {
                        label: "Reactivate",
                        icon: CheckCircle2,
                        isLoading: bulkStatus.isPending && bulkStatus.variables?.next === "ACTIVE",
                        onClick: () => bulkStatus.mutate({ ids: [...selected], next: "ACTIVE" }),
                    },
                    {
                        label: "Block",
                        icon: Ban,
                        destructive: true,
                        isLoading: bulkStatus.isPending && bulkStatus.variables?.next === "BLOCKED",
                        onClick: async () => {
                            if (
                                await confirmAction({
                                    title: `Block ${plural(selected.size, "student")}?`,
                                    text: "They won't be able to sign in until reactivated. Their progress is kept.",
                                    confirmText: "Block students",
                                })
                            ) {
                                bulkStatus.mutate({ ids: [...selected], next: "BLOCKED" });
                            }
                        },
                    },
                ]}
            />

            <EnrollStudentModal
                open={enrolling !== undefined}
                onOpenChange={(open) => !open && setEnrolling(undefined)}
                initialStudent={enrolling ?? null}
            />
        </>
    );
}

/** Cards fill the row at whatever width the console leaves them, rather than a fixed column count. */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-4";
