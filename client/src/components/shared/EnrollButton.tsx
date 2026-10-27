"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCourseBatches } from "@/hooks/useCourseBatches";
import { useSession } from "@/hooks/useSession";
import type { BatchSchedule } from "@/lib/courseBatch";
import { getApiErrorMessage } from "@/lib/httpClient";
import { orderService } from "@/services";

interface EnrollButtonProps {
    courseId: string;
    courseSlug: string;
    isEnrolled: boolean;
    price: number;
    /** The course type and batch dates. A bootcamp takes enrolments only
     *  inside a batch's window (`lib/courseBatch.ts`); the button opens and
     *  closes on its own as one begins and ends. */
    schedule?: BatchSchedule;
    /** When the server rendered the page — see `useCourseBatches`. */
    renderedAt?: number;
    /** The look for the active states: the site's pressable call to action
     *  (`enroll`, `.cmd` in globals.css) by default — `inverse` on a brand-coloured panel. */
    variant?: "default" | "inverse";
}

/** A course with no schedule passed has no batches: always open. */
const NO_BATCHES: BatchSchedule = {
    courseType: "TRADITIONAL",
    enrollmentStartsAt: null,
    enrollmentEndsAt: null,
    startsAt: null,
    endsAt: null,
    nextEnrollmentStartsAt: null,
    nextEnrollmentEndsAt: null,
    nextStartsAt: null,
    nextEndsAt: null,
};

/**
 * The single call to action on the course page.
 *
 * Checkout deliberately sends only the course id — the API reads the price from
 * the database, so there's nothing here a client could tamper with. A free
 * course settles server-side immediately and comes back PAID, which is why the
 * success path branches on the returned status rather than on `price`.
 */
export default function EnrollButton({
    courseId,
    courseSlug,
    isEnrolled,
    price,
    schedule = NO_BATCHES,
    renderedAt,
    variant = "default",
}: EnrollButtonProps) {
    const router = useRouter();
    const { isAuthenticated, isLoading, isStudent } = useSession();
    const look = variant === "inverse" ? "inverse" : "enroll";
    const batches = useCourseBatches(schedule, renderedAt);

    const checkout = useMutation({
        mutationFn: () => orderService.checkout(courseId),
        onSuccess: (order) => {
            if (order.status === "PAID") {
                toast.success("আপনি ভর্তি হয়ে গেছেন — শুভ শিক্ষা!");
                router.push(`/learn/${courseSlug}`);
                return;
            }

            toast.success("অর্ডার তৈরি হয়েছে। কোর্স আনলক করতে পেমেন্ট সম্পন্ন করুন।");
            router.push(`/checkout/${order.id}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "চেকআউট শুরু করা যায়নি।")),
    });

    if (isEnrolled) {
        return (
            <Button className="w-full" variant={look} size="lg" onClick={() => router.push(`/learn/${courseSlug}`)}>
                শেখা চালিয়ে যান
            </Button>
        );
    }

    // Ahead of the login prompt: signing in to find the door shut helps no one.
    // The batch card beside the button says when enrolment opens.
    if (batches && !batches.enrollmentOpen) {
        return (
            <Button className="w-full" variant={look} size="lg" disabled>
                {batches.opensAt ? "ভর্তি শীঘ্রই শুরু হবে" : "ভর্তি বন্ধ"}
            </Button>
        );
    }

    if (!isLoading && !isAuthenticated) {
        return (
            <Button
                className="w-full"
                variant={look}
                size="lg"
                onClick={() =>
                    router.push(`/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`)
                }
            >
                কোর্সে ভর্তি হোন
            </Button>
        );
    }

    // Enrolment is a student action — the API refuses it for staff, so offering
    // the button to a mentor or an admin only buys them a 403.
    if (!isLoading && !isStudent) {
        return (
            <Button className="w-full" size="lg" variant={look === "inverse" ? "inverse" : "outline"} disabled>
                স্টাফ অ্যাকাউন্ট দিয়ে ভর্তি হওয়া যায় না
            </Button>
        );
    }

    return (
        <Button
            className="w-full"
            variant={look}
            size="lg"
            isLoading={checkout.isPending}
            disabled={isLoading}
            onClick={() => checkout.mutate()}
        >
            {price === 0 ? "ফ্রিতে শুরু করুন" : "কোর্সে ভর্তি হোন"}
        </Button>
    );
}
