"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { History, LogOut, MapPin, MonitorSmartphone, RefreshCw, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { DEVICE_ICONS, deviceLabel, placeLabel, SIGN_IN_METHOD_LABEL } from "@/lib/device";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { IpPlace, StudentAccess, StudentSignIn } from "@/types/admin.types";

/** Used this recently, a device counts as in use right now. */
const IN_USE_MS = 10 * 60 * 1000;
const HISTORY_PAGE = 15;

export const studentAccessKey = (studentId: string) => ["admin", "student", studentId, "access"];

const ago = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true });

const RISK: Record<StudentAccess["risk"]["level"], { icon: LucideIcon; title: string; text: (days: number) => string; tone: string; chip: string }> = {
    low: {
        icon: ShieldCheck,
        title: "Nothing unusual",
        text: (days) => `In the last ${days} days this account looks like one person's: the usual devices, from the usual places.`,
        tone: "border-l-success",
        chip: "bg-success/10 text-success",
    },
    medium: {
        icon: ShieldAlert,
        title: "Worth a look",
        text: (days) => `One thing in the last ${days} days stands out. It can be innocent — a new phone, a trip — so check it before acting.`,
        tone: "border-l-warning",
        chip: "bg-warning/10 text-warning-ink",
    },
    high: {
        icon: ShieldAlert,
        title: "Possible account sharing",
        text: (days) => `In the last ${days} days, these point to more than one person using this account.`,
        tone: "border-l-destructive",
        chip: "bg-destructive/10 text-destructive",
    },
};

/**
 * Where the student's account is used from, to stop a course being shared:
 * plain signs of sharing from the last 30 days, the devices signed in now (an
 * admin can sign one out), every device and place it's been used from, and the
 * whole sign-in history — the sign-ins the device limit turned away too.
 */
export function StudentDevicesTab({ studentId, studentName }: { studentId: string; studentName: string }) {
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: studentAccessKey(studentId),
        queryFn: () => adminService.studentAccess(studentId),
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 rounded-card" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-52 rounded-card" />
                    <Skeleton className="h-52 rounded-card" />
                </div>
                <Skeleton className="h-72 rounded-card" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="rounded-card border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">{getApiErrorMessage(error, "Couldn't load where this account is used from.")}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()} isLoading={isFetching}>
                    <RefreshCw /> Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <RiskPanel access={data} />
            <SignedInNow access={data} studentId={studentId} studentName={studentName} />
            <div className="grid gap-6 xl:grid-cols-2">
                <DevicesUsed devices={data.devices} />
                <Places places={data.places} />
            </div>
            <SignInHistory studentId={studentId} />
            <p className="text-xs text-muted-foreground">
                Places come from each network&apos;s address, so they&apos;re rough: a phone network can show a nearby city, a VPN another country. Device names
                are what each browser says about itself.
                {data.historySince && ` Sign-ins are on record from ${formatDate(data.historySince)}.`}
            </p>
        </div>
    );
}

// ── Signs of sharing ────────────────────────────────────────────────────────

