"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bed, Clock, Eye, Heart, Mail, MonitorOff, PersonStanding, Save, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import RoleGuard from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SESSION_QUERY_KEY, useSession } from "@/hooks/useSession";
import { STUDENT_ROLES } from "@/lib/access";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { authService } from "@/services";
import type { HealthCautionCategories, UserPreferences } from "@/types/domain.types";

const DEFAULT_CATEGORIES: Required<HealthCautionCategories> = {
    eyeCare: true,
    goodPosture: true,
    meditation: true,
    stretching: true,
    screenBreak: true,
};

const DEFAULT_INTERVAL_MINUTES = 90;
const MIN_INTERVAL = 15;
const MAX_INTERVAL = 480;
const INTERVAL_PRESETS = [30, 45, 60, 90, 120];
/** The study session the interval is drawn against. */
const SESSION_MINUTES = 240;

const CATEGORY_ROWS: { key: keyof HealthCautionCategories; label: string; hint: string; icon: typeof Eye }[] = [
    { key: "eyeCare", label: "Eye Care", hint: "Rest your eyes from the screen", icon: Eye },
    { key: "goodPosture", label: "Good Posture Reminder", hint: "Sit up and check your posture", icon: PersonStanding },
    { key: "meditation", label: "Meditation", hint: "A moment to breathe and reset", icon: Bed },
    { key: "stretching", label: "Body Stretching and Exercise", hint: "Stand up and stretch", icon: Heart },
    { key: "screenBreak", label: "Screen Break", hint: "Step away from the screen", icon: MonitorOff },
];

const TABS = [
    { id: "health-caution", label: "Health Caution", hint: "Reminders while you learn", icon: Heart },
    { id: "email-preference", label: "Email Preference", hint: "Updates and announcements", icon: Mail },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** "1 h 30 m", "45 m", "2 h". */
const hoursAndMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return [h > 0 && `${h} h`, (m > 0 || h === 0) && `${m} m`].filter(Boolean).join(" ");
};

/** Only students have this menu today, so only students get the page. */
export default function SettingsPage() {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <Settings />
        </RoleGuard>
    );
}

/**
 * A standalone page rather than nested under `/dashboard` — like `/orders`
 * and `/contact`, it doesn't want the dashboard's sidebar chrome. Password
 * change and active devices live on the My Profile page instead
 * (`dashboard/profile/page.tsx`), not here.
 */
function Settings() {
    const { user } = useSession();
    const [tab, setTab] = useState<TabId>("health-caution");

    if (!user) return null;

    const enabled = user.preferences?.healthCaution?.enabled ?? true;
    const categories = { ...DEFAULT_CATEGORIES, ...user.preferences?.healthCaution?.categories };
    const intervalMinutes = user.preferences?.healthCaution?.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
    const emailPreference = user.preferences?.emailPreference ?? true;

    return (
        <div className="container-page max-w-5xl py-8 sm:py-12">
            <header className="mb-8 flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <SettingsIcon className="size-5" />
                </span>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Customise your account preferences. Every change saves as you make it.
                    </p>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-[15rem_1fr] md:gap-8">
                <nav aria-label="Settings" className="no-scrollbar flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
                    {TABS.map((t) => {
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                aria-current={active ? "page" : undefined}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "flex shrink-0 items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors",
                                    active
                                        ? "border-primary/30 bg-card shadow-card"
                                        : "border-transparent hover:bg-secondary",
                                )}
                            >
                                <span
                                    className={cn(
                                        "grid size-9 shrink-0 place-items-center rounded-md",
                                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                                    )}
                                >
                                    <t.icon className="size-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className={cn("block text-sm font-semibold", active && "text-primary")}>{t.label}</span>
                                    <span className="hidden truncate text-xs text-muted-foreground md:block">{t.hint}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div key={tab} className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
                    {tab === "health-caution" ? (
                        <HealthCautionPanel enabled={enabled} categories={categories} intervalMinutes={intervalMinutes} />
                    ) : (
                        <EmailPreferencePanel value={emailPreference} />
                    )}
                </div>
            </div>
        </div>
    );
}

/** Fires immediately on click — a settings toggle, not a form to submit. */
function usePreferenceMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: Partial<UserPreferences>) => authService.updatePreferences(payload),
        onSuccess: (updated) => {
            queryClient.setQueryData(SESSION_QUERY_KEY, updated);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save that setting.")),
    });
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
    return <section className={cn("rounded-card border border-border bg-card p-5 shadow-card sm:p-6", className)}>{children}</section>;
}

