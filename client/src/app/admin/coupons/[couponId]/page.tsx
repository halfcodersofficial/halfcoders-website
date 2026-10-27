"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Pencil, Power } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/components/admin/coupons/CouponCard";
import CouponForm from "@/components/admin/coupons/CouponForm";
import {
    COUPON_STATE,
    couponLink,
    couponState,
    CouponStub,
    CouponUsage,
    offText,
    perStudentText,
    windowText,
} from "@/components/admin/coupons/couponParts";
import { StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminCouponDetail, CouponRedemption } from "@/types/admin.types";

type Outcome = "paid" | "paying" | "refunded" | "dropped";

const OUTCOME: Record<Outcome, { label: string; tone: "success" | "warning" | "secondary" | "destructive" }> = {
    paid: { label: "Paid", tone: "success" },
    paying: { label: "Paying now", tone: "warning" },
    refunded: { label: "Refunded", tone: "secondary" },
    dropped: { label: "Didn't pay", tone: "secondary" },
};

/** What became of an order the code went on. */
const outcomeOf = (redemption: CouponRedemption): Outcome =>
    redemption.status === "PAID" ? "paid" : redemption.status === "REFUNDED" ? "refunded" : redemption.held ? "paying" : "dropped";

/**
 * One coupon: the code with its rules and share link, what it has done, which
 * courses it was spent on, and every order it went on — who, what they paid,
 * and whether they finished — with a CSV of them all.
 */
