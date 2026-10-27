"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Headphones, ListOrdered, Save, Trophy, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z, type ZodType } from "zod";
import { SettingFacts, SettingSection } from "@/components/admin/settings/SettingSection";
import { CertificatePreview, QueueExample, SequenceDiagram } from "@/components/admin/settings/SettingPreviews";
import XpRules, { MAX_XP, XP_SOURCE_KEYS } from "@/components/admin/settings/XpRules";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useZodForm, type FormValues, type ZodFormApi } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { numericField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { PlatformSettingKey, PlatformSettings } from "@/types/admin.types";

const KEY = ["admin", "settings"] as const;

/** Built from the source list, so a new XP source only has to be added there. */
const xpSchema = z.object(
    Object.fromEntries(XP_SOURCE_KEYS.map((key) => [key, numericField({ label: "Points", min: 0, max: MAX_XP })])),
);
const supportSchema = z.object({ slotMinutes: numericField({ label: "Minutes per student", min: 1, max: 60 }) });
const certificateSchema = z.object({
    prefix: z
        .string()
        .trim()
        .min(1, "Certificate ID prefix is required")
        .min(2, "Prefix must be at least 2 characters")
        .max(12, "Prefix must be at most 12 characters")
        .regex(/^[A-Z0-9]+$/, "Use capital letters and digits only — no spaces or punctuation"),
});
const learningSchema = z.object({ sequential: z.boolean() });

const NAV: { id: string; key: PlatformSettingKey; label: string; icon: LucideIcon }[] = [
    { id: "xp", key: "xp.rules", label: "XP & leaderboard", icon: Trophy },
    { id: "support", key: "support.slotMinutes", label: "Support sessions", icon: Headphones },
    { id: "certificates", key: "certificate.prefix", label: "Certificates", icon: Award },
    { id: "learning", key: "learning.sequential", label: "Learning order", icon: ListOrdered },
];

/** One setting's form, as the save bar and the reset button need it. */
interface Section {
    key: PlatformSettingKey;
    label: string;
    dirty: boolean;
    /** The value to save, or `undefined` while the form has errors. */
    parse: () => unknown;
    /** Shows the form's errors and moves focus to the first. */
    revealErrors: () => void;
    /** Makes what's in the form the new baseline, once it's saved. */
    commit: () => void;
    discard: () => void;
}

function toSection<TValues extends FormValues, TOut>(
    key: PlatformSettingKey,
    label: string,
    form: ZodFormApi<TValues>,
    schema: ZodType<TOut, TValues>,
    toSetting: (values: TOut) => unknown,
): Section {
    return {
        key,
        label,
        dirty: form.isDirty,
        parse: () => {
            const parsed = schema.safeParse(form.values);
            return parsed.success ? toSetting(parsed.data) : undefined;
        },
        revealErrors: form.submit,
        // A copy: `isDirty` is worked out when the values object changes, and
        // resetting to the very object the form already holds wouldn't change it.
        commit: () => form.reset({ ...form.values }),
        discard: () => form.reset(),
    };
}

/**
 * A form over one setting that follows the server: whenever the stored value
 * changes (a save, a reset, another admin), the form takes it up — unless
 * it's holding edits of its own, which win until they're saved or discarded.
 */
function useSettingForm<TValues extends FormValues, TOut>(schema: ZodType<TOut, TValues>, stored: TValues) {
    const form = useZodForm({ schema, initialValues: stored, onSubmit: () => undefined });
    const dirty = useRef(form.isDirty);
    dirty.current = form.isDirty;

    const signature = JSON.stringify(stored);
    const { reset } = form;
    useEffect(() => {
        if (!dirty.current) reset(JSON.parse(signature) as TValues);
    }, [signature, reset]);

    return form;
}

const xpToForm = (rules: Record<string, number>) =>
    Object.fromEntries(XP_SOURCE_KEYS.map((key) => [key, String(rules[key] ?? 0)])) as Record<string, string>;

/**
 * Platform settings: the four things that change how Half Coders behaves for
 * everyone — XP awards, support session length, certificate IDs and learning
 * order. Each panel says where its setting takes effect and where it stands
 * (default, changed when, unsaved); edits gather in one bar that saves them
 * together, so a half-finished change is never live by accident.
 */
export default function AdminSettingsPage() {
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: adminService.settings });

    return (
        <div className="max-w-6xl space-y-8">
            <header className="animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none">
                <h1 className="text-2xl font-bold sm:text-3xl">Platform settings</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    How Half Coders behaves for everyone — XP, support sessions, certificates and the order students learn in.
                    A change applies as soon as it&apos;s saved.
                </p>
            </header>

            {isLoading ? (
                <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
                    <Skeleton className="hidden h-40 lg:block" />
                    <div className="space-y-6">
                        <Skeleton className="h-96 rounded-2xl" />
                        <Skeleton className="h-56 rounded-2xl" />
                    </div>
                </div>
            ) : isError || !data ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load the settings.</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
            ) : (
                <SettingsBoard settings={data} />
            )}
        </div>
    );
}