function RiskPanel({ access }: { access: StudentAccess }) {
    const risk = RISK[access.risk.level];
    const Icon = risk.icon;
    const { window } = access;

    const figures: { label: string; value: number; alert?: boolean }[] = [
        { label: "Sign-ins", value: window.signIns },
        { label: "Devices", value: window.devices },
        { label: "Cities", value: window.places },
        { label: "Addresses", value: window.addresses },
        { label: "Turned away", value: window.refused, alert: window.gaveUp > 0 },
        { label: "Pushed others out", value: window.kickouts, alert: window.kickouts > 2 },
    ];

    return (
        <section className={cn("overflow-hidden rounded-card border border-l-4 border-border bg-card shadow-card", risk.tone)}>
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-3.5">
                    <span className={cn("grid size-11 shrink-0 place-items-center rounded-md", risk.chip)}>
                        <Icon className="size-5.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <p className="font-mono text-xs text-syn-comment">
                            {"// "}Account sharing check · last {window.days} days
                        </p>
                        <h2 className="mt-0.5 text-lg font-semibold">{risk.title}</h2>
                        <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{risk.text(window.days)}</p>
                    </div>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-6">
                    {figures.map((figure) => (
                        <div key={figure.label} className="flex min-w-0 flex-col-reverse bg-card px-3 py-2">
                            <dt className="truncate text-[11px] text-muted-foreground">{figure.label}</dt>
                            <dd className={cn("text-lg font-bold tabular-nums", figure.alert && "text-destructive")}>{figure.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {access.risk.signs.length > 0 && (
                <ul className="divide-y divide-border border-t border-border bg-surface/60">
                    {access.risk.signs.map((sign) => (
                        <li key={sign.id} className="flex gap-3 px-5 py-3">
                            <span
                                className={cn("mt-1.5 size-2 shrink-0 rounded-full", sign.level === "high" ? "bg-destructive" : "bg-warning")}
                                aria-label={sign.level === "high" ? "Strong sign" : "Worth a look"}
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{sign.title}</p>
                                <p className="text-xs text-muted-foreground">{sign.detail}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// ── Signed in now ───────────────────────────────────────────────────────────

function SignedInNow({ access, studentId, studentName }: { access: StudentAccess; studentId: string; studentName: string }) {
    const queryClient = useQueryClient();
    const signOut = useMutation({
        mutationFn: (sessionId: string) => adminService.signOutStudentDevice(studentId, sessionId),
        onSuccess: () => {
            toast.success("Signed out. That device has to sign in again.");
            void queryClient.invalidateQueries({ queryKey: studentAccessKey(studentId) });
            void queryClient.invalidateQueries({ queryKey: ["admin", "student", studentId, "sign-ins"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't sign that device out.")),
    });

    const askSignOut = async (device: StudentAccess["live"][number]) => {
        if (
            await confirmAction({
                title: `Sign ${studentName} out of ${deviceLabel(device)}?`,
                text:
                    "That device will have to sign in again; their progress isn't touched. If the password has been shared, " +
                    "send a password reset too — otherwise whoever has it can simply sign back in.",
                confirmText: "Sign out",
            })
        ) {
            signOut.mutate(device.id);
        }
    };

    const free = Math.max(0, access.maxDevices - access.live.length);

    return (
        <section className="space-y-3">
            <SectionTitle
                title="Signed in now"
                hint={`${access.live.length} of ${access.maxDevices} devices. One account can be signed in on ${access.maxDevices} at once; another sign-in has to sign these out first.`}
            />
            <ul className="grid gap-4 md:grid-cols-2">
                {access.live.map((device) => {
                    const Icon = DEVICE_ICONS[device.deviceType];
                    const inUse = Date.now() - new Date(device.lastSeenAt).getTime() < IN_USE_MS;
                    const moved = device.signedInFrom.ip !== device.lastSeenFrom.ip;
                    return (
                        <li key={device.id} className="flex flex-col rounded-card border border-border bg-card shadow-card">
                            <div className="flex items-start gap-3 p-4">
                                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                    <Icon className="size-5" aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                        {deviceLabel(device)}
                                        {inUse && <Badge variant="success">In use now</Badge>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {device.method ? `Signed in with ${SIGN_IN_METHOD_LABEL[device.method]?.toLowerCase() ?? device.method}` : "Signed in"}
                                    </p>
                                </div>
                            </div>

                            <dl className="grid flex-1 grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border px-4 py-3 text-sm">
                                <Row label="Last used">
                                    <span title={formatDateTime(device.lastSeenAt)}>{ago(device.lastSeenAt)}</span>
                                </Row>
                                <Row label="From">
                                    <PlaceLine place={device.lastSeenFrom.place} ip={device.lastSeenFrom.ip} />
                                </Row>
                                <Row label="Signed in">
                                    {formatDateTime(device.signedInAt)}
                                    {moved && (
                                        <span className="block text-xs text-muted-foreground">
                                            from {placeLabel(device.signedInFrom.place) ?? "another address"}
                                            {device.signedInFrom.ip && <span className="font-mono"> · {device.signedInFrom.ip}</span>}
                                        </span>
                                    )}
                                </Row>
                                <Row label="Runs out">{formatDate(device.expiresAt)}</Row>
                            </dl>

                            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
                                {device.userAgent ? (
                                    <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={device.userAgent}>
                                        {device.userAgent}
                                    </p>
                                ) : (
                                    <span className="flex-1" />
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    isLoading={signOut.isPending && signOut.variables === device.id}
                                    onClick={() => void askSignOut(device)}
                                >
                                    <LogOut /> Sign out
                                </Button>
                            </div>
                        </li>
                    );
                })}

                {Array.from({ length: free }).map((_, index) => (
                    <li
                        key={`free-${index}`}
                        className="grid min-h-40 place-items-center rounded-card border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
                    >
                        <span>
                            <MonitorSmartphone className="mx-auto mb-2 size-5" aria-hidden />
                            Free slot — no device here
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// ── Every device and every place ────────────────────────────────────────────

function DevicesUsed({ devices }: { devices: StudentAccess["devices"] }) {
    return (
        <section className="rounded-card border border-border bg-card shadow-card">
            <header className="border-b border-border px-5 py-4">
                <SectionTitle title="Devices used" hint="Each browser on each system counts once, whatever its version." />
            </header>
            {devices.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No sign-ins on record yet.</p>
            ) : (
                <ul className="divide-y divide-border">
                    {devices.map((device) => {
                        const Icon = DEVICE_ICONS[device.deviceType];
                        const cities = device.places.map(placeLabel).filter(Boolean);
                        return (
                            <li key={device.id} className="flex gap-3 px-5 py-3">
                                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                                    <Icon className="size-4" aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                        {deviceLabel(device)}
                                        {device.live && <Badge variant="success">Signed in now</Badge>}
                                        {device.refused > 0 && <Badge variant="destructive">Turned away {device.refused}×</Badge>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        First {formatDate(device.firstSeenAt)} · last {ago(device.lastSeenAt)}
                                    </p>
                                    {cities.length > 0 && (
                                        <p className="truncate text-xs text-muted-foreground" title={cities.join(" · ")}>
                                            <MapPin className="mr-1 inline size-3" aria-hidden />
                                            {cities.join(" · ")}
                                        </p>
                                    )}
                                </div>
                                <p className="shrink-0 text-right text-xs text-muted-foreground">
                                    <span className="block text-sm font-semibold tabular-nums text-foreground">{device.signIns}</span>
                                    {device.signIns === 1 ? "sign-in" : "sign-ins"}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function Places({ places }: { places: StudentAccess["places"] }) {
    const most = Math.max(1, ...places.map((place) => place.signIns + place.refused));
    return (
        <section className="rounded-card border border-border bg-card shadow-card">
            <header className="border-b border-border px-5 py-4">
                <SectionTitle title="Places" hint="Where it was used from, as each network's address places it." />
            </header>
            {places.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No places on record yet.</p>
            ) : (
                <ul className="divide-y divide-border">
                    {places.map((row) => (
                        <li key={row.key} className="space-y-1.5 px-5 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="truncate">
                                        {placeLabel(row.place) ?? (row.key === "unknown" ? "Place not known yet" : "Unknown place")}
                                    </span>
                                </p>
                                <span className="shrink-0 text-xs text-muted-foreground">last {ago(row.lastSeenAt)}</span>
                            </div>
                            <Progress value={((row.signIns + row.refused) / most) * 100} className="h-1" barClassName="bg-brand" />
                            <p className="truncate text-xs text-muted-foreground">
                                {row.signIns} {row.signIns === 1 ? "sign-in" : "sign-ins"}
                                {row.refused > 0 && <span className="text-destructive"> · {row.refused} turned away</span>} · {row.addresses}{" "}
                                {row.addresses === 1 ? "address" : "addresses"}
                                {row.networks.length > 0 && ` · ${row.networks.join(", ")}`}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// ── The sign-in history ─────────────────────────────────────────────────────

function SignInHistory({ studentId }: { studentId: string }) {
    const [refusedOnly, setRefusedOnly] = useState(false);
    const query = useInfiniteQuery({
        queryKey: ["admin", "student", studentId, "sign-ins", { refusedOnly }],
        queryFn: ({ pageParam }) =>
            adminService.studentSignIns(studentId, {
                page: pageParam,
                limit: HISTORY_PAGE,
                outcome: refusedOnly ? "DEVICE_LIMIT_REFUSED" : undefined,
            }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    });
    const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
    const total = query.data?.pages[0]?.meta?.total ?? 0;

    return (
        <section className="rounded-card border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
                <SectionTitle
                    title="Sign-in history"
                    hint={query.isSuccess ? `${total} ${total === 1 ? "entry" : "entries"}, newest first.` : "Every sign-in, newest first."}
                />
                <div role="group" aria-label="Show" className="flex gap-1.5">
                    {[
                        [false, "All"],
                        [true, "Turned away"],
                    ].map(([value, label]) => (
                        <button
                            key={String(value)}
                            type="button"
                            aria-pressed={refusedOnly === value}
                            onClick={() => setRefusedOnly(value as boolean)}
                            className={cn(
                                "rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                refusedOnly === value
                                    ? "border-primary bg-primary/10 text-primary-ink"
                                    : "border-border text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label as string}
                        </button>
                    ))}
                </div>
            </header>

            {query.isLoading ? (
                <div className="space-y-2 p-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-14" />
                    ))}
                </div>
            ) : query.isError ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{getApiErrorMessage(query.error, "Couldn't load the sign-in history.")}</p>
            ) : rows.length === 0 ? (
                <div className="p-8 text-center">
                    <History className="mx-auto size-6 text-muted-foreground" aria-hidden />
                    <p className="mt-2 text-sm text-muted-foreground">
                        {refusedOnly ? "The device limit hasn't turned anyone away." : "No sign-ins on record yet."}
                    </p>
                </div>
            ) : (
                <>
                    <div
                        className="hidden border-b border-border bg-surface px-5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:gap-4"
                        aria-hidden
                    >
                        <span>When</span>
                        <span>Device</span>
                        <span>From</span>
                        <span>What happened</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {rows.map((row) => (
                            <li key={row.id}>
                                <HistoryRow row={row} />
                            </li>
                        ))}
                    </ul>
                    {query.hasNextPage && (
                        <div className="flex justify-center border-t border-border p-4">
                            <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} isLoading={query.isFetchingNextPage}>
                                Show older sign-ins
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

function HistoryRow({ row }: { row: StudentSignIn }) {
    const Icon = DEVICE_ICONS[row.deviceType];
    const refused = row.outcome === "DEVICE_LIMIT_REFUSED";
    return (
        <div
            className={cn(
                "grid gap-x-4 gap-y-2 px-5 py-3 text-sm md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]",
                refused && "bg-destructive/5",
            )}
        >
            <div>
                <p className="tabular-nums">{formatDateTime(row.createdAt)}</p>
                <p className="text-xs text-muted-foreground">{ago(row.createdAt)}</p>
            </div>

            <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate" title={row.userAgent ?? undefined}>
                        {deviceLabel(row)}
                    </span>
                    {row.newDevice && <Badge variant="warning">New device</Badge>}
                </p>
                {row.method && <p className="text-xs text-muted-foreground">{SIGN_IN_METHOD_LABEL[row.method] ?? row.method}</p>}
            </div>

            <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate">{placeLabel(row.place) ?? "Place not known yet"}</span>
                    {row.newPlace && <Badge variant="warning">New place</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {row.ipAddress && <span className="font-mono">{row.ipAddress}</span>}
                    {row.place?.network && ` · ${row.place.network}`}
                </p>
            </div>

            <div className="min-w-0 space-y-0.5">
                {refused ? (
                    <>
                        <Badge variant="destructive">Turned away</Badge>
                        <p className="text-xs text-muted-foreground">The right password, but the account was already on every device it may use.</p>
                    </>
                ) : (
                    <>
                        {row.live ? (
                            <Badge variant="success">Still signed in</Badge>
                        ) : row.endedAt ? (
                            <p className="text-xs text-muted-foreground">Signed out {formatDateTime(row.endedAt)}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">Ran out without signing out</p>
                        )}
                        {row.live && row.lastSeenAt && <p className="text-xs text-muted-foreground">last used {ago(row.lastSeenAt)}</p>}
                        {row.signedOutOthers > 0 && (
                            <p className="text-xs font-medium text-warning-ink">
                                Signed {row.signedOutOthers} other {row.signedOutOthers === 1 ? "device" : "devices"} out to get in
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function SectionTitle({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="min-w-0">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0">{children}</dd>
        </>
    );
}

function PlaceLine({ place, ip }: { place: IpPlace | null; ip: string | null }) {
    return (
        <>
            <span className="block truncate">{placeLabel(place) ?? "Place not known yet"}</span>
            <span className="block truncate text-xs text-muted-foreground">
                {ip && <span className="font-mono">{ip}</span>}
                {place?.network && ` · ${place.network}`}
            </span>
        </>
    );
}
