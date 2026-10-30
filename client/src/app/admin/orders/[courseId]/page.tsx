"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, ChevronRight, Settings2, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState, type KeyboardEvent } from "react";
import BulkActionBar from "@/components/admin/BulkActionBar";
import { CourseSummaryHeader, since } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import { OrderStatusBar } from "@/components/admin/orders/OrderStatusBar";
import { gatewayLabel, ORDER_TONE } from "@/components/admin/orders/orderMeta";
import { useOrderActions } from "@/components/admin/orders/useOrderActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminOrder, AdminOrderCourse } from "@/types/admin.types";

/** Student · order · amount · status · action, shared by the header row and every order row. */
const COLUMNS = "md:grid md:grid-cols-[1.25rem_minmax(0,2fr)_minmax(0,1.7fr)_7rem_minmax(0,1.6fr)_7.5rem] md:items-center md:gap-4";

function CourseHeader({ summary, onAwaiting }: { summary: AdminOrderCourse; onAwaiting: () => void }) {
    const { course, counts } = summary;
    const price = course.discountPrice ?? course.price;

    return (
        <CourseSummaryHeader
            course={course}
            details={
                <>
                    <span>
                        Price <span className="font-semibold text-foreground">{price === 0 ? "Free" : formatBDT(price)}</span>
                        {course.discountPrice !== null && <s className="ml-1.5 text-xs">{formatBDT(course.price)}</s>}
                    </span>
                    {summary.lastOrderAt && <span>{since("Last order", summary.lastOrderAt, "")}</span>}
                    <Link href={`/admin/enrollments/${course.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        <Users className="size-3.5" /> Enrolments
                    </Link>
                    {!course.isDeleted && (
                        <Link href={`/admin/courses/${course.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                            <Settings2 className="size-3.5" /> Course settings
                        </Link>
                    )}
                </>
            }
            stats={[
                { label: "Collected", value: formatBDT(summary.collected), hint: `${counts.PAID} paid` },
                {
                    label: "Awaiting payment",
                    value: String(counts.PENDING),
                    hint: counts.PENDING > 0 ? `${formatBDT(summary.awaiting)} to confirm` : "Nothing to confirm",
                    alert: counts.PENDING > 0,
                    onClick: counts.PENDING > 0 ? onAwaiting : undefined,
                },
                { label: "Failed", value: String(counts.FAILED), hint: "Never arrived" },
                { label: "Refunded", value: String(counts.REFUNDED), hint: "Access withdrawn" },
            ]}
            bar={<OrderStatusBar counts={counts} />}
        />
    );
}

/** One student's order. The row opens the detail; a pending one can be confirmed straight from here. */
function OrderRow({
    order,
    selected,
    onSelect,
    onOpen,
    onSettle,
}: {
    order: AdminOrder;
    selected: boolean;
    onSelect: (checked: boolean) => void;
    onOpen: () => void;
    onSettle: () => void;
}) {
    const pending = order.status === "PENDING";
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`${order.student.name}, ${order.orderNumber}`}
            onClick={onOpen}
            onKeyDown={onKeyDown}
            className={cn(
                "group relative flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-5",
                COLUMNS,
                selected && "bg-primary/5 hover:bg-primary/5",
            )}
        >
            <span aria-hidden className={cn("absolute inset-y-2 left-0 w-0.5 rounded-r-full", ORDER_TONE[order.status].fill)} />

            {/* Only an order awaiting payment can be failed in bulk, so only it can be picked. */}
            <span className="hidden md:block" onClick={(event) => event.stopPropagation()}>
                {pending && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onSelect(event.target.checked)}
                        aria-label={`Select ${order.orderNumber}`}
                        className="size-4 cursor-pointer rounded accent-primary"
                    />
                )}
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                <Avatar src={order.student.image} name={order.student.name} size={38} />
                <div className="min-w-0">
                    <p className="truncate font-semibold">{order.student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{order.student.phone ?? order.student.email}</p>
                </div>
            </div>

            <div className="order-last flex w-full min-w-0 items-center gap-3 pl-12.5 md:order-none md:w-auto md:pl-0">
                <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium">{order.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} · {formatDistanceToNowStrict(new Date(order.createdAt), { addSuffix: true })}
                    </p>
                </div>
                <span className="md:hidden">
                    <StatusPill kind="order" value={order.status} />
                </span>
            </div>

            <div className="text-right">
                <p className="font-bold tabular-nums">{formatBDT(order.total)}</p>
                {order.discount > 0 && <p className="text-xs text-muted-foreground">{formatBDT(order.discount)} off</p>}
            </div>

            <div className="hidden min-w-0 md:block">
                <StatusPill kind="order" value={order.status} />
                {order.payment && order.status === "PAID" ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                        {gatewayLabel(order.payment.gateway)}
                        {order.payment.transactionId && <span className="font-mono"> · {order.payment.transactionId}</span>}
                    </p>
                ) : (
                    order.payment?.failureReason && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{order.payment.failureReason}</p>
                    )
                )}
            </div>

            <div className="hidden items-center justify-end md:flex">
                {pending ? (
                    <Button
                        size="sm"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSettle();
                        }}
                    >
                        <CheckCircle2 /> Confirm
                    </Button>
                ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                        Details <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                )}
            </div>
        </div>
    );
}

