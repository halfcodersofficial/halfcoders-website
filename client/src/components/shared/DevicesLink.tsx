"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { devicesFor } from "@/lib/access";
import { MY_DEVICES_KEY } from "@/lib/device";
import { authService } from "@/services";

/**
 * The way to "My devices" from any role's sign-in & security settings, with
 * how many of the account's device spots are in use. Opens the role's own
 * devices page, so it renders in that role's chrome.
 */
export default function DevicesLink() {
    const { user } = useSession();
    const { data } = useQuery({ queryKey: MY_DEVICES_KEY, queryFn: authService.devices, enabled: !!user });

    if (!user) return null;

    return (
        <Link
            href={devicesFor(user.role)}
            className="group flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary/70"
        >
            <MonitorSmartphone className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">My devices</span>
                <span className="block text-xs text-muted-foreground">
                    {data ? `Signed in on ${data.devices.length} of ${data.maxDevices} devices` : "See where you're signed in"}
                </span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Manage
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
        </Link>
    );
}
