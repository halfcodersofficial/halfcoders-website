"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, CalendarRange, Gift, Medal, Plus, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { COURSE_GRID, CourseSummaryCard, CourseSummaryHeader, CourseSummaryRow, CourseThumb, StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import CourseFan from "@/components/admin/promotions/CourseFan";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { cn, formatBDT, formatDate, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminSummaryCourse, PromotionCourseDetail, PromotionCourseSummary, PromotionGrant } from "@/types/admin.types";

/*
 * The Offers, Rewards and Reward courses screens: each starts from the
 * courses (a promotion belongs to one), then opens one course to set its
 * offer, its reward, or the reward courses given with it.
 */

export type PromotionKind = "offer" | "reward" | "bonus";

const KIND = {
    offer: {
        title: "Free-course offers",
        description: "Buy one course, get others free. Pick a paid course to set the courses that come with it.",
        href: "/admin/offers",
        icon: Gift,
        noun: "offer",
    },
    reward: {
        title: "Completion rewards",
        description: "Courses given for finishing a course in time. Pick a course to set its reward and deadline.",
        href: "/admin/rewards",
        icon: Medal,
        noun: "reward",
    },
    bonus: {
        title: "Reward courses",
        description:
            "Give extra courses with a course — to one student, a group, or everyone who has it. Students find them under Reward courses on their dashboard; only the main course gives a certificate.",
        href: "/admin/reward-courses",
        icon: Sparkles,
        noun: "reward course",
    },
} as const;

/** The kind's own entry on a course's summary. */
const promoOf = (kind: PromotionKind, summary: PromotionCourseSummary) =>
    kind === "offer" ? summary.offer : kind === "reward" ? summary.reward : summary.bonus;

type Live = "on" | "off" | "scheduled" | "ended" | "paused" | "everyone" | "picked";
const LIVE_TONE: Record<Live, { label: string; tone: string; badge: "success" | "default" | "secondary" | "warning" }> = {
    on: { label: "On", tone: "bg-success/90 text-white", badge: "success" },
    // Reward courses have no on/off — just who they reach.
    everyone: { label: "For everyone", tone: "bg-success/90 text-white", badge: "success" },
    picked: { label: "Picked students", tone: "bg-primary/90 text-white", badge: "default" },
    scheduled: { label: "Not open yet", tone: "bg-primary/90 text-white", badge: "default" },
    ended: { label: "Ended", tone: "bg-foreground/70 text-white", badge: "secondary" },
    off: { label: "Switched off", tone: "bg-foreground/70 text-white", badge: "secondary" },
    paused: { label: "Paused · course not paid", tone: "bg-amber-500/90 text-white", badge: "warning" },
};

/** An offer only stands while its course is paid — made free, it's paused. */
const offerLive = (
    pricing: AdminSummaryCourse["pricing"],
    offer: { isActive: boolean; startsAt: string | null; endsAt: string | null } | null,
    now = Date.now(),
): Live => {
    if (!offer) return "off";
    if (pricing !== "PAID") return "paused";
    return !offer.isActive
        ? "off"
        : offer.startsAt && new Date(offer.startsAt).getTime() > now
          ? "scheduled"
          : offer.endsAt && new Date(offer.endsAt).getTime() < now
            ? "ended"
            : "on";
};

const rewardLive = (reward: { isActive: boolean; deadlineAt: string | null }, now = Date.now()): Live =>
    !reward.isActive ? "off" : reward.deadlineAt && new Date(reward.deadlineAt).getTime() < now ? "ended" : "on";

/** Reward courses reach everyone who has the course once any one of them is on for everyone. */
const bonusLive = (forEveryone: number): Live => (forEveryone > 0 ? "everyone" : "picked");

/** The deadline in words: a date, so many days from enrolling, both, or none. */
export const deadlineText = (reward: { deadlineAt: string | null; withinDays: number | null }) => {
    if (reward.deadlineAt && reward.withinDays) return `Within ${reward.withinDays} days of enrolling, and by ${formatDate(reward.deadlineAt)}`;
    if (reward.withinDays) return `Within ${reward.withinDays} days of enrolling`;
    if (reward.deadlineAt) return `By ${formatDate(reward.deadlineAt)}`;
    return "No deadline";
};

