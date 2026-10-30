"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, LogOut, MonitorSmartphone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { confirmAction } from "@/lib/confirm";
import { DEVICE_ICONS, deviceLabel, MY_DEVICES_KEY } from "@/lib/device";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { authService } from "@/services";
import type { MyDevice } from "@/types/domain.types";

/**
 * "My devices" — every role's own list of where it's signed in, reached
 * through its own route (`/dashboard/devices`, `/mentor/devices`,
 * `/admin/devices`) so it renders inside that role's chrome, like
 * ProfileSettings.
 *
 * An account may be signed in on a limited number of devices at once
 * (server lib/session.ts); this is where someone sees how many of those spots
 * are taken and frees one up. `passwordHref` is where this role changes its
 * password — the advice for a device nobody recognises.
 */
export default function MyDevices({ passwordHref }: { passwordHref: string }) {
    const queryClient = useQueryClient();
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: MY_DEVICES_KEY,
        queryFn: authService.devices,
    });

    // Refetched whatever happens: a "not signed in any more" still changes the list.
    const refresh = () => queryClient.invalidateQueries({ queryKey: MY_DEVICES_KEY });

    const signOutOne = useMutation({
        mutationFn: (device: MyDevice) => authService.signOutDevice(device.id),
        onSuccess: (_, device) => toast.success(`${deviceLabel(device)} has been signed out.`),
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't sign that device out.")),
        onSettled: refresh,
    });

    const signOutOthers = useMutation({
        mutationFn: authService.signOutOtherDevices,
        onSuccess: ({ signedOut }) =>
            toast.success(signedOut === 1 ? "Your other device has been signed out." : `${signedOut} devices have been signed out.`),
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't sign your other devices out.")),
        onSettled: refresh,
    });

    const askToSignOut = async (device: MyDevice) => {
        const confirmed = await confirmAction({
            title: "Sign this device out?",
            text: `${deviceLabel(device)} will be signed out of Half Coders. Whoever uses it will need your password to sign in again.`,
            confirmText: "Sign it out",
        });
        if (confirmed) signOutOne.mutate(device);
    };

    const askToSignOutOthers = async () => {
        const confirmed = await confirmAction({
            title: "Sign out every other device?",
            text: "Only this device stays signed in. The others will need your password to sign in again.",
            confirmText: "Sign them out",
        });
        if (confirmed) signOutOthers.mutate();
    };

    const devices = data?.devices ?? [];
    const maxDevices = data?.maxDevices ?? 0;
    const others = devices.filter((device) => !device.current);
    const full = devices.length >= maxDevices;

    return (
        <div className="space-y-8">
            <header className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <MonitorSmartphone className="size-5" aria-hidden />
                </span>
                <div>
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My devices</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        The phones, tablets and computers where you&apos;re signed in to Half Coders.
                    </p>
                </div>
            </header>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-24 rounded-card" />
                </div>
            ) : isError || !data ? (
                <div className="rounded-card border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, "Couldn't load your devices right now.")}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()} isLoading={isFetching}>
                        <RefreshCw /> Try again
                    </Button>
                </div>
            ) : (
                <>
                    {/* How many spots are taken, drawn as the spots themselves. */}
                    <section className="rounded-card border border-border bg-card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold">
                                {devices.length} of {maxDevices} devices in use
                            </p>
                            <div className="flex gap-1.5" aria-hidden>
                                {Array.from({ length: maxDevices }, (_, index) => (
                                    <span
                                        key={index}
                                        className={cn(
                                            "h-2.5 w-10 rounded-full",
                                            index < devices.length ? (full ? "bg-warning" : "bg-primary") : "bg-secondary",
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {full
                                ? `Your account can be signed in on up to ${maxDevices} devices at a time, and every spot is taken. Signing in on another device will ask you to sign out of these first.`
                                : `Your account can be signed in on up to ${maxDevices} devices at a time. You can sign in on ${maxDevices - devices.length === 1 ? "one more device" : `${maxDevices - devices.length} more devices`}.`}
                        </p>
                    </section>

                    <section className="space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <h2 className="text-lg font-semibold tracking-tight">Signed in now</h2>
                            {others.length > 0 && (
                                <Button variant="outline" size="sm" onClick={askToSignOutOthers} isLoading={signOutOthers.isPending}>
                                    {!signOutOthers.isPending && <LogOut aria-hidden />}
                                    Sign out all other devices
                                </Button>
                            )}
                        </div>

                        <ul className="space-y-3">
                            {devices.map((device) => (
                                <DeviceRow
                                    key={device.id}
                                    device={device}
                                    onSignOut={() => askToSignOut(device)}
                                    signingOut={signOutOne.isPending && signOutOne.variables?.id === device.id}
                                />
                            ))}
                        </ul>
                    </section>

                    <section className="flex gap-3 rounded-card border border-border bg-surface p-4 text-sm">
                        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <p className="text-muted-foreground">
                            Don&apos;t recognise a device? Sign it out, then{" "}
                            <Link href={passwordHref} className="font-medium text-primary hover:underline">
                                change your password
                            </Link>{" "}
                            — that signs out every other device as well.
                        </p>
                    </section>
                </>
            )}
        </div>
    );
}

function DeviceRow({ device, onSignOut, signingOut }: { device: MyDevice; onSignOut: () => void; signingOut: boolean }) {
    const Icon = DEVICE_ICONS[device.deviceType];
    const signedIn = new Date(device.signedInAt);

    return (
        <li
            className={cn(
                "flex flex-wrap items-center gap-4 rounded-card border bg-card p-4",
                device.current ? "border-primary/40" : "border-border",
            )}
        >
            <span
                className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-md",
                    device.current ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
            >
                <Icon className="size-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{deviceLabel(device)}</span>
                    {device.current && <Badge variant="success">This device</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                    Signed in {formatDistanceToNow(signedIn, { addSuffix: true })} · {formatDateTime(signedIn)}
                    {device.ipAddress && ` · IP ${device.ipAddress}`}
                </p>
            </div>

            {device.current ? (
                <p className="text-xs text-muted-foreground">You&apos;re using this one</p>
            ) : (
                <Button variant="outline" size="sm" onClick={onSignOut} isLoading={signingOut}>
                    {!signingOut && <LogOut aria-hidden />}
                    Sign out
                </Button>
            )}
        </li>
    );
}
