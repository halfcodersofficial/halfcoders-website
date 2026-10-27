"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import BundleCard from "@/components/admin/bundles/BundleCard";
import BundleForm from "@/components/admin/bundles/BundleForm";
import BundleOrders from "@/components/admin/bundles/BundleOrders";
import { bundleState } from "@/components/admin/bundles/bundleState";
import { StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminBundle } from "@/types/admin.types";

/** Two across once each card has ~30rem, three on a very wide screen. */
const BUNDLE_GRID = "grid grid-cols-1 gap-4 @4xl:grid-cols-2 @[96rem]:grid-cols-3";

/**
 * Course bundles: several courses sold together for less. Each is priced as
 * a fixed sum or a percentage off the courses' combined sale price, sells
 * within its window while switched on, and is paid in one checkout — which
 * becomes one paid order per course, so the Payments screen still shows
 * every course's share. A bundle that has sold stays for the record.
 */
export default function AdminBundlesPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState("");
    const [term, setTerm] = useState("");
    const [editing, setEditing] = useState<AdminBundle | "new" | null>(null);
    const [ordersOf, setOrdersOf] = useState<AdminBundle | null>(null);
    const { data, isLoading } = useQuery({ queryKey: ["admin", "bundles"], queryFn: adminService.bundles });
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "bundles"] });

    const toggle = useMutation({
        mutationFn: (bundle: AdminBundle) => adminService.updateBundle(bundle.id, { isActive: !bundle.isActive }),
        onSuccess: (_, bundle) => {
            toast.success(bundle.isActive ? `${bundle.title} switched off.` : `${bundle.title} switched on.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change that bundle.")),
    });
    const remove = useMutation({
        mutationFn: (bundle: AdminBundle) => adminService.deleteBundle(bundle.id),
        onSuccess: (_, bundle) => {
            toast.success(`${bundle.title} deleted.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that bundle.")),
    });

    const all = useMemo(() => data ?? [], [data]);
    const selling = all.filter((bundle) => bundleState(bundle) === "selling").length;
    const bundles = useMemo(() => {
        const search = term.trim().toLowerCase();
        return all.filter((bundle) => {
            const onSale = bundleState(bundle) === "selling";
            if (filter === "selling" && !onSale) return false;
            if (filter === "other" && onSale) return false;
            return (
                !search ||
                bundle.title.toLowerCase().includes(search) ||
                bundle.items.some((item) => item.course.title.toLowerCase().includes(search))
            );
        });
    }, [all, filter, term]);

    const pending = all.reduce((sum, bundle) => sum + bundle.pending, 0);
    const cells: StatCell[] = [
        { label: "Bundles", value: String(all.length), hint: `${selling} on sale now` },
        { label: "Sold", value: all.reduce((sum, bundle) => sum + bundle.sold, 0).toLocaleString("en-US"), hint: "Checkouts paid" },
        { label: "Earned", value: formatBDT(all.reduce((sum, bundle) => sum + bundle.revenue, 0)), hint: "Across every bundle" },
        { label: "Awaiting payment", value: String(pending), hint: pending ? "Open a bundle's orders" : "Nothing waiting", alert: pending > 0 },
    ];

    const newButton = (
        <Button onClick={() => setEditing("new")}>
            <Plus /> New bundle
        </Button>
    );

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 max-w-3xl">
                                <h1 className="text-2xl font-bold sm:text-3xl">Bundles</h1>
                                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                                    Courses sold together for less, in one checkout. Each becomes a paid order per course, so Payments still shows every
                                    course&apos;s share.
                                </p>
                            </div>
                            <div className="shrink-0">{newButton}</div>
                        </header>
                        {isLoading ? <Skeleton className="h-24 rounded-xl" /> : <StatStrip cells={cells} />}
                    </div>
                }
                searchPlaceholder="Search bundles or courses…"
                onSearch={setTerm}
                filters={[
                    { value: "", label: "All", count: all.length },
                    { value: "selling", label: "On sale", count: selling },
                    { value: "other", label: "Not on sale", count: all.length - selling },
                ]}
                activeFilter={filter}
                onFilter={setFilter}
                isLoading={isLoading}
                skeleton={
                    <div className="@container">
                        <div className={BUNDLE_GRID}>
                            {Array.from({ length: 2 }).map((_, index) => (
                                <Skeleton key={index} className="h-96 rounded-2xl" />
                            ))}
                        </div>
                    </div>
                }
                isEmpty={bundles.length === 0}
                emptyMessage={all.length ? "No bundles match." : "No bundles yet."}
                emptyHint={all.length ? "Try a different search or filter." : "Put two or more courses together at a price that beats buying them one by one."}
                emptyAction={all.length ? undefined : newButton}
            >
                <div className="@container">
                    <ul className={BUNDLE_GRID}>
                        {bundles.map((bundle) => (
                            <li key={bundle.id}>
                                <BundleCard
                                    bundle={bundle}
                                    onEdit={() => setEditing(bundle)}
                                    onOrders={() => setOrdersOf(bundle)}
                                    onToggle={() => toggle.mutate(bundle)}
                                    toggling={toggle.isPending && toggle.variables?.id === bundle.id}
                                    onDelete={async () => {
                                        if (
                                            await confirmAction({
                                                title: `Delete ${bundle.title}?`,
                                                text: "Nobody has ordered it, so nothing loses track of it.",
                                                confirmText: "Delete",
                                            })
                                        ) {
                                            remove.mutate(bundle);
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
                title={editing === "new" ? "New bundle" : "Edit bundle"}
                description="Students see it on the bundles page and on each of its courses' pages."
            >
                {editing && (
                    <BundleForm
                        bundle={editing === "new" ? null : editing}
                        onDone={() => {
                            setEditing(null);
                            refresh();
                        }}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </Modal>

            <Modal
                open={ordersOf !== null}
                onOpenChange={(open) => !open && setOrdersOf(null)}
                size="lg"
                title={ordersOf ? `Orders · ${ordersOf.title}` : "Orders"}
                description="Every checkout for this bundle, newest first."
            >
                {ordersOf && <BundleOrders bundle={ordersOf} onChanged={refresh} />}
            </Modal>
        </>
    );
}
