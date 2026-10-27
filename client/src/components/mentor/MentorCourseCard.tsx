import { ArrowRight, BookOpen, CalendarDays, Gauge, Layers, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { ROLE_LABEL, STATUS_LABEL } from "@/components/mentor/course/CourseWorkspace";
import { clock, DAY_MS, pad2, plural } from "@/components/mentor/dashboard/time";
import { SafeImage } from "@/components/ui/safe-image";
import { PHASE_META } from "@/lib/courseClassification";
import { staffCourseRoutes } from "@/lib/staffRoutes";
import { cn } from "@/lib/utils";
import type { MentorCourse } from "@/types/mentor.types";

/** "Week 02 · Day 01, Sat 9:00 PM" — or a date, when it's more than a week off. */
function nextRelease(course: MentorCourse, now: number) {
    const next = course.stats.nextRelease;
    if (!next) return null;
    const week = `${course.milestoneLabel} ${pad2(next.milestoneOrder)}`;
    const what =
        next.itemType === "MODULE"
            ? `${week} · ${course.moduleLabel} ${pad2(next.order ?? 0)}`
            : `${week} ${next.itemType === "ASSIGNMENT" ? "assignment" : "practice day"}`;
    const at = new Date(next.at);
    const when =
        at.getTime() - now < 6 * DAY_MS
            ? `${at.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Dhaka" })} ${clock(at)}`
            : at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
    return { what, when };
}

/**
 * One course the mentor teaches: its cover, what it is to them, how many are
 * enrolled and how far they've got on average, what's waiting on a review and
 * what goes out next — then a strip with the way in and the three places
 * they go most.
 */
export default function MentorCourseCard({ course, now }: { course: MentorCourse; now: number }) {
    const routes = staffCourseRoutes("mentor", course.id);
    const { stats } = course;
    const release = nextRelease(course, now);

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-card-hover">
            <div className="relative aspect-video overflow-hidden bg-secondary">
                <SafeImage
                    src={course.thumbnail}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    fallback={
                        <span className="grid size-full place-items-center bg-brand-soft">
                            <BookOpen className="size-8 text-primary/60" aria-hidden />
                        </span>
                    }
                />
                <p className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 text-[0.6875rem] font-semibold text-white">
                    <span className="rounded-full bg-slate-950/60 px-2 py-0.5 backdrop-blur">{course.courseType === "BOOTCAMP" ? "Bootcamp" : "Traditional"}</span>
                    {course.phase && (
                        <span className="rounded-full bg-slate-950/60 px-2 py-0.5 backdrop-blur" title={PHASE_META[course.phase].hint}>
                            {PHASE_META[course.phase].admin}
                        </span>
                    )}
                    <span className="rounded-full bg-slate-950/60 px-2 py-0.5 backdrop-blur">{ROLE_LABEL[course.role] ?? course.role}</span>
                </p>
                {STATUS_LABEL[course.status] && (
                    <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground shadow-sm">
                        {STATUS_LABEL[course.status]}
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col p-5">
                <h2 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                    {/* The whole card opens the course; the links below sit above this one. */}
                    <Link href={routes.overview} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                        {course.title}
                    </Link>
                </h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{stats.students}</span> {stats.students === 1 ? "student" : "students"} enrolled ·{" "}
                    {plural(course._count.milestones, course.milestoneLabel.toLowerCase())} · {plural(course._count.videos, "lesson")}
                </p>

                <div className="mt-auto space-y-3 border-t border-border pt-4">
                    <div>
                        <p className="flex items-baseline justify-between text-xs text-muted-foreground">
                            <span>Average progress</span>
                            <span className="font-semibold tabular-nums text-foreground">{stats.averageProgress}%</span>
                        </p>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${stats.averageProgress}%` }} />
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
                        {stats.toReview > 0 ? (
                            <Link
                                href={`/mentor/reviews?course=${course.id}`}
                                className="relative z-10 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary transition-colors hover:bg-primary/15"
                            >
                                {stats.toReview} to review <ArrowRight className="size-3.5" aria-hidden />
                            </Link>
                        ) : (
                            <span className="text-muted-foreground">Nothing to review</span>
                        )}
                        {release && (
                            <span className="min-w-0 truncate text-muted-foreground" title={`${release.what} goes out ${release.when}`}>
                                Next: <span className="font-medium text-foreground">{release.what}</span> · {release.when}
                            </span>
                        )}
                    </div>
                </div>

            </div>

            {/* The way in, and the three places a mentor goes most — hairline-divided, never wrapping. */}
            <nav aria-label={`${course.title}: go to`} className="grid grid-cols-4 divide-x divide-border border-t border-border">
                <QuickLink href={routes.overview} icon={LayoutDashboard} label="Open" primary />
                <QuickLink href={routes.modules} icon={Layers} label="Modules" />
                <QuickLink href={routes.outline} icon={CalendarDays} label="Outline" />
                <QuickLink href={routes.results} icon={Gauge} label="Results" />
            </nav>
        </article>
    );
}

function QuickLink({ href, icon: Icon, label, primary = false }: { href: string; icon: typeof Layers; label: string; primary?: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "relative z-10 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors hover:bg-secondary/50",
                primary ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
        >
            <Icon className="size-4" aria-hidden />
            {label}
        </Link>
    );
}
