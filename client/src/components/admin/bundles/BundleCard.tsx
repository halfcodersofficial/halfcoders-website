"use client";

import { CalendarRange, ExternalLink, Pencil, Receipt, Trash2 } from "lucide-react";
import CourseFan from "@/components/admin/promotions/CourseFan";
import RowActions from "@/components/admin/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, formatBDT, formatDate } from "@/lib/utils";
import type { AdminBundle } from "@/types/admin.types";
import { BUNDLE_STATE, bundleState, isPriced, salePrice, savingPercent } from "./bundleState";

/** "Any time", "From 1 Nov", "Until 30 Nov" or "1 Nov – 30 Nov". */
export const windowText = (bundle: Pick<AdminBundle, "startsAt" | "endsAt">) =>
    bundle.startsAt && bundle.endsAt
        ? `${formatDate(bundle.startsAt)} – ${formatDate(bundle.endsAt)}`
        : bundle.startsAt
          ? `From ${formatDate(bundle.startsAt)}`
          : bundle.endsAt
            ? `Until ${formatDate(bundle.endsAt)}`
            : "Any time";

interface BundleCardProps {
    bundle: AdminBundle;
    onEdit: () => void;
    onOrders: () => void;
    onToggle: () => void;
    onDelete: () => void;
    toggling: boolean;
}

/**
 * One bundle as the admin manages it: its courses fanned out, where it
 * stands, what each course sells for alone against the bundle's price, what
 * it has sold — and the switch, the orders and the edit at hand.
 */
export default function BundleCard({ bundle, onEdit, onOrders, onToggle, onDelete, toggling }: BundleCardProps) {
    const state = BUNDLE_STATE[bundleState(bundle)];
    const priced = isPriced(bundle);
    const courses = bundle.items.map((item) => item.course);
    const saving = bundle.combined - bundle.bundlePrice;
    const percent = savingPercent(bundle.combined, bundle.bundlePrice);

    return (
        <article className="@container flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border bg-surface/70 px-5 py-4">
                {/* Five covers where there's room for them, three on a narrow card. */}
                <CourseFan courses={courses} className="@max-md:hidden" />
                <CourseFan courses={courses} max={3} className="@md:hidden" />
                <Badge variant={state.tone} className="shrink-0" title={state.hint}>
                    <span className={cn("size-1.5 rounded-full", state.dot)} aria-hidden />
                    {state.label}
                </Badge>
            </div>

            <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-snug tracking-tight">{bundle.title}</h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{bundle.items.length} courses</span>
                            <span className="inline-flex items-center gap-1">
                                <CalendarRange className="size-3.5" aria-hidden />
                                {windowText(bundle)}
                            </span>
                        </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground has-disabled:cursor-not-allowed">
                        {bundle.isActive ? "On" : "Off"}
                        <Switch
                            checked={bundle.isActive}
                            onCheckedChange={onToggle}
                            disabled={toggling || (!priced && !bundle.isActive)}
                            aria-label={`${bundle.title}: switched ${bundle.isActive ? "on" : "off"}`}
                        />
                    </label>
                </div>

                {bundle.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{bundle.description}</p>}

                <ol className="mt-4 divide-y divide-border border-y border-border">
                    {bundle.items.map((item, index) => {
                        const price = salePrice(item.course);
                        const live = item.course.status === "PUBLISHED" && !item.course.isDeleted;
                        return (
                            <li key={item.courseId} className="flex items-center gap-3 py-2 text-sm">
                                <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                                <span className="min-w-0 flex-1 truncate" title={item.course.title}>
                                    {item.course.title}
                                </span>
                                {!live && (
                                    <span className="shrink-0 text-[0.6875rem] font-semibold text-warning-ink">
                                        {item.course.isDeleted ? "Deleted" : item.course.status === "DRAFT" ? "Draft" : "Archived"}
                                    </span>
                                )}
                                <span className="shrink-0 tabular-nums text-muted-foreground">{price > 0 ? formatBDT(price) : "Free"}</span>
                            </li>
                        );
                    })}
                </ol>

                <div className="mt-auto pt-4">
                    {priced ? (
                        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                            <div>
                                <p className="text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                                    {bundle.pricing === "PERCENT" ? `${bundle.discountPercent}% off the total` : "Fixed price"}
                                </p>
                                <p className="mt-0.5 flex items-baseline gap-2">
                                    <span className="text-2xl font-bold tabular-nums tracking-tight">{formatBDT(bundle.bundlePrice)}</span>
                                    {saving > 0 && <s className="text-sm tabular-nums text-muted-foreground">{formatBDT(bundle.combined)}</s>}
                                </p>
                            </div>
                            {saving > 0 ? (
                                <span className="rounded-sm bg-success/10 px-2.5 py-1 text-xs font-semibold text-success-ink">
                                    Saves {formatBDT(saving)} · {percent}%
                                </span>
                            ) : (
                                <span className="rounded-sm bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive-ink">No saving</span>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-warning/60 bg-warning/5 px-4 py-3">
                            <p className="text-sm">
                                <span className="font-semibold">Not priced yet.</span>{" "}
                                <span className="text-muted-foreground">One by one it&apos;s {formatBDT(bundle.combined)}.</span>
                            </p>
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                Set the price
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3">
                <dl className="flex gap-5 text-xs">
                    <div>
                        <dt className="text-muted-foreground">Sold</dt>
                        <dd className="text-sm font-semibold tabular-nums">{bundle.sold.toLocaleString("en-US")}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Earned</dt>
                        <dd className="text-sm font-semibold tabular-nums">{formatBDT(bundle.revenue)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Awaiting</dt>
                        <dd className={cn("text-sm font-semibold tabular-nums", bundle.pending > 0 && "text-warning-ink")}>
                            {bundle.pending.toLocaleString("en-US")}
                        </dd>
                    </div>
                </dl>
                <RowActions
                    label={`More for ${bundle.title}`}
                    primary={
                        <>
                            <Button size="sm" variant="ghost" onClick={onOrders}>
                                <Receipt /> Orders
                            </Button>
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <Pencil /> Edit
                            </Button>
                        </>
                    }
                    items={[
                        { label: "View on the site", icon: ExternalLink, onSelect: () => window.open(`/bundles/${bundle.slug}`, "_blank", "noopener") },
                        {
                            label: "Delete",
                            icon: Trash2,
                            destructive: true,
                            separatorBefore: true,
                            // A bundle that has sold stays, for the record.
                            hidden: bundle.sold > 0 || bundle.pending > 0,
                            onSelect: onDelete,
                        },
                    ]}
                />
            </footer>
        </article>
    );
}
