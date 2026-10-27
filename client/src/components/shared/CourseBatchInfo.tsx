"use client";

import { useCourseBatches } from "@/hooks/useCourseBatches";
import type { UiLanguage } from "@/lib/i18n";
import { formatBatchDateTime, hasBatchDates, type BatchSchedule } from "@/lib/courseBatch";
import { cn } from "@/lib/utils";

interface CourseBatchInfoProps {
    schedule: BatchSchedule;
    /** When the server rendered the page — see `useCourseBatches`. */
    renderedAt?: number;
    /** Takes the language rather than reading it from context: the public
     *  page is Bangla without a `UiLanguageProvider` around it. */
    lang: UiLanguage;
    className?: string;
}

/**
 * On the purchase card: whether a bootcamp takes enrolments right now, and
 * until or from when — updating itself as a window opens or closes. The batch
 * dates themselves are in `CourseBatchSchedule`, further down the page.
 * Nothing off bootcamp, or for a bootcamp without dates.
 */
export default function CourseBatchInfo({ schedule, renderedAt, lang, className }: CourseBatchInfoProps) {
    const batches = useCourseBatches(schedule, renderedAt);
    if (!hasBatchDates(batches)) return null;

    const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
    const { enrollmentOpen, enrollingInto, closesAt, opensAt } = batches;

    const status = enrollmentOpen
        ? enrollingInto === "next"
            ? closesAt
                ? t(
                    `Enrolment for the next batch is open until ${formatBatchDateTime(closesAt)}.`,
                    `পরের ব্যাচে ভর্তি চলছে — ${formatBatchDateTime(closesAt)} পর্যন্ত।`,
                )
                : t("Enrolment for the next batch is open.", "পরের ব্যাচে ভর্তি চলছে।")
            : closesAt
                ? t(`Enrolment is open until ${formatBatchDateTime(closesAt)}.`, `ভর্তি চলছে — ${formatBatchDateTime(closesAt)} পর্যন্ত।`)
                : t("Enrolment is open.", "ভর্তি চলছে।")
        : opensAt
            ? t(`Enrolment opens on ${formatBatchDateTime(opensAt)}.`, `ভর্তি শুরু হবে ${formatBatchDateTime(opensAt)}।`)
            : t(
                "Enrolment for this batch has closed. The next batch will be announced soon.",
                "এই ব্যাচে ভর্তি বন্ধ। পরের ব্যাচের তারিখ শিগগিরই জানানো হবে।",
            );

    return (
        <p
            className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
                enrollmentOpen ? "border-success/30 bg-success/5 font-medium text-success-ink" : "border-border bg-surface text-muted-foreground",
                className,
            )}
            aria-live="polite"
        >
            {/* Pulses while enrolment is open: it's live, and it won't last. */}
            <span className="relative mt-1.5 flex size-2 shrink-0" aria-hidden>
                {enrollmentOpen && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                )}
                <span className="relative size-2 rounded-full bg-current" />
            </span>
            {status}
        </p>
    );
}
