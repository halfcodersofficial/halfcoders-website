"use client";

import { ArrowRight, BookOpen, CalendarRange, Copy, Link2, Pencil, Power, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import RowActions from "@/components/admin/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminCoupon } from "@/types/admin.types";
import { COUPON_STATE, couponLink, couponState, CouponStub, CouponUsage, perStudentText, scopeText, windowText } from "./couponParts";

export const copyText = (text: string, done: string) =>
    void navigator.clipboard?.writeText(text).then(
        () => toast.success(done),
        () => toast.error("Couldn't copy it — select it and copy by hand."),
    );

interface CouponCardProps {
    coupon: AdminCoupon;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
}

/**
 * One code as a ticket: what it takes off on the stub, then the code itself
 * (one click to copy), who it's for, its rules and how much of it is gone,
 * with the share link, edit and its own page at hand.
 */
export default function CouponCard({ coupon, onEdit, onToggle, onDelete }: CouponCardProps) {
    const state = COUPON_STATE[couponState(coupon)];
    const href = `/admin/coupons/${coupon.id}`;

    return (
        <article className="@container h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex h-full flex-col @md:flex-row">
                <CouponStub coupon={coupon} className="@md:w-32 @max-md:py-4" />

                <div className="flex min-w-0 flex-1 flex-col border-dashed border-border-strong p-4 @md:border-l-2 @max-md:border-t-2 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <button
                            type="button"
                            onClick={() => copyText(coupon.code, `${coupon.code} copied.`)}
                            className="group inline-flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Copy the code"
                        >
                            <span className="truncate font-mono text-lg font-bold tracking-wide">{coupon.code}</span>
                            <Copy className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                        </button>
                        <Badge variant={state.tone} title={state.hint} className="shrink-0">
                            <span className={cn("size-1.5 rounded-full", state.dot)} aria-hidden />
                            {state.label}
                        </Badge>
                    </div>
                    {(coupon.label || coupon.description) && (
                        <p className="mt-1 line-clamp-2 text-sm">
                            {coupon.label && <span className="font-medium">{coupon.label}</span>}
                            {coupon.label && coupon.description && <span className="text-muted-foreground"> · </span>}
                            {coupon.description && <span className="text-muted-foreground">{coupon.description}</span>}
                        </p>
                    )}

                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <li className="inline-flex min-w-0 items-center gap-1.5" title={coupon.courses.map((course) => course.title).join("\n") || undefined}>
                            <BookOpen className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{scopeText(coupon)}</span>
                        </li>
                        <li className="inline-flex items-center gap-1.5">
                            <UserRound className="size-3.5" aria-hidden />
                            {perStudentText(coupon.perStudentLimit)}
                        </li>
                        <li className="inline-flex items-center gap-1.5">
                            <CalendarRange className="size-3.5" aria-hidden />
                            {windowText(coupon)}
                        </li>
                    </ul>

                    <CouponUsage coupon={coupon} className="mt-4" />

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                        <Button size="sm" variant="ghost" className="-ml-2.5" onClick={() => copyText(couponLink(coupon), "Share link copied.")}>
                            <Link2 /> Share link
                        </Button>
                        <RowActions
                            label={`More for ${coupon.code}`}
                            primary={
                                <>
                                    <Button size="sm" variant="outline" onClick={onEdit}>
                                        <Pencil /> Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" asChild>
                                        <Link href={href}>
                                            Uses <ArrowRight />
                                        </Link>
                                    </Button>
                                </>
                            }
                            items={[
                                { label: coupon.isActive ? "Switch off" : "Switch on", icon: Power, onSelect: onToggle },
                                { label: "Copy the code", icon: Copy, onSelect: () => copyText(coupon.code, `${coupon.code} copied.`) },
                                {
                                    label: "Delete",
                                    icon: Trash2,
                                    destructive: true,
                                    separatorBefore: true,
                                    // A code orders carry stays for the record.
                                    hidden: coupon.used + coupon.held + coupon.refunded > 0,
                                    onSelect: onDelete,
                                },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </article>
    );
}
