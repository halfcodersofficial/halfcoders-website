"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MonitorOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DEVICE_ICONS, deviceLabel } from "@/lib/device";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";

/**
 * Where the mentor is signed in right now — their live sessions
 * (read-only: no signing anyone out from here).
 * Browser and system are read from each sign-in's user agent.
 */
export function MentorDevices({ mentorId }: { mentorId: string }) {
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ["admin", "mentor", mentorId, "devices"],
        queryFn: () => adminService.mentorDevices(mentorId),
    });

    if (isLoading) {
        return (
            <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    {getApiErrorMessage(error, "Couldn't get this mentor's sign-ins right now.")}
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()} isLoading={isFetching}>
                    <RefreshCw /> Try again
                </Button>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
                <MonitorOff className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-medium">Not signed in anywhere right now.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Devices appear here while the mentor has a live sign-in.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Signed in on {data.length} {data.length === 1 ? "device" : "devices"}. Browser and system are what each
                device reports about itself.
            </p>
            <ul className="grid gap-3 md:grid-cols-2">
                {data.map((device, index) => {
                    const Icon = DEVICE_ICONS[device.deviceType];
                    return (
                        <li key={device.id} className="flex gap-3 rounded-md border border-border bg-card p-4">
                            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                <Icon className="size-5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="flex flex-wrap items-center gap-2 font-medium">
                                    {deviceLabel(device)}
                                    {index === 0 && <Badge variant="success">Most recent</Badge>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Last active {formatDistanceToNow(new Date(device.lastActiveAt), { addSuffix: true })}
                                    {device.ipAddress && ` · IP ${device.ipAddress}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Signed in {formatDateTime(device.createdAt)} · expires {formatDateTime(device.expiresAt)}
                                </p>
                                {device.userAgent && (
                                    <p className="truncate text-[11px] text-muted-foreground/80" title={device.userAgent}>
                                        {device.userAgent}
                                    </p>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
