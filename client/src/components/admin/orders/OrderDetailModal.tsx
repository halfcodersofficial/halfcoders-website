"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    ArrowLeft,
    CheckCircle2,
    CircleDollarSign,
    Copy,
    ExternalLink,
    GraduationCap,
    Mail,
    Phone,
    ReceiptText,
    TicketPercent,
    Undo2,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { StatusPill } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle, modalFormClass } from "@/components/ui/modal";
import { useRetained } from "@/hooks/useRetained";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import { optionalTextField, selectField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminOrder } from "@/types/admin.types";
import { bkashSentIn, GATEWAYS, gatewayLabel, ORDER_TONE } from "./orderMeta";
import { useOrderActions } from "./useOrderActions";

const settleSchema = z.object({
    gateway: selectField("Choose how the student paid"),
    // Optional, but a transaction id is the only trail back to the payment,
    // so anything typed has to be long enough to be one.
    transactionId: optionalTextField({ label: "Transaction ID", max: 120 }).refine(
        (value) => value === "" || value.length >= 4,
        { message: "A transaction ID is at least 4 characters — leave it blank if you don't have one" },
    ),
});

/**
 * Confirming a payment by hand — the busiest form in the console. Usually a
 * bKash payment the student sent in: it opens with their transaction ID
 * filled in and what to match it against on the merchant statement. Also
 * takes a payment made some other way (cash, bank), typed in from scratch.
 */
