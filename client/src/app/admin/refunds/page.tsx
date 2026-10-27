"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import DataShell from "@/components/admin/DataShell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminRefundRequest } from "@/types/admin.types";

const STATUS: Record<AdminRefundRequest["status"], { label: string; tone: string }> = {
    PENDING: { label: "Waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    APPROVED: { label: "Refunded", tone: "bg-success/10 text-success" },
    DECLINED: { label: "Declined", tone: "bg-destructive/10 text-destructive" },
    WITHDRAWN: { label: "Withdrawn", tone: "bg-secondary text-muted-foreground" },
};

type Deciding = { request: AdminRefundRequest; decision: "APPROVE" | "DECLINE" };

/**
 * Students' refund requests, waiting ones first, oldest first. Approving
 * refunds the order — the course closes to them, their history stays — and
 * declining needs a reason; the student is told either way, by email too.
 * The money itself goes back through the gateway or by hand, as before.
 */
export default function AdminRefundsPage() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("PENDING");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [deciding, setDeciding] = useState<Deciding | null>(null);
    const [note, setNote] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "refunds", { status, searchTerm, page }],
        queryFn: () => adminService.refundRequests({ status: status || undefined, searchTerm: searchTerm || undefined, page, limit: 20 }),
    });
    const counts = useQuery({ queryKey: ["admin", "refunds", "counts"], queryFn: adminService.refundRequestCounts });

    const decide = useMutation({
        mutationFn: ({ request, decision }: Deciding) => adminService.decideRefund(request.id, decision, note.trim() || undefined),
        onSuccess: (_, { decision }) => {
            toast.success(decision === "APPROVE" ? "Refunded — the order's closed and the student has been told." : "Declined — the student has been told why.");
            setDeciding(null);
            setNote("");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't record that.")),
    });

    const requests = data?.data ?? [];

    return (
        <>
            <DataShell
                title="Refund requests"
                description="What students asked for back, within the policy's 48 hours of paying. Approve to refund the order, or decline with a reason they'll read."
                searchPlaceholder="Search by student, order number or reason…"
                onSearch={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
                filters={[
                    { value: "PENDING", label: "Waiting", count: counts.data?.PENDING },
                    { value: "APPROVED", label: "Refunded", count: counts.data?.APPROVED },
                    { value: "DECLINED", label: "Declined", count: counts.data?.DECLINED },
                    { value: "", label: "All" },
                ]}
                activeFilter={status}
                onFilter={(value) => {
                    setStatus(value);
                    setPage(1);
                }}
                isLoading={isLoading}
                isEmpty={requests.length === 0}
                emptyMessage={status === "PENDING" ? "Nothing waiting" : "No requests here"}
                emptyHint={status === "PENDING" ? "Students ask from their order page, within 48 hours of paying." : "Try another tab."}
                meta={data?.meta}
                onPage={setPage}
            >
                <ul className="space-y-3">
                    {requests.map((request) => (
                        <li key={request.id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                            <div className="flex flex-wrap items-start gap-3">
                                <Avatar src={request.student.image} name={request.student.name} size={36} />
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-medium">{request.student.name}</span>
                                        <span className="text-sm text-muted-foreground">{request.student.email}</span>
                                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[request.status].tone)}>{STATUS[request.status].label}</span>
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        <Link
                                            href={`/admin/orders/${request.order.courseId}?q=${encodeURIComponent(request.order.orderNumber)}&open=${request.order.id}`}
                                            className="font-mono font-semibold hover:underline"
                                        >
                                            {request.order.orderNumber}
                                        </Link>{" "}
                                        · {request.order.course.title} · {formatBDT(request.order.total)} · paid{" "}
                                        {formatDateTime(request.order.payment?.paidAt ?? request.order.createdAt)} · asked {formatDateTime(request.createdAt)}
                                    </p>
                                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">“{request.reason}”</p>
                                    {request.adminNote && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">{request.decidedBy?.name ?? "Admin"}:</span> {request.adminNote}
                                        </p>
                                    )}
                                </div>
                                {request.status === "PENDING" && (
                                    <div className="flex shrink-0 gap-2">
                                        <Button size="sm" onClick={() => setDeciding({ request, decision: "APPROVE" })}>
                                            <Check /> Approve
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setDeciding({ request, decision: "DECLINE" })}>
                                            <X /> Decline
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </DataShell>

            <Modal
                open={deciding !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeciding(null);
                        setNote("");
                    }
                }}
                title={deciding?.decision === "APPROVE" ? `Refund ${deciding.request.order.orderNumber}?` : `Decline ${deciding?.request.order.orderNumber ?? ""}?`}
                description={
                    deciding?.decision === "APPROVE"
                        ? `${deciding.request.student.name} loses access to ${deciding.request.order.course.title}. Send the ${formatBDT(deciding.request.order.total)} back through the gateway or by hand, as usual.`
                        : "Tell the student why — they read this."
                }
            >
                <ModalBody>
                    <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder={deciding?.decision === "APPROVE" ? "A note for the student (optional)" : "Why it isn't approved…"}
                        aria-label="Note for the student"
                    />
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={() => setDeciding(null)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant={deciding?.decision === "DECLINE" ? "destructive" : "default"}
                        disabled={deciding?.decision === "DECLINE" && !note.trim()}
                        isLoading={decide.isPending}
                        onClick={() => deciding && decide.mutate(deciding)}
                    >
                        {deciding?.decision === "APPROVE" ? "Refund the order" : "Decline"}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
