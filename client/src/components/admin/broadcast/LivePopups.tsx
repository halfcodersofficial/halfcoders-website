"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, MonitorPlay, Repeat } from "lucide-react";
import { toast } from "sonner";
import { count } from "@/components/admin/broadcast/composer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminLivePopup } from "@/types/admin.types";

export const LIVE_POPUPS_KEY = ["admin", "live-popups"] as const;

/** Where a pop-up stands, in words — the line under its bar. */
const standing = (popup: AdminLivePopup) => {
    if (popup.pending === 0) return popup.repeatOnLogin ? "Read by everyone — no longer showing" : "Seen by everyone";
    return popup.repeatOnLogin
        ? `Still showing to ${count(popup.pending)} at each sign-in`
        : `${count(popup.pending)} still to see it`;
};

/**
 * Every pop-up still set to appear at login, newest first, with how far it
 * has got — and the one control the page never had: Stop. Stopping ends the
 * pop-up for everyone it went to; it stays in their notification bell. One
 * that everyone has already seen can be cleared from the list the same way.
 */
export default function LivePopups() {
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({ queryKey: LIVE_POPUPS_KEY, queryFn: adminService.livePopups });

    const stop = useMutation({
        mutationFn: (popup: AdminLivePopup) => adminService.stopPopup(popup.id),
        onSuccess: (_result, popup) => {
            toast.success(popup.pending > 0 ? "Stopped — it won't pop up for anyone again." : "Cleared from the list.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't stop that pop-up.")),
        // Either way the list should show where things now stand.
        onSettled: () => queryClient.invalidateQueries({ queryKey: LIVE_POPUPS_KEY }),
    });

    const onStop = async (popup: AdminLivePopup) => {
        if (
            popup.pending > 0 &&
            !(await confirmAction({
                title: "Stop this pop-up?",
                text: `“${popup.title}” stops appearing at login for the ${count(popup.pending)} who'd still see it. It stays in their notification bell.`,
                confirmText: "Stop it",
            }))
        ) {
            return;
        }
        stop.mutate(popup);
    };

    const showing = data?.filter((popup) => popup.pending > 0).length ?? 0;

    return (
        <section id="live-popups" aria-labelledby="live-popups-title" className="scroll-mt-8 space-y-4">
            <div>
                <h2 id="live-popups-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                    Pop-ups out there
                    {showing > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                            {showing} showing
                        </span>
                    )}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Still set to appear at login. Stopping one ends it for everyone — it stays in their notification bell.
                </p>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <Skeleton key={index} className="h-24 rounded-xl" />
                    ))}
                </div>
            ) : isError ? (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                    Couldn&apos;t load the pop-ups. Reload to try again.
                </p>
            ) : !data || data.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <MonitorPlay className="mb-3 size-6 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium">Nothing is popping up right now.</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        A pop-up you send shows here until everyone has seen it — or until you stop it.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {data.map((popup) => {
                        const seen = popup.recipients - popup.pending;
                        const busy = stop.isPending && stop.variables?.id === popup.id;

                        return (
                            <li
                                key={popup.id}
                                className={cn(
                                    "grid gap-x-8 gap-y-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_15rem_6.5rem] md:items-center",
                                    popup.pending === 0 && "bg-secondary/20",
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                                                popup.repeatOnLogin ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
                                            )}
                                        >
                                            {popup.repeatOnLogin && <Repeat className="size-3" aria-hidden />}
                                            {popup.repeatOnLogin ? "Every sign-in" : "Once"}
                                        </span>
                                        <span>Sent {formatDateTime(popup.sentAt)}</span>
                                    </p>
                                    <p className="mt-1.5 truncate font-semibold" title={popup.title}>
                                        {popup.title}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">{popup.message}</p>
                                </div>

                                <div>
                                    <div
                                        className="h-1.5 overflow-hidden rounded-full bg-secondary"
                                        role="img"
                                        aria-label={`${count(seen)} of ${count(popup.recipients)} ${popup.repeatOnLogin ? "have read it" : "have seen it"}`}
                                    >
                                        <div
                                            className="h-full rounded-full bg-primary transition-[width] duration-700"
                                            style={{ width: `${popup.recipients ? (seen / popup.recipients) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        <span className="font-semibold tabular-nums text-foreground">{count(seen)}</span> of{" "}
                                        {count(popup.recipients)} {popup.repeatOnLogin ? "have read it" : "have seen it"}
                                    </p>
                                    <p className={cn("text-xs", popup.pending > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                                        {standing(popup)}
                                    </p>
                                </div>

                                <div className="flex md:justify-end">
                                    {popup.pending > 0 ? (
                                        <Button variant="outline" size="sm" isLoading={busy} onClick={() => onStop(popup)}>
                                            {!busy && <BellOff aria-hidden />} Stop
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" isLoading={busy} onClick={() => onStop(popup)}>
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
