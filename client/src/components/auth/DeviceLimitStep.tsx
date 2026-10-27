"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Check, LogOut, MonitorSmartphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEVICE_ICONS, deviceLabel } from "@/lib/device";
import type { DeviceLimitError } from "@/types/domain.types";

const AFTER = [
    "The devices above are signed out.",
    "You're signed in here straight away.",
    "Your courses, progress and certificates stay exactly as they are.",
];

/**
 * The sign-in step for an account already on every device it may use: which
 * devices those are, the free spot this one needs, and the way through — sign
 * out of them all and continue here — or back to the form.
 *
 * The form keeps the email and password in memory and sends them again with
 * `signOutAllDevices`; nothing is written to storage on the way.
 */
export default function DeviceLimitStep({
    limit,
    onContinue,
    onBack,
    isContinuing,
}: {
    limit: DeviceLimitError;
    onContinue: () => void;
    onBack: () => void;
    isContinuing: boolean;
}) {
    const count = limit.devices.length;

    return (
        <div className="space-y-6">
            <header className="text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-warning/40 bg-warning/10 text-warning-ink">
                    <MonitorSmartphone className="size-6" aria-hidden />
                </span>
                <h1 className="text-2xl font-bold tracking-tight">You&apos;re signed in on {count} devices</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    One Half Coders account can be signed in on up to {limit.maxDevices} devices at a time. To sign in
                    here, sign out of these first.
                </p>
            </header>

            <div className="overflow-hidden rounded-card border border-border bg-card">
                <p className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 text-xs font-medium text-muted-foreground">
                    Signed in now
                    <span className="font-mono tabular-nums">
                        {count}/{limit.maxDevices} in use
                    </span>
                </p>
                <ul className="divide-y divide-border">
                    {limit.devices.map((device, index) => {
                        const Icon = DEVICE_ICONS[device.deviceType];
                        return (
                            <li key={`${device.signedInAt}-${index}`} className="flex items-center gap-3 px-4 py-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                    <Icon className="size-4.5" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{deviceLabel(device)}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        Signed in {formatDistanceToNow(new Date(device.signedInAt), { addSuffix: true })}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                    {/* The spot this device is asking for. */}
                    <li className="flex items-center gap-3 px-4 py-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-border-strong text-muted-foreground">
                            <Plus className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">This device</span>
                            <span className="block text-xs text-muted-foreground">Needs a free spot</span>
                        </span>
                    </li>
                </ul>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium">If you continue</p>
                <ul className="space-y-1.5">
                    {AFTER.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                            {line}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="grid gap-2">
                <Button type="button" size="lg" variant="brand" className="h-13 w-full text-base" onClick={onContinue} isLoading={isContinuing}>
                    {!isContinuing && <LogOut aria-hidden />}
                    Sign out of them and continue
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={isContinuing}>
                    <ArrowLeft aria-hidden /> Go back
                </Button>
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Rather keep one of them? On that device, open <span className="font-medium text-foreground">My devices</span>{" "}
                from your account menu and sign out just the one you don&apos;t need.
            </p>
        </div>
    );
}
