"use client";

import { useQuery } from "@tanstack/react-query";
import {
    BookOpen,
    CalendarDays,
    Clapperboard,
    ExternalLink,
    FileText,
    Gauge,
    Layers,
    LayoutDashboard,
    Megaphone,
    PenLine,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { PHASE_META } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import { dashboardService } from "@/services";
import { curriculumAuthoring } from "@/services/curriculum";

export const ROLE_LABEL: Record<string, string> = { LEAD: "Lead mentor", CO_MENTOR: "Co-mentor", SUPPORT: "Support mentor" };
export const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", ARCHIVED: "Unpublished" };

interface Tab {
    href: string;
    label: string;
    icon: LucideIcon;
    /** Also active under these paths — a module's lessons belong to Modules. */
    match?: string[];
    exact?: boolean;
    badge?: number;
}

/**
 * Everything a mentor does on one course, under one roof: the course named
 * once at the top, and a tab for each job — the course at a glance, its
 * content, its schedule, the recorded classes, the marks, the public page and
 * the pre-enrolment roadmap. Mounted by `app/mentor/courses/[courseId]/layout`;
 * the shared editors underneath drop their own "back" links in this console.
 */
export default function CourseWorkspace({ courseId, children }: { courseId: string; children: ReactNode }) {
    const pathname = usePathname();
    const routes = staffCourseRoutes("mentor", courseId);

    // The editors read this same query, so it's one request between them.
    const course = useQuery({ queryKey: ["staff", "course", courseId], queryFn: () => curriculumAuthoring.getCourse(courseId) });
    const dashboard = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    const mine = dashboard.data?.courses.find((entry) => entry.id === courseId);

    if (course.isError) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this course</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(course.error, "You may not be assigned to it.")}</p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={routes.courses}>Back to my courses</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const tabs: Tab[] = [
        { href: routes.overview, label: "Overview", icon: LayoutDashboard, exact: true },
        { href: routes.modules, label: "Modules", icon: Layers, match: [`${routes.overview}/assignments`] },
        { href: routes.outline, label: "Outline", icon: CalendarDays },
        { href: routes.conceptual, label: "Conceptual", icon: Clapperboard },
        { href: routes.announcements, label: "Announcements", icon: Megaphone },
        { href: routes.results, label: "Results", icon: Gauge, badge: mine?.stats.toReview },
        { href: routes.coursePage, label: "Course page", icon: PenLine },
        { href: routes.preEnrollment, label: "Pre-enrolment", icon: FileText },
    ];
    const isActive = (tab: Tab) =>
        tab.exact ? pathname === tab.href : [tab.href, ...(tab.match ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));

    const data = course.data;
    const students = data?._count.enrollments ?? mine?.stats.students;

    return (
        <>
            <div className="border-b border-border bg-card/70">
                <div className="container-page pt-5 sm:pt-6">
                    <div className="flex items-center gap-4">
                        <span className="relative hidden aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary ring-1 ring-border sm:grid">
                            {data && (
                                <SafeImage
                                    src={data.thumbnail}
                                    alt=""
                                    fill
                                    sizes="96px"
                                    className="object-cover"
                                    fallback={<BookOpen className="size-5 text-muted-foreground" />}
                                />
                            )}
                        </span>
                        <div className="min-w-0 flex-1">
                            {data ? (
                                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{data.title}</h1>
                            ) : (
                                <Skeleton className="h-7 w-64" />
                            )}
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                {data && (
                                    <>
                                        <span>{data.courseType === "BOOTCAMP" ? "Bootcamp" : "Traditional"}</span>
                                        <span aria-hidden>·</span>
                                        <span title={PHASE_META[data.phase].hint}>{PHASE_META[data.phase].admin}</span>
                                        {mine && (
                                            <>
                                                <span aria-hidden>·</span>
                                                <span>{ROLE_LABEL[mine.role] ?? mine.role}</span>
                                            </>
                                        )}
                                        {typeof students === "number" && (
                                            <>
                                                <span aria-hidden>·</span>
                                                <span>
                                                    <span className="font-semibold tabular-nums text-foreground">{students}</span>{" "}
                                                    {students === 1 ? "student" : "students"} enrolled
                                                </span>
                                            </>
                                        )}
                                        {STATUS_LABEL[data.status] && (
                                            <span className="rounded bg-secondary px-1.5 py-px font-medium text-secondary-foreground">
                                                {STATUS_LABEL[data.status]}
                                            </span>
                                        )}
                                    </>
                                )}
                            </p>
                        </div>
                        {data?.status === "PUBLISHED" && (
                            <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
                                <Link href={`/courses/${data.slug}`} target="_blank">
                                    <span className="max-sm:sr-only">Live page</span> <ExternalLink />
                                </Link>
                            </Button>
                        )}
                    </div>

                    {/* `relative` keeps the badge's screen-reader text inside the scroller, not widening the page. */}
                    <nav aria-label="Course" className="no-scrollbar relative -mb-px mt-4 flex gap-1 overflow-x-auto">
                        {tabs.map((tab) => {
                            const active = isActive(tab);
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                                        active
                                            ? "border-primary text-foreground"
                                            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                                    )}
                                >
                                    <tab.icon className={cn("size-4", active && "text-primary")} aria-hidden />
                                    {tab.label}
                                    {!!tab.badge && (
                                        <span className="min-w-5 rounded-sm bg-primary px-1.5 text-center text-[0.6875rem] font-semibold tabular-nums text-primary-foreground">
                                            {tab.badge}
                                            <span className="sr-only"> waiting for review</span>
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {children}
        </>
    );
}
