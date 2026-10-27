"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, BookOpen, CheckCircle2, Eye, KeyRound, Link2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AssignMentorModal from "@/components/admin/AssignMentorModal";
import CreateMentorModal from "@/components/admin/CreateMentorModal";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import EditMentorModal from "@/components/admin/EditMentorModal";
import RowActions from "@/components/admin/RowActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { useMentorActions } from "@/components/admin/useMentorActions";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminUser } from "@/types/admin.types";

const FILTERS = [
    { value: "", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "BLOCKED", label: "Blocked" },
];

export default function AdminMentorsPage() {
    const [status, setStatus] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [view, setView] = useState<ViewMode>("grid");

    const [creating, setCreating] = useState(false);
    // The mentor in the edit modal. Kept after it closes, so the modal doesn't
    // go blank while it animates out.
    const [editing, setEditing] = useState<{ id: string; open: boolean } | null>(null);
    const openEdit = (id: string) => setEditing({ id, open: true });
    // `null` closed, otherwise the mentor being assigned to a course.
    const [assigning, setAssigning] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "mentors", { status, searchTerm, page }],
        queryFn: () =>
            adminService.mentors({
                status: status || undefined,
                searchTerm: searchTerm || undefined,
                page,
                limit: 20,
            }),
    });

    const mentorActions = useMentorActions();

    const mentors = data?.data ?? [];
    const filtered = Boolean(status || searchTerm);

    const columns: Column<AdminUser>[] = [
        {
            id: "mentor",
            header: "Mentor",
            primary: true,
            sortable: true,
            sortValue: (mentor) => mentor.name,
            cell: (mentor) => (
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={mentor.image} name={mentor.name} size={36} />
                    <div className="min-w-0">
                        <Link
                            href={`/admin/mentors/${mentor.id}`}
                            className="block truncate font-medium hover:underline"
                        >
                            {mentor.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{mentor.email}</p>
                    </div>
                </div>
            ),
        },
        {
            id: "designation",
            header: "Designation",
            cell: (mentor) =>
                mentor.mentorProfile?.designation ?? <span className="text-muted-foreground">—</span>,
        },
        {
            id: "expertise",
            header: "Expertise",
            cell: (mentor) => {
                const skills = mentor.mentorProfile?.expertise ?? [];
                if (skills.length === 0) return <span className="text-muted-foreground">—</span>;
                return <ExpertiseBadges skills={skills} />;
            },
        },
        {
            id: "courses",
            header: "Courses",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (mentor) => mentor._count?.mentoredCourses ?? 0,
            cell: (mentor) => mentor._count?.mentoredCourses ?? 0,
        },
        {
            id: "status",
            header: "Status",
            cell: (mentor) => <StatusPill kind="user" value={mentor.status} />,
        },
    ];

    const actions = (mentor: AdminUser) => {
        const isActive = mentor.status === "ACTIVE";

        return (
            <RowActions
                primary={
                    <Button size="sm" variant="outline" onClick={() => openEdit(mentor.id)}>
                        <Pencil /> Edit
                    </Button>
                }
                items={[
                    {
                        label: "View details",
                        icon: Eye,
                        href: `/admin/mentors/${mentor.id}`,
                    },
                    {
                        label: "Assign to course",
                        icon: Link2,
                        onSelect: () => setAssigning(mentor.id),
                    },
                    isActive
                        ? {
                            label: "Block",
                            icon: Ban,
                            destructive: true,
                            separatorBefore: true,
                            onSelect: () => void mentorActions.block(mentor),
                        }
                        : {
                            label: "Reactivate",
                            icon: CheckCircle2,
                            separatorBefore: true,
                            onSelect: () => mentorActions.reactivate(mentor),
                        },
                    {
                        label: "Reset password",
                        icon: KeyRound,
                        onSelect: () => void mentorActions.resetPassword(mentor),
                    },
                ]}
            />
        );
    };

    // Everything in the table's ⋯ menu, out on the card: the rarer actions as
    // icon buttons on the left, Edit on the right.
    const cardActions = (mentor: AdminUser) => {
        const isActive = mentor.status === "ACTIVE";
        const resetting = mentorActions.isResetting(mentor.id);
        const changingStatus = mentorActions.isChangingStatus(mentor.id);

        return (
            <div className="flex items-center gap-1">
                <Button
                    size="sm"
                    variant="ghost"
                    className="w-9 px-0"
                    title="Reset password"
                    aria-label={`Send ${mentor.name} a password reset link`}
                    isLoading={resetting}
                    onClick={() => void mentorActions.resetPassword(mentor)}
                >
                    {!resetting && <KeyRound />}
                </Button>
                {isActive ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="w-9 px-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Block"
                        aria-label={`Block ${mentor.name}`}
                        isLoading={changingStatus}
                        onClick={() => void mentorActions.block(mentor)}
                    >
                        {!changingStatus && <Ban />}
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="w-9 px-0"
                        title="Reactivate"
                        aria-label={`Reactivate ${mentor.name}`}
                        isLoading={changingStatus}
                        onClick={() => mentorActions.reactivate(mentor)}
                    >
                        {!changingStatus && <CheckCircle2 />}
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    className="w-9 px-0"
                    title="Assign to course"
                    aria-label={`Assign ${mentor.name} to a course`}
                    onClick={() => setAssigning(mentor.id)}
                >
                    <Link2 />
                </Button>
                <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link href={`/admin/mentors/${mentor.id}`}>
                        <Eye /> Details
                    </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(mentor.id)}>
                    <Pencil /> Edit
                </Button>
            </div>
        );
    };

    const newMentorButton = (
        <Button onClick={() => setCreating(true)}>
            <Plus /> New mentor
        </Button>
    );

    return (
        <>
            <DataShell
                title="Mentors"
                description="Mentor accounts. Assign them to courses here or from each course's editor."
                action={
                    <div className="flex items-center gap-2">
                        <ViewToggle value={view} onChange={setView} />
                        {newMentorButton}
                    </div>
                }
                searchPlaceholder="Search by name, email or designation…"
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
                isEmpty={mentors.length === 0}
                emptyMessage={filtered ? "No mentors match." : "No mentors yet."}
                emptyHint={
                    filtered
                        ? "Try a different search or filter."
                        : "Create a mentor account, then assign them to a course."
                }
                emptyAction={filtered ? undefined : newMentorButton}
                meta={data?.meta}
                onPage={setPage}
            >
                {view === "grid" ? (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {mentors.map((mentor) => {
                            const skills = mentor.mentorProfile?.expertise ?? [];
                            const headline = [mentor.mentorProfile?.designation, mentor.mentorProfile?.experience]
                                .filter(Boolean)
                                .join(" · ");
                            const courses = mentor._count?.mentoredCourses ?? 0;

                            return (
                                <li key={mentor.id}>
                                    <Card
                                        className={cn(
                                            "flex h-full flex-col shadow-sm",
                                            mentor.status !== "ACTIVE" && "bg-secondary/30",
                                        )}
                                    >
                                        <CardContent className="flex flex-1 flex-col gap-4 p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <Avatar
                                                    src={mentor.image}
                                                    name={mentor.name}
                                                    size={56}
                                                    className="shrink-0"
                                                />
                                                <StatusPill kind="user" value={mentor.status} />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/admin/mentors/${mentor.id}`}
                                                    title={mentor.name}
                                                    className="block max-w-full truncate font-medium hover:underline"
                                                >
                                                    {mentor.name}
                                                </Link>
                                                <p className="truncate text-xs text-muted-foreground">{mentor.email}</p>
                                                <p
                                                    className={cn(
                                                        "mt-2 line-clamp-2 text-sm",
                                                        !headline && "text-muted-foreground",
                                                    )}
                                                >
                                                    {headline || "No designation yet"}
                                                </p>
                                                {skills.length > 0 && (
                                                    <div className="mt-3">
                                                        <ExpertiseBadges skills={skills} />
                                                    </div>
                                                )}
                                            </div>

                                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <BookOpen className="size-3.5" aria-hidden />
                                                {courses} {courses === 1 ? "course" : "courses"}
                                            </p>

                                            <div className="border-t border-border pt-4">{cardActions(mentor)}</div>
                                        </CardContent>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <DataTable rows={mentors} columns={columns} rowKey={(mentor) => mentor.id} actions={actions} />
                )}
            </DataShell>

            <CreateMentorModal open={creating} onOpenChange={setCreating} />

            <EditMentorModal
                open={editing?.open ?? false}
                onOpenChange={(open) => !open && setEditing((current) => current && { ...current, open: false })}
                mentorId={editing?.id ?? null}
            />

            <AssignMentorModal
                open={assigning !== null}
                onOpenChange={(open) => !open && setAssigning(null)}
                mentorId={assigning}
            />
        </>
    );
}

/** The first three skills as tags, then how many more. */
function ExpertiseBadges({ skills }: { skills: string[] }) {
    return (
        <div className="flex flex-wrap gap-1">
            {skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
            {skills.length > 3 && <Badge variant="outline">+{skills.length - 3}</Badge>}
        </div>
    );
}
