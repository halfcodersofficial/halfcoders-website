"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, GraduationCap, Layers, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import BkashPayment from "@/components/shared/BkashPayment";
import { CheckoutSteps, Stamp } from "@/components/shared/CheckoutParts";
import { FileIcon } from "@/components/site/EditorWindow";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENT_ROLES } from "@/lib/access";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT, formatDateTime } from "@/lib/utils";
import { bundleOrderService, type BkashSubmission } from "@/services";

/** Only students buy bundles, so only students have one to settle. */
export default function BundleCheckoutPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <BundleCheckout />
        </RoleGuard>
    );
}

/**
 * A bundle's checkout: the receipt (each course still to buy, the bundle's
 * saving, one total) and one bKash payment, verified by an admin. Once paid,
 * every course is in the dashboard, each with its own order and invoice.
 */
function BundleCheckout() {
    const { bundleOrderId } = useParams<{ bundleOrderId: string }>();
    const queryClient = useQueryClient();

    const { data: order, isLoading, isError, error } = useQuery({
        queryKey: ["bundle-order", bundleOrderId],
        queryFn: () => bundleOrderService.get(bundleOrderId),
        // Settled when an admin verifies the bKash payment, which doesn't happen in this tab.
        refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 10_000 : false),
    });

    const submitBkash = useMutation({
        mutationFn: (details: BkashSubmission) => bundleOrderService.submitBkash(bundleOrderId, details),
        onSuccess: (next) => {
            queryClient.setQueryData(["bundle-order", bundleOrderId], next);
            toast.success("Payment details sent — we'll verify them and open your courses.");
        },
        onError: (err) => {
            toast.error(getApiErrorMessage(err, "Couldn't send the payment details."));
            // The price may have changed — show the order as it is now.
            void queryClient.invalidateQueries({ queryKey: ["bundle-order", bundleOrderId] });
        },
    });

    if (isLoading) {
        return (
            <div className="container-page max-w-5xl py-10 sm:py-14">
                <Skeleton className="h-7 w-full" />
                <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-12">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-112 rounded-card" />
                </div>
            </div>
        );
    }

    if (isError || !order) {
        return (
            <div className="container-page grid min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <AlertTriangle className="mx-auto mb-3 size-10 text-muted-foreground" />
                    <p className="font-medium">Order not found</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "This order doesn't exist or isn't yours.")}</p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href="/bundles">Browse bundles</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const isPaid = order.status === "PAID";
    const isPending = order.status === "PENDING";
    // Sent in by the student, waiting for an admin to match it.
    const sentIn =
        isPending && order.gateway === "BKASH" && order.transactionId
            ? { transactionId: order.transactionId, senderNumber: order.gatewayData?.senderNumber, submittedAt: order.gatewayData?.submittedAt }
            : null;

    return (
        <div className="container-page max-w-5xl py-10 sm:py-14">
            <CheckoutSteps status={order.status} submitted={Boolean(sentIn)} />

            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8">
                <header className="min-w-0 lg:col-start-1 lg:row-start-1">
                    <p className="mb-2 inline-flex items-center gap-2 font-mono text-xs text-syn-comment">
                        <Layers className="size-3.5" aria-hidden /> {"// "}
                        <span className="font-sans text-sm font-semibold text-primary">{order.bundle.title}</span>
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        {isPaid ? "Access granted." : sentIn ? "Verifying your payment…" : isPending ? "One step left: pay by bKash" : "This order is closed"}
                    </h1>
                    <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
                        {isPaid
                            ? "Payment confirmed. Every course is in your dashboard, each with its own invoice in your orders."
                            : sentIn
                              ? "Your bKash payment details are in. Every course below opens as soon as we've matched them — we'll email you."
                              : isPending
                                ? "One bKash payment for every course below. Pay with the steps below, then send us the transaction ID."
                                : `This order is ${order.status.toLowerCase()}${order.failureReason ? ` — ${order.failureReason}` : ""}. Start again from the bundle page, or contact support if you think this is a mistake.`}
                    </p>
                </header>

                {/* ---- The receipt ---------------------------------------- */}
                <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                    <article className="relative overflow-hidden rounded-card border border-border bg-card pb-6 shadow-card">
                        <p className="flex items-center justify-between gap-2 border-b border-border bg-surface px-5 py-2 text-xs font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <FileIcon name="bundle-order.json" /> Bundle order summary
                            </span>
                            {isPaid && <Stamp tone="success">Paid</Stamp>}
                            {!isPaid && !isPending && <Stamp tone="destructive">{order.status.toLowerCase()}</Stamp>}
                            {isPending && <span className="font-medium text-syn-number">{sentIn ? "Verifying" : "Awaiting payment"}</span>}
                        </p>
                        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Created</p>
                                <p className="mt-1 text-xs">{formatDateTime(order.createdAt)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Order no.</p>
                                <p className="mt-0.5 font-mono text-sm font-semibold">{order.orderNumber}</p>
                            </div>
                        </header>

                        <ul className="space-y-2.5 px-5 py-5">
                            {order.items.map((item) => (
                                <li key={item.courseId} className="flex items-start justify-between gap-3 text-sm">
                                    <span className="min-w-0 font-medium leading-snug">{item.title}</span>
                                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{formatBDT(item.salePrice)}</span>
                                </li>
                            ))}
                        </ul>

                        <dl className="space-y-2.5 border-t border-border px-5 pt-4 font-mono text-[0.8rem]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Courses on their own</dt>
                                <dd className="tabular-nums">{formatBDT(order.amount)}</dd>
                            </div>
                            {order.discount > 0 && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Bundle saving</dt>
                                    <dd className="tabular-nums text-success">−{formatBDT(order.discount)}</dd>
                                </div>
                            )}
                        </dl>

                        <div className="mx-5 mt-5 flex items-end justify-between border-t border-border pt-4">
                            <span className="text-sm font-semibold text-muted-foreground">Total</span>
                            <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{formatBDT(order.total)}</span>
                        </div>

                        {isPending && (
                            <p className="mx-5 mt-4 rounded-md border border-border bg-surface px-3 py-2.5 text-center text-xs text-muted-foreground">
                                {sentIn ? "Payment sent — being verified" : "Pay by bKash — the steps are on this page"}
                            </p>
                        )}
                    </article>
                </div>

                <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
                    {isPaid ? (
                        <div className="space-y-5">
                            <ul className="space-y-3">
                                {order.orders.map((child) => (
                                    <li key={child.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3">
                                        <span className="min-w-0 truncate font-medium">{child.course.title}</span>
                                        <Button asChild size="sm" variant="outline" className="shrink-0">
                                            <Link href={`/learn/${child.course.slug}`}>
                                                Start <ArrowRight />
                                            </Link>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap gap-3">
                                <Button asChild size="lg">
                                    <Link href="/dashboard">
                                        <LayoutDashboard /> Go to dashboard
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href="/orders">
                                        <GraduationCap /> Orders and invoices
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : isPending ? (
                        <BkashPayment
                            amount={order.total}
                            reference={order.orderNumber}
                            submitted={sentIn}
                            onSubmit={(details) => submitBkash.mutateAsync(details)}
                        />
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            <Button asChild size="lg">
                                <Link href={`/bundles/${order.bundle.slug}`}>
                                    Back to the bundle <ArrowRight />
                                </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <Link href="/contact">Contact support</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
