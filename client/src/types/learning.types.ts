import type { OrderStatus, QuizAttemptStatus, SubmissionStatus } from "./api.types";
import type { LessonType, UserSummary } from "./domain.types";

export interface AssignmentSubmission {
    id: string;
    content: string | null;
    submissionUrl: string | null;
    fileUrls: string[];
    status: SubmissionStatus;
    score: number | null;
    /** The most this submission can score — set when it came in late; null means full marks. */
    maxScore: number | null;
    feedback: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewedBy: UserSummary | null;
    /** Points per rubric line, once reviewed with the rubric. */
    rubricScores?: { criterionId: string; points: number; comment: string | null }[];
}

/**
 * A late-submission window after an assignment's deadline: a first submission
 * by `until` can score at most `maxMarks`. Set per assignment by staff.
 */
export interface AssignmentLateTier {
    until: string;
    maxMarks: number;
}

/** A lesson that comes with an assignment — one of the three lesson types. */
export interface AssignmentMaterial {
    id: string;
    type: LessonType;
    title: string;
    description: string | null;
    order: number;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    content: string | null;
    resourceUrl: string | null;
}

export interface StudentAssignment {
    id: string;
    title: string;
    description: string;
    /** Written in the same light markdown as text lessons. */
    instructions: string | null;
    attachments: string[];
    /** The assignment's own lessons, in order. */
    materials: AssignmentMaterial[];
    totalMarks: number;
    deadline: string | null;
    /** In order; empty when submissions simply close at the deadline. */
    lateTiers: AssignmentLateTier[];
    order: number;
    milestone: { id: string; title: string; order: number };
    course: { id: string; title: string; slug: string };
    /** How it's marked, line by line — empty for a single overall score. */
    rubric: { id: string; title: string; description: string | null; maxPoints: number; order: number }[];
    submission: AssignmentSubmission | null;
    isOverdue: boolean;
    /** Where a submission made right now would land, and what it would be marked out of. */
    window: {
        status: "ON_TIME" | "LATE" | "CLOSED";
        maxScore: number | null;
        until: string | null;
    };
    /** False once a submission is accepted or awaiting review, or once submissions have closed. */
    canSubmit: boolean;
}

export interface StudentPracticeDay {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    order: number;
    milestone: { id: string; title: string; order: number };
    course: { id: string; title: string; slug: string };
    completion: { id: string; note: string | null; completedAt: string } | null;
    isCompleted: boolean;
}

// ---- Quiz ------------------------------------------------------------------

export interface QuizAttemptSummary {
    id: string;
    status: QuizAttemptStatus;
    score: number;
    percentage: number;
    correctCount: number;
    incorrectCount: number;
    totalQuestions: number;
    startedAt: string;
    completedAt: string | null;
}

/** A submitted quiz's score — a quiz is taken once, so there's one of these at most. */
export interface QuizResult {
    /** The attempt to open for "See correct answers". */
    id: string;
    score: number;
    percentage: number;
    correctCount: number;
    incorrectCount: number;
    totalQuestions: number;
    completedAt: string | null;
}

/** One option as offered to the student — never carries `isCorrect`. */
export interface QuizOptionChoice {
    id: string;
    text: string;
    order: number;
}

export interface QuizQuestionForStudent {
    id: string;
    question: string;
    order: number;
    options: QuizOptionChoice[];
}

/**
 * A quiz as the student sees it. Until they submit: the questions, with
 * nothing that gives the answers away, and `result` null. After: `result`,
 * and no questions — the answers come from the review instead.
 */
export interface QuizForStudent {
    id: string;
    title: string;
    description: string | null;
    moduleTitle: string;
    totalQuestions: number;
    result: QuizResult | null;
    questions: QuizQuestionForStudent[];
}

/** One question in a submitted attempt's review. */
export interface QuizReviewQuestion {
    id: string;
    question: string;
    explanation: string | null;
    /** Present only once this question is safe to reveal — see `QuizService.getAttempt`. */
    options: { id: string; text: string; isCorrect?: boolean }[];
    selectedOptionId: string | null;
    isCorrect: boolean | null;
}

export interface QuizAttemptReview extends QuizAttemptSummary {
    quiz: { id: string; title: string };
    questions: QuizReviewQuestion[];
}

export interface OrderDetail {
    id: string;
    orderNumber: string;
    amount: number;
    discount: number;
    total: number;
    currency: string;
    /** The coupon it was bought with, if any — its share is inside `discount`. */
    couponCode: string | null;
    /** The coupon's share of `discount`; the rest is the course's own sale price. */
    couponDiscount: number;
    /** The code's public face, for the receipt — absent on responses that don't look it up. */
    coupon?: { code: string; label: string | null; kind: "PERCENT" | "FIXED"; value: number } | null;
    status: OrderStatus;
    createdAt: string;
    course: { id: string; title: string; slug: string; thumbnail: string | null; price: number };
    student: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        /** Where Half Coders mails them — the contact email they gave at sign-up. */
        learningProfile?: { contactEmail: string | null; whatsapp: string | null } | null;
    };
    payment: {
        id: string;
        gateway: string;
        transactionId: string | null;
        status: OrderStatus;
        paidAt: string | null;
        /** For a bKash payment sent in by the student: the number they paid from, and when they sent it. */
        gatewayData?: BkashDetails | null;
        failureReason?: string | null;
    } | null;
}

/** What a student sends in after paying by bKash, kept on the payment for the admin who verifies it. */
export interface BkashDetails {
    method?: string;
    senderNumber?: string;
    submittedAt?: string;
}

export type RefundRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

/** A student's request for their money back on an order. */
export interface RefundRequest {
    id: string;
    orderId: string;
    reason: string;
    status: RefundRequestStatus;
    adminNote: string | null;
    decidedAt: string | null;
    createdAt: string;
    order: { id: string; orderNumber: string; total: number; currency: string; status: OrderStatus; course: { id: string; title: string; slug: string } };
}

/**
 * What a code does, before there's an order — `GET /coupons/check`. A bad
 * code comes back with `usable: false` and only the reason.
 */
export interface CouponCheck {
    code: string;
    usable: boolean;
    /** Why it can't be used, in words for the student. */
    reason: string | null;
    label?: string | null;
    kind?: "PERCENT" | "FIXED";
    value?: number;
    maxDiscount?: number | null;
    minAmount?: number | null;
    allCourses?: boolean;
    /** The courses it's for, when not every course (published ones only). */
    courses?: { id: string; title: string; slug: string }[];
    endsAt?: string | null;
    /** With a course asked about and the code usable on it: that course's price with the code. */
    preview?: { courseId: string; salePrice: number; off: number; total: number } | null;
}