function SettleForm({ order, onBack, onDone }: { order: AdminOrder; onBack?: () => void; onDone: () => void }) {
    const queryClient = useQueryClient();
    const sentIn = bkashSentIn(order.payment);

    const settle = useMutation({
        mutationFn: (values: z.output<typeof settleSchema>) =>
            adminService.markOrderPaid(order.id, {
                gateway: values.gateway,
                transactionId: values.transactionId || undefined,
            }),
        onSuccess: () => {
            toast.success(`Payment confirmed — ${order.student.name} is now enrolled.`);
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't confirm that payment.")),
    });

    const form = useZodForm({
        schema: settleSchema,
        initialValues: { gateway: "BKASH", transactionId: sentIn?.transactionId ?? "" },
        onSubmit: (values) => settle.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-5">
                <div className="flex items-center gap-3 rounded-card bg-secondary/50 p-4">
                    <Avatar src={order.student.image} name={order.student.name} size={40} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{order.student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{order.course.title}</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{formatBDT(order.total)}</p>
                </div>

                {sentIn && (
                    <div className="rounded-card border border-primary/25 bg-primary/5 p-4 text-sm">
                        <p className="font-semibold">Check the bKash merchant statement for a payment with:</p>
                        <ul className="mt-2 space-y-1 text-muted-foreground">
                            <li>
                                TrxID <span className="font-mono font-semibold text-foreground">{sentIn.transactionId}</span>
                            </li>
                            <li>
                                Amount <span className="font-semibold text-foreground">{formatBDT(order.total)}</span>
                            </li>
                            {sentIn.senderNumber && (
                                <li>
                                    From <span className="font-mono font-semibold text-foreground">{sentIn.senderNumber}</span>
                                </li>
                            )}
                            <li>
                                Reference <span className="font-mono font-semibold text-foreground">{order.orderNumber}</span> (if they added it)
                            </li>
                        </ul>
                    </div>
                )}

                <FormField form={form} name="gateway" label="Paid via" required>
                    <Select autoFocus>
                        {GATEWAYS.map((gateway) => (
                            <option key={gateway.value} value={gateway.value}>
                                {gateway.label}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField form={form} name="transactionId" label="Transaction ID" optional hint="The bKash TrxID, or a receipt number for cash or bank.">
                    <Input autoComplete="off" spellCheck={false} className="font-mono" placeholder="e.g. BKX7H3QK21" />
                </FormField>

                <p className="text-xs text-muted-foreground">
                    Confirming enrols {order.student.name} straight away. It can only be undone with a refund.
                </p>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onBack ?? onDone}>
                    {onBack ? (
                        <>
                            <ArrowLeft /> Back
                        </>
                    ) : (
                        "Cancel"
                    )}
                </Button>
                <Button type="submit" isLoading={settle.isPending}>
                    <CheckCircle2 /> {sentIn ? "Verify and enrol" : "Confirm payment"}
                </Button>
            </ModalFooter>
        </form>
    );
}

type Step = { title: string; detail?: ReactNode; at?: string | null; tone: "done" | "current" | "bad" | "muted" };

/** What happened to the order, oldest first, ending where it stands now. */
function orderSteps(order: AdminOrder): Step[] {
    const steps: Step[] = [{ title: "Order placed", at: order.createdAt, tone: "done" }];
    const payment = order.payment;
    const sentIn = bkashSentIn(payment);

    switch (order.status) {
        case "PENDING":
            if (sentIn) {
                steps.push({
                    title: "bKash payment sent in",
                    detail: `TrxID ${sentIn.transactionId}${sentIn.senderNumber ? `, from ${sentIn.senderNumber}` : ""}.`,
                    at: sentIn.submittedAt,
                    tone: "done",
                });
                steps.push({ title: "Awaiting verification", detail: "Match it on the bKash merchant statement, then verify it.", tone: "current" });
            } else {
                steps.push({ title: "Awaiting payment", detail: "The student hasn't sent in a bKash payment yet.", tone: "current" });
            }
            break;
        case "PAID":
            steps.push({
                title: payment ? `Paid via ${gatewayLabel(payment.gateway)}` : "Paid",
                at: payment?.paidAt ?? order.updatedAt,
                tone: "done",
            });
            break;
        case "FAILED":
            steps.push({ title: "Payment failed", detail: payment?.failureReason ?? undefined, at: order.updatedAt, tone: "bad" });
            break;
        case "REFUNDED":
            if (payment?.paidAt) steps.push({ title: `Paid via ${gatewayLabel(payment.gateway)}`, at: payment.paidAt, tone: "done" });
            steps.push({ title: "Refunded", detail: payment?.failureReason ?? undefined, at: order.updatedAt, tone: "muted" });
            break;
        case "CANCELLED":
            steps.push({ title: "Cancelled", at: order.updatedAt, tone: "muted" });
            break;
    }

    if (order.enrollment && order.status === "PAID") {
        steps.push({
            title: order.enrollment.status === "COMPLETED" ? "Course completed" : "Enrolled",
            detail: `${order.enrollment.progress}% through the course`,
            tone: "done",
        });
    }
    return steps;
}

const STEP_DOT: Record<Step["tone"], string> = {
    done: "bg-success ring-success/20",
    current: "bg-amber-500 ring-amber-500/25",
    bad: "bg-destructive ring-destructive/20",
    muted: "bg-muted-foreground/60 ring-muted-foreground/15",
};

function Timeline({ order }: { order: AdminOrder }) {
    const steps = orderSteps(order);
    return (
        <ol className="relative space-y-4">
            {steps.map((step, index) => (
                <li key={step.title} className="relative flex gap-3 pl-0.5">
                    {index < steps.length - 1 && (
                        <span aria-hidden className="absolute left-[0.4375rem] top-4 h-[calc(100%+0.25rem)] w-px bg-border" />
                    )}
                    <span className={cn("relative mt-1 size-3 shrink-0 rounded-full ring-4", STEP_DOT[step.tone])}>
                        {step.tone === "current" && (
                            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60 motion-reduce:animate-none" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{step.title}</p>
                        {step.at && (
                            <time className="block text-xs text-muted-foreground" dateTime={step.at}>
                                {formatDateTime(step.at)}
                            </time>
                        )}
                        {step.detail && <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>}
                    </div>
                </li>
            ))}
        </ol>
    );
}

function Section({ title, icon: Icon, children, action }: { title: string; icon: typeof Mail; children: ReactNode; action?: ReactNode }) {
    return (
        <section className="rounded-card border border-border">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 bg-surface">
                <h3 className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                    <Icon className="size-3.5" /> {title}
                </h3>
                {action}
            </header>
            <div className="p-4">{children}</div>
        </section>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right">{children}</dd>
        </div>
    );
}

function OrderDetail({ order }: { order: AdminOrder }) {
    const payment = order.payment;
    const sentIn = bkashSentIn(payment);
    const contactEmail = order.student.learningProfile?.contactEmail ?? order.student.email;
    const contactPhone = order.student.learningProfile?.whatsapp ?? order.student.phone;
    const copy = (value: string) =>
        navigator.clipboard.writeText(value).then(
            () => toast.success("Copied."),
            () => toast.error("Couldn't copy."),
        );

    return (
        <ModalBody className="space-y-4">
            {/* Where the order stands, with the money it's about. */}
            <div className="relative overflow-hidden rounded-card border border-border bg-secondary/30 p-4">
                <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", ORDER_TONE[order.status].fill)} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-3xl font-bold tabular-nums tracking-tight">{formatBDT(order.total)}</p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{order.course.title}</p>
                    </div>
                    <StatusPill kind="order" value={order.status} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Timeline" icon={ReceiptText}>
                    <Timeline order={order} />
                </Section>

                <Section
                    title="Student"
                    icon={GraduationCap}
                    action={
                        <Link
                            href={`/admin/students/${order.student.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                            Open <ExternalLink className="size-3" />
                        </Link>
                    }
                >
                    <div className="flex items-center gap-3">
                        <Avatar src={order.student.image} name={order.student.name} size={44} />
                        <p className="min-w-0 truncate font-semibold">{order.student.name}</p>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                        <li className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <a href={`mailto:${contactEmail}`} className="truncate hover:text-foreground hover:underline">
                                {contactEmail}
                            </a>
                        </li>
                        {contactPhone && (
                            <li className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="size-3.5 shrink-0" />
                                <a href={`tel:${contactPhone}`} className="tabular-nums hover:text-foreground hover:underline">
                                    {contactPhone}
                                </a>
                            </li>
                        )}
                    </ul>
                    {order.enrollment && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs">
                                <StatusPill kind="enrollment" value={order.enrollment.status} />
                                <span className="font-semibold tabular-nums">{order.enrollment.progress}%</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${order.enrollment.progress}%` }} />
                            </div>
                        </div>
                    )}
                </Section>
            </div>

            <Section title="Amount" icon={CircleDollarSign}>
                <dl>
                    <Row label="Course price">{formatBDT(order.amount)}</Row>
                    {order.discount > 0 && (
                        <Row label="Discount">
                            <span className="inline-flex items-center gap-2">
                                {order.couponCode && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                                        <TicketPercent className="size-3" /> {order.couponCode}
                                    </span>
                                )}
                                <span className="text-success">−{formatBDT(order.discount)}</span>
                            </span>
                        </Row>
                    )}
                    <div className="mt-1 border-t border-dashed border-border pt-1">
                        <Row label="Total">
                            <span className="text-base font-bold tabular-nums">{formatBDT(order.total)}</span>
                        </Row>
                    </div>
                </dl>
            </Section>

            {payment && (
                <Section title="Payment" icon={ReceiptText}>
                    <dl>
                        <Row label="Method">{gatewayLabel(payment.gateway)}</Row>
                        <Row label="Transaction ID">
                            {payment.transactionId ? (
                                <button
                                    type="button"
                                    onClick={() => copy(payment.transactionId!)}
                                    className="group inline-flex max-w-full items-center gap-1.5 font-mono text-xs hover:text-primary"
                                    title="Copy"
                                >
                                    <span className="truncate">{payment.transactionId}</span>
                                    <Copy className="size-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                                </button>
                            ) : (
                                <span className="text-muted-foreground">Not recorded</span>
                            )}
                        </Row>
                        {sentIn?.senderNumber && (
                            <Row label="Sent from">
                                <span className="font-mono text-xs">{sentIn.senderNumber}</span>
                            </Row>
                        )}
                        {sentIn?.submittedAt && <Row label="Sent in">{formatDateTime(sentIn.submittedAt)}</Row>}
                        {payment.paidAt && (
                            <Row label="Paid">
                                {formatDateTime(payment.paidAt)}{" "}
                                <span className="text-xs text-muted-foreground">
                                    ({formatDistanceToNow(new Date(payment.paidAt), { addSuffix: true })})
                                </span>
                            </Row>
                        )}
                        {payment.amount !== order.total && <Row label="Amount received">{formatBDT(payment.amount)}</Row>}
                        {payment.failureReason && <Row label="Note">{payment.failureReason}</Row>}
                    </dl>
                    {payment.gatewayData != null && (
                        <details className="group mt-3 rounded-md bg-secondary/50">
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                                Raw payment data
                            </summary>
                            <pre className="max-h-56 overflow-auto px-3 pb-3 font-mono text-[0.6875rem] leading-relaxed">
                                {JSON.stringify(payment.gatewayData, null, 2)}
                            </pre>
                        </details>
                    )}
                </Section>
            )}
        </ModalBody>
    );
}

/**
 * One order in full: where it stands and how it got there, who placed it,
 * what they paid and through what. Confirming a payment swaps the detail for
 * the settle form in the same popup; failing and refunding confirm first.
 */
export function OrderDetailModal({
    order,
    mode,
    onModeChange,
    onClose,
}: {
    order: AdminOrder | null;
    /** "settle" shows the confirm-payment form in place of the detail. */
    mode: "detail" | "settle";
    onModeChange: (mode: "detail" | "settle") => void;
    onClose: () => void;
}) {
    const shown = useRetained(order);
    const settling = mode === "settle" && shown?.status === "PENDING";
    const actions = useOrderActions({ onDone: onClose });
    const close = onClose;
    const setSettling = (next: boolean) => onModeChange(next ? "settle" : "detail");

    return (
        <Modal
            open={order !== null}
            onOpenChange={(open) => !open && close()}
            size="lg"
            closeOnOutsideClick={!settling}
        >
            {shown && (
                <>
                    <ModalHeader>
                        <ModalTitle>{settling ? "Confirm payment" : <span className="font-mono">{shown.orderNumber}</span>}</ModalTitle>
                        <ModalDescription>
                            {settling
                                ? "Records the payment and enrols the student."
                                : `Placed ${formatDateTime(shown.createdAt)} by ${shown.student.name}`}
                        </ModalDescription>
                    </ModalHeader>

                    {settling ? (
                        <SettleForm order={shown} onBack={() => setSettling(false)} onDone={close} />
                    ) : (
                        <>
                            <OrderDetail order={shown} />
                            <ModalFooter>
                                {shown.status === "PENDING" && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                                            isLoading={actions.isFailing}
                                            onClick={() => actions.fail(shown)}
                                        >
                                            <XCircle /> {bkashSentIn(shown.payment) ? "Reject payment" : "Mark as failed"}
                                        </Button>
                                        <Button onClick={() => setSettling(true)}>
                                            <CheckCircle2 /> {bkashSentIn(shown.payment) ? "Verify payment" : "Confirm payment"}
                                        </Button>
                                    </>
                                )}
                                {shown.status === "PAID" && (
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                                        isLoading={actions.isRefunding}
                                        onClick={() => actions.refund(shown)}
                                    >
                                        <Undo2 /> Refund
                                    </Button>
                                )}
                                {shown.status !== "PENDING" && (
                                    <Button variant="ghost" onClick={close}>
                                        Close
                                    </Button>
                                )}
                            </ModalFooter>
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}

