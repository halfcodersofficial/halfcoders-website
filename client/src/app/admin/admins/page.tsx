"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateAdminModal from "@/components/admin/CreateAdminModal";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { elapsed } from "@/components/mentor/dashboard/time";
import RoleGuard from "@/components/shared/RoleGuard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/hooks/useSession";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminDirectoryEntry } from "@/types/admin.types";

const FILTERS = [
    { value: "", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "BLOCKED", label: "Suspended" },
];

/**
 * Everyone who runs Half Coders: who they are, whether they've opened the
 * console, when they last did anything in it. A super admin adds admins here
 * (on a temporary password) and can suspend an admin's access (it's checked on
 * every request) and restore it.
 */
export default function AdminDirectoryPage() {
    return (
        <RoleGuard allow={["SUPER_ADMIN"]}>
            <Directory />
        </RoleGuard>
    );
}

function Directory() {
    const queryClient = useQueryClient();
    const now = useNow(60_000);
    const { user } = useSession();
    const [status, setStatus] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [adding, setAdding] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "admins", { status, searchTerm, page }],
        queryFn: () => adminService.admins({ status: status || undefined, searchTerm: searchTerm || undefined, page, limit: 25 }),
    });
    const admins = data?.data ?? [];

    const setAccess = useMutation({
        mutationFn: ({ admin, next }: { admin: AdminDirectoryEntry; next: "ACTIVE" | "BLOCKED" }) => adminService.setUserStatus(admin.id, next),
        onSuccess: (_, { admin, next }) => {
            toast.success(next === "BLOCKED" ? `${admin.name} can no longer open Half Coders.` : `${admin.name}'s Half Coders access is back.`);
            void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change their access.")),
    });
    const suspend = async (admin: AdminDirectoryEntry) => {
        const ok = await confirmAction({
            title: `Suspend ${admin.name}'s Half Coders access?`,
            text: "They're signed out of the Half Coders console at once. Their account and admin role stay as they are, so you can restore their access later.",
            confirmText: "Suspend access",
        });
        if (ok) setAccess.mutate({ admin, next: "BLOCKED" });
    };
    const busy = (id: string) => setAccess.isPending && setAccess.variables?.admin.id === id;

    const columns: Column<AdminDirectoryEntry>[] = [
        {
            id: "admin",
            header: "Admin",
            primary: true,
            sortable: true,
            sortValue: (admin) => admin.name,
            cell: (admin) => (
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={admin.image} name={admin.name} size={36} />
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium">
                            <span className="truncate">{admin.name}</span>
                            {admin.id === user?.id && <span className="shrink-0 rounded-full bg-secondary px-2 py-px text-[0.6875rem] font-medium text-muted-foreground">You</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                </div>
            ),
        },
        {
            id: "role",
            header: "Role",
            sortable: true,
            sortValue: (admin) => admin.role,
            cell: (admin) => (
                <span
                    className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        admin.role === "SUPER_ADMIN" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
                    )}
                >
                    {admin.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
                </span>
            ),
        },
        {
            id: "access",
            header: "Half Coders access",
            cell: (admin) =>
                admin.status !== "ACTIVE" ? (
                    <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">Suspended</span>
                ) : admin.hasOpenedHalfCoders ? (
                    <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Active</span>
                ) : (
                    <span className="text-xs text-muted-foreground">Hasn&apos;t opened Half Coders yet</span>
                ),
        },
        {
            id: "since",
            header: "On Half Coders since",
            className: "whitespace-nowrap",
            hideOnMobile: true,
            cell: (admin) => (admin.hasOpenedHalfCoders ? formatDate(admin.createdAt) : <span className="text-muted-foreground">—</span>),
        },
        {
            id: "last",
            header: "Last console action",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (admin) => (admin.lastActionAt ? new Date(admin.lastActionAt) : new Date(0)),
            cell: (admin) =>
                admin.lastActionAt ? (
                    <span title={formatDate(admin.lastActionAt)}>{elapsed(admin.lastActionAt, now).text} ago</span>
                ) : (
                    <span className="text-muted-foreground">None yet</span>
                ),
        },
    ];

    const actions = (admin: AdminDirectoryEntry) => {
        // Super admins, and the super admin looking, can't be suspended from here.
        if (admin.role === "SUPER_ADMIN" || admin.id === user?.id) {
            return <span className="text-xs text-muted-foreground">Super admin</span>;
        }
        return admin.status === "BLOCKED" ? (
            <Button size="sm" variant="outline" isLoading={busy(admin.id)} onClick={() => setAccess.mutate({ admin, next: "ACTIVE" })}>
                {!busy(admin.id) && <CheckCircle2 />} Restore access
            </Button>
        ) : (
            <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                isLoading={busy(admin.id)}
                onClick={() => void suspend(admin)}
            >
                {!busy(admin.id) && <Ban />} Suspend
            </Button>
        );
    };

    const filtered = Boolean(status || searchTerm);

    return (
        <DataShell
            title="Admins"
            description="Everyone who runs Half Coders. Add an admin, or suspend and restore an admin's access."
            action={
                <Button onClick={() => setAdding(true)}>
                    <UserPlus /> Add admin
                </Button>
            }
            searchPlaceholder="Search by name or email…"
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
            isEmpty={admins.length === 0}
            emptyMessage={filtered ? "No admins match." : "No admins yet."}
            emptyHint={filtered ? "Try a different search or filter." : "Add an admin and they appear here."}
            meta={data?.meta}
            onPage={setPage}
        >
            <DataTable rows={admins} columns={columns} rowKey={(admin) => admin.id} actions={actions} />
            <CreateAdminModal open={adding} onOpenChange={setAdding} />
        </DataShell>
    );
}
