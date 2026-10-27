import { useRef, useState } from "react";

/**
 * Presses landing this soon after a step change are dropped: the primary
 * button stays under the pointer as the step changes, so a double-click on
 * Next would skip the step after it — and one on Create would skip the review.
 */
const STEP_CHANGE_GRACE_MS = 400;

/**
 * The step machine behind a multi-step modal (CreateMentorModal,
 * CreateCourseModal): `stepCount` steps, then a review at index `stepCount`
 * where any step can be reopened — and a reopened step's primary button goes
 * straight back to the review instead of through the steps after it.
 */
export function useStepFlow(stepCount: number) {
    const review = stepCount;
    const [step, setStep] = useState(0);
    // Picks the side the step slides in from. Unset for the first step, which
    // arrives with the popup's own pop instead.
    const [direction, setDirection] = useState<"next" | "back" | null>(null);
    const [returnToReview, setReturnToReview] = useState(false);
    const lastStepChange = useRef(0);

    const goTo = (next: number) => {
        setDirection(next > step ? "next" : "back");
        setStep(next);
        lastStepChange.current = performance.now();
    };

    const editFromReview = (index: number) => {
        setReturnToReview(true);
        goTo(index);
    };

    return {
        step,
        /** The review's index — one past the last step. */
        review,
        isReview: step === review,
        isLastStep: step === review - 1,
        /** Set while a step reopened from the review is on screen. */
        returnToReview,
        /** Slides the step in from the side it's moving toward. */
        enterClass: direction ? `step-enter-${direction}` : undefined,
        goTo,
        editFromReview,
        /** A done step picked in ModalSteps: from the review it's an edit, otherwise just a jump back. */
        select: (index: number) => (step === review ? editFromReview(index) : goTo(index)),
        /** Forward from a step that passed its checks: the next one, or back to the review. */
        advance: () => {
            if (returnToReview || step === review - 1) {
                setReturnToReview(false);
                goTo(review);
            } else {
                goTo(step + 1);
            }
        },
        /** True for a press that is really the second half of a double-click on the previous step. */
        justChanged: () => performance.now() - lastStepChange.current < STEP_CHANGE_GRACE_MS,
    };
}
