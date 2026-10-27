"use client";

import { THUMBNAIL_CHIP } from "@/components/shared/courseCardParts";
import { useCourseBatches } from "@/hooks/useCourseBatches";
import { formatBatchDate } from "@/lib/courseBatch";
import { cn } from "@/lib/utils";
import type { CourseCard } from "@/types/domain.types";

/**
 * A course card's batch status, for a bootcamp: enrolling now (and until
 * when), when enrolment opens, or when the batch starts — whichever is the
 * news, kept live like the course page's. Nothing for a traditional course,
 * or a bootcamp with nothing ahead.
 */
export default function CourseCardBatch({ course, className }: { course: CourseCard; className?: string }) {
    const batches = useCourseBatches({
        courseType: course.courseType,
        enrollmentStartsAt: course.enrollmentStartsAt ?? null,
        enrollmentEndsAt: course.enrollmentEndsAt ?? null,
        startsAt: course.startsAt ?? null,
        endsAt: course.endsAt ?? null,
        nextEnrollmentStartsAt: course.nextEnrollmentStartsAt ?? null,
        nextEnrollmentEndsAt: course.nextEnrollmentEndsAt ?? null,
        nextStartsAt: course.nextStartsAt ?? null,
        nextEndsAt: course.nextEndsAt ?? null,
    });
    if (!batches) return null;

    const startsAt = batches.present.startsAt;
    const status = batches.enrollmentOpen
        ? { live: true, text: batches.closesAt ? `Enrolling · until ${formatBatchDate(batches.closesAt)}` : "Enrolling now" }
        : batches.opensAt
            ? { live: false, text: `Enrolment opens ${formatBatchDate(batches.opensAt)}` }
            : startsAt && startsAt.getTime() > Date.now()
                ? { live: false, text: `Starts ${formatBatchDate(startsAt)}` }
                : null;
    if (!status) return null;

    return (
        <span
            className={cn(
                THUMBNAIL_CHIP,
                "gap-1.5",
                status.live ? "text-success" : "text-foreground",
                className,
            )}
        >
            <span className="relative flex size-1.5" aria-hidden>
                {status.live && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                )}
                <span className={cn("relative size-1.5 rounded-full", status.live ? "bg-current" : "bg-primary")} />
            </span>
            {status.text}
        </span>
    );
}
