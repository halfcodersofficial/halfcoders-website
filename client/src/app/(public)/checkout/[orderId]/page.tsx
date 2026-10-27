"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BookOpen, Copy, Download, Gift, GraduationCap, LayoutDashboard, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AdmissionTicketPanel } from "@/components/shared/AdmissionTicket";
import BkashPayment from "@/components/shared/BkashPayment";
import { CheckoutSteps, Stamp } from "@/components/shared/CheckoutParts";
import { FileIcon } from "@/components/site/EditorWindow";
import RefundPanel from "@/components/shared/RefundPanel";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENT_ROLES } from "@/lib/access";
import { getApiErrorMessage } from "@/lib/httpClient";
import { clearCoupon, useSavedCoupon } from "@/lib/savedCoupon";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import { catalogueService, couponService, orderService } from "@/services";
import type { BkashSubmission } from "@/services";
import type { OrderDetail } from "@/types/learning.types";

/** Orders the saved link code has already been tried on in this tab — tried once, never again. */
const TRIED_KEY = "halfcoders.coupon.tried";
const triedOn = (orderId: string) => {
    try {
        return (sessionStorage.getItem(TRIED_KEY) ?? "").split(",").includes(orderId);
    } catch {
        return true;
    }
};
const markTried = (orderId: string) => {
    try {
        sessionStorage.setItem(TRIED_KEY, [...(sessionStorage.getItem(TRIED_KEY) ?? "").split(",").filter(Boolean), orderId].join(","));
    } catch {
        // Storage blocked: `triedOn` already says yes, so it's never tried.
    }
};

/**
 * "Have a code?" on an unpaid order: apply it and the receipt re-prices (a
 * code that covers it all enrols them straight away); take it off again. A
 * code the student arrived with on a share link is applied by itself, once.
 */
function CouponField({ order }: { order: OrderDetail }) {
    const queryClient = useQueryClient();
    const saved = useSavedCoupon();
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState("");
    const update = (next: OrderDetail) => queryClient.setQueryData(["order", order.id], next);
    const apply = useMutation({
        mutationFn: ({ value }: { value: string; fromLink: boolean }) => orderService.applyCoupon(order.id, value),
        onSuccess: (next, { fromLink }) => {
            update(next);
            setCode("");
            setOpen(false);
            const what = next.status === "PAID" ? "it covers the whole price, so you're enrolled." : `you pay ${formatBDT(next.total)}.`;
            toast.success(fromLink ? `${next.couponCode} from your link is applied — ${what}` : `Code applied — ${what}`);
        },
        onError: (err, { value, fromLink }) => {
            const reason = getApiErrorMessage(err, "That code couldn't be applied.");
            toast[fromLink ? "info" : "error"](fromLink ? `${value} wasn't applied: ${reason}` : reason);
        },
    });
    const remove = useMutation({
        mutationFn: () => orderService.removeCoupon(order.id),
        onSuccess: (next) => update(next),
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't take the code off.")),
    });

    // The share-link code, once per order: not over a code already on it, and not again after it was taken off.
    // Checked first: a code for other courses waits quietly for one of them; a code that's no good anywhere
    // any more (expired, used up, used by them already) is let go with a word why.
    useEffect(() => {
        if (!saved || order.couponCode || order.status !== "PENDING" || triedOn(order.id)) return;
        markTried(order.id);
        void (async () => {
            try {
                if ((await couponService.check(saved, order.course.id)).usable) return apply.mutate({ value: saved, fromLink: true });
                const anywhere = await couponService.check(saved);
                if (!anywhere.usable) {
                    clearCoupon();
                    toast.info(`${saved} can't be used any more: ${anywhere.reason}`);
                }
            } catch {
                // Couldn't check — they can still type it.
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saved, order.id, order.couponCode, order.status]);

    if (order.couponCode) {
        return (
            <div className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-success/50 bg-success/5 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-start gap-2">
                    <TicketPercent className="mt-0.5 size-4 shrink-0 text-success-ink" aria-hidden />
                    <span className="min-w-0">
                        <span className="font-mono font-semibold text-success-ink">{order.couponCode}</span>
                        <span className="text-success-ink"> applied</span>
                        {order.coupon?.label && <span className="block truncate text-xs text-muted-foreground">{order.coupon.label}</span>}
                    </span>
                </span>
                <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
                    {remove.isPending ? "Removing…" : "Remove"}
                </button>
            </div>
        );
    }
    if (apply.isPending && apply.variables?.fromLink) {
        return (
            <p className="mx-5 mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <TicketPercent className="size-4 animate-pulse" aria-hidden /> Applying {apply.variables.value} from your link…
            </p>
        );
    }
    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className="mx-5 mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <TicketPercent className="size-4" aria-hidden /> Have a coupon code?
            </button>
        );
    }
    return (
        <form
            className="mx-5 mt-3 flex gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                if (code.trim()) apply.mutate({ value: code.trim(), fromLink: false });
            }}
        >
            <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Coupon code"
                aria-label="Coupon code"
                autoFocus
                maxLength={32}
                className="font-mono uppercase"
            />
            <Button type="submit" variant="brand-outline" disabled={!code.trim()} isLoading={apply.isPending}>
                Apply
            </Button>
        </form>
    );
}

