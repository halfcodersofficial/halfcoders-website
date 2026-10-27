"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { confirmAction } from "@/lib/confirm";
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
 * "Rate this course", in the learn sidebar: 1–5 stars and a few words. It
 * reaches the public course page (with the student's name) once an admin
 * publishes it; an edit goes back for approval.
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
            <Modal open={open} onOpenChange={setOpen} title={review ? "Your review" : "Rate this course"} description="Shown on the course page with your name, once approved.">
                {open && (
                    <ReviewForm
                        courseId={courseId}
                        review={review}
                        onDone={() => {
                            setOpen(false);
                            void queryClient.invalidateQueries({ queryKey: key });
                        }}
                    />
                )}
            </Modal>
        </>
    );
}

function ReviewForm({ courseId, review, onDone }: { courseId: string; review: MyCourseReview | null; onDone: () => void }) {
    const [rating, setRating] = useState(review?.rating ?? 0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState(review?.comment ?? "");
    const save = useMutation({
        mutationFn: () => courseReviewService.save(courseId, { rating, comment: comment.trim() || undefined }),
        onSuccess: () => {
            toast.success("Thanks — your review is with us for approval.");
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your review.")),
    });
    const remove = useMutation({
        mutationFn: () => courseReviewService.removeMine(courseId),
        onSuccess: () => {
            toast.success("Review removed.");
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove it.")),
    });
    const shown = hover || rating;

    return (
        <>
            <ModalBody className="space-y-5">
                {review && <p className="rounded-lg bg-secondary/50 px-3 py-2 text-center text-xs text-muted-foreground">{STATUS_LINE[review.status]}</p>}
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
            </ModalBody>
            <ModalFooter>
                {review && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        isLoading={remove.isPending}
                        onClick={async () => {
                            if (await confirmAction({ title: "Remove your review?", text: "It comes off the course page too.", confirmText: "Remove" })) remove.mutate();
                        }}
                    >
                        Remove
                    </Button>
                )}
                <Button type="button" disabled={rating === 0} isLoading={save.isPending} onClick={() => save.mutate()}>
                    {review ? "Save" : "Send review"}
                </Button>
            </ModalFooter>
        </>
    );
}
