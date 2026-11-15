"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, CalendarClock, Check, HelpCircle, LayoutDashboard, ListTree, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { relativeTime, weekLabelFor } from "@/components/shared/OutlineSchedule";
import { pad2 } from "@/components/shared/OutlineSyllabus";
import { Eyebrow } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { cn, formatDateTime, formatHoursMinutes } from "@/lib/utils";
import { learningService } from "@/services";
import type { CourseLearning, CourseOutline, LearningMilestone, LearningModule, LearningVideo } from "@/types/domain.types";

/** A quieter button on the dark editor surface — the theme's outline would vanish on it in light mode. */
const ON_DARK_OUTLINE =
    "border-editor-line bg-transparent text-editor-fg hover:border-editor-gutter hover:bg-editor-raised";

interface ModuleCompleteProps {
    data: CourseLearning;
    slug: string;
    milestone: LearningMilestone;
    courseModule: LearningModule;
    /** The first lesson after this module, when the student may open it. */
    nextLesson: { video: LearningVideo; moduleTitle: string } | null;
    onOpenLesson: (videoId: string) => void;
    onOpenQuiz: (quizId: string) => void;
}

/**
 * The finish line of a module, shown in the player's place: what the student
 * just finished, and where to go from here — the next module, the module's
 * quiz, or (when nothing else is out yet) when the next module opens.
 */
