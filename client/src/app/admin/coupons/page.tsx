"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import CouponCard from "@/components/admin/coupons/CouponCard";
import CouponForm from "@/components/admin/coupons/CouponForm";
import { couponState } from "@/components/admin/coupons/couponParts";
import { StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminCoupon } from "@/types/admin.types";

const COUPON_GRID = "grid grid-cols-1 gap-4 @4xl:grid-cols-2 @[100rem]:grid-cols-3";

/**
 * Checkout coupons. A code takes a percentage (capped, if wanted) or a sum
 * off a course's sale price — on any course, or chosen ones — as many times
 * in all and per student as the admin allows, between its dates. Handed out
 * as the code or as a link that applies it at checkout by itself. A code
 * orders carry stays for the record: switch it off rather than delete it.
 */
export default function AdminCouponsPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState("");
    const [term, setTerm] = useState("");
    const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);
    const { data, isLoading } = useQuery({ queryKey: ["admin", "coupons"], queryFn: adminService.coupons });
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });

    const toggle = useMutation({
        mutationFn: (coupon: AdminCoupon) => adminService.updateCoupon(coupon.id, { isActive: !coupon.isActive }),
        onSuccess: (_, coupon) => {
            toast.success(coupon.isActive ? `${coupon.code} switched off.` : `${coupon.code} switched on.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change that coupon.")),
    });
    const remove = useMutation({
        mutationFn: (coupon: AdminCoupon) => adminService.deleteCoupon(coupon.id),
        onSuccess: (_, coupon) => {
            toast.success(`${coupon.code} deleted.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that coupon.")),
    });

    const all = useMemo(() => data ?? [], [data]);
    const usable = all.filter((coupon) => couponState(coupon) === "active").length;
    const coupons = useMemo(() => {
        const search = term.trim().toLowerCase();
        return all.filter((coupon) => {
            const live = couponState(coupon) === "active";
            if (filter === "active" && !live) return false;
            if (filter === "inactive" && live) return false;
            return (
                !search ||
                coupon.code.toLowerCase().includes(search) ||
                (coupon.label?.toLowerCase().includes(search) ?? false) ||
                (coupon.description?.toLowerCase().includes(search) ?? false) ||
                coupon.courses.some((course) => course.title.toLowerCase().includes(search))
            );
        });
    }, [all, filter, term]);

    const held = all.reduce((sum, coupon) => sum + coupon.held, 0);
    const cells: StatCell[] = [
        { label: "Usable now", value: String(usable), hint: `Of ${all.length} code${all.length === 1 ? "" : "s"}` },
        {
            label: "Used",
            value: all.reduce((sum, coupon) => sum + coupon.used, 0).toLocaleString("en-US"),
            hint: held ? `Paid orders · ${held} paying now` : "Paid orders",
        },
        { label: "Taken off", value: formatBDT(all.reduce((sum, coupon) => sum + coupon.discountGiven, 0)), hint: "What the codes saved students" },
        { label: "Brought in", value: formatBDT(all.reduce((sum, coupon) => sum + coupon.revenue, 0)), hint: "Paid with a code" },
    ];

    const newButton = (
        <Button onClick={() => setEditing("new")}>
            <Plus /> New coupon
        </Button>
    );

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 max-w-3xl">
                                <ConsoleEyebrow />
                                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Coupons</h1>
                                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                    Codes for a campaign, a partner or a programme. Hand out the code or its link — checkout applies it, and a code that
                                    covers the whole price enrols the student straight away.
                                </p>
                            </div>
                            <div className="shrink-0">{newButton}</div>
                        </header>
                        {isLoading ? <Skeleton className="h-24 rounded-card" /> : <StatStrip cells={cells} />}
                    </div>
                }
                searchPlaceholder="Search codes, labels or courses…"
                onSearch={setTerm}
                filters={[
                    { value: "", label: "All", count: all.length },
                    { value: "active", label: "Usable now", count: usable },
                    { value: "inactive", label: "Not usable", count: all.length - usable },
                ]}
                activeFilter={filter}
                onFilter={setFilter}
                isLoading={isLoading}
                skeleton={
                    <div className="@container">
                        <div className={COUPON_GRID}>
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-56 rounded-card" />
                            ))}
                        </div>
                    </div>
                }
                isEmpty={coupons.length === 0}
                emptyMessage={all.length ? "No coupons match." : "No coupons yet."}
                emptyHint={all.length ? "Try a different search or filter." : "Make a code for a launch, a festival, a partner or a campus programme."}
                emptyAction={all.length ? undefined : newButton}
            >
                <div className="@container">
                    <ul className={COUPON_GRID}>
                        {coupons.map((coupon) => (
                            <li key={coupon.id} className="min-w-0">
                                <CouponCard
                                    coupon={coupon}
                                    onEdit={() => setEditing(coupon)}
                                    onToggle={() => toggle.mutate(coupon)}
                                    onDelete={async () => {
                                        if (
                                            await confirmAction({
                                                title: `Delete ${coupon.code}?`,
                                                text: "Nobody has used it, so nothing loses track of it.",
                                                confirmText: "Delete",
                                            })
                                        ) {
                                            remove.mutate(coupon);
                                        }
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </DataShell>

            <Modal
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                size="xl"
                closeOnOutsideClick={false}
                title={editing === "new" ? "New coupon" : `Edit ${editing ? (editing as AdminCoupon).code : "coupon"}`}
                description="Students type the code at checkout, or open its link and it's applied for them."
            >
                {editing && (
                    <CouponForm
                        coupon={editing === "new" ? null : editing}
                        onDone={() => {
                            setEditing(null);
                            refresh();
                        }}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </Modal>
        </>
    );
}