export default function AdminCouponPage() {
    const { couponId } = useParams<{ couponId: string }>();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState("");
    const [term, setTerm] = useState("");
    const [editing, setEditing] = useState(false);
    const key = ["admin", "coupon", couponId];
    const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => adminService.coupon(couponId) });
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: key });
        void queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    };

    const toggle = useMutation({
        mutationFn: (coupon: AdminCouponDetail) => adminService.updateCoupon(coupon.id, { isActive: !coupon.isActive }),
        onSuccess: (_, coupon) => {
            toast.success(coupon.isActive ? `${coupon.code} switched off.` : `${coupon.code} switched on.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change that coupon.")),
    });

    const redemptions = useMemo(() => data?.redemptions ?? [], [data]);
    const shown = useMemo(() => {
        const search = term.trim().toLowerCase();
        return redemptions.filter(
            (entry) =>
                (!filter || outcomeOf(entry) === filter) &&
                (!search ||
                    entry.student.name.toLowerCase().includes(search) ||
                    entry.student.email.toLowerCase().includes(search) ||
                    (entry.student.phone ?? "").includes(search) ||
                    entry.course.title.toLowerCase().includes(search) ||
                    entry.orderNumber.toLowerCase().includes(search)),
        );
    }, [redemptions, filter, term]);

    // Which courses it was spent on — paid uses only.
    const byCourse = useMemo(() => {
        const counts = new Map<string, { title: string; count: number; off: number }>();
        for (const entry of redemptions) {
            if (entry.status !== "PAID") continue;
            const row = counts.get(entry.course.id) ?? { title: entry.course.title, count: 0, off: 0 };
            row.count += 1;
            row.off += entry.couponDiscount;
            counts.set(entry.course.id, row);
        }
        return [...counts.values()].sort((a, b) => b.count - a.count);
    }, [redemptions]);

    if (isError) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/coupons" label="All coupons" />
                <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This coupon couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
                </div>
            </div>
        );
    }
    if (isLoading || !data) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/coupons" label="All coupons" />
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        );
    }

    const coupon = data;
    const state = COUPON_STATE[couponState(coupon)];
    const link = couponLink(coupon);
    const counts = (outcome: Outcome) => redemptions.filter((entry) => outcomeOf(entry) === outcome).length;

    const cells: StatCell[] = [
        {
            label: "Used",
            value: coupon.maxRedemptions !== null ? `${coupon.used} / ${coupon.maxRedemptions}` : String(coupon.used),
            hint: coupon.refunded ? `Paid orders · ${coupon.refunded} refunded` : "Paid orders",
        },
        { label: "Paying now", value: String(coupon.held), hint: `Each holds a use for ${coupon.holdMinutes} min`, alert: coupon.held > 0 },
        { label: "Taken off", value: formatBDT(coupon.discountGiven), hint: "What it saved students" },
        { label: "Brought in", value: formatBDT(coupon.revenue), hint: "Paid with this code" },
    ];

    const columns: Column<CouponRedemption>[] = [
        {
            id: "student",
            header: "Student",
            primary: true,
            sortable: true,
            sortValue: (entry) => entry.student.name,
            cell: (entry) => (
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={entry.student.image} name={entry.student.name} size={32} />
                    <div className="min-w-0">
                        <p className="truncate font-medium">{entry.student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{entry.student.email || entry.student.phone}</p>
                    </div>
                </div>
            ),
        },
        {
            id: "course",
            header: "Course",
            cell: (entry) => (
                <p className="max-w-64 truncate" title={entry.course.title}>
                    {entry.course.title}
                </p>
            ),
        },
        {
            id: "order",
            header: "Order",
            sortable: true,
            sortValue: (entry) => new Date(entry.createdAt),
            cell: (entry) => (
                <div>
                    <p className="font-mono text-xs">{entry.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.payment?.paidAt ?? entry.createdAt)}</p>
                </div>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: (entry) => {
                const outcome = OUTCOME[outcomeOf(entry)];
                return <Badge variant={outcome.tone}>{outcome.label}</Badge>;
            },
        },
        {
            id: "off",
            header: "Code took off",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (entry) => entry.couponDiscount,
            cell: (entry) => <span className="text-success-ink">−{formatBDT(entry.couponDiscount)}</span>,
        },
        {
            id: "total",
            header: "Paid",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (entry) => entry.total,
            cell: (entry) =>
                entry.status === "PAID" ? (
                    <span className="font-semibold">{formatBDT(entry.total)}</span>
                ) : (
                    <span className="text-muted-foreground">{formatBDT(entry.total)}</span>
                ),
        },
    ];

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <BackButton href="/admin/coupons" label="All coupons" />

                        <section className="@container overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                            <div className="flex flex-col @2xl:flex-row">
                                <CouponStub coupon={coupon} className="py-6 @2xl:w-44 [&>p:first-child]:text-4xl" />
                                <div className="min-w-0 flex-1 border-dashed border-border-strong p-5 @2xl:border-l-2 @max-2xl:border-t-2 sm:p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h1 className="font-mono text-2xl font-bold tracking-wide sm:text-3xl">{coupon.code}</h1>
                                                <Badge variant={state.tone} title={state.hint}>
                                                    <span className={cn("size-1.5 rounded-full", state.dot)} aria-hidden />
                                                    {state.label}
                                                </Badge>
                                            </div>
                                            {coupon.label && <p className="mt-1 font-medium">{coupon.label}</p>}
                                            {coupon.description && <p className="mt-0.5 text-sm text-muted-foreground">{coupon.description}</p>}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={() => toggle.mutate(coupon)} isLoading={toggle.isPending}>
                                                {!toggle.isPending && <Power />} {coupon.isActive ? "Switch off" : "Switch on"}
                                            </Button>
                                            <Button onClick={() => setEditing(true)}>
                                                <Pencil /> Edit
                                            </Button>
                                        </div>
                                    </div>

                                    <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm @xl:grid-cols-2 @5xl:grid-cols-4">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Takes off</dt>
                                            <dd className="font-medium">
                                                {offText(coupon)}
                                                {coupon.minAmount !== null && <span className="text-muted-foreground"> · courses from {formatBDT(coupon.minAmount)}</span>}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Works on</dt>
                                            <dd className="font-medium">
                                                {coupon.allCourses ? (
                                                    "Any course"
                                                ) : (
                                                    <ul className="space-y-0.5">
                                                        {coupon.courses.map((course) => (
                                                            <li key={course.id} className="truncate" title={course.title}>
                                                                {course.title}
                                                                {(course.status !== "PUBLISHED" || course.isDeleted) && (
                                                                    <span className="ml-1.5 text-xs font-semibold text-warning-ink">
                                                                        {course.isDeleted ? "Deleted" : course.status === "DRAFT" ? "Draft" : "Archived"}
                                                                    </span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Uses</dt>
                                            <dd className="font-medium">
                                                {coupon.maxRedemptions !== null ? `${coupon.maxRedemptions.toLocaleString("en-US")} in all` : "No limit in all"}
                                                <span className="text-muted-foreground"> · {perStudentText(coupon.perStudentLimit).toLowerCase()}</span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">When</dt>
                                            <dd className="font-medium">{windowText(coupon)}</dd>
                                        </div>
                                    </dl>

                                    <CouponUsage coupon={coupon} className="mt-5 max-w-xl" />

                                    <div className="mt-5 flex flex-col gap-2 rounded-xl border border-border bg-surface/70 p-3 sm:flex-row sm:items-center">
                                        <Link2 className="hidden size-4 shrink-0 text-primary sm:block" aria-hidden />
                                        <input
                                            readOnly
                                            value={link}
                                            onFocus={(event) => event.currentTarget.select()}
                                            aria-label="Share link"
                                            className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-foreground/85 outline-none"
                                        />
                                        <div className="flex shrink-0 gap-2">
                                            <Button size="sm" variant="outline" onClick={() => copyText(coupon.code, `${coupon.code} copied.`)}>
                                                <Copy /> Code
                                            </Button>
                                            <Button size="sm" onClick={() => copyText(link, "Share link copied.")}>
                                                <Link2 /> Copy link
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        Whoever opens the link has the code applied at checkout by itself — for a seminar handout, a post or a message.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <StatStrip cells={cells} />

                        {byCourse.length > 0 && (
                            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                                <h2 className="text-sm font-semibold">Spent on</h2>
                                <ul className="mt-3 space-y-2.5">
                                    {byCourse.map((row) => (
                                        <li key={row.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm">
                                            <span className="truncate" title={row.title}>
                                                {row.title}
                                            </span>
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                <span className="font-semibold text-foreground">{row.count}</span> · −{formatBDT(row.off)}
                                            </span>
                                            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                                                <span className="block h-full rounded-full bg-primary" style={{ width: `${(row.count / byCourse[0].count) * 100}%` }} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Who used it</h2>
                                <p className="text-sm text-muted-foreground">
                                    Every order it went on, newest first{redemptions.length >= 500 ? " — the latest 500; the CSV has them all" : ""}.
                                </p>
                            </div>
                            <ExportCsvButton path={`/coupons/manage/${coupon.id}/export`} disabled={redemptions.length === 0} />
                        </div>
                    </div>
                }
                searchPlaceholder="Search students, courses or orders…"
                onSearch={setTerm}
                filters={[
                    { value: "", label: "All", count: redemptions.length },
                    { value: "paid", label: "Paid", count: counts("paid") },
                    { value: "paying", label: "Paying now", count: counts("paying") },
                    { value: "refunded", label: "Refunded", count: counts("refunded") },
                    { value: "dropped", label: "Didn't pay", count: counts("dropped") },
                ]}
                activeFilter={filter}
                onFilter={setFilter}
                isLoading={false}
                isEmpty={shown.length === 0}
                emptyMessage={redemptions.length ? "No orders match." : "Nobody has used it yet."}
                emptyHint={redemptions.length ? "Try a different search or filter." : "Orders show here the moment a student applies the code."}
            >
                <DataTable rows={shown} columns={columns} rowKey={(entry) => entry.id} />
            </DataShell>

            <Modal
                open={editing}
                onOpenChange={setEditing}
                size="xl"
                closeOnOutsideClick={false}
                title={`Edit ${coupon.code}`}
                description="Changes apply to orders from now on — paid ones keep what they paid."
            >
                {editing && (
                    <CouponForm
                        coupon={coupon}
                        onDone={() => {
                            setEditing(false);
                            refresh();
                        }}
                        onCancel={() => setEditing(false)}
                    />
                )}
            </Modal>
        </>
    );
}
