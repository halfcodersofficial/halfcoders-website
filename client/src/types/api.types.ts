export interface ApiMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    meta?: ApiMeta;
}

export interface ApiErrorSource {
    path: string;
    message: string;
}

export interface ApiErrorResponse {
    success: false;
    message: string;
    errorSources?: ApiErrorSource[];
    /** Some errors attach structured context — e.g. certificate eligibility. */
    data?: unknown;
}

export type Role = "STUDENT" | "MENTOR" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "BLOCKED" | "DELETED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CourseType = "BOOTCAMP" | "TRADITIONAL";
/** Where a course is in its life — running, not started yet, or over and sold as recordings. */
export type CoursePhase = "PRESENT" | "UPCOMING" | "PREVIOUS";
export type CoursePricing = "FREE" | "PAID";
/** How its classes are delivered. HYBRID is live classes plus recorded lessons. */
export type CourseDelivery = "LIVE" | "RECORDED" | "HYBRID";
/** Online, in person at a venue, or both — apart from `CourseDelivery`. */
export type CourseMode = "ONLINE" | "OFFLINE" | "BOTH";
/** Where one module or outline item happens, on a course that runs both. */
export type ClassMode = Exclude<CourseMode, "BOTH">;
/** A bundle's price: one fixed sum, or a percentage off the courses' combined sale price. */
export type BundlePricing = "FIXED" | "PERCENT";
/** What a completion reward asks for: 100% of the course, or its certificate. */
export type RewardCondition = "COURSE_COMPLETE" | "CERTIFICATE";
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type SubmissionStatus =
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "ACCEPTED"
    | "NEEDS_REVISION"
    | "REJECTED";
export type SupportSessionStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
export type QuizQuestionType = "SINGLE_CHOICE";
export type QuizAttemptStatus = "IN_PROGRESS" | "COMPLETED";
export type SupportQueueStatus = "WAITING" | "SERVING" | "COMPLETED" | "SKIPPED" | "LEFT";