/** The free courses this purchase brings, on the receipt — while the course's offer is on. */
function IncludedFree({ courseId }: { courseId: string }) {
    const { data } = useQuery({
        queryKey: ["course-promotions", courseId],
        queryFn: () => catalogueService.coursePromotions(courseId),
        staleTime: 60_000,
    });
    if (!data?.offer) return null;

    return (
        <div className="mx-5 mb-5 rounded-md border border-success/30 bg-success/5 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success-ink">
                <Gift className="size-3.5" aria-hidden /> Included free with this course
            </p>
            <ul className="mt-2 space-y-1.5">
                {data.offer.courses.map((course) => (
                    <li key={course.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{course.title}</span>
                        <span className="shrink-0 text-xs">
                            {course.price > 0 && <s className="text-muted-foreground">{formatBDT(course.discountPrice ?? course.price)}</s>}{" "}
                            <span className="font-semibold text-success-ink">Free</span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">They open in your dashboard as soon as this payment is confirmed.</p>
        </div>
    );
}

function ReceiptRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={cn("flex items-baseline gap-2 font-mono text-[0.8rem]", className)}>
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-border" />
            <dd className="shrink-0 font-medium tabular-nums">{children}</dd>
        </div>
    );
}

/** Only students buy courses, so only students have an order to settle. */
export default function CheckoutPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <Checkout />
        </RoleGuard>
    );
}

