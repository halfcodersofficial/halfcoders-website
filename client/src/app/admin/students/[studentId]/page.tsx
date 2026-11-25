"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    Activity,
    AlertTriangle,
    Ban,
    CalendarDays,
    CheckCircle2,
    Clock,
    Copy,
    KeyRound,
    Mail,
    MessageCircle,
    MonitorSmartphone,
    Phone,
    ShieldAlert,
    Trash2,
    UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import DetailTabs from "@/components/admin/DetailTabs";
import EnrollStudentModal from "@/components/admin/EnrollStudentModal";
import { studentOption } from "@/components/admin/pickers";
import { StatusPill } from "@/components/admin/StatusPill";
import { percentLabel } from "@/components/admin/studentDetail/format";
import { StudentCourses } from "@/components/admin/studentDetail/StudentCourses";
import { StudentOverviewTab } from "@/components/admin/studentDetail/StudentOverviewTab";
import { StudentProfileTab } from "@/components/admin/studentDetail/StudentProfileTab";
import { studentAccessKey, StudentDevicesTab } from "@/components/admin/studentDetail/StudentDevicesTab";
import { StudentQuizzesTab } from "@/components/admin/studentDetail/StudentQuizzesTab";
import { StudentPayments, StudentSupport } from "@/components/admin/studentDetail/StudentRecords";
import { StudentSubmissions } from "@/components/admin/studentDetail/StudentSubmissions";
import { useStudentActions } from "@/components/admin/useStudentActions";
import ProgressRing from "@/components/shared/ProgressRing";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { StudentAccess, StudentOverview } from "@/types/admin.types";

const TABS = ["overview", "courses", "assignments", "quizzes", "devices", "profile", "payments", "support"] as const;
type TabId = (typeof TABS)[number];

/**
 * One student, in full: everything on their profile, each course week by
 * week, every assignment with its marks and who gave them, their quizzes
 * course by course (with each answer), the devices and places their account
 * is used from, payments and support visits — and what an admin does to a
 * student: enrol them, send a password reset, sign a device out, block them.
 * Everything they did is on its own page, /activity.
 */
export default function AdminStudentDetailPage() {
    const { studentId } = useParams<{ studentId: string }>();
    const [tab, setTab] = useState<TabId>("overview");

    // `?tab=` opens a tab directly — a course-request notification links to "profile".
    useEffect(() => {
        const requested = new URLSearchParams(window.location.search).get("tab");
        if (requested && TABS.includes(requested as TabId)) setTab(requested as TabId);
    }, []);
    const [courseId, setCourseId] = useState("");
    const [enrolling, setEnrolling] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "student", studentId, "overview"],
        queryFn: () => adminService.studentOverview(studentId),
    });
    // Where the account is used from — the header's warning and the Devices tab share it.
    const access = useQuery({
        queryKey: studentAccessKey(studentId),
        queryFn: () => adminService.studentAccess(studentId),
        enabled: Boolean(data),
    });

    if (isLoading) return <DetailSkeleton />;

    if (isError || !data) {
        return (
            <div className="space-y-6">
                <BackButton href="/admin/students" label="All students" />
                <Card className="border-dashed">
                    <CardContent className="p-10 text-center text-muted-foreground">
                        {getApiErrorMessage(error, "Couldn't load this student.")}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { student, stats } = data;
    const openCourse = (id: string) => {
        setCourseId(id);
        setTab("courses");
    };

    const tabs = [
        { id: "overview" as const, label: "Overview" },
        { id: "courses" as const, label: "Courses", count: data.enrollments.length },
        { id: "assignments" as const, label: "Assignments", count: data.submissions.length },
        { id: "quizzes" as const, label: "Quizzes", count: data.quizAttempts.length },
        { id: "devices" as const, label: "Devices", count: access.data?.live.length },
        { id: "profile" as const, label: "Profile" },
        { id: "payments" as const, label: "Payments", count: data.orders.length },
        { id: "support" as const, label: "Support", count: data.support.length },
    ];

    return (
        <div className="space-y-6">
            <BackButton href="/admin/students" label="All students" />

            <StudentHero data={data} access={access.data} onEnroll={() => setEnrolling(true)} onDevices={() => setTab("devices")} />

            <Numbers stats={stats} />

            <DetailTabs tabs={tabs} value={tab} onChange={setTab} label="Student details" />

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === "overview" && <StudentOverviewTab studentId={studentId} data={data} onOpenCourse={openCourse} />}
                {tab === "courses" && (
                    <StudentCourses
                        studentId={studentId}
                        enrollments={data.enrollments}
                        courseId={courseId}
                        onCourse={setCourseId}
                    />
                )}
                {tab === "assignments" && (
                    <StudentSubmissions
                        submissions={data.submissions}
                        courses={data.enrollments.map(({ course }) => ({ id: course.id, title: course.title }))}
                        missed={stats.assignments.missed}
                    />
                )}
                {tab === "quizzes" && <StudentQuizzesTab studentId={studentId} courseId={courseId} onCourse={setCourseId} />}
                {tab === "devices" && <StudentDevicesTab studentId={studentId} studentName={student.name} />}
                {tab === "profile" && <StudentProfileTab data={data} />}
                {tab === "payments" && <StudentPayments orders={data.orders} paid={stats.paid} />}
                {tab === "support" && <StudentSupport visits={data.support} />}
            </div>

            <EnrollStudentModal
                open={enrolling}
                onOpenChange={setEnrolling}
                initialStudent={enrolling ? studentOption({ ...student, email: student.email ?? student.phone ?? "" }) : null}
            />
        </div>
    );
}