function SettingsBoard({ settings }: { settings: PlatformSettings }) {
    const queryClient = useQueryClient();
    const { values, defaults, changedAt } = settings;
    const [saving, setSaving] = useState(false);
    const [active, setActive] = useState(NAV[0].id);

    const xp = useSettingForm(xpSchema, xpToForm(values["xp.rules"]));
    const support = useSettingForm(supportSchema, { slotMinutes: String(values["support.slotMinutes"]) });
    const certificate = useSettingForm(certificateSchema, { prefix: values["certificate.prefix"] });
    const learning = useSettingForm(learningSchema, { sequential: values["learning.sequential"] });

    const sections: Section[] = [
        toSection("xp.rules", "XP rules", xp, xpSchema, (rules) =>
            Object.fromEntries(Object.entries(rules).map(([key, points]) => [key, Number(points)])),
        ),
        toSection("support.slotMinutes", "Support minutes", support, supportSchema, (v) => Number(v.slotMinutes)),
        toSection("certificate.prefix", "Certificate prefix", certificate, certificateSchema, (v) => v.prefix),
        toSection("learning.sequential", "Sequential learning", learning, learningSchema, (v) => v.sequential),
    ];
    const sectionFor = (key: PlatformSettingKey) => sections.find((section) => section.key === key)!;
    const dirty = sections.filter((section) => section.dirty);

    const afterChange = () => {
        void queryClient.invalidateQueries({ queryKey: KEY });
        // The support scheduling forms prefill from this.
        void queryClient.invalidateQueries({ queryKey: ["support", "defaults"] });
    };

    const saveAll = async () => {
        if (saving || dirty.length === 0) return;
        const invalid = dirty.find((section) => section.parse() === undefined);
        if (invalid) {
            invalid.revealErrors();
            return;
        }

        setSaving(true);
        const saved: string[] = [];
        try {
            for (const section of dirty) {
                await adminService.saveSetting(section.key, section.parse());
                section.commit();
                saved.push(section.label);
            }
            toast.success(saved.length === 1 ? `${saved[0]} saved.` : `${saved.length} settings saved.`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't save that setting."));
        } finally {
            setSaving(false);
            afterChange();
        }
    };

    const discardAll = () => dirty.forEach((section) => section.discard());

    const resetToDefault = async (key: PlatformSettingKey) => {
        const section = sectionFor(key);
        const confirmed = await confirmAction({
            title: "Back to the default?",
            text: `${section.label} goes back to Half Coders' built-in value, for everyone, straight away.`,
            confirmText: "Reset",
            tone: "default",
        });
        if (!confirmed) return;
        try {
            section.discard();
            await adminService.resetSetting(key);
            toast.success(`${section.label} reset to the default.`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't reset that setting."));
        } finally {
            afterChange();
        }
    };

    // Ctrl/⌘+S saves, and leaving with unsaved edits asks first.
    const saveRef = useRef(saveAll);
    saveRef.current = saveAll;
    const hasEdits = dirty.length > 0;
    useEffect(() => {
        if (!hasEdits) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key?.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void saveRef.current();
            }
        };
        const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, [hasEdits]);

    // The nav follows the panel in view.
    const observe = useCallback((root: HTMLFieldSetElement | null) => {
        if (!root) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-20% 0px -60% 0px" },
        );
        root.querySelectorAll("section[id]").forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, []);

    const prefixValid = certificateSchema.safeParse(certificate.values).success;
    const minutes = supportSchema.safeParse(support.values).success ? Number(support.values.slotMinutes) : null;

    return (
        <div className={cn("grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]", hasEdits && "pb-24")}>
            <nav aria-label="Settings" className="hidden lg:block">
                <ul className="sticky top-8 space-y-0.5">
                    {NAV.map((item) => {
                        const section = sectionFor(item.key);
                        return (
                            <li key={item.id}>
                                <a
                                    href={`#${item.id}`}
                                    aria-current={active === item.id ? "true" : undefined}
                                    className={cn(
                                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        active === item.id ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-secondary",
                                    )}
                                >
                                    <item.icon className="size-4 shrink-0" aria-hidden />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {section.dirty ? (
                                        <span className="size-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                                    ) : (
                                        changedAt[item.key] && <span className="size-1.5 rounded-full bg-primary/50" title="Changed from the default" />
                                    )}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <fieldset ref={observe} disabled={saving} className="min-w-0 space-y-6">
                <SettingSection
                    id="xp"
                    icon={Trophy}
                    title="XP & leaderboard"
                    purpose="Points students earn as they learn. Each course's leaderboard ranks by them."
                    dirty={xp.isDirty}
                    changedAt={changedAt["xp.rules"]}
                    onReset={() => resetToDefault("xp.rules")}
                >
                    <XpRules form={xp} defaults={defaults["xp.rules"]} />
                    <SettingFacts>
                        <li>New awards use these numbers; XP students have already earned stays as it was.</li>
                        <li>0 switches an award off.</li>
                    </SettingFacts>
                </SettingSection>

                <SettingSection
                    id="support"
                    icon={Headphones}
                    title="Support sessions"
                    purpose="How long each student usually gets with a mentor in a live support session."
                    dirty={support.isDirty}
                    changedAt={changedAt["support.slotMinutes"]}
                    onReset={() => resetToDefault("support.slotMinutes")}
                >
                    <div className="grid gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start">
                        <FormField form={support} name="slotMinutes" label="Minutes per student" required hint="1 to 60.">
                            <Input type="number" inputMode="numeric" min={1} max={60} step={1} className="tabular-nums" />
                        </FormField>
                        <QueueExample minutes={minutes} />
                    </div>
                    <SettingFacts>
                        <li>New sessions start from this — whoever schedules one can still change it there.</li>
                        <li>Sessions already scheduled keep their own minutes.</li>
                        <li>It only estimates the wait students see; mentors move the queue on themselves, and nobody is cut off.</li>
                    </SettingFacts>
                </SettingSection>

                <SettingSection
                    id="certificates"
                    icon={Award}
                    title="Certificates"
                    purpose="The start of every certificate's ID — printed on it, and in the link that verifies it."
                    dirty={certificate.isDirty}
                    changedAt={changedAt["certificate.prefix"]}
                    onReset={() => resetToDefault("certificate.prefix")}
                >
                    <div className="grid gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start">
                        <FormField
                            form={certificate}
                            name="prefix"
                            label="ID prefix"
                            required
                            hint="2–12 capital letters or digits."
                        >
                            <Input
                                className="font-mono uppercase"
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={12}
                                value={certificate.values.prefix}
                                onChange={(event) => certificate.setValue("prefix", event.target.value.toUpperCase())}
                            />
                        </FormField>
                        <CertificatePreview prefix={prefixValid ? certificate.values.prefix.trim() : null} />
                    </div>
                    <SettingFacts>
                        <li>A course with a certificate code (set on the course) adds it after the prefix: HCC-CE-2026-000125. The preview is for a course without one.</li>
                        <li>Numbers count separately for each prefix, course code and year, so a new prefix starts again at 000001.</li>
                        <li>Certificates already issued keep their IDs, and their verification links keep working.</li>
                    </SettingFacts>
                </SettingSection>

                <SettingSection
                    id="learning"
                    icon={ListOrdered}
                    title="Learning order"
                    purpose="Whether students must finish each module before the next one opens."
                    dirty={learning.isDirty}
                    changedAt={changedAt["learning.sequential"]}
                    onReset={() => resetToDefault("learning.sequential")}
                >
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium" id="sequential-label">
                                Sequential learning
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                Each module unlocks once every module before it is finished.
                            </p>
                        </div>
                        <Switch
                            checked={learning.values.sequential}
                            onCheckedChange={(next) => learning.setValue("sequential", next)}
                            aria-label="Sequential learning"
                        />
                    </div>
                    <div className="mt-4">
                        <SequenceDiagram sequential={learning.values.sequential} />
                    </div>
                    <SettingFacts>
                        <li>Applies to every course and every enrolled student as soon as it&apos;s saved; staff previews are never locked.</li>
                        <li>A locked module&apos;s lessons and quiz are refused by the server too — not just hidden.</li>
                        <li>Turned on mid-course, a student who skipped ahead finds later modules locked until they finish the one they missed.</li>
                    </SettingFacts>
                </SettingSection>
            </fieldset>

            {hasEdits && (
                <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none lg:left-(--console-sidebar)">
                    <div
                        role="region"
                        aria-label="Unsaved changes"
                        className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card/95 px-4 py-3 backdrop-blur"
                        style={{ boxShadow: "var(--shadow-panel)" }}
                    >
                        <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                        <p className="min-w-0 flex-1 text-sm">
                            <span className="font-medium">Unsaved changes</span>
                            <span className="text-muted-foreground"> — {dirty.map((section) => section.label).join(", ")}</span>
                        </p>
                        <Button type="button" variant="ghost" size="sm" onClick={discardAll} disabled={saving}>
                            Discard
                        </Button>
                        <Button type="button" size="sm" onClick={saveAll} isLoading={saving}>
                            {!saving && <Save />} Save changes
                            <kbd className="ml-1 hidden rounded bg-white/20 px-1 font-sans text-[0.625rem] sm:inline">
                                {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘S" : "Ctrl S"}
                            </kbd>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
