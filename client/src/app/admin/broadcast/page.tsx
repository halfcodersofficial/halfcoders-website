"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import AudiencePicker from "@/components/admin/broadcast/AudiencePicker";
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
    type MessageDraft,
} from "@/components/admin/broadcast/composer";
import HoldToSend from "@/components/admin/broadcast/HoldToSend";
import MessageFields from "@/components/admin/broadcast/MessageFields";
import RecipientPreview, { type PreviewView } from "@/components/admin/broadcast/RecipientPreview";
import { DraftStatus, SentReceipt, type Sent } from "@/components/admin/broadcast/ComposerStatus";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const schema = z.object(messageShape).refine(courseChosen, COURSE_REQUIRED);

const DRAFT_KEY = "admin.broadcast.draft";
const DRAFT_ALLOWED = {};

const VIEWS: readonly PreviewView[] = ["bell", "inbox"];

/**
 * Broadcast: one in-app notification to a whole audience at once. Composed
 * in three steps down a rail — who, what, send — beside a live picture of
 * what a recipient will see. The send is press-and-hold, because it writes a
 * row per recipient and can't be recalled.
 */
export default function AdminBroadcastPage() {
    const [view, setView] = useState<PreviewView>("bell");
    const [sent, setSent] = useState<Sent<MessageDraft> | null>(null);
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
            }),
        onSuccess: (result, values) => {
            // The API reports 0 both for an audience that emptied out since
            // the count and for a write that failed — either way, nothing
            // went out, so keep the words.
            if (result.recipients === 0) {
                toast.error("Nobody received that — no one is in this audience right now. Your message is still here.");
                return;
            }

            const reach = people(result.recipients, values.audience);
            toast.success(`Sent to ${reach}.`);
            setSent({ values, reach, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
            setDeliveries((n) => n + 1);
            forgetDraft();
            // The audience and type are usually reused for the next broadcast;
            // the words are not. Resetting rather than setting also re-arms the
            // cleared fields, so the emptied title doesn't immediately turn red.
            form.reset(withoutWords(values));
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send that notification.")),
    });

    const form = useZodForm({
        schema,
        initialValues: EMPTY_MESSAGE,
        onSubmit: (values) => broadcast.mutate(values),
    });
    const { values, errors, reset, setValue } = form;

    const forgetDraft = useKeptDraft(DRAFT_KEY, EMPTY_MESSAGE, DRAFT_ALLOWED, values, reset);
    useDropMissingCourse(audience, values.courseId, useCallback(() => setValue("courseId", ""), [setValue]));

    const reachCount = reachOf(values, audience);
    const reach = reachCount === null ? null : people(reachCount, values.audience);
    const nobody = reachCount === 0;

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
            title: `Send to ${reach ?? "this audience"}?`,
            text: "It reaches everyone at once and can't be recalled.",
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
            reach={showingSent ? sent.reach : reach}
            stamp={showingSent ? `Sent ${sent.at}` : undefined}
            deliveries={deliveries}
            className={className}
        />
    );

    return (
        <div className="max-w-6xl space-y-8">
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Broadcast</h1>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
                        Write it once and it reaches a whole audience — in their notification bell, and on screen
                        straight away for anyone online.
                    </p>
                </div>
                <Link
                    href="/admin/broadcast/popup"
                    className="group inline-flex items-center gap-3 rounded-card border border-border bg-card px-3.5 py-2.5 shadow-card transition-colors hover:border-primary/30"
                >
                    <MonitorPlay className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-sm">
                        <span className="block text-xs text-muted-foreground">Must everyone see it at login?</span>
                        <span className="block font-medium">Send a Popup Alert</span>
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
                        title="Who hears it"
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
                        title="What they'll read"
                        done={!errors.title && !errors.message && !errors.link}
                        delayMs={160}
                        aside={hasWords(values) && <DraftStatus onClear={clearDraft} />}
                    >
                        <MessageFields
                            form={form}
                            destinations={destinationsFor(values, audience)}
                            titlePlaceholder="Module 17 is live"
                            messagePlaceholder="Module 17 — Authentication with JWT — is open now. Finish it before Friday's live class."
                            messageHint="Plain text. A web address written out in full (https://…) becomes a link on their Announcements page."
                            linkHint="Where “View” takes them — a path inside Half Coders, not a full URL."
                        />

                        {/* Below xl the preview has no column of its own, so it sits here, before the send. */}
                        {preview("mt-8 max-w-md xl:hidden")}
                    </ComposerStep>

                    <ComposerStep index={3} title="Send it" last delayMs={240}>
                        <p className="mb-4 max-w-xl text-sm text-muted-foreground">
                            {nobody ? (
                                "No one is in this audience yet — choose another to send."
                            ) : (
                                <>
                                    One send reaches{" "}
                                    {reach ? <strong className="font-semibold text-foreground">{reach}</strong> : "the whole audience"}{" "}
                                    at once. It can&apos;t be edited or recalled afterwards.
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
                            {nobody ? "No one to send to" : reach ? `Hold to send to ${reach}` : "Hold to send"}
                        </HoldToSend>

                        {sent && <SentReceipt key={deliveries} sent={sent} />}
                    </ComposerStep>
                </form>

                <aside className={cn("hidden xl:block", RISE)} style={{ animationDelay: "200ms" }}>
                    <div className="sticky top-8">{preview()}</div>
                </aside>
            </div>
        </div>
    );
}