/** An offer's window in a few words: "Starts 1 Nov", "Until 30 Nov", "Ended 2 Oct", "No end date". */
const offerWindow = (offer: { startsAt: string | null; endsAt: string | null }, now = Date.now()) => {
    if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return `Starts ${formatDate(offer.startsAt)}`;
    if (offer.endsAt) return `${new Date(offer.endsAt).getTime() < now ? "Ended" : "Until"} ${formatDate(offer.endsAt)}`;
    return "No end date";
};

export const CONDITION_TEXT = { COURSE_COMPLETE: "Finish the course", CERTIFICATE: "Earn the certificate" } as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function LiveChip({ live }: { live: Live }) {
    return <span className={cn("rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold shadow-card", LIVE_TONE[live].tone)}>{LIVE_TONE[live].label}</span>;
}

/** Every course, each with its offer or reward in brief; one opens that course's setup. */
export function PromotionCoursesPage({ kind }: { kind: PromotionKind }) {
    const meta = KIND[kind];
    const [filter, setFilter] = useState("");
    const [term, setTerm] = useState("");
    const [view, setView] = useState<ViewMode>("grid");
    const viewKey = `admin.${kind}s.view`;

    useEffect(() => {
        try {
            const saved = localStorage.getItem(viewKey);
            if (saved === "grid" || saved === "list") setView(saved);
        } catch {
            // Storage blocked — the default layout is fine.
        }
    }, [viewKey]);
    const changeView = (next: ViewMode) => {
        setView(next);
        try {
            localStorage.setItem(viewKey, next);
        } catch {
            // Not remembered this time; still switches.
        }
    };

    const { data, isLoading } = useQuery({ queryKey: ["admin", "promotion-courses"], queryFn: adminService.promotionCourses });

    // Only a paid course can come with free courses — but one made free since keeps showing its offer, to remove it.
    const all = (data ?? []).filter((summary) => kind !== "offer" || summary.course.pricing === "PAID" || summary.offer);
    const has = (summary: PromotionCourseSummary) => Boolean(promoOf(kind, summary));
    const liveOf = (summary: PromotionCourseSummary): Live | null =>
        kind === "offer"
            ? summary.offer && offerLive(summary.course.pricing, summary.offer)
            : kind === "reward"
              ? summary.reward && rewardLive(summary.reward)
              : summary.bonus && bonusLive(summary.bonus.forEveryone);
    const running = (summary: PromotionCourseSummary) => ["on", "everyone"].includes(liveOf(summary) ?? "");
    // Running ones first, then the rest that have one, then the courses still without.
    const rank = (summary: PromotionCourseSummary) => (!has(summary) ? 2 : running(summary) ? 0 : 1);

    const search = term.trim().toLowerCase();
    const shown = all
        .filter(
            (summary) =>
                (filter === "" || (filter === "WITH") === has(summary)) && (!search || summary.course.title.toLowerCase().includes(search)),
        )
        .sort((a, b) => rank(a) - rank(b));
    const given = all.reduce((sum, summary) => sum + (promoOf(kind, summary)?.given ?? 0), 0);
    const withOne = all.filter(has).length;
    const live = all.filter(running).length;
    const withLabel = kind === "offer" ? "With an offer" : kind === "reward" ? "With a reward" : "With reward courses";

    const cells: StatCell[] = [
        { label: withLabel, value: String(withOne), hint: `Of ${plural(all.length, "course")}` },
        kind === "bonus"
            ? { label: "For everyone", value: String(live), hint: "Later buyers get them too" }
            : { label: "On now", value: String(live), hint: "Switched on and open" },
        { label: "Courses given", value: String(given), hint: "Not counting any taken back" },
        { label: "Without", value: String(all.length - withOne), hint: withOne === all.length ? "Every course has one" : `No ${meta.noun} set` },
    ];

    const parts = (summary: PromotionCourseSummary, compact: boolean) => {
        const promo = promoOf(kind, summary);
        const count = (kind === "offer" ? summary.offer?.freeCount : kind === "reward" ? summary.reward?.rewardCount : summary.bonus?.courseCount) ?? 0;
        const state = liveOf(summary);

        const figure = promo ? (
            <p className="inline-flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-primary">+{count}</span>
                <span className="text-xs text-muted-foreground">
                    {kind === "bonus"
                        ? count === 1
                            ? "reward course"
                            : "reward courses"
                        : compact
                          ? "free"
                          : kind === "offer"
                            ? `free ${count === 1 ? "course" : "courses"} with each purchase`
                            : `free for finishing in time`}
                </span>
            </p>
        ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Plus className="size-4" aria-hidden />
                {compact ? (kind === "bonus" ? "Give" : "Set up") : kind === "offer" ? "Set up an offer" : kind === "reward" ? "Set up a reward" : "Give a reward course"}
            </span>
        );

        const bar =
            kind === "offer" ? (
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarRange className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{summary.offer ? offerWindow(summary.offer) : "Buyers get nothing extra yet."}</span>
                </p>
            ) : kind === "reward" ? (
                <p className="truncate text-xs text-muted-foreground">
                    {summary.reward
                        ? `${CONDITION_TEXT[summary.reward.condition]} · ${deadlineText(summary.reward).toLowerCase()}`
                        : "Finishing earns nothing extra yet."}
                </p>
            ) : (
                <p className="truncate text-xs text-muted-foreground">
                    {!summary.bonus
                        ? "Its students get nothing extra yet."
                        : summary.bonus.forEveryone === summary.bonus.courseCount
                          ? "Everyone who has it gets them, later buyers too."
                          : summary.bonus.forEveryone > 0
                            ? `${summary.bonus.forEveryone} for everyone, the rest for picked students.`
                            : "Given to picked students."}
                </p>
            );

        return {
            badge: state ? <LiveChip live={state} /> : undefined,
            figure,
            bar,
            note: promo ? `Gave ${plural(promo.given, "course")}` : `No ${meta.noun} yet`,
        };
    };

    const hrefFor = (summary: PromotionCourseSummary) => `${meta.href}/courses/${summary.course.id}`;

    return (
        <DataShell
            header={
                <div className="space-y-5">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <ConsoleEyebrow />
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{meta.title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground sm:text-base">{meta.description}</p>
                        </div>
                        <ViewToggle value={view} onChange={changeView} />
                    </header>
                    {isLoading ? <Skeleton className="h-24 rounded-card" /> : <StatStrip cells={cells} />}
                </div>
            }
            searchPlaceholder="Search courses…"
            onSearch={setTerm}
            filters={[
                { value: "", label: "All courses", count: all.length },
                { value: "WITH", label: withLabel, count: withOne },
                { value: "WITHOUT", label: "None yet", count: all.length - withOne },
            ]}
            activeFilter={filter}
            onFilter={setFilter}
            isLoading={isLoading}
            skeleton={
                <div className="@container">
                    <div className={COURSE_GRID}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-72 rounded-card" />
                        ))}
                    </div>
                </div>
            }
            isEmpty={shown.length === 0}
            emptyMessage={all.length === 0 ? (kind === "offer" ? "No paid courses yet." : "No courses yet.") : "No courses match."}
            emptyHint={all.length === 0 ? "Create a course first." : "Try a different search or filter."}
        >
            {view === "grid" ? (
                <div className="@container">
                    <ul className={COURSE_GRID}>
                        {shown.map((summary) => (
                            <li key={summary.course.id}>
                                <CourseSummaryCard course={summary.course} href={hrefFor(summary)} {...parts(summary, false)} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((summary) => (
                        <li key={summary.course.id}>
                            <CourseSummaryRow course={summary.course} href={hrefFor(summary)} {...parts(summary, true)} />
                        </li>
                    ))}
                </ul>
            )}
        </DataShell>
    );
}

