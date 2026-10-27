"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    Award,
    Ban,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Headphones,
    History,
    KeyRound,
    Link2,
    Mail,
    Pencil,
    Phone,
    Users,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import AssignMentorModal from "@/components/admin/AssignMentorModal";
import DataTable, { type Column } from "@/components/admin/DataTable";
import DetailTabs from "@/components/admin/DetailTabs";
import EditMentorModal from "@/components/admin/EditMentorModal";
import { MentorActivityFeed } from "@/components/admin/mentorDetail/MentorActivityFeed";
import { MentorDevices } from "@/components/admin/mentorDetail/MentorDevices";
import { MentorReviews } from "@/components/admin/mentorDetail/MentorReviews";
import { formatHours } from "@/components/admin/mentorDetail/format";
import { StatusPill } from "@/components/admin/StatusPill";
import { TREND_COLORS, TrendChart } from "@/components/admin/TrendChart";
import { useMentorActions } from "@/components/admin/useMentorActions";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { MentorOverview } from "@/types/admin.types";

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "History" },
    { id: "support", label: "Support sessions" },
    { id: "reviews", label: "Assignment marks" },
    { id: "devices", label: "Devices" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROLE_LABEL: Record<string, string> = { LEAD: "Lead", CO_MENTOR: "Co-mentor", SUPPORT: "Support" };

const WORK_SERIES = [
    { key: "changes" as const, label: "Content changes", ...TREND_COLORS[0] },
    { key: "reviews" as const, label: "Reviews", ...TREND_COLORS[1] },
    { key: "supportSessions" as const, label: "Support sessions", ...TREND_COLORS[2] },
];

/**
 * One mentor, in full: who they are, how their courses and students are
 * doing, their support sessions and reviews, the change history of everything
 * they've edited, and where they're signed in.
 */
export default function AdminMentorDetailPage() {
    const { mentorId } = useParams<{ mentorId: string }>();
    const [tab, setTab] = useState<TabId>("overview");
    const [editOpen, setEditOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const mentorActions = useMentorActions();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "mentor", mentorId, "overview"],
        queryFn: () => adminService.mentorOverview(mentorId),
    });

    if (isLoading) return <DetailSkeleton />;

    if (isError || !data) {
        return (
            <div className="space-y-6">
                <BackButton href="/admin/mentors" label="All mentors" />
                <Card className="border-dashed">
                    <CardContent className="p-10 text-center text-muted-foreground">
                        {getApiErrorMessage(error, "Couldn't load this mentor.")}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { mentor, stats } = data;
    const isActive = mentor.status === "ACTIVE";
    const headline = [mentor.mentorProfile?.designation, mentor.mentorProfile?.experience].filter(Boolean).join(" · ");
    const courses = data.courses.map(({ id, title }) => ({ id, title }));

    return (
        <div className="space-y-6">
            <BackButton href="/admin/mentors" label="All mentors" />

            {/* ---- Who they are */}
            <Card className="overflow-hidden shadow-sm">
                <div className="h-24 bg-linear-to-r from-primary/15 via-primary/5 to-transparent sm:h-28" aria-hidden />
                <CardContent className="-mt-14 flex flex-col gap-5 p-6 pt-0 sm:-mt-16 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <Avatar
                            src={mentor.image}
                            name={mentor.name}
                            size={128}
                            className="shrink-0 bg-card ring-4 ring-card"
                        />
                        <div className="min-w-0 space-y-1.5 sm:pb-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold wrap-break-word sm:text-3xl">{mentor.name}</h1>
                                <StatusPill kind="user" value={mentor.status} />
                            </div>
                            <p className={cn("text-base", !headline && "text-muted-foreground")}>
                                {headline || "No designation yet"}
                            </p>
                            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <Mail className="size-4 shrink-0" aria-hidden />
                                    <span className="truncate">{mentor.email}</span>
                                </span>
                                {mentor.phone && (
                                    <span className="flex items-center gap-1.5">
                                        <Phone className="size-4" aria-hidden /> {mentor.phone}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <CalendarDays className="size-4" aria-hidden /> Mentor since {formatDate(mentor.createdAt)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock className="size-4" aria-hidden />
                                    {stats.lastActivityAt
                                        ? `Last active ${formatDistanceToNow(new Date(stats.lastActivityAt), { addSuffix: true })}`
                                        : "No recorded activity yet"}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                            <Pencil /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                            <Link2 /> Assign to course
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            isLoading={mentorActions.isResetting(mentor.id)}
                            onClick={() => void mentorActions.resetPassword(mentor)}
                        >
                            <KeyRound /> Reset password
                        </Button>
                        {isActive ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                isLoading={mentorActions.isChangingStatus(mentor.id)}
                                onClick={() => void mentorActions.block(mentor)}
                            >
                                <Ban /> Block
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                isLoading={mentorActions.isChangingStatus(mentor.id)}
                                onClick={() => mentorActions.reactivate(mentor)}
                            >
                                <CheckCircle2 /> Reactivate
                            </Button>
                        )}
                    </div>
                </CardContent>

                {(mentor.mentorProfile?.expertise.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border px-6 py-4">
                        {mentor.mentorProfile?.expertise.map((skill) => (
                            <Badge key={skill} variant="secondary">
                                {skill}
                            </Badge>
                        ))}
                    </div>
                )}
            </Card>

            {/* ---- The numbers */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile icon={BookOpen} label="Courses" value={stats.courses} hint={`${stats.certificates} certificates issued`} />
                <StatTile icon={Users} label="Students taught" value={stats.students} hint="across their courses" />
                <StatTile
                    icon={Headphones}
                    label="Support sessions"
                    value={stats.support.total}
                    hint={`${stats.support.studentsHelped} students helped`}
                />
                <StatTile
                    icon={ClipboardCheck}
                    label="Reviews done"
                    value={stats.reviews.total}
                    hint={`${stats.reviews.pending} waiting in their courses`}
                    tone={stats.reviews.pending > 0 ? "warning" : undefined}
                />
                <StatTile
                    icon={Clock}
                    label="Avg. review time"
                    value={stats.reviews.averageTurnaroundHours === null ? "—" : formatHours(stats.reviews.averageTurnaroundHours)}
                    hint={
                        stats.reviews.promptShare === null
                            ? "no reviews yet"
                            : `${stats.reviews.promptShare}% within ${stats.reviews.promptHours} h`
                    }
                />
                <StatTile
                    icon={History}
                    label="Content changes"
                    value={stats.content.changes}
                    hint={`${stats.content.lessonsAdded} lessons added`}
                />
            </div>

            {/* ---- Sections */}
            <DetailTabs tabs={TABS} value={tab} onChange={setTab} label="Mentor details" />

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === "overview" && (
                    <OverviewTab data={data} mentorId={mentorId} courses={courses} onSeeHistory={() => setTab("activity")} />
                )}
                {tab === "activity" && <MentorActivityFeed mentorId={mentorId} courses={courses} />}
                {tab === "support" && <SupportTab data={data} />}
                {tab === "reviews" && <MentorReviews mentorId={mentorId} courses={courses} />}
                {tab === "devices" && <MentorDevices mentorId={mentorId} />}
            </div>

            <EditMentorModal open={editOpen} onOpenChange={setEditOpen} mentorId={mentorId} />
            <AssignMentorModal open={assignOpen} onOpenChange={setAssignOpen} mentorId={assignOpen ? mentorId : null} />
        </div>
    );
}

function StatTile({
    icon: Icon,
    label,
    value,
    hint,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    hint?: string;
    tone?: "warning";
}) {
    return (
        <Card className="h-full shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
                <span
                    className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-lg",
                        tone === "warning" ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary",
                    )}
                >
                    <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-2xl font-bold leading-none">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function OverviewTab({
    data,
    mentorId,
    courses,
    onSeeHistory,
}: {
    data: MentorOverview;
    mentorId: string;
    courses: { id: string; title: string }[];
    onSeeHistory: () => void;
}) {
    const { stats, mentor } = data;

    return (
        <div className="space-y-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Work in the last 30 days</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Content changes, reviews returned and support sessions held, day by day.
                    </p>
                </CardHeader>
                <CardContent>
                    <TrendChart
                        trend={data.trend}
                        series={WORK_SERIES}
                        emptyMessage="No recorded work in the last 30 days."
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card className="shadow-sm xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.courses.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                Not assigned to any course yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {data.courses.map((course) => (
                                    <li key={course.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/admin/courses/${course.id}`}
                                                className="min-w-0 flex-1 truncate font-medium hover:underline"
                                            >
                                                {course.title}
                                            </Link>
                                            <Badge variant="secondary">{ROLE_LABEL[course.role] ?? course.role}</Badge>
                                            <StatusPill kind="course" value={course.status} />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Progress value={course.averageProgress} className="h-1.5 flex-1" />
                                            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                                {course.averageProgress}% avg. progress
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {course.students} {course.students === 1 ? "student" : "students"} ·{" "}
                                            {course.completed} completed
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="space-y-2.5 text-sm">
                            <Row label="Reviews returned">{stats.reviews.total}</Row>
                            <Row label="Waiting for review">{stats.reviews.pending}</Row>
                            <Row label="Average review time">
                                {stats.reviews.averageTurnaroundHours === null
                                    ? "—"
                                    : formatHours(stats.reviews.averageTurnaroundHours)}
                            </Row>
                            <Row label={`Reviewed within ${stats.reviews.promptHours} h`}>
                                {stats.reviews.promptShare === null ? "—" : `${stats.reviews.promptShare}%`}
                            </Row>
                            <Divider />
                            <Row label="Support sessions held">{stats.support.ended + stats.support.live}</Row>
                            <Row label="Upcoming">{stats.support.upcoming}</Row>
                            <Row label="Cancelled">{stats.support.cancelled}</Row>
                            <Row label="Students helped">{stats.support.studentsHelped}</Row>
                            <Divider />
                            <Row label="Lessons added">{stats.content.lessonsAdded}</Row>
                            <Row label="Modules added">{stats.content.modulesAdded}</Row>
                            <Row label="Quizzes added">{stats.content.quizzesAdded}</Row>
                            <Row label="Assignments added">{stats.content.assignmentsAdded}</Row>
                            <Row label="Certificates in their courses">
                                <span className="flex items-center gap-1">
                                    <Award className="size-3.5 text-muted-foreground" aria-hidden /> {stats.certificates}
                                </span>
                            </Row>
                        </dl>
                        <p className="mt-4 text-xs text-muted-foreground">
                            Content counts come from the change history, which starts when it was switched on.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card className="shadow-sm xl:col-span-2">
                    <CardHeader className="flex-row items-center justify-between gap-3">
                        <CardTitle>Recent changes</CardTitle>
                        <Button variant="outline" size="sm" onClick={onSeeHistory}>
                            <History /> Full history
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <MentorActivityFeed mentorId={mentorId} courses={courses} preview={5} />
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>About</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {mentor.bio ? (
                            <p className="whitespace-pre-line text-sm wrap-break-word">{mentor.bio}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">No bio yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{children}</dd>
        </div>
    );
}

const Divider = () => <hr className="border-border" />;

function SupportTab({ data }: { data: MentorOverview }) {
    const columns: Column<MentorOverview["recentSupportSessions"][number]>[] = [
        {
            id: "session",
            header: "Session",
            primary: true,
            cell: (session) => (
                <div className="min-w-0">
                    <p className="truncate font-medium">{session.title || "Support session"}</p>
                    <Link
                        href={`/admin/courses/${session.course.id}`}
                        className="block truncate text-xs text-muted-foreground hover:underline"
                    >
                        {session.course.title}
                    </Link>
                </div>
            ),
        },
        {
            id: "when",
            header: "When",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (session) => new Date(session.startTime),
            cell: (session) => formatDateTime(session.startTime),
        },
        {
            id: "status",
            header: "Status",
            cell: (session) => <StatusPill kind="supportSession" value={session.status} />,
        },
        {
            id: "students",
            header: "Students",
            className: "whitespace-nowrap tabular-nums",
            cell: (session) => `${session.studentsHelped} helped / ${session.studentsJoined} joined`,
        },
    ];

    return (
        <TabSection
            empty="No support sessions yet."
            count={data.recentSupportSessions.length}
            total={data.stats.support.total}
            noun="sessions"
        >
            <DataTable rows={data.recentSupportSessions} columns={columns} rowKey={(session) => session.id} />
        </TabSection>
    );
}

/** A list tab: its empty state, or the rows with a note when they're only the latest ones. */
function TabSection({
    empty,
    count,
    total,
    noun,
    children,
}: {
    empty: string;
    count: number;
    total: number;
    noun: string;
    children: ReactNode;
}) {
    if (count === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {empty}
            </p>
        );
    }
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                {count < total ? `The latest ${count} of ${total} ${noun}.` : `${total} ${noun}.`}
            </p>
            {children}
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="space-y-6" aria-busy>
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-56 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-72 rounded-xl" />
        </div>
    );
}
