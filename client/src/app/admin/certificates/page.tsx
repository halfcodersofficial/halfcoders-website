"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, RotateCcw, ShieldX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import IssueCertificateModal from "@/components/admin/IssueCertificateModal";
import RowActions from "@/components/admin/RowActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { useRetained } from "@/hooks/useRetained";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatDate } from "@/lib/utils";
import { textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminCertificate } from "@/types/admin.types";

const FILTERS = [
    { value: "", label: "All" },
    { value: "ISSUED", label: "Valid" },
    { value: "REVOKED", label: "Revoked" },
];

const revokeSchema = z.object({
    reason: textField({ label: "Reason", min: 3, max: 500 }),
});

/**
 * Revoking asks for a reason: the student is notified with it and it appears
 * on the public verification page, so it needs the same length rule and
 * visible error as any other field.
 */
function RevokeForm({ certificate, onClose }: { certificate: AdminCertificate; onClose: () => void }) {
    const queryClient = useQueryClient();

    const revoke = useMutation({
        mutationFn: (reason: string) => adminService.revokeCertificate(certificate.id, reason),
        onSuccess: () => {
            toast.success("Certificate revoked — its verification page now says so.");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't revoke that certificate.")),
    });

    const form = useZodForm({
        schema: revokeSchema,
        initialValues: { reason: "" },
        onSubmit: (values) => revoke.mutate(values.reason),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-secondary/40 p-4 text-sm">
                    <dt className="text-muted-foreground">Certificate</dt>
                    <dd className="font-mono text-xs">{certificate.certificateNo}</dd>
                    <dt className="text-muted-foreground">Student</dt>
                    <dd className="min-w-0 truncate">{certificate.studentName}</dd>
                    <dt className="text-muted-foreground">Course</dt>
                    <dd className="min-w-0 truncate">{certificate.courseName}</dd>
                </dl>

                <FormField
                    form={form}
                    name="reason"
                    label="Reason"
                    required
                    counterMax={500}
                    hint="The student is notified with this text, and it appears on the public verification page."
                >
                    <Textarea rows={3} autoFocus placeholder="Issued in error — the enrolment was refunded." />
                </FormField>

                <p className="text-xs text-muted-foreground">
                    Revoking is reversible: the certificate can be restored from this screen later.
                </p>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" variant="destructive" isLoading={revoke.isPending}>
                    <ShieldX /> Revoke certificate
                </Button>
            </ModalFooter>
        </form>
    );
}

export default function AdminCertificatesPage() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [issuing, setIssuing] = useState(false);
    const [revoking, setRevoking] = useState<AdminCertificate | null>(null);
    // What the revoke modal shows — kept while it animates closed.
    const shownRevoking = useRetained(revoking);

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "certificates", { status, searchTerm, page }],
        queryFn: () =>
            adminService.certificates({
                status: status || undefined,
                searchTerm: searchTerm || undefined,
                page,
                limit: 20,
            }),
    });

    const restore = useMutation({
        mutationFn: (id: string) => adminService.restoreCertificate(id),
        onSuccess: () => {
            toast.success("Certificate restored.");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't restore that certificate.")),
    });

    const certificates = data?.data ?? [];
    const filtered = Boolean(status || searchTerm);

    const columns: Column<AdminCertificate>[] = [
        {
            id: "student",
            header: "Student",
            primary: true,
            cell: (certificate) => (
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                        src={certificate.student?.image ?? null}
                        name={certificate.studentName}
                        size={36}
                    />
                    <div className="min-w-0">
                        <p className="truncate font-medium">{certificate.studentName}</p>
                        {certificate.student?.email && (
                            <p className="truncate text-xs text-muted-foreground">{certificate.student.email}</p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            id: "course",
            header: "Course",
            cell: (certificate) => <span className="line-clamp-2">{certificate.courseName}</span>,
        },
        {
            id: "number",
            header: "Certificate",
            className: "whitespace-nowrap",
            cell: (certificate) => <span className="font-mono text-xs">{certificate.certificateNo}</span>,
        },
        {
            id: "issued",
            header: "Issued",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (certificate) => new Date(certificate.issuedAt),
            cell: (certificate) => formatDate(certificate.issuedAt),
        },
        {
            id: "status",
            header: "Status",
            cell: (certificate) => <StatusPill kind="certificate" value={certificate.status} />,
        },
    ];

    const actions = (certificate: AdminCertificate) => (
        <RowActions
            primary={
                <Button asChild size="sm" variant="outline">
                    <Link href={`/certificate/${certificate.certificateNo}`} target="_blank" rel="noopener noreferrer">
                        Verify <ExternalLink className="size-3.5" />
                    </Link>
                </Button>
            }
            items={[
                certificate.status === "ISSUED"
                    ? {
                        label: "Revoke",
                        icon: ShieldX,
                        destructive: true,
                        onSelect: () => setRevoking(certificate),
                    }
                    : {
                        label: "Restore",
                        icon: RotateCcw,
                        onSelect: () => restore.mutate(certificate.id),
                    },
            ]}
        />
    );

    const issueButton = (
        <Button variant="outline" onClick={() => setIssuing(true)}>
            <Plus /> Issue a certificate
        </Button>
    );

    return (
        <>
            <DataShell
                exportCsv={{ path: "/certificates/manage/export", params: { status: status || undefined, searchTerm: searchTerm || undefined } }}
                title="Certificates"
                description="Every certificate issued, and whether it still verifies."
                action={issueButton}
                searchPlaceholder="Search by certificate ID, student or course…"
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
                isEmpty={certificates.length === 0}
                emptyMessage={filtered ? "No certificates match." : "No certificates issued yet."}
                emptyHint={
                    filtered
                        ? "Try a different search or filter."
                        : "Students claim their own once they finish a course. You can also issue one by hand."
                }
                emptyAction={filtered ? undefined : issueButton}
                meta={data?.meta}
                onPage={setPage}
            >
                <DataTable
                    rows={certificates}
                    columns={columns}
                    rowKey={(certificate) => certificate.id}
                    actions={actions}
                />
            </DataShell>

            <IssueCertificateModal open={issuing} onOpenChange={setIssuing} />

            <Modal
                open={revoking !== null}
                onOpenChange={(open) => !open && setRevoking(null)}
                closeOnOutsideClick={false}
                title="Revoke certificate"
                description="The verification page will show it as revoked."
            >
                {shownRevoking && <RevokeForm certificate={shownRevoking} onClose={() => setRevoking(null)} />}
            </Modal>
        </>
    );
}