/**
 * One course's offer or reward page: back to the list, the course's header
 * with its figures, then the setup (`children`, drawn on a ruled card — see
 * `PromotionDeal`, `PromoSection`, `PromoActions`) beside who it has given
 * courses to.
 */
export function PromotionCourseShell({
    kind,
    courseId,
    children,
    grantAction,
}: {
    kind: PromotionKind;
    courseId: string;
    children: (detail: PromotionCourseDetail) => ReactNode;
    /** Something to do about one student's course in "Given so far" — taking a reward course back. */
    grantAction?: (grant: PromotionGrant) => ReactNode;
}) {
    const meta = KIND[kind];
    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin", "promotion-course", courseId],
        queryFn: () => adminService.promotionCourse(courseId),
    });

    if (isError) {
        return (
            <div className="space-y-5">
                <BackButton href={meta.href} label="All courses" />
                <div className="rounded-card border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }
    if (isLoading || !data) {
        return (
            <div className="space-y-5">
                <BackButton href={meta.href} label="All courses" />
                <Skeleton className="h-72 rounded-card" />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <Skeleton className="h-112 rounded-card" />
                    <Skeleton className="h-64 rounded-card" />
                </div>
            </div>
        );
    }

    const grants = kind === "offer" ? data.offerGrants : kind === "reward" ? data.rewardGrants : data.bonusGrants;
    const active = grants.filter((grant) => !grant.revokedAt).length;
    const everyone = data.bonuses.filter((bonus) => bonus.forEveryone).length;
    const live =
        kind === "offer"
            ? data.offer
                ? offerLive(data.course.pricing, data.offer)
                : null
            : kind === "reward"
              ? data.reward
                  ? rewardLive(data.reward)
                  : null
              : data.bonuses.length
                ? bonusLive(everyone)
                : null;
    const cells: StatCell[] =
        kind === "bonus"
            ? [
                  { label: "Reward courses", value: String(data.bonuses.length), hint: "Given with this course" },
                  { label: "For everyone", value: String(everyone), hint: everyone ? "Later buyers get them too" : "Only picked students" },
                  { label: "Courses given", value: String(active), hint: "Still open to them" },
                  { label: "Taken back", value: String(grants.length - active), hint: "Lost the main course" },
              ]
            : kind === "offer"
            ? [
                  { label: "Free courses", value: String(data.offer?.freeCourses.length ?? 0), hint: "With each purchase" },
                  { label: "Status", value: live ? LIVE_TONE[live].label.split(" · ")[0] : "—", hint: data.offer ? offerWindow(data.offer) : "Not set" },
                  { label: "Courses given", value: String(active), hint: "Still open to them" },
                  { label: "Taken back", value: String(grants.length - active), hint: "By a refund" },
              ]
            : [
                  { label: "Reward courses", value: String(data.reward?.rewardCourses.length ?? 0), hint: "For finishing in time" },
                  { label: "Status", value: live ? LIVE_TONE[live].label : "—", hint: data.reward ? deadlineText(data.reward) : "Not set" },
                  { label: "Courses given", value: String(grants.length), hint: "Each student once" },
                  { label: "Asks for", value: data.reward ? (data.reward.condition === "CERTIFICATE" ? "Certificate" : "Finishing") : "—", hint: "To earn it" },
              ];

    return (
        <div className="space-y-6">
            <BackButton href={meta.href} label="All courses" />
            <CourseSummaryHeader
                course={data.course}
                details={
                    <>
                        {live ? (
                            <Badge variant={LIVE_TONE[live].badge}>{LIVE_TONE[live].label}</Badge>
                        ) : (
                            <Badge variant="secondary">No {meta.noun} yet</Badge>
                        )}
                        {kind === "offer" && data.course.pricing === "PAID" && (
                            <span>Sells at {formatBDT(data.course.discountPrice ?? data.course.price)}</span>
                        )}
                    </>
                }
                stats={cells}
                bar={<p className="text-sm text-muted-foreground">{meta.description}</p>}
            />
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="@container min-w-0 overflow-hidden rounded-card border border-border bg-card shadow-card">{children(data)}</section>
                <GrantList grants={grants} kind={kind} action={grantAction} />
            </div>
        </div>
    );
}

/**
 * The promotion as a student meets it, redrawn as the form changes: this
 * course on one side — bought, or finished in time — and what it gives on the
 * other, with what those courses would cost alone.
 */
export function PromotionDeal({
    kind,
    course,
    courseIds,
    lead,
    terms,
}: {
    kind: PromotionKind;
    course: AdminSummaryCourse;
    /** The courses picked in the form, in order. */
    courseIds: string[];
    /** Over this course: "Buy this course", "Finish the course". */
    lead: string;
    /** Under it: the price, or the deadline. */
    terms: string;
}) {
    const { data } = useQuery({
        queryKey: ["admin", "courses", "picker"],
        queryFn: () => adminService.courses({ limit: 100, sortBy: "title", sortOrder: "asc" }),
        staleTime: 60_000,
    });
    const picked = courseIds.map((id) => data?.data.find((entry) => entry.id === id)).filter((entry) => entry !== undefined);
    const worth = picked.reduce((sum, entry) => sum + (entry.discountPrice ?? entry.price), 0);
    const Connector = kind === "offer" ? Plus : ArrowRight;

    return (
        <div className="bg-surface/70 px-5 py-5 sm:px-6">
            <p className="text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                {kind === "offer" ? "The offer, as a buyer sees it" : "The reward, as a student sees it"}
            </p>
            <div className="mt-3 grid grid-cols-1 items-stretch gap-3 @2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @2xl:items-center">
                <div className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
                    <span className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">
                        <CourseThumb course={course} sizes="96px" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-primary">{lead}</span>
                        <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug">{course.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{terms}</span>
                    </span>
                </div>

                <span aria-hidden className="mx-auto grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-card">
                    <Connector className={cn("size-4", kind === "reward" && "@max-2xl:rotate-90")} strokeWidth={2.5} />
                </span>

                {picked.length > 0 ? (
                    <div className="flex items-center gap-3 rounded-card border border-primary/30 bg-card p-3">
                        <CourseFan courses={picked} max={3} className="shrink-0" />
                        <span className="min-w-0">
                            <span className="block text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-success-ink">
                                {picked.length === 1 ? "Free course" : `${picked.length} free courses`}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug">
                                {picked.length === 1 ? picked[0].title : picked.map((entry) => entry.title).join(", ")}
                            </span>
                            {worth > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">Worth {formatBDT(worth)} on their own</span>}
                        </span>
                    </div>
                ) : (
                    <div className="grid min-h-21 place-items-center rounded-card border-[1.5px] border-dashed border-border-strong px-4 text-center text-sm text-muted-foreground">
                        {kind === "offer" ? "Pick the free courses below." : "Pick the reward courses below."}
                    </div>
                )}
            </div>
        </div>
    );
}

/** One part of the setup: what it is on the left (above, when narrow), its fields on the right. */
export function PromoSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
    return (
        <section className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 @3xl:grid-cols-[13rem_minmax(0,1fr)] @3xl:gap-8">
            <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            <div className="min-w-0 space-y-4">{children}</div>
        </section>
    );
}

/** The setup's foot: remove on the left, save on the right — on a phone, full width with save on top. */
export const PromoActions = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-col-reverse gap-2 bg-surface/70 px-5 py-4 max-sm:[&>button]:w-full sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {children}
    </div>
);

