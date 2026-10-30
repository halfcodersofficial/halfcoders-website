"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LayoutGrid, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminOrderCourse } from "@/types/admin.types";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";

const TABS: { href: string; label: string; icon: LucideIcon; count?: (courses: AdminOrderCourse[]) => number }[] = [
    { href: "/admin/orders", label: "By course", icon: LayoutGrid },
    {
        href: "/admin/orders/successful",
        label: "Successful",
        icon: CheckCircle2,
        count: (courses) => courses.reduce((total, summary) => total + summary.counts.PAID, 0),
    },
    {
        href: "/admin/orders/failed",
        label: "Failed",
        icon: XCircle,
        count: (courses) => courses.reduce((total, summary) => total + summary.counts.FAILED, 0),
    },
];

/**
 * The Payments area's heading: one title, three ways in — course by course,
 * or every course's successful or failed payments as one list. The counts
 * come from the same roll-up the course view loads, so switching costs no
 * extra request.
 */
export default function PaymentsHeader({ description, actions }: { description: ReactNode; actions?: ReactNode }) {
    const pathname = usePathname();
    const { data } = useQuery({
        queryKey: ["admin", "order-courses"],
        queryFn: () => adminService.orderCourses(),
    });

    return (
        <div className="border-b border-border">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Payments</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </header>

            <nav aria-label="Payments" className="no-scrollbar relative -mb-px mt-4 flex gap-1 overflow-x-auto">
                {TABS.map((tab) => {
                    const active = pathname === tab.href;
                    const count = data && tab.count ? tab.count(data) : undefined;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                                active
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                            )}
                        >
                            <tab.icon className={cn("size-4", active && "text-primary")} aria-hidden />
                            {tab.label}
                            {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