function StudentHero({
    data,
    access,
    onEnroll,
    onDevices,
}: {
    data: StudentOverview;
    access: StudentAccess | undefined;
    onEnroll: () => void;
    onDevices: () => void;
}) {
    const { student, stats, profile } = data;
    const actions = useStudentActions();
    const router = useRouter();
    const isActive = student.status === "ACTIVE";

    const copyId = async () => {
        if (!student.studentId) return;
        try {
            await navigator.clipboard.writeText(student.studentId);
            toast.success("Student ID copied.");
        } catch {
            toast.error("Couldn't copy — select it instead.");
        }
    };

    return (
        <Card className="overflow-hidden shadow-card">
            <div className="editor relative h-24 overflow-hidden border-b border-editor-line sm:h-28" aria-hidden>
                <span className="bg-grid bg-grid-fade absolute inset-0" />
                <p className="relative px-6 pt-4 text-right font-mono text-xs text-syn-comment">{"// "}Student profile</p>
            </div>
            <CardContent className="flex flex-col gap-5 p-6 pt-0 sm:flex-row sm:items-start sm:gap-6">
                {/* Only the photo rises into the banner — in their profile's completion ring, as on the student's own profile. */}
                <div className="relative z-10 -mt-16 w-fit shrink-0 sm:-mt-18">
                    <span className="grid rounded-full bg-card p-1.5 shadow-card">
                        <ProgressRing value={profile.completionPercent} size={136} stroke={5} fillIn>
                            <Avatar src={student.image} name={student.name} size={116} />
                        </ProgressRing>
                    </span>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-semibold shadow-card">
                        Profile {profile.completionPercent}%
                    </span>
                </div>

                {/* Name, ID and actions start under the banner, so nothing hides behind it. */}
                <div className="min-w-0 flex-1 space-y-3 sm:pt-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold wrap-break-word sm:text-3xl">{student.name}</h1>
                                <StatusPill kind="user" value={student.status} />
                                {!student.emailVerified && <Badge variant="warning">Email unverified</Badge>}
                                {access && access.risk.level !== "low" && (
                                    <button
                                        type="button"
                                        onClick={onDevices}
                                        title="See where this account is used from"
                                        className={cn(
                                            "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[0.7rem] font-medium leading-5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            access.risk.level === "high" ? "bg-destructive/10 text-destructive-ink" : "bg-warning/10 text-warning-ink",
                                        )}
                                    >
                                        <ShieldAlert className="size-3" aria-hidden />
                                        {access.risk.level === "high" ? "Possible account sharing" : "Sign-ins worth a look"}
                                    </button>
                                )}
                            </div>

                            {student.studentId && (
                                <button
                                    type="button"
                                    onClick={() => void copyId()}
                                    title="Copy student ID"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {student.studentId}
                                    <Copy className="size-3 text-muted-foreground" aria-hidden />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 xl:shrink-0 xl:justify-end">
                            <Button size="sm" onClick={onEnroll} disabled={!isActive}>
                                <UserPlus /> Enrol in a course
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/admin/students/${student.id}/activity`}>
                                    <Activity /> Activity
                                </Link>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                isLoading={actions.isResetting(student.id)}
                                onClick={() => void actions.resetPassword(student)}
                            >
                                <KeyRound /> Reset password
                            </Button>
                            {isActive ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    isLoading={actions.isChangingStatus(student.id)}
                                    onClick={() => void actions.block(student)}
                                >
                                    <Ban /> Block
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    isLoading={actions.isChangingStatus(student.id)}
                                    onClick={() => actions.reactivate(student)}
                                >
                                    <CheckCircle2 /> Reactivate
                                </Button>
                            )}
                            {actions.canDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    isLoading={actions.isDeleting(student.id)}
                                    onClick={() => void actions.remove(student, () => router.replace("/admin/students"))}
                                >
                                    <Trash2 /> Delete
                                </Button>
                            )}
                        </div>
                    </div>

                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {student.email && (
                            <Fact icon={Mail}>
                                <a href={`mailto:${student.email}`} className="truncate hover:text-foreground hover:underline">
                                    {student.email}
                                </a>
                            </Fact>
                        )}
                        {student.phone && (
                            <Fact icon={Phone}>
                                <a href={`tel:${student.phone}`} className="hover:text-foreground hover:underline">
                                    {student.phone}
                                </a>
                            </Fact>
                        )}
                        {student.whatsapp && <Fact icon={MessageCircle}>WhatsApp {student.whatsapp}</Fact>}
                        <Fact icon={CalendarDays}>Joined {formatDate(student.createdAt)}</Fact>
                        <Fact icon={Clock}>
                            {stats.lastActivityAt
                                ? `Last active ${formatDistanceToNow(new Date(stats.lastActivityAt), { addSuffix: true })}`
                                : "No learning activity yet"}
                        </Fact>
                        {access && (
                            <Fact icon={MonitorSmartphone}>
                                <button type="button" onClick={onDevices} className="hover:text-foreground hover:underline">
                                    Signed in on {access.live.length} of {access.maxDevices} devices
                                </button>
                            </Fact>
                        )}
                    </p>
                </div>
            </CardContent>

            {student.accountStatus !== "ACTIVE" && (
                <p className="flex items-start gap-2 border-t border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Their account is {student.accountStatus.toLowerCase()}, so they can&apos;t sign in anywhere —
                    whatever their learning status says.
                </p>
            )}

            {student.bio && (
                <p className="whitespace-pre-line border-t border-border px-6 py-4 text-sm text-muted-foreground wrap-break-word">
                    {student.bio}
                </p>
            )}
        </Card>
    );
}

function Fact({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-4 shrink-0" aria-hidden />
            {children}
        </span>
    );
}

/** The student's key figures on one hairline-divided strip. */
function Numbers({ stats }: { stats: StudentOverview["stats"] }) {
    const cells: { label: string; value: ReactNode; hint: string }[] = [
        {
            label: "Courses",
            value: stats.courses.total,
            hint: `${stats.courses.active} active · ${stats.courses.completed} done`,
        },
        {
            label: "Avg. progress",
            value: stats.averageProgress === null ? "—" : `${stats.averageProgress}%`,
            hint: "across their courses",
        },
        { label: "Lessons done", value: stats.lessonsCompleted.toLocaleString(), hint: "completed lessons" },
        {
            label: "Assignment marks",
            value: percentLabel(stats.assignments.averagePercent),
            hint: `${stats.assignments.marked} marked · ${stats.assignments.awaitingReview} waiting${stats.assignments.missed ? ` · ${stats.assignments.missed} missed` : ""}`,
        },
        {
            label: "Quiz average",
            value: percentLabel(stats.quizzes.averagePercent),
            hint: `${stats.quizzes.attempts} ${stats.quizzes.attempts === 1 ? "attempt" : "attempts"}`,
        },
        { label: "XP", value: stats.xp.toLocaleString(), hint: "earned in all" },
        { label: "Certificates", value: stats.certificates, hint: "issued and valid" },
        { label: "Paid", value: formatBDT(stats.paid), hint: `${stats.support.visits} support ${stats.support.visits === 1 ? "visit" : "visits"}` },
    ];

    return (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-4 2xl:grid-cols-8">
            {cells.map((cell) => (
                <div key={cell.label} className="min-w-0 bg-card px-4 py-4">
                    <dt className="truncate text-[11px] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{cell.label}</dt>
                    <dd className="mt-1.5 truncate text-2xl font-bold tabular-nums leading-none">{cell.value}</dd>
                    <dd className="mt-1.5 truncate text-xs text-muted-foreground" title={cell.hint}>{cell.hint}</dd>
                </div>
            ))}
        </dl>
    );
}

function DetailSkeleton() {
    return (
        <div className="space-y-6" aria-busy>
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-60 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-80 rounded-card" />
        </div>
    );
}