function CourseOrders() {
    const { courseId } = useParams<{ courseId: string }>();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState(searchParams.get("status") ?? "");
    // `?q=` and `?open=` come from an admin notification: the list searched
    // to that order, with it open.
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [open, setOpen] = useState<{ id: string; mode: "detail" | "settle" } | null>(() => {
        const id = searchParams.get("open");
        return id ? { id, mode: "detail" } : null;
    });
    const clearSelection = () => setSelected(new Set());
    const actions = useOrderActions({ onDone: clearSelection });

    const summaryQuery = useQuery({
        queryKey: ["admin", "order-courses", courseId],
        queryFn: () => adminService.orderCourse(courseId),
    });

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "orders", { courseId, status, searchTerm, page }],
        queryFn: () =>
            adminService.orders({
                courseId,
                status: status || undefined,
                searchTerm: searchTerm || undefined,
                page,
                limit: 20,
            }),
    });

    const orders = data?.data ?? [];
    const pendingHere = orders.filter((order) => order.status === "PENDING");
    const openOrder = open ? (orders.find((order) => order.id === open.id) ?? null) : null;
    const summary = summaryQuery.data;
    const counts = summary?.counts;

    const backHref = `/admin/orders${searchParams.get("status") === "PENDING" ? "?status=PENDING" : ""}`;

    if (summaryQuery.isError) {
        return (
            <div className="space-y-5">
                <BackButton href={backHref} label="All courses" />
                <div className="rounded-card border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }

    const filters = [
        { value: "", label: "All", count: counts?.total },
        { value: "PENDING", label: "Awaiting payment", count: counts?.PENDING },
        { value: "PAID", label: "Paid", count: counts?.PAID },
        { value: "FAILED", label: "Failed", count: counts?.FAILED },
        { value: "REFUNDED", label: "Refunded", count: counts?.REFUNDED },
        ...(counts?.CANCELLED ? [{ value: "CANCELLED", label: "Cancelled", count: counts.CANCELLED }] : []),
    ];

    const resetList = () => {
        setPage(1);
        clearSelection();
    };

    return (
        <>
            <DataShell
                exportCsv={{ path: "/orders/manage/export", params: { courseId, status: status || undefined, searchTerm: searchTerm || undefined } }}
                header={
                    <div className="space-y-4">
                        <BackButton href={backHref} label="All courses" />
                        {summary ? (
                            <CourseHeader
                                summary={summary}
                                onAwaiting={() => {
                                    setStatus("PENDING");
                                    resetList();
                                }}
                            />
                        ) : (
                            <Skeleton className="h-72 rounded-card" />
                        )}
                    </div>
                }
                searchPlaceholder="Search by student, phone, email or order number…"
                defaultSearch={searchParams.get("q") ?? ""}
                onSearch={(term) => {
                    setSearchTerm(term);
                    resetList();
                }}
                filters={filters}
                activeFilter={status}
                onFilter={(value) => {
                    setStatus(value);
                    resetList();
                }}
                isLoading={isLoading}
                isEmpty={orders.length === 0}
                emptyMessage={
                    searchTerm
                        ? "No orders match."
                        : status === "PENDING"
                          ? "Nothing awaiting confirmation."
                          : status
                            ? "No orders with this status."
                            : "No orders for this course yet."
                }
                emptyHint={
                    searchTerm
                        ? "Try a different name, phone number or order number."
                        : status === "PENDING"
                          ? "Every order for this course has been settled."
                          : "Orders show up here as students buy the course."
                }
                meta={data?.meta}
                onPage={(next) => {
                    setPage(next);
                    clearSelection();
                }}
            >
                <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    <div
                        className={cn(
                            "hidden border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground",
                            COLUMNS,
                        )}
                    >
                        <span>
                            {pendingHere.length > 0 && (
                                <input
                                    type="checkbox"
                                    checked={pendingHere.every((order) => selected.has(order.id))}
                                    onChange={(event) =>
                                        setSelected(event.target.checked ? new Set(pendingHere.map((order) => order.id)) : new Set())
                                    }
                                    aria-label="Select every order awaiting payment on this page"
                                    className="size-4 cursor-pointer rounded accent-primary"
                                />
                            )}
                        </span>
                        <span>Student</span>
                        <span>Order</span>
                        <span className="text-right">Amount</span>
                        <span>Status</span>
                        <span className="sr-only">Action</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {orders.map((order) => (
                            <li key={order.id}>
                                <OrderRow
                                    order={order}
                                    selected={selected.has(order.id)}
                                    onSelect={(checked) =>
                                        setSelected((current) => {
                                            const next = new Set(current);
                                            if (checked) next.add(order.id);
                                            else next.delete(order.id);
                                            return next;
                                        })
                                    }
                                    onOpen={() => setOpen({ id: order.id, mode: "detail" })}
                                    onSettle={() => setOpen({ id: order.id, mode: "settle" })}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </DataShell>

            <BulkActionBar
                count={selected.size}
                onClear={clearSelection}
                actions={[
                    {
                        label: "Mark failed",
                        icon: XCircle,
                        destructive: true,
                        isLoading: actions.isBulkFailing,
                        onClick: () => actions.bulkFail(orders.filter((order) => selected.has(order.id))),
                    },
                ]}
            />

            <OrderDetailModal
                order={openOrder}
                mode={open?.mode ?? "detail"}
                onModeChange={(mode) => setOpen((current) => (current ? { ...current, mode } : current))}
                onClose={() => setOpen(null)}
            />
        </>
    );
}

export default function AdminCourseOrdersPage() {
    return (
        <Suspense fallback={<Skeleton className="h-96" />}>
            <CourseOrders />
        </Suspense>
    );
}