function Checkout() {
    const { orderId } = useParams<{ orderId: string }>();
    const queryClient = useQueryClient();

    const { data: order, isLoading, isError, error } = useQuery({
        queryKey: ["order", orderId],
        queryFn: () => orderService.get(orderId),
        // A pending order flips to PAID when an admin verifies its bKash
        // payment, which doesn't happen in this tab.
        refetchInterval: (query) =>
            query.state.data?.status === "PENDING" ? 10_000 : false,
    });

    const submitBkash = useMutation({
        mutationFn: (details: BkashSubmission) => orderService.submitBkash(orderId, details),
        onSuccess: (next) => {
            queryClient.setQueryData(["order", orderId], next);
            toast.success("Payment details sent — we'll verify them and open the course.");
        },
        onError: (err) => {
            toast.error(getApiErrorMessage(err, "Couldn't send the payment details."));
            // The price may have changed (or the course gone free) — show the order as it is now.
            void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        },
    });

    if (isLoading) {
        return (
            <div className="container-page max-w-5xl py-10 sm:py-14">
                <Skeleton className="h-7 w-full" />
                <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-12">
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-72" />
                        <Skeleton className="h-5 w-full max-w-xl" />
                        <Skeleton className="mt-8 h-48" />
                    </div>
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
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "This order doesn't exist or isn't yours.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href="/courses">Browse courses</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const isPaid = order.status === "PAID";
    const isPending = order.status === "PENDING";
    // Sent in by the student, waiting for an admin to match it.
    const sentIn =
        isPending && order.payment?.gateway === "BKASH" && order.payment.transactionId
            ? {
                  transactionId: order.payment.transactionId,
                  senderNumber: order.payment.gatewayData?.senderNumber,
                  submittedAt: order.payment.gatewayData?.submittedAt,
              }
            : null;

    return (
        <div className="container-page max-w-5xl py-10 sm:py-14">
            <CheckoutSteps status={order.status} submitted={Boolean(sentIn)} />

            {/* Title, receipt, then the details: on a phone the receipt and its Pay
                button come straight after the title; beside it on a wide screen. */}
            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8">
                <header className="min-w-0 lg:col-start-1 lg:row-start-1">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        {isPaid ? "Access granted." : sentIn ? "Verifying your payment…" : isPending ? "One step left: pay by bKash" : "This order is closed"}
                    </h1>
                    <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
                        {isPaid
                            ? "Payment confirmed — the course is waiting in your dashboard. Start whenever you like."
                            : sentIn
                                ? "We've got your bKash details. The course opens as soon as our team matches them — you'll get an email."
                                : isPending
                                    ? "Your order is saved. Follow the bKash steps below, then send us the Transaction ID."
                                    : `This order is ${order.status.toLowerCase()}${order.payment?.failureReason ? ` — ${order.payment.failureReason}` : ""}. Start a new order from the course page, or contact support if you think this is a mistake.`}
                    </p>
                </header>

                {/* ---- The receipt ---------------------------------------- */}
                <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                    <article className="relative overflow-hidden rounded-card border border-border bg-card pb-6 shadow-card">
                        <p className="flex items-center justify-between gap-2 border-b border-border bg-surface px-5 py-2 text-xs font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <FileIcon name="order.json" /> Order summary
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
                                <button
                                    type="button"
                                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-sm font-semibold hover:text-primary"
                                    onClick={() => {
                                        void navigator.clipboard.writeText(order.orderNumber);
                                        toast.success("Order number copied");
                                    }}
                                    title="Copy order number"
                                >
                                    {order.orderNumber}
                                    <Copy className="size-3" aria-hidden />
                                </button>
                            </div>
                        </header>

                        <div className="flex gap-3.5 px-5 py-5">
                            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-secondary">
                                <SafeImage
                                    src={order.course.thumbnail}
                                    alt=""
                                    fill
                                    sizes="96px"
                                    className="object-cover"
                                    fallback={<BookOpen className="size-5 text-muted-foreground" />}
                                />
                            </div>
                            <p className="min-w-0 text-sm font-semibold leading-snug">{order.course.title}</p>
                        </div>

                        {isPending && <IncludedFree courseId={order.course.id} />}

                        <dl className="space-y-2.5 px-5">
                            <ReceiptRow label="Course price">{formatBDT(order.amount)}</ReceiptRow>
                            {order.discount - (order.couponDiscount ?? 0) > 0 && (
                                <ReceiptRow label="Discount" className="[&_dd]:text-success">
                                    −{formatBDT(order.discount - (order.couponDiscount ?? 0))}
                                </ReceiptRow>
                            )}
                            {order.couponCode && (order.couponDiscount ?? 0) > 0 && (
                                <ReceiptRow label={`Code ${order.couponCode}`} className="[&_dd]:text-success">
                                    −{formatBDT(order.couponDiscount)}
                                </ReceiptRow>
                            )}
                        </dl>

                        {isPending && <CouponField order={order} />}

                        <div className="mx-5 mt-5 flex items-end justify-between border-t border-border pt-4">
                            <span className="text-sm font-semibold text-muted-foreground">Total</span>
                            <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{formatBDT(order.total)}</span>
                        </div>

                        {isPending && (
                            <p className="mx-5 mt-4 rounded-md border border-border bg-surface px-3 py-2.5 text-center text-xs text-muted-foreground">
                                {sentIn ? "Payment sent — being verified" : "Pay by bKash — the steps are on this page"}
                            </p>
                        )}

                        <p className="mt-6 px-5 text-center text-xs text-muted-foreground">
                            Questions about this order?{" "}
                            <Link href="/contact" className="font-semibold text-primary hover:underline">
                                Contact support
                            </Link>
                        </p>
                    </article>
                </div>

                <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
                    {isPaid ? (
                        <div className="space-y-5">
                            <div className="flex flex-wrap gap-3">
                                <Button asChild size="lg">
                                    <Link href={`/learn/${order.course.slug}`}>
                                        <GraduationCap /> Start learning
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href="/dashboard">
                                        <LayoutDashboard /> Go to dashboard
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <a href={orderService.invoiceUrl(order.id)}>
                                        <Download /> Download invoice
                                    </a>
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                A copy of the invoice was also emailed to{" "}
                                <span className="font-medium text-foreground">{order.student.learningProfile?.contactEmail ?? order.student.email}</span>.
                            </p>
                            <AdmissionTicketPanel courseId={order.course.id} />
                            <RefundPanel order={order} />
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
                                <Link href={`/courses/${order.course.slug}`}>
                                    Back to course <ArrowRight />
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
