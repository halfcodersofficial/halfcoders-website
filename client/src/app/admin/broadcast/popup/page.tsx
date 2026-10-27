"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import AudiencePicker from "@/components/admin/broadcast/AudiencePicker";
import { DraftStatus, SentReceipt, type Sent } from "@/components/admin/broadcast/ComposerStatus";
import ComposerStep from "@/components/admin/broadcast/ComposerStep";
import {
    COURSE_REQUIRED,
    courseChosen,
    destinationsFor,
    EMPTY_MESSAGE,
    hasWords,
    messageShape,
    people,
    reachOf,
    useDropMissingCourse,
    useKeptDraft,
    withoutWords,
} from "@/components/admin/broadcast/composer";
import FrequencyPicker from "@/components/admin/broadcast/FrequencyPicker";
import HoldToSend from "@/components/admin/broadcast/HoldToSend";
import LivePopups, { LIVE_POPUPS_KEY } from "@/components/admin/broadcast/LivePopups";
import MessageFields from "@/components/admin/broadcast/MessageFields";
import RecipientPreview, { type PreviewView } from "@/components/admin/broadcast/RecipientPreview";
import { FormField } from "@/components/ui/form";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction, LOGIN_POPUP_LOCK_SECONDS } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const FREQUENCY_VALUES = ["ONCE", "EVERY_LOGIN"] as const;

const schema = z
    .object({ ...messageShape, frequency: z.enum(FREQUENCY_VALUES) })
    .refine(courseChosen, COURSE_REQUIRED);

const EMPTY = { ...EMPTY_MESSAGE, frequency: "ONCE" };

type PopupDraft = typeof EMPTY;

const DRAFT_KEY = "admin.popup.draft";
const DRAFT_ALLOWED: Partial<Record<keyof PopupDraft, readonly string[]>> = { frequency: FREQUENCY_VALUES };

const VIEWS: readonly PreviewView[] = ["popup", "bell"];

/**
 * Popup Alert: a broadcast that also covers each recipient's screen when
 * they open Half Coders — once, or once in every sign-in — locked for its first
 * ten seconds so it's read, not reflexively closed. Composed like Broadcast
 * (who, what, how often, send) beside a live picture of the pop-up itself;
 * below, every pop-up still out there, each of which can be stopped.
 */
