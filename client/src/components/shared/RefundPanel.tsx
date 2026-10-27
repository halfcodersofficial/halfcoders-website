"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useNow } from "@/hooks/useNow";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT, formatDateTime } from "@/lib/utils";
import { refundService } from "@/services";
import type { OrderDetail } from "@/types/learning.types";

/** The refund policy's window, as the API enforces it. */
const WINDOW_MS = 48 * 3_600_000;

/**
 * On a paid order: where its refund request stands, or — within 48 hours of
 * paying — the way to ask for one, as the refund policy describes.
 */
export default function RefundPanel({ order }: { order: OrderDetail }) {
    const queryClient = useQueryClient();
    const now = useNow(60_000);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const requests = useQuery({ queryKey: ["refunds", "mine"], queryFn: refundService.mine });
    const latest = requests.data?.find((request) => request.orderId === order.id && request.status !== "WITHDRAWN");

    const ask = useMutation({
        mutationFn: () => refundService.request(order.id, reason.trim()),
        onSuccess: () => {
            toast.success("Asked — we'll reply within 3–7 days.");
            setOpen(false);
            setReason("");
            void queryClient.invalidateQueries({ queryKey: ["refunds", "mine"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send your request.")),
    });
    const withdraw = useMutation({
        mutationFn: (id: string) => refundService.withdraw(id),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["refunds", "mine"] }),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't withdraw it.")),
    });

    if (requests.isLoading || order.total <= 0) return null;

    if (latest?.status === "PENDING") {
        return (
            <section className="rounded-card border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                <p className="font-medium">Refund requested {formatDateTime(latest.createdAt)}</p>
                <p className="mt-1 text-muted-foreground">We reply within 3–7 days. Until then the course stays open to you.</p>
                <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => withdraw.mutate(latest.id)} isLoading={withdraw.isPending}>
                    Withdraw the request
                </Button>
            </section>
        );
    }

    const paidAt = new Date(order.payment?.paidAt ?? order.createdAt).getTime();
    const deadline = paidAt + WINDOW_MS;
    const canAsk = now < deadline;

    return (
        <>
            {latest?.status === "DECLINED" && (
                <section className="rounded-card border border-border bg-secondary/30 p-4 text-sm">
                    <p className="font-medium">Refund not approved</p>
                    {latest.adminNote && <p className="mt-1 text-muted-foreground">{latest.adminNote}</p>}
                </section>
            )}
            {canAsk && (
                <p className="text-sm text-muted-foreground">
                    Changed your mind? You can ask for a refund until {formatDateTime(new Date(deadline))}.{" "}
                    <button type="button" onClick={() => setOpen(true)} className="font-medium text-primary hover:underline">
                        Request a refund
                    </button>
                </p>
            )}
            <Modal open={open} onOpenChange={setOpen} title="Request a refund" description={`${order.course.title} · ${formatBDT(order.total)}`} closeOnOutsideClick={false}>
                <ModalBody className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Tell us why. We reply within 3–7 days; if it&apos;s approved, your access to the course ends and the money can take 7–65 days to reach you. See the{" "}
                        <Link href="/refund-policy" target="_blank" className="font-medium text-primary hover:underline">
                            refund policy
                        </Link>
                        .
                    </p>
                    <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={2000} placeholder="What happened?" aria-label="Why you'd like a refund" />
                    {reason.trim().length > 0 && reason.trim().length < 10 && <p className="text-xs text-muted-foreground">A sentence or so, please.</p>}
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={reason.trim().length < 10} isLoading={ask.isPending} onClick={() => ask.mutate()}>
                        <Undo2 /> Send request
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
