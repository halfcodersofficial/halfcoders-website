"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { courseReviewService } from "@/services";
import type { MyCourseReview } from "@/types/domain.types";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const STATUS_LINE: Record<MyCourseReview["status"], string> = {
    PENDING: "Waiting for approval — it shows on the course page once an admin publishes it.",
    PUBLISHED: "On the course page.",
    HIDDEN: "Not shown on the course page.",
};

/**
 * "Rate this course", in the learn sidebar: 1–5 stars and a few words, given
 * once. It reaches the public course page (with the student's name) once an
 * admin publishes it. After that the student can see what they gave, but not
 * change or remove it.
 */
export default function RateCourse({ courseId }: { courseId: string }) {
    const queryClient = useQueryClient();
    const key = ["learning", "my-review", courseId];
    const { data } = useQuery({ queryKey: key, queryFn: () => courseReviewService.mine(courseId) });
    const [open, setOpen] = useState(false);
    const review = data?.review ?? null;
    if (!data?.canReview) return null;

    return (
        <>
            <Button variant="outline" className="w-full rounded-full" onClick={() => setOpen(true)}>
                <Star className={cn("size-4", review && "fill-amber-400 text-amber-400")} />
                {review ? `Your rating: ${review.rating} of 5` : "Rate this course"}
            </Button>
            <Modal
                open={open}
                onOpenChange={setOpen}
                title={review ? "Your review" : "Rate this course"}
                description="Shown on the course page with your name, once approved."
            >
                {open &&
                    (review ? (
                        <GivenReview review={review} onClose={() => setOpen(false)} />
                    ) : (
                        <ReviewForm
                            courseId={courseId}
                            onDone={() => {
                                setOpen(false);
                                void queryClient.invalidateQueries({ queryKey: key });
                            }}
                        />
                    ))}
            </Modal>
        </>
    );
}

function Stars({ value, className }: { value: number; className?: string }) {
    return (
        <span className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    aria-hidden
                    className={cn(className, star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                />
            ))}
        </span>
    );
}

/** The review already given — to read, not to change. */
function GivenReview({ review, onClose }: { review: MyCourseReview; onClose: () => void }) {
    return (
        <>
            <ModalBody className="space-y-5">
                <p className="rounded-lg bg-secondary/50 px-3 py-2 text-center text-xs text-muted-foreground">
                    {STATUS_LINE[review.status]}
                </p>
                <div className="text-center" role="img" aria-label={`${review.rating} of 5 stars — ${LABELS[review.rating]}`}>
                    <Stars value={review.rating} className="size-8" />
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{LABELS[review.rating]}</p>
                </div>
                {review.comment && (
                    <p className="whitespace-pre-line rounded-lg border border-border px-3 py-2.5 text-sm wrap-break-word">
                        {review.comment}
                    </p>
                )}
                <p className="text-center text-xs text-muted-foreground">
                    You&apos;ve rated this course. A rating can be given only once.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </>
    );
}

function ReviewForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState("");
    const save = useMutation({
        mutationFn: () => courseReviewService.save(courseId, { rating, comment: comment.trim() || undefined }),
        onSuccess: () => {
            toast.success("Thanks — your review is with us for approval.");
            onDone();
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, "Couldn't save your review."));
            // Already rated (from another tab, say): show what's there.
            if (isAxiosError(error) && error.response?.status === 409) onDone();
        },
    });
    const shown = hover || rating;

    return (
        <>
            <ModalBody className="space-y-5">
                <div className="text-center">
                    <div role="radiogroup" aria-label="Your rating" className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                role="radio"
                                aria-checked={rating === star}
                                aria-label={`${star} ${star === 1 ? "star" : "stars"} — ${LABELS[star]}`}
                                onMouseEnter={() => setHover(star)}
                                onClick={() => setRating(star)}
                                className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Star className={cn("size-8", star <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                            </button>
                        ))}
                    </div>
                    <p className="mt-1 h-5 text-sm font-medium text-muted-foreground">{LABELS[shown]}</p>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="review-comment" className="text-sm font-medium">
                        A few words <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                        id="review-comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="What was it like? What did you get out of it?"
                    />
                </div>
                <p className="text-xs text-muted-foreground">
                    You can rate a course only once — once sent, it can&apos;t be changed or removed.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button type="button" disabled={rating === 0} isLoading={save.isPending} onClick={() => save.mutate()}>
                    Send review
                </Button>
            </ModalFooter>
        </>
    );
}