export default function ModuleComplete({
    data,
    slug,
    milestone,
    courseModule,
    nextLesson,
    onOpenLesson,
    onOpenQuiz,
}: ModuleCompleteProps) {
    const { course } = data;
    const moduleLabel = course.moduleLabel || "Module";
    const moduleWord = moduleLabel.toLowerCase();
    const now = useNow(60_000);

    // Only needed when there's no next lesson to send the student to: the
    // outline says what comes next and when. Same cache as the outline page.
    const { data: outline } = useQuery({
        queryKey: ["learning", slug, "outline"],
        queryFn: () => learningService.outline(slug),
        enabled: !nextLesson,
        staleTime: 5 * 60_000,
    });
    const upcoming = nextLesson || !outline ? null : nextOutlineModule(outline, now);

    const lessonsDone = courseModule.videos.filter((video) => video.isCompleted).length;
    const videoSeconds = courseModule.videos.reduce((sum, video) => sum + (video.type === "VIDEO" ? video.duration : 0), 0);
    const milestoneVideos = milestone.modules.flatMap((m) => m.videos);
    const milestonePercent = milestoneVideos.length
        ? Math.round((milestoneVideos.filter((video) => video.isCompleted).length / milestoneVideos.length) * 100)
        : 0;
    const quiz = courseModule.quiz;
    const place = `${course.milestoneLabel} ${pad2(milestone.order)} · ${moduleLabel} ${pad2(courseModule.order)}`;

    // A running bootcamp's "everything done" only means "everything out so far".
    const courseFinished =
        data.enrollment?.status === "COMPLETED" && !(course.courseType === "BOOTCAMP" && course.phase === "PRESENT");

    const stats = [
        { label: "Lessons done", value: `${lessonsDone}/${courseModule.videos.length}` },
        ...(videoSeconds > 0 ? [{ label: "Video time", value: formatHoursMinutes(videoSeconds) }] : []),
        ...(quiz?.isCompleted && quiz.bestScore !== null ? [{ label: "Quiz score", value: `${quiz.bestScore}%` }] : []),
        { label: `${course.milestoneLabel} ${pad2(milestone.order)} done`, value: `${milestonePercent}%` },
    ];

    return (
        <EditorWindow
            tabs={[{ name: "module.md", label: `${moduleLabel} complete`, active: true }]}
            status={
                <>
                    <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3" strokeWidth={3} aria-hidden /> All lessons done
                    </span>
                    <span className="truncate">{place}</span>
                </>
            }
            className="mx-auto w-full max-w-6xl"
            bodyClassName="relative isolate overflow-hidden"
        >
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10" />
            <span
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-primary-500/25 blur-3xl"
            />

            <div className="space-y-6 px-5 py-8 sm:px-10 sm:py-10">
                {/* What was finished. */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_6px_color-mix(in_oklch,var(--violet-500)_25%,transparent)] animate-in zoom-in-50 duration-500 motion-reduce:animate-none">
                        <Check className="size-7" strokeWidth={3} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <Eyebrow>{place}</Eyebrow>
                        <h2 className="mt-1.5 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                            {moduleLabel} complete!
                        </h2>
                        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-editor-muted sm:text-base">
                            You finished every lesson in{" "}
                            <span className="font-semibold text-editor-fg">&ldquo;{courseModule.title}&rdquo;</span>. Well
                            done — keep going.
                        </p>
                    </div>
                </div>

                {/* Hairlines between the cells come from the gap showing the frame's colour.
                    The cells wrap and stretch, so a narrow screen never leaves a gap in a row. */}
                <dl className="flex flex-wrap gap-px overflow-hidden rounded-card border border-editor-line bg-editor-line">
                    {stats.map((stat) => (
                        <div key={stat.label} className="flex min-w-34 flex-1 flex-col-reverse justify-end bg-editor-panel px-4 py-3">
                            <dt className="mt-0.5 truncate text-xs text-editor-muted">{stat.label}</dt>
                            <dd className="font-mono text-lg font-semibold tabular-nums sm:text-xl">{stat.value}</dd>
                        </div>
                    ))}
                </dl>

                {/* Where to go from here. */}
                <div className="space-y-3">
                    {quiz && !quiz.isCompleted && (
                        <NextStep
                            eyebrow={
                                <>
                                    <HelpCircle className="size-3.5" aria-hidden /> Quiz waiting
                                </>
                            }
                            title={quiz.title}
                            note={`A short quiz to check what you learned in this ${moduleWord}.`}
                        >
                            <Button variant="outline" className={ON_DARK_OUTLINE} onClick={() => onOpenQuiz(quiz.id)}>
                                Take the quiz
                            </Button>
                        </NextStep>
                    )}

                    {nextLesson ? (
                        <NextStep
                            highlight
                            eyebrow="Up next"
                            title={nextLesson.moduleTitle}
                            note={`Starts with: ${nextLesson.video.title}`}
                        >
                            <Button variant="brand" onClick={() => onOpenLesson(nextLesson.video.id)}>
                                Start the next {moduleWord} <ArrowRight className="size-4" aria-hidden />
                            </Button>
                        </NextStep>
                    ) : upcoming ? (
                        <NextStep
                            highlight
                            eyebrow={
                                <>
                                    <CalendarClock className="size-3.5" aria-hidden /> Next {moduleWord} is on its way
                                </>
                            }
                            title={upcoming.title}
                            note={`${upcoming.weekLabel} · ${
                                upcoming.opensAt
                                    ? `Opens ${formatDateTime(upcoming.opensAt)} (${relativeTime(new Date(upcoming.opensAt).getTime(), now)})`
                                    : "Date to be announced"
                            }`}
                        >
                            <Button asChild variant="outline" className={ON_DARK_OUTLINE}>
                                <Link href={`/learn/${slug}/outline`}>
                                    <ListTree className="size-4" aria-hidden /> See the full outline
                                </Link>
                            </Button>
                        </NextStep>
                    ) : courseFinished ? (
                        <NextStep
                            highlight
                            eyebrow={
                                <>
                                    <Award className="size-3.5" aria-hidden /> Course finished
                                </>
                            }
                            title="You've finished every lesson in this course 🎉"
                            note="Your certificate, if this course gives one, is on your profile."
                        >
                            <Button asChild variant="brand">
                                <Link href="/dashboard/profile/certification">
                                    <Award className="size-4" aria-hidden /> See my certificates
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className={ON_DARK_OUTLINE}>
                                <Link href="/dashboard">
                                    <LayoutDashboard className="size-4" aria-hidden /> My Learning
                                </Link>
                            </Button>
                        </NextStep>
                    ) : (
                        <NextStep
                            highlight
                            eyebrow={
                                <>
                                    <CalendarClock className="size-3.5" aria-hidden /> You&apos;re all caught up
                                </>
                            }
                            title="The next lessons aren't out yet"
                            note="They'll show up here as soon as they're published."
                        >
                            <Button asChild variant="outline" className={ON_DARK_OUTLINE}>
                                <Link href={`/learn/${slug}/outline`}>
                                    <ListTree className="size-4" aria-hidden /> See the full outline
                                </Link>
                            </Button>
                        </NextStep>
                    )}
                </div>

                {courseModule.videos[0] && (
                    <button
                        type="button"
                        onClick={() => onOpenLesson(courseModule.videos[0].id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-editor-muted transition-colors hover:text-editor-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <RotateCcw className="size-4" aria-hidden /> Watch this {moduleWord} again from the start
                    </button>
                )}
            </div>
        </EditorWindow>
    );
}

/** One "what now" row: what it is on the left, its button(s) on the right (stacked on a phone). */
function NextStep({
    eyebrow,
    title,
    note,
    highlight = false,
    children,
}: {
    eyebrow: ReactNode;
    title: string;
    note: string;
    highlight?: boolean;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-4 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
                highlight ? "border-primary/45 bg-editor-raised shadow-panel" : "border-editor-line bg-editor-panel/80",
            )}
        >
            <div className="min-w-0">
                <p
                    className={cn(
                        "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
                        highlight ? "text-syn-string" : "text-syn-func",
                    )}
                >
                    {eyebrow}
                </p>
                <p className="mt-1.5 line-clamp-2 font-semibold">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-editor-muted">{note}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row *:w-full sm:*:w-auto">{children}</div>
        </div>
    );
}

/**
 * The first module in the outline that isn't out yet: on a bootcamp, one
 * dated in the future (or still undated); on a self-paced course, one staff
 * haven't published.
 */
function nextOutlineModule(outline: CourseOutline, now: number) {
    const selfPaced = outline.course.courseType === "TRADITIONAL";
    for (const week of outline.weeks) {
        for (const item of week.items) {
            if (item.kind !== "MODULE") continue;
            const notOutYet = selfPaced
                ? !item.isPublished
                : !item.scheduledAt || new Date(item.scheduledAt).getTime() > now;
            if (notOutYet) {
                return {
                    title: item.title,
                    opensAt: selfPaced ? null : item.scheduledAt,
                    weekLabel: weekLabelFor(week, outline.course.milestoneLabel),
                };
            }
        }
    }
    return null;
}