export default function AdminPopupAlertPage() {
    const queryClient = useQueryClient();
    const [view, setView] = useState<PreviewView>("popup");
    const [sent, setSent] = useState<Sent<PopupDraft> | null>(null);
    const [deliveries, setDeliveries] = useState(0);

    const { data: audience, isLoading, isError } = useQuery({
        queryKey: ["admin", "broadcast-audience"],
        queryFn: adminService.broadcastAudience,
    });

    const broadcast = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.broadcast({
                title: values.title,
                message: values.message,
                type: values.type,
                link: values.link || undefined,
                audience: values.audience,
                courseId: values.audience === "COURSE" ? values.courseId : undefined,
                // What makes this a pop-up rather than a plain broadcast: every
                // row it writes is also shown at login, not only in the bell.
                showOnLogin: true,
                repeatOnLogin: values.frequency === "EVERY_LOGIN",
            }),
        onSuccess: (result, values) => {
            // 0 means nothing went out — an audience emptied since the count,
            // or a failed write — so keep the words.
            if (result.recipients === 0) {
                toast.error("Nobody received that — no one is in this audience right now. Your message is still here.");
                return;
            }

            const reach = people(result.recipients, values.audience);
            toast.success(
                values.frequency === "EVERY_LOGIN"
                    ? `Sent — it pops up for ${reach} every time they sign in.`
                    : `Sent — it pops up for ${reach} the next time they open Half Coders.`,
            );
            setSent({ values, reach, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
            setDeliveries((n) => n + 1);
            forgetDraft();
            void queryClient.invalidateQueries({ queryKey: LIVE_POPUPS_KEY });
            // Audience, type and frequency usually carry over to the next one;
            // the words don't.
            form.reset(withoutWords(values));
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send that pop-up.")),
    });

    const form = useZodForm({
        schema,
        initialValues: EMPTY,
        onSubmit: (values) => broadcast.mutate(values),
    });
    const { values, errors, reset, setValue } = form;

    const forgetDraft = useKeptDraft(DRAFT_KEY, EMPTY, DRAFT_ALLOWED, values, reset);
    useDropMissingCourse(audience, values.courseId, useCallback(() => setValue("courseId", ""), [setValue]));

    const reachCount = reachOf(values, audience);
    const reach = reachCount === null ? null : people(reachCount, values.audience);
    const nobody = reachCount === 0;
    const repeat = values.frequency === "EVERY_LOGIN";

    // Until the next one is started, the preview keeps showing what just went out.
    const showingSent = sent !== null && !hasWords(values);
    const shown = showingSent ? sent.values : values;

    const clearDraft = async () => {
        if (
            values.message.trim().length > 40 &&
            !(await confirmAction({ title: "Clear this draft?", text: "The title, message and link are removed.", confirmText: "Clear" }))
        ) {
            return;
        }
        forgetDraft();
        reset(withoutWords(values));
    };

    const confirmSend = async () => {
        const confirmed = await confirmAction({
            title: `Send this pop-up to ${reach ?? "this audience"}?`,
            text: repeat
                ? "It covers their screen at every sign-in until they read it or you stop it."
                : "It covers their screen the next time they open Half Coders.",
            confirmText: "Send now",
            tone: "default",
        });
        if (confirmed) form.submit();
    };

    const preview = (className?: string) => (
        <RecipientPreview
            views={VIEWS}
            title={shown.title}
            message={shown.message}
            type={shown.type}
            link={shown.link}
            view={view}
            onViewChange={setView}
            repeat={shown.frequency === "EVERY_LOGIN"}
            reach={showingSent ? sent.reach : reach}
            stamp={showingSent ? `Sent ${sent.at}` : undefined}
            deliveries={deliveries}
            className={className}
        />
    );

    return (
        <div className="max-w-6xl space-y-12">
            <div className="space-y-8">
                <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold sm:text-3xl">Popup Alert</h1>
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
                            A message that covers the screen when they open Half Coders — for the announcements everyone
                            genuinely has to see.
                        </p>
                    </div>
                    <Link
                        href="/admin/broadcast"
                        className="group inline-flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm transition-colors hover:border-primary/30"
                    >
                        <Send className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="text-sm">
                            <span className="block text-xs text-muted-foreground">Only needs to be in their bell?</span>
                            <span className="block font-medium">Send a Broadcast</span>
                        </span>
                        <ArrowRight
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                        />
                    </Link>
                </header>

                <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-14">
                    <form noValidate onSubmit={(event) => event.preventDefault()} className="min-w-0">
                        <ComposerStep
                            index={1}
                            title="Who sees it"
                            hint="The counts are live — exactly who the send reaches."
                            done={values.audience !== "COURSE" || reachCount !== null}
                            delayMs={80}
                        >
                            <AudiencePicker
                                value={values.audience}
                                courseId={values.courseId}
                                onAudience={(next) => setValue("audience", next)}
                                onCourse={(next) => setValue("courseId", next)}
                                audience={audience}
                                isLoading={isLoading}
                                isError={isError}
                                audienceId={form.idFor("audience")}
                                courseFieldId={form.idFor("courseId")}
                                courseError={form.errorFor("courseId")}
                            />
                        </ComposerStep>

                        <ComposerStep
                            index={2}
                            title="What it says"
                            done={!errors.title && !errors.message && !errors.link}
                            delayMs={160}
                            aside={hasWords(values) && <DraftStatus onClear={clearDraft} />}
                        >
                            <MessageFields
                                form={form}
                                destinations={destinationsFor(values, audience)}
                                titlePlaceholder="Platform maintenance this weekend"
                                messagePlaceholder="Half Coders will be briefly unavailable on Saturday night for scheduled maintenance."
                                messageHint={`Plain text; line breaks are kept. Short enough to read in ${LOGIN_POPUP_LOCK_SECONDS} seconds is ideal.`}
                                linkHint="Shown as a “View” button once the pop-up unlocks — a path inside Half Coders."
                            />
                        </ComposerStep>

                        <ComposerStep index={3} title="How often" done delayMs={240}>
                            <FormField form={form} name="frequency" label={<span className="sr-only">How often</span>}>
                                <FrequencyPicker />
                            </FormField>

                            {/* Below xl the preview has no column of its own, so it sits here, before the send. */}
                            {preview("mt-8 max-w-md xl:hidden")}
                        </ComposerStep>

                        <ComposerStep index={4} title="Send it" last delayMs={320}>
                            <p className="mb-4 max-w-xl text-sm text-muted-foreground">
                                {nobody ? (
                                    "No one is in this audience yet — choose another to send."
                                ) : (
                                    <>
                                        Pops up for{" "}
                                        {reach ? <strong className="font-semibold text-foreground">{reach}</strong> : "the whole audience"}{" "}
                                        {repeat ? "every time they sign in" : "the next time they open Half Coders"}, locked for its
                                        first {LOGIN_POPUP_LOCK_SECONDS} seconds, and lands in their bell too.{" "}
                                        {repeat ? (
                                            <>
                                                It keeps coming back until they read it there or you{" "}
                                                <a href="#live-popups" className="font-medium text-primary underline-offset-2 hover:underline">
                                                    stop it
                                                </a>
                                                .
                                            </>
                                        ) : (
                                            "It can't be edited once sent."
                                        )}
                                    </>
                                )}
                            </p>

                            <HoldToSend
                                ready={form.isValid && !nobody}
                                disabled={nobody}
                                isLoading={broadcast.isPending}
                                onBlocked={form.submit}
                                onSend={form.submit}
                                onConfirm={confirmSend}
                            >
                                {nobody ? "No one to send to" : reach ? `Hold to send pop-up to ${reach}` : "Hold to send pop-up"}
                            </HoldToSend>

                            {sent && (
                                <SentReceipt
                                    key={deliveries}
                                    sent={sent}
                                    note={
                                        sent.values.frequency === "EVERY_LOGIN"
                                            ? "It's listed below, where you can stop it."
                                            : "It shows at their next visit."
                                    }
                                />
                            )}
                        </ComposerStep>
                    </form>

                    <aside className={cn("hidden xl:block", RISE)} style={{ animationDelay: "200ms" }}>
                        <div className="sticky top-8">{preview()}</div>
                    </aside>
                </div>
            </div>

            <div className={RISE} style={{ animationDelay: "400ms" }}>
                <LivePopups />
            </div>
        </div>
    );
}