/** Who the promotion has given courses to, newest first — with `action` beside each one still open, where there's one. */
function GrantList({ grants, kind, action }: { grants: PromotionGrant[]; kind: PromotionKind; action?: (grant: PromotionGrant) => ReactNode }) {
    const Icon = KIND[kind].icon;
    return (
        <aside className="overflow-hidden rounded-card border border-border bg-card shadow-card xl:sticky xl:top-6">
            <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="font-semibold">Given so far</h2>
                <span className="text-xs text-muted-foreground">{grants.length ? "Latest 50, newest first" : ""}</span>
            </div>
            {grants.length === 0 ? (
                <div className="px-6 py-10 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-md border border-border bg-surface text-primary">
                        <Icon className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-sm font-medium">Nobody yet</p>
                    <p className="mx-auto mt-1 max-w-64 text-xs text-muted-foreground">
                        {kind === "offer"
                            ? "Free courses are given the moment a purchase is paid."
                            : kind === "reward"
                              ? "Reward courses are given the moment a student qualifies."
                              : "Give a reward course to students of this course and they show up here."}
                    </p>
                </div>
            ) : (
                <ul className="max-h-128 divide-y divide-border overflow-y-auto">
                    {grants.map((grant) => (
                        <li key={grant.id} className={cn("flex items-center gap-3 px-5 py-3", grant.revokedAt && "opacity-70")}>
                            <Avatar src={grant.student.image} name={grant.student.name} size={32} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{grant.student.name}</p>
                                <p className="truncate text-xs text-muted-foreground" title={grant.course.title}>
                                    {grant.course.title}
                                </p>
                            </div>
                            {grant.revokedAt ? (
                                <span className="shrink-0 rounded-sm bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">Taken back</span>
                            ) : (
                                <span className="flex shrink-0 flex-col items-end gap-0.5">
                                    <time
                                        dateTime={grant.createdAt}
                                        title={formatDateTime(grant.createdAt)}
                                        className="text-[0.6875rem] tabular-nums text-muted-foreground"
                                    >
                                        {formatDistanceToNowStrict(new Date(grant.createdAt), { addSuffix: true })}
                                    </time>
                                    {action?.(grant)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