function PanelTitle({ icon: Icon, title, description }: { icon: typeof Eye; title: string; description: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
            </span>
            <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight tracking-tight">{title}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function HealthCautionPanel({
    enabled,
    categories,
    intervalMinutes,
}: {
    enabled: boolean;
    categories: Required<HealthCautionCategories>;
    intervalMinutes: number;
}) {
    const mutate = usePreferenceMutation();
    const onCount = CATEGORY_ROWS.filter((row) => categories[row.key]).length;

    return (
        <div className="space-y-5">
            <Panel className={cn(enabled && "border-primary/30")}>
                <div className="flex items-start justify-between gap-4">
                    <PanelTitle
                        icon={Heart}
                        title="Health cautions"
                        description="Get a health-caution reminder after a prolonged learning session, and again on an interval basis."
                    />
                    <Switch
                        checked={enabled}
                        onCheckedChange={(next) => mutate.mutate({ healthCaution: { enabled: next } })}
                        aria-label="Health cautions"
                    />
                </div>
                <p
                    className={cn(
                        "mt-4 rounded-md px-4 py-2.5 text-sm font-medium",
                        enabled ? "bg-primary/5 text-primary" : "bg-secondary text-muted-foreground",
                    )}
                >
                    {enabled
                        ? `On — the first reminder comes after ${hoursAndMinutes(intervalMinutes)} of learning.`
                        : "Off — you won't get health-caution reminders."}
                </p>
            </Panel>

            <div className={cn("space-y-5 transition-opacity", !enabled && "opacity-60")}>
                <IntervalCard intervalMinutes={intervalMinutes} mutate={mutate} />

                <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <PanelTitle
                            icon={Eye}
                            title="What to remind you about"
                            description="Choose which categories of health-caution notification you want to receive."
                        />
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                            {onCount} of {CATEGORY_ROWS.length} on
                        </span>
                    </div>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                        {CATEGORY_ROWS.map((row) => {
                            const on = categories[row.key];
                            return (
                                <li
                                    key={row.key}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md border p-3.5 transition-colors",
                                        on ? "border-primary/25 bg-primary/3" : "border-border bg-card",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "grid size-10 shrink-0 place-items-center rounded-md transition-colors",
                                            on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                                        )}
                                    >
                                        <row.icon className="size-4.5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold leading-snug">{row.label}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>
                                    </span>
                                    <Switch
                                        checked={on}
                                        onCheckedChange={(next) =>
                                            mutate.mutate({ healthCaution: { categories: { [row.key]: next } } })
                                        }
                                        aria-label={row.label}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            </div>
        </div>
    );
}

/**
 * How often reminders come: quick picks that save on click, like the
 * switches; any other value typed and saved; and a study session drawn as a
 * bar with a mark at each reminder, so "every 90 minutes" reads as the times
 * it actually lands.
 */
function IntervalCard({
    intervalMinutes,
    mutate,
}: {
    intervalMinutes: number;
    mutate: ReturnType<typeof usePreferenceMutation>;
}) {
    // Seeded from the saved value, not just set at mount — a save elsewhere
    // (or the initial session load landing after this component mounts)
    // should still show up here.
    const [interval, setInterval] = useState(String(intervalMinutes));
    useEffect(() => setInterval(String(intervalMinutes)), [intervalMinutes]);

    const saveInterval = (minutes: number) =>
        mutate.mutate(
            { healthCaution: { intervalMinutes: minutes } },
            { onSuccess: () => toast.success(`Reminders every ${hoursAndMinutes(minutes)}.`) },
        );

    const marks: number[] = [];
    for (let at = intervalMinutes; at <= SESSION_MINUTES; at += intervalMinutes) marks.push(at);

    return (
        <Panel>
            <PanelTitle
                icon={Clock}
                title="How often"
                description="Health cautions begin after this many minutes of learning, then repeat at the same interval."
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
                {INTERVAL_PRESETS.map((minutes) => {
                    const active = minutes === intervalMinutes;
                    return (
                        <button
                            key={minutes}
                            type="button"
                            aria-pressed={active}
                            disabled={mutate.isPending}
                            onClick={() => !active && saveInterval(minutes)}
                            className={cn(
                                "rounded-full border px-4 py-2 text-sm font-semibold tabular-nums transition-colors disabled:opacity-60",
                                active
                                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:text-primary",
                            )}
                        >
                            {minutes} min
                        </button>
                    );
                })}

                <div className="flex items-center gap-2 sm:ml-auto">
                    <label htmlFor="interval-minutes" className="sr-only">
                        Custom minutes
                    </label>
                    <Input
                        id="interval-minutes"
                        type="number"
                        inputMode="numeric"
                        min={MIN_INTERVAL}
                        max={MAX_INTERVAL}
                        value={interval}
                        onChange={(event) => setInterval(event.target.value)}
                        className="w-24 rounded-full text-center tabular-nums"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                       
                        isLoading={mutate.isPending}
                        onClick={() => {
                            const minutes = Number(interval);
                            if (!Number.isFinite(minutes) || minutes < MIN_INTERVAL || minutes > MAX_INTERVAL) {
                                toast.error(`Enter a number of minutes between ${MIN_INTERVAL} and ${MAX_INTERVAL}.`);
                                return;
                            }
                            saveInterval(minutes);
                        }}
                    >
                        <Save className="size-3.5" /> Save
                    </Button>
                </div>
            </div>

            {/* A study session, with each reminder marked on it. */}
            <div className="mt-6 rounded-md bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-muted-foreground">
                    In a {hoursAndMinutes(SESSION_MINUTES)} study session
                    {marks.length > 0 ? `, you'd be reminded ${marks.length === 1 ? "once" : `${marks.length} times`}` : ", no reminder would come"}
                </p>
                <div className="relative mb-7 mt-4 h-2 rounded-full bg-border">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-primary opacity-30" style={{ width: "100%" }} />
                    {marks.map((at) => (
                        <span key={at} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(at / SESSION_MINUTES) * 100}%` }}>
                            <span className="block size-4 rounded-full border-2 border-card bg-primary shadow-sm" />
                            <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] font-semibold tabular-nums text-primary">
                                {hoursAndMinutes(at)}
                            </span>
                        </span>
                    ))}
                    <span className="absolute -bottom-6 left-0 text-[0.6875rem] text-muted-foreground">Start</span>
                    {!marks.includes(SESSION_MINUTES) && (
                        <span className="absolute -bottom-6 right-0 text-[0.6875rem] text-muted-foreground">
                            {hoursAndMinutes(SESSION_MINUTES)}
                        </span>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function EmailPreferencePanel({ value }: { value: boolean }) {
    const mutate = usePreferenceMutation();

    return (
        <Panel className={cn(value && "border-primary/30")}>
            <div className="flex items-start justify-between gap-4">
                <PanelTitle
                    icon={Mail}
                    title="Email updates"
                    description="Emails when something needs you: a mark on your work, a new assignment, a support session scheduled, moved or cancelled, a certificate, a course announcement. Payment receipts always come."
                />
                <Switch
                    checked={value}
                    onCheckedChange={(next) => mutate.mutate({ emailPreference: next })}
                    aria-label="Email updates"
                />
            </div>
            <p
                className={cn(
                    "mt-4 rounded-md px-4 py-2.5 text-sm font-medium",
                    value ? "bg-primary/5 text-primary" : "bg-secondary text-muted-foreground",
                )}
            >
                {value ? "On — you'll get these by email as well as here." : "Off — you'll see them here only."}
            </p>
        </Panel>
    );
}
