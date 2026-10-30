"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Eye, EyeOff, Globe, History, Layers, Lock, Pencil, Plus, Tag, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import CoursePriceDialog from "@/components/admin/CoursePriceDialog";
import CreateCourseModal from "@/components/admin/CreateCourseModal";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import RowActions from "@/components/admin/RowActions";
import { StatusPill } from "@/components/admin/StatusPill";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { CourseClassBadges } from "@/components/shared/CourseClassification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { SafeImage } from "@/components/ui/safe-image";
import { confirmAction } from "@/lib/confirm";
import { COURSE_PHASES, COURSE_PRICINGS, hasCurriculumTools, PHASE_META, PRICING_META } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminCourse } from "@/types/admin.types";

const FILTERS = [
    { value: "", label: "All" },
    { value: "PUBLISHED", label: "Published" },
    { value: "DRAFT", label: "Drafts" },
    { value: "ARCHIVED", label: "Archived" },
];

const COURSE_TYPE_LABEL: Record<string, string> = {
    BOOTCAMP: "Bootcamp",
    TRADITIONAL: "Traditional",
};

const PAGE_SIZE = 16;

export default function AdminCoursesPage() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("");
    const [phase, setPhase] = useState("");
    const [pricing, setPricing] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [view, setView] = useState<ViewMode>("grid");
    const [creating, setCreating] = useState(false);
    // The course whose price is being changed, straight from the list.
    const [pricingCourse, setPricingCourse] = useState<AdminCourse | null>(null);

    // `?new=1` opens the create popup — the dashboard's "New course" lands here.
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("new") === "1") setCreating(true);
    }, []);

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "courses", { status, phase, pricing, searchTerm, page }],
        queryFn: () =>
            adminService.courses({
                status: status || undefined,
                phase: phase || undefined,
                pricing: pricing || undefined,
                searchTerm: searchTerm || undefined,
                page,
                limit: PAGE_SIZE,
            }),
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin"] });
        void refreshCoursePages();
    };

    const setStatusMutation = useMutation({
        mutationFn: ({ courseId, next }: { courseId: string; next: string }) =>
            adminService.setCourseStatus(courseId, next),
        onSuccess: (_result, { next }) => {
            toast.success(
                next === "PUBLISHED"
                    ? "Course published — it's live in the catalogue."
                    : "Course archived. Enrolled students keep their access.",
            );
            refresh();
        },
        // The API refuses to publish a course with no milestones and says so.
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change the status.")),
    });

    const moveToPrevious = useMutation({
        mutationFn: (courseId: string) => adminService.updateCourse(courseId, { phase: "PREVIOUS" }),
        onSuccess: () => {
            toast.success("Moved to previous (recorded). Its upcoming support sessions were cancelled.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't move that course.")),
    });

    const remove = useMutation({
        mutationFn: (courseId: string) => adminService.deleteCourse(courseId),
        onSuccess: () => {
            toast.success("Course deleted.");
            refresh();
        },
        // The API refuses to delete a course with active students and names
        // the count — pass its message through.
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that course.")),
    });

    const courses = data?.data ?? [];
    const filtered = Boolean(status || phase || pricing || searchTerm);

    const columns: Column<AdminCourse>[] = [
        {
            id: "course",
            header: "Course",
            primary: true,
            sortable: true,
            sortValue: (course) => course.title,
            cell: (course) => (
                <div className="min-w-0">
                    <Link href={`/admin/courses/${course.id}`} className="font-medium hover:underline">
                        {course.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {course.category?.title ?? "No category"}
                        {course.isFeatured && " · Featured"}
                        {course.isPopular && " · Popular"}
                    </p>
                </div>
            ),
        },
        {
            id: "price",
            header: "Price",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (course) => course.discountPrice ?? course.price,
            cell: (course) => <CoursePrice course={course} onEdit={() => setPricingCourse(course)} />,
        },
        {
            id: "students",
            header: "Students",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (course) => course._count.enrollments,
            cell: (course) => course._count.enrollments,
        },
        {
            id: "content",
            header: "Content",
            className: "whitespace-nowrap",
            cell: (course) => <span className="text-muted-foreground">{courseContent(course)}</span>,
        },
        {
            id: "classification",
            header: "Course status",
            cell: (course) => <CourseClassBadges phase={course.phase} delivery={course.delivery} mode={course.mode} />,
        },
        {
            id: "type",
            header: "Type",
            cell: (course) => (
                <span className="flex flex-wrap gap-1.5">
                    <CourseTypeBadge course={course} />
                    <HiddenBadge course={course} />
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: (course) => <StatusPill kind="course" value={course.status} />,
        },
    ];

    // Shared by the card's buttons and the table's ⋯ menu, so both confirm the same way.
    const publish = (course: AdminCourse) => setStatusMutation.mutate({ courseId: course.id, next: "PUBLISHED" });

    const archive = async (course: AdminCourse) => {
        if (
            await confirmAction({
                title: `Take "${course.title}" off the catalogue?`,
                text: "Enrolled students keep their access. New students can't find or buy it until it's published again.",
                confirmText: "Archive course",
            })
        ) {
            setStatusMutation.mutate({ courseId: course.id, next: "ARCHIVED" });
        }
    };

    /** Any course can be moved to previous at any time; the editor moves it anywhere else. */
    const confirmMoveToPrevious = async (course: AdminCourse) => {
        if (
            await confirmAction({
                title: `Move "${course.title}" to previous (recorded)?`,
                text: "Its upcoming and running support sessions are cancelled (enrolled students are told), and no new ones can be held. Its batch dates and support note are cleared. Modules, lessons and students' access stay as they are.",
                confirmText: "Move to previous",
            })
        ) {
            moveToPrevious.mutate(course.id);
        }
    };

    const confirmDelete = async (course: AdminCourse) => {
        if (
            await confirmAction({
                title: `Delete "${course.title}"?`,
                text: "It disappears from the catalogue, but past orders and certificates are kept.",
                confirmText: "Delete course",
            })
        ) {
            remove.mutate(course.id);
        }
    };

    /** The table view's row menu. The card shows all of this as buttons instead. */
    const actions = (course: AdminCourse) => {
        const isPublished = course.status === "PUBLISHED";

        return (
            <RowActions
                primary={
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/courses/${course.id}`}>
                            <Pencil /> Edit
                        </Link>
                    </Button>
                }
                items={[
                    { label: "Change price", icon: Tag, onSelect: () => setPricingCourse(course) },
                    // Upcoming courses have neither yet.
                    { label: "Outline Maker", icon: CalendarDays, href: `/admin/courses/${course.id}/outline`, hidden: !hasCurriculumTools(course.phase) },
                    { label: "Module Manager", icon: Layers, href: `/admin/courses/${course.id}/modules`, hidden: !hasCurriculumTools(course.phase) },
                    { label: "Students", icon: Users, href: `/admin/courses/${course.id}/students` },
                    {
                        label: "Move to previous",
                        icon: History,
                        hidden: course.phase === "PREVIOUS",
                        onSelect: () => confirmMoveToPrevious(course),
                    },
                    {
                        label: "View live page",
                        icon: Globe,
                        href: `/courses/${course.slug}`,
                        external: true,
                        hidden: !isPublished,
                    },
                    isPublished
                        ? { label: "Archive", icon: EyeOff, separatorBefore: true, onSelect: () => archive(course) }
                        : { label: "Publish", icon: Eye, separatorBefore: true, onSelect: () => publish(course) },
                    { label: "Delete", icon: Trash2, destructive: true, onSelect: () => confirmDelete(course) },
                ]}
            />
        );
    };

    const newCourseButton = (
        <Button onClick={() => setCreating(true)}>
            <Plus /> New course
        </Button>
    );

    return (
        <>
            <DataShell
                title="Courses"
                description="Create a draft, build its curriculum, then publish."
                action={
                    <div className="flex items-center gap-2">
                        <ViewToggle value={view} onChange={setView} />
                        {newCourseButton}
                    </div>
                }
                searchPlaceholder="Search courses…"
                onSearch={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
                filters={FILTERS}
                activeFilter={status}
                onFilter={(value) => {
                    setStatus(value);
                    setPage(1);
                }}
                isLoading={isLoading}
                isEmpty={courses.length === 0}
                emptyMessage={filtered ? "No courses match." : "No courses yet."}
                emptyHint={
                    filtered
                        ? "Try a different search or filter."
                        : "Start with a title, a price, a short description and its curriculum PDF — everything else comes after."
                }
                emptyAction={filtered ? undefined : newCourseButton}
                controls={
                    <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                        <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                            <Select
                                value={phase}
                                onChange={(event) => {
                                    setPhase(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Course status"
                            >
                                <option value="">Any course status</option>
                                {COURSE_PHASES.map((value) => (
                                    <option key={value} value={value}>
                                        {PHASE_META[value].admin}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                            <Select
                                value={pricing}
                                onChange={(event) => {
                                    setPricing(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Free or paid"
                            >
                                <option value="">Free &amp; paid</option>
                                {COURSE_PRICINGS.map((value) => (
                                    <option key={value} value={value}>
                                        {PRICING_META[value].label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                }
                meta={data?.meta}
                onPage={setPage}
            >
                {view === "grid" ? (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {courses.map((course) => (
                            <li key={course.id}>
                                <Card className="flex h-full flex-col overflow-hidden shadow-card">
                                    {/* The title below is the accessible link; this one is a
                                        bigger click target for the same place. */}
                                    <Link
                                        href={`/admin/courses/${course.id}`}
                                        tabIndex={-1}
                                        aria-hidden
                                        className="relative block aspect-video overflow-hidden bg-secondary"
                                    >
                                        <SafeImage
                                            src={course.thumbnail}
                                            alt=""
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, (max-width: 1536px) 33vw, 25vw"
                                            className="object-cover"
                                            fallback={<BookOpen className="size-8 text-muted-foreground" />}
                                        />
                                        {(course.isFeatured || course.isPopular) && (
                                            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                                                {course.isFeatured && <Badge variant="warning">Featured</Badge>}
                                                {course.isPopular && <Badge variant="default">Popular</Badge>}
                                            </div>
                                        )}
                                    </Link>

                                    <CardContent className="flex flex-1 flex-col gap-3 p-5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <StatusPill kind="course" value={course.status} />
                                            <CourseTypeBadge course={course} />
                                            <HiddenBadge course={course} />
                                            <span className="ml-auto">
                                                <CoursePrice course={course} onEdit={() => setPricingCourse(course)} />
                                            </span>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/admin/courses/${course.id}`}
                                                className="line-clamp-2 font-medium hover:underline"
                                            >
                                                {course.title}
                                            </Link>
                                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                {course.category?.title ?? "No category"}
                                            </p>
                                            <CourseClassBadges phase={course.phase} delivery={course.delivery} mode={course.mode} className="mt-2" />
                                        </div>

                                        <div className="space-y-1 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-1.5">
                                                <Users className="size-3.5" aria-hidden />
                                                {course._count.enrollments}{" "}
                                                {course._count.enrollments === 1 ? "student" : "students"}
                                            </p>
                                            <p className="flex items-center gap-1.5">
                                                <Layers className="size-3.5" aria-hidden />
                                                {courseContent(course)}
                                            </p>
                                        </div>

                                        {/* Everything an admin opens a course for, one click
                                            from the card rather than behind the ⋯ menu. */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {hasCurriculumTools(course.phase) ? (
                                                <>
                                                    <Button asChild size="sm" variant="secondary">
                                                        <Link href={`/admin/courses/${course.id}/outline`}>
                                                            <CalendarDays /> Outline
                                                        </Link>
                                                    </Button>
                                                    <Button asChild size="sm" variant="secondary">
                                                        <Link href={`/admin/courses/${course.id}/modules`}>
                                                            <Layers /> Modules
                                                        </Link>
                                                    </Button>
                                                </>
                                            ) : (
                                                // Upcoming: no outline or modules until it's moved to present.
                                                <>
                                                    <Button size="sm" variant="secondary" disabled title="Opens once the course is moved to Present">
                                                        <Lock /> Outline
                                                    </Button>
                                                    <Button size="sm" variant="secondary" disabled title="Opens once the course is moved to Present">
                                                        <Lock /> Modules
                                                    </Button>
                                                </>
                                            )}
                                            <Button asChild size="sm" variant="secondary">
                                                <Link href={`/admin/courses/${course.id}`}>
                                                    <Pencil /> Edit
                                                </Link>
                                            </Button>
                                            <Button asChild size="sm" variant="secondary">
                                                <Link href={`/admin/courses/${course.id}/students`}>
                                                    <Users /> Students
                                                </Link>
                                            </Button>
                                        </div>

                                        {/* Status and delete out on the card too, like the
                                            buttons above — no ⋯ menu to open. Delete keeps to
                                            the left, away from the rest. */}
                                        <div className="flex items-center gap-2 border-t border-border pt-4">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                isLoading={remove.isPending && remove.variables === course.id}
                                                onClick={() => confirmDelete(course)}
                                            >
                                                <Trash2 /> Delete
                                            </Button>
                                            {course.phase !== "PREVIOUS" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="px-2.5"
                                                    title="Move to previous (recorded)"
                                                    aria-label={`Move ${course.title} to previous (recorded)`}
                                                    isLoading={moveToPrevious.isPending && moveToPrevious.variables === course.id}
                                                    onClick={() => confirmMoveToPrevious(course)}
                                                >
                                                    <History />
                                                </Button>
                                            )}
                                            {course.status === "PUBLISHED" && (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    variant="ghost"
                                                    className="px-2.5"
                                                    title="View live page"
                                                >
                                                    <Link
                                                        href={`/courses/${course.slug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`View the live page of ${course.title}`}
                                                    >
                                                        <Globe />
                                                    </Link>
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                isLoading={
                                                    setStatusMutation.isPending &&
                                                    setStatusMutation.variables?.courseId === course.id
                                                }
                                                onClick={() =>
                                                    course.status === "PUBLISHED" ? archive(course) : publish(course)
                                                }
                                            >
                                                {course.status === "PUBLISHED" ? (
                                                    <>
                                                        <EyeOff /> Archive
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye /> Publish
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <DataTable rows={courses} columns={columns} rowKey={(course) => course.id} actions={actions} />
                )}
            </DataShell>

            <CreateCourseModal open={creating} onOpenChange={setCreating} />
            <CoursePriceDialog
                course={pricingCourse}
                onOpenChange={(open) => !open && setPricingCourse(null)}
                onSaved={() => {
                    setPricingCourse(null);
                    refresh();
                }}
            />
        </>
    );
}

const courseContent = (course: AdminCourse) =>
    `${course._count.milestones} milestones · ${course._count.videos} lessons`;

/** The price as students see it — a button that changes it (free or paid, the price, its discount). */
function CoursePrice({ course, onEdit }: { course: AdminCourse; onEdit: () => void }) {
    const label =
        course.pricing === null ? (
            <span className="text-amber-700 dark:text-amber-400">Price not set</span>
        ) : course.pricing === "FREE" || course.price === 0 ? (
            <span className="font-medium text-success">Free</span>
        ) : course.discountPrice !== null ? (
            <>
                <span className="font-medium">{formatBDT(course.discountPrice)}</span>{" "}
                <s className="text-xs text-muted-foreground">{formatBDT(course.price)}</s>
            </>
        ) : (
            <span className="font-medium">{formatBDT(course.price)}</span>
        );

    return (
        <button
            type="button"
            onClick={onEdit}
            title="Change the price"
            aria-label={`Change the price of ${course.title}`}
            className="group/price -mx-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-sm transition-colors hover:bg-secondary"
        >
            {label}
            <Pencil className="size-3 text-muted-foreground opacity-60 transition-opacity group-hover/price:opacity-100" aria-hidden />
        </button>
    );
}

function CourseTypeBadge({ course }: { course: AdminCourse }) {
    return (
        <Badge variant={course.courseType === "BOOTCAMP" ? "default" : "secondary"}>
            {COURSE_TYPE_LABEL[course.courseType] ?? course.courseType}
        </Badge>
    );
}

/** A finished bootcamp batch taken out of discovery — set on the course's Pricing page. */
function HiddenBadge({ course }: { course: AdminCourse }) {
    const places = [course.hiddenFromHomepage && "homepage", course.hiddenFromCatalogue && "/courses"].filter(Boolean);
    if (course.courseType !== "BOOTCAMP" || places.length === 0) return null;
    return (
        <Badge variant="outline" title="Enrolled students keep their access">
            <EyeOff className="size-3" /> Hidden from {places.join(" & ")}
        </Badge>
    );
}
