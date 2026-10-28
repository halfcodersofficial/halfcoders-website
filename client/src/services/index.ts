import axios from "axios";
import envConfig from "@/lib/envConfig";
import httpClient from "@/lib/httpClient";
import type { ApiMeta, ApiResponse, SubmissionStatus } from "@/types/api.types";
import type {
    QueueHistoryEntry,
} from "@/types/mentor.types";
import type {
    CourseStudent,
    MentorDashboard,
    MentorMilestone,
    MentorPastSession,
    MentorSupportSession,
    ReviewQueueItem,
} from "@/types/mentor.types";
import type {
    CouponCheck,
    OrderDetail,
    RefundRequest,
    QuizAttemptReview,
    QuizAttemptSummary,
    QuizForStudent,
    QuizResult,
    StudentAssignment,
    StudentPracticeDay,
} from "@/types/learning.types";
import type {
    AppNotification,
    UnreadCount,
    BookmarkedLesson,
    BundleOrder,
    CoursePromotions,
    PublicBundle,
    Category,
    Certificate,
    CertificateVerification,
    CourseAnnouncement,
    CourseCard,
    InboxQuestion,
    CourseDetail,
    CourseLearning,
    CourseOutline,
    CurrentUser,
    EligibilityReport,
    Enrollment,
    LeaderboardRow,
    LessonAnswer,
    LessonQuestion,
    LessonReaction,
    MyCourseReview,
    MyDevice,
    RatingSummary,
    XpHistoryEntry,
    LessonState,
    LoginPopups,
    MyQueuePosition,
    Order,
    QueueBoard,
    StudentDashboard,
    MyAdmissionTicket,
    SupportSessionCard,
    UserPreferences,
    UserSummary,
} from "@/types/domain.types";

/** Every endpoint wraps its payload in { success, message, data, meta }. */
const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

const unwrapList = <T>(response: { data: ApiResponse<T> }): { data: T; meta?: ApiMeta } => ({
    data: response.data.data,
    meta: response.data.meta,
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Accounts: signing up, verifying the email, signing in and out, the password
 * flows, and the signed-in person's own profile. The session is an httpOnly
 * cookie the API sets — nothing is stored here.
 */
export const authService = {
    // `_silent` so the 401 for an anonymous visitor doesn't bounce them to
    // /login — every page calls this to find out who, if anyone, is signed in.
    me: () =>
        httpClient
            .get<ApiResponse<CurrentUser>>("/auth/me", { _silent: true })
            .then(unwrap),

    /** Creates the account and mails a code to verify the email. */
    register: (payload: { name: string; email: string; phone: string; password: string }) =>
        httpClient.post<ApiResponse<{ email: string }>>("/auth/register", payload).then(unwrap),

    /** Verifies the email with its code — and signs in. */
    verifyEmail: (payload: { email: string; code: string }) =>
        httpClient.post<ApiResponse<CurrentUser>>("/auth/verify-email", payload).then(unwrap),

    resendVerification: (email: string) =>
        httpClient.post<ApiResponse<null>>("/auth/resend-verification", { email }).then(unwrap),

    // `_silent`: a wrong password is answered on the form, not by a redirect.
    // `signOutAllDevices` is the device-limit step's "sign out of them and continue".
    login: (payload: { email: string; password: string; signOutAllDevices?: boolean }) =>
        httpClient.post<ApiResponse<CurrentUser>>("/auth/login", payload, { _silent: true }).then(unwrap),

    /**
     * Signs in — or signs up — with the code from Google's sign-in popup (or,
     * on the device-limit step, the ID token the API handed back).
     * `isNewAccount` is true when this made the account. `_silent` and
     * `signOutAllDevices` as for `login`.
     */
    googleSignIn: (payload: { code?: string; credential?: string; signOutAllDevices?: boolean }) =>
        httpClient
            .post<ApiResponse<CurrentUser & { isNewAccount: boolean }>>("/auth/google", payload, { _silent: true })
            .then(unwrap),

    logout: () => httpClient.post<ApiResponse<null>>("/auth/logout", undefined, { _silent: true }).then(unwrap),

    /** Every device this account is signed in on, this one marked `current`, and how many it may use. */
    devices: () => httpClient.get<ApiResponse<{ maxDevices: number; devices: MyDevice[] }>>("/auth/me/devices").then(unwrap),

    /** Signs one of the other devices out, by its id from `devices()`. */
    signOutDevice: (id: string) => httpClient.delete<ApiResponse<null>>(`/auth/me/devices/${id}`).then(unwrap),

    signOutOtherDevices: () =>
        httpClient.post<ApiResponse<{ signedOut: number }>>("/auth/me/devices/sign-out-others").then(unwrap),

    forgotPassword: (email: string) =>
        httpClient.post<ApiResponse<null>>("/auth/forgot-password", { email }).then(unwrap),

    /** Sets a new password with the mailed code — and signs in. */
    resetPassword: (payload: { email: string; code: string; password: string }) =>
        httpClient.post<ApiResponse<CurrentUser>>("/auth/reset-password", payload).then(unwrap),

    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
        httpClient.post<ApiResponse<null>>("/auth/change-password", payload).then(unwrap),

    /** Name and mobile number on the account; WhatsApp, bio and address on the learning profile. */
    updateProfile: (payload: Partial<Pick<CurrentUser, "name" | "phone" | "whatsapp" | "bio" | "address">>) =>
        httpClient.patch<ApiResponse<CurrentUser>>("/auth/me", payload).then(unwrap),

    /** Multipart upload — the server streams straight to Cloudinary and swaps `image`. */
    updateAvatar: (file: File) => {
        const formData = new FormData();
        formData.append("avatar", file);
        return httpClient
            .patch<ApiResponse<Pick<CurrentUser, "id" | "name" | "email" | "image">>>(
                "/auth/me/avatar",
                formData,
                { headers: { "Content-Type": "multipart/form-data" } },
            )
            .then(unwrap);
    },

    updatePreferences: (payload: Partial<UserPreferences>) =>
        httpClient.patch<ApiResponse<CurrentUser>>("/auth/me/preferences", payload).then(unwrap),
};

// ---------------------------------------------------------------------------
// Public catalogue
// ---------------------------------------------------------------------------

export const catalogueService = {
    categories: () => httpClient.get<ApiResponse<Category[]>>("/categories").then(unwrap),

    courses: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<CourseCard[]>>("/courses", { params }).then(unwrapList),

    courseBySlug: (slug: string) =>
        httpClient.get<ApiResponse<CourseDetail>>(`/courses/${slug}`).then(unwrap),

    /** The free courses, completion reward and bundles a course comes with — priced for the viewer. */
    coursePromotions: (courseId: string) =>
        httpClient.get<ApiResponse<CoursePromotions>>(`/promotions/courses/${courseId}`).then(unwrap),

    bundles: () => httpClient.get<ApiResponse<PublicBundle[]>>("/bundles").then(unwrap),

    bundle: (slug: string) => httpClient.get<ApiResponse<PublicBundle>>(`/bundles/${slug}`).then(unwrap),

    mentors: () =>
        httpClient.get<ApiResponse<UserSummary[]>>("/users/mentors/public").then(unwrap),

    /**
     * The pre-enrolment roadmap PDF. A blob response rather than a plain link:
     * the API 404s with a real error message when a course has none uploaded
     * yet, which only a blob request lets the caller catch and show as a toast
     * instead of opening a tab to a broken download.
     */
    downloadCurriculumPdf: async (slug: string) => {
        try {
            const response = await httpClient.get(`/courses/${slug}/curriculum-pdf`, {
                responseType: "blob",
            });

            const disposition = response.headers["content-disposition"] as string | undefined;
            const fileName = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "curriculum.pdf";

            return { blob: response.data as Blob, fileName };
        } catch (error) {
            // `responseType: "blob"` means a JSON error body also arrives as a
            // Blob — re-read it as text so `getApiErrorMessage` still surfaces
            // the API's real message ("Course curriculum is not available
            // yet.") instead of falling back to a generic one.
            if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
                const text = await error.response.data.text();
                const message = (() => {
                    try {
                        return (JSON.parse(text) as { message?: string }).message;
                    } catch {
                        return undefined;
                    }
                })();
                if (message) throw new Error(message);
            }
            throw error;
        }
    },
};

// ---------------------------------------------------------------------------
// Enrolment, checkout, learning
// ---------------------------------------------------------------------------

export const enrollmentService = {
    mine: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<Enrollment[]>>("/enrollments/my", { params }).then(unwrapList),

    forCourse: (courseId: string) =>
        httpClient.get<ApiResponse<Enrollment>>(`/enrollments/my/${courseId}`).then(unwrap),

    /** Mentor/admin: everyone on one course, with progress (plan §21). */
    courseStudents: (courseId: string, params?: Record<string, string | number | undefined>) =>
        httpClient
            .get<ApiResponse<CourseStudent[]>>(`/enrollments/course/${courseId}`, { params })
            .then(unwrapList),
};

export const orderService = {
    checkout: (courseId: string) =>
        httpClient.post<ApiResponse<Order>>("/orders", { courseId }).then(unwrap),

    mine: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<Order[]>>("/orders/my", { params }).then(unwrapList),

    get: (orderId: string) =>
        httpClient.get<ApiResponse<OrderDetail>>(`/orders/my/${orderId}`).then(unwrap),

    /** Puts a coupon on an unpaid order (re-priced by the API) — one that covers it all settles it. */
    applyCoupon: (orderId: string, code: string) =>
        httpClient.post<ApiResponse<OrderDetail>>(`/orders/${orderId}/coupon`, { code }).then(unwrap),

    removeCoupon: (orderId: string) => httpClient.delete<ApiResponse<OrderDetail>>(`/orders/${orderId}/coupon`).then(unwrap),

    /** Paid by bKash: the TrxID and the number paid from, for an admin to verify. */
    submitBkash: (orderId: string, details: BkashSubmission) =>
        httpClient.post<ApiResponse<OrderDetail>>(`/orders/${orderId}/bkash`, details).then(unwrap),

    /**
     * Absolute URL of the invoice PDF. Returned rather than fetched so the
     * browser handles the download itself — the same reason
     * `certificateService.downloadUrl` isn't a blob fetch.
     */
    invoiceUrl: (orderId: string) => `${envConfig.apiBaseUrl}/orders/my/${orderId}/invoice`,
};

/** A bundle checkout: one payment for every course in it the student doesn't own yet. */
export const couponService = {
    /** What a code does — and, with a course, that course's price with it. Never throws for a bad code. */
    check: (code: string, courseId?: string) =>
        httpClient
            .get<ApiResponse<CouponCheck>>("/coupons/check", { params: { code, courseId }, _silent: true })
            .then(unwrap),
};

export const bundleOrderService = {
    checkout: (bundleId: string) =>
        httpClient.post<ApiResponse<BundleOrder>>(`/bundles/${bundleId}/orders`).then(unwrap),

    get: (bundleOrderId: string) =>
        httpClient.get<ApiResponse<BundleOrder>>(`/bundles/orders/${bundleOrderId}`).then(unwrap),

    /** Paid by bKash: the TrxID and the number paid from, for an admin to verify. */
    submitBkash: (bundleOrderId: string, details: BkashSubmission) =>
        httpClient.post<ApiResponse<BundleOrder>>(`/bundles/orders/${bundleOrderId}/bkash`, details).then(unwrap),
};

/** What a student sends in after paying by bKash. */
export interface BkashSubmission {
    transactionId: string;
    senderNumber: string;
}

export const learningService = {
    course: (slug: string) =>
        httpClient.get<ApiResponse<CourseLearning>>(`/learning/courses/${slug}`).then(unwrap),

    video: (videoId: string) =>
        httpClient.get<ApiResponse<unknown>>(`/learning/videos/${videoId}`).then(unwrap),

    /** The real-time outline — milestones and modules, published or upcoming. */
    outline: (slug: string) =>
        httpClient.get<ApiResponse<CourseOutline>>(`/learning/courses/${slug}/outline`).then(unwrap),
};

export const lessonService = {
    state: (videoId: string) =>
        httpClient.get<ApiResponse<LessonState>>(`/lessons/videos/${videoId}`).then(unwrap),

    saveNote: (videoId: string, content: string) =>
        httpClient
            .put<ApiResponse<{ note: string | null }>>(`/lessons/videos/${videoId}/note`, { content })
            .then(unwrap),

    setBookmark: (videoId: string, bookmarked: boolean) =>
        httpClient
            .patch<ApiResponse<{ isBookmarked: boolean; reaction: LessonReaction | null }>>(
                `/lessons/videos/${videoId}/bookmark`,
                { bookmarked },
            )
            .then(unwrap),

    setReaction: (videoId: string, reaction: LessonReaction | null) =>
        httpClient
            .patch<ApiResponse<{ isBookmarked: boolean; reaction: LessonReaction | null }>>(
                `/lessons/videos/${videoId}/reaction`,
                { reaction },
            )
            .then(unwrap),

    courseBookmarks: (courseId: string) =>
        httpClient
            .get<ApiResponse<BookmarkedLesson[]>>(`/lessons/courses/${courseId}/bookmarks`)
            .then(unwrap),
};

export const progressService = {
    completeVideo: (videoId: string) =>
        httpClient
            .post<ApiResponse<{ courseProgress: number; courseCompleted: boolean }>>(
                `/progress/videos/${videoId}/complete`,
            )
            .then(unwrap),

    uncompleteVideo: (videoId: string) =>
        httpClient.post(`/progress/videos/${videoId}/incomplete`).then(() => undefined),

    savePosition: (videoId: string, watchedSeconds: number) =>
        httpClient
            .patch(`/progress/videos/${videoId}/position`, { watchedSeconds }, { _silent: true })
            .then(() => undefined),
};

// ---------------------------------------------------------------------------
// Assignments & practice
// ---------------------------------------------------------------------------

export const assignmentService = {
    get: (assignmentId: string) =>
        httpClient.get<ApiResponse<StudentAssignment>>(`/assignments/${assignmentId}`).then(unwrap),

    submit: (
        assignmentId: string,
        payload: { content?: string; submissionUrl?: string; fileUrls?: string[] },
    ) => httpClient.post(`/assignments/${assignmentId}/submit`, payload).then(() => undefined),

    /** A student's files for a hand-in, stored privately; attach the returned links when submitting. */
    uploadFiles: (assignmentId: string, files: File[], onProgress?: (percent: number) => void) => {
        const formData = new FormData();
        for (const file of files) formData.append("files", file, file.name);
        return httpClient
            .post<ApiResponse<{ url: string; name: string }[]>>(`/assignments/${assignmentId}/files`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (event) => {
                    if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
                },
            })
            .then(unwrap);
    },

    mySubmissions: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<unknown[]>>("/assignments/my-submissions", { params }).then(unwrapList),

    // ---- mentor
    /** An array value asks for any of them: `{ status: ["SUBMITTED", "UNDER_REVIEW"] }`. */
    reviewQueue: (params?: Record<string, string | string[] | number | undefined>) =>
        httpClient
            .get<ApiResponse<ReviewQueueItem[]>>("/assignments/submissions/queue", { params })
            .then(unwrapList),

    /** How many hand-ins are in each state, within the same course/assignment scope. */
    reviewCounts: (params?: { courseId?: string; assignmentId?: string }) =>
        httpClient
            .get<ApiResponse<Record<SubmissionStatus, number>>>("/assignments/submissions/queue/counts", { params })
            .then(unwrap),

    review: (
        submissionId: string,
        payload: { status: string; score?: number; feedback?: string; rubric?: { criterionId: string; points: number; comment?: string }[] },
    ) =>
        httpClient
            .patch(`/assignments/submissions/${submissionId}/review`, payload)
            .then(() => undefined),

    /** "I'm reviewing this" — refused (409) while a colleague has it, unless `takeOver`. */
    claim: (submissionId: string, takeOver = false) =>
        httpClient.post(`/assignments/submissions/${submissionId}/claim`, { takeOver }).then(() => undefined),

    /** Puts a hand-in this reviewer took back in line, unmarked. */
    release: (submissionId: string) =>
        httpClient.delete(`/assignments/submissions/${submissionId}/claim`).then(() => undefined),
};

/** A course's notice board: read by its students and staff, written by its staff. */
export const announcementService = {
    forCourse: (courseId: string) =>
        httpClient.get<ApiResponse<CourseAnnouncement[]>>(`/announcements/course/${courseId}`).then(unwrap),

    /** A student's view, by the course's slug. */
    forLearner: (slug: string) =>
        httpClient
            .get<ApiResponse<{ course: { id: string; title: string; slug: string }; announcements: CourseAnnouncement[] }>>(`/announcements/learn/${slug}`)
            .then(unwrap),

    create: (courseId: string, payload: { title: string; body: string; isPinned?: boolean }) =>
        httpClient.post<ApiResponse<CourseAnnouncement>>(`/announcements/course/${courseId}`, payload).then(unwrap),

    update: (announcementId: string, payload: { title?: string; body?: string; isPinned?: boolean }) =>
        httpClient.patch<ApiResponse<CourseAnnouncement>>(`/announcements/${announcementId}`, payload).then(unwrap),

    remove: (announcementId: string) => httpClient.delete(`/announcements/${announcementId}`).then(() => undefined),
};

/** Questions on a lesson: asked by its students, answered by classmates and mentors. */
export const lessonQaService = {
    forLesson: (videoId: string) =>
        httpClient.get<ApiResponse<LessonQuestion[]>>(`/lesson-questions/lesson/${videoId}`).then(unwrap),
    ask: (videoId: string, body: string) =>
        httpClient.post<ApiResponse<LessonQuestion>>(`/lesson-questions/lesson/${videoId}`, { body }).then(unwrap),
    answer: (questionId: string, body: string) =>
        httpClient.post<ApiResponse<LessonAnswer>>(`/lesson-questions/${questionId}/answers`, { body }).then(unwrap),
    setResolved: (questionId: string, isResolved: boolean) =>
        httpClient.patch(`/lesson-questions/${questionId}`, { isResolved }).then(() => undefined),
    removeQuestion: (questionId: string) => httpClient.delete(`/lesson-questions/${questionId}`).then(() => undefined),
    removeAnswer: (answerId: string) => httpClient.delete(`/lesson-questions/answers/${answerId}`).then(() => undefined),

    /** Staff: questions across their courses — open ones by default, waiting longest first. */
    inbox: (params: { status?: "open" | "resolved" | "all"; courseId?: string; page?: number; limit?: number }) =>
        httpClient
            .get<ApiResponse<InboxQuestion[]>>("/lesson-questions/manage", { params })
            .then((res) => ({ data: res.data.data, meta: res.data.meta as (ApiMeta & { open: number }) | undefined })),
};

/** Course ratings: a student's own, and what the course page shows. */
export const courseReviewService = {
    mine: (courseId: string) =>
        httpClient.get<ApiResponse<{ canReview: boolean; review: MyCourseReview | null }>>(`/course-reviews/mine/${courseId}`).then(unwrap),
    save: (courseId: string, payload: { rating: number; comment?: string }) =>
        httpClient.put<ApiResponse<MyCourseReview>>(`/course-reviews/mine/${courseId}`, payload).then(unwrap),
    removeMine: (courseId: string) => httpClient.delete(`/course-reviews/mine/${courseId}`).then(() => undefined),
    /** Staff: every review of one course, students by name only. */
    forCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<{ summary: RatingSummary; published: number; reviews: (Omit<MyCourseReview, "updatedAt"> & { student: { id: string; name: string } })[] }>>(
                `/course-reviews/course/${courseId}`,
            )
            .then(unwrap),
};

/** Refund requests — the policy's 48 hours from paying, checked by the API. */
export const refundService = {
    mine: () => httpClient.get<ApiResponse<RefundRequest[]>>("/refund-requests/mine").then(unwrap),
    request: (orderId: string, reason: string) =>
        httpClient.post<ApiResponse<RefundRequest>>("/refund-requests", { orderId, reason }).then(unwrap),
    withdraw: (requestId: string) => httpClient.post(`/refund-requests/${requestId}/withdraw`).then(() => undefined),
};

export const practiceService = {
    get: (practiceDayId: string) =>
        httpClient.get<ApiResponse<StudentPracticeDay>>(`/practice-days/${practiceDayId}`).then(unwrap),

    complete: (practiceDayId: string, note?: string) =>
        httpClient.post(`/practice-days/${practiceDayId}/complete`, { note }).then(() => undefined),

    uncomplete: (practiceDayId: string) =>
        httpClient.post(`/practice-days/${practiceDayId}/incomplete`).then(() => undefined),
};

export const quizService = {
    get: (quizId: string) =>
        httpClient.get<ApiResponse<QuizForStudent>>(`/quizzes/${quizId}`).then(unwrap),

    myAttempts: (quizId: string) =>
        httpClient.get<ApiResponse<QuizAttemptSummary[]>>(`/quizzes/${quizId}/attempts`).then(unwrap),

    /**
     * The whole answer sheet, once. Scored on the server; a second submit is
     * refused (409) — a quiz can only be taken once.
     */
    submit: (quizId: string, answers: { questionId: string; selectedOptionId: string }[]) =>
        httpClient.post<ApiResponse<QuizResult>>(`/quizzes/${quizId}/submit`, { answers }).then(unwrap),

    getAttempt: (attemptId: string) =>
        httpClient.get<ApiResponse<QuizAttemptReview>>(`/quizzes/attempts/${attemptId}`).then(unwrap),
};

// ---------------------------------------------------------------------------
// Support queue
// ---------------------------------------------------------------------------

export const supportService = {
    /** What a new session starts from — the platform default from admin Settings. */
    defaults: () =>
        httpClient.get<ApiResponse<{ slotMinutes: number }>>("/support/manage/defaults").then(unwrap),

    sessionsForCourse: (courseId: string) =>
        httpClient.get<ApiResponse<SupportSessionCard[]>>(`/support/course/${courseId}`).then(unwrap),

    joinQueue: (sessionId: string, topic?: string) =>
        httpClient
            .post<ApiResponse<{ queueNumber: number }>>(`/support/${sessionId}/join`, { topic })
            .then(unwrap),

    leaveQueue: (sessionId: string) =>
        httpClient.post(`/support/${sessionId}/leave`).then(() => undefined),

    // Polled as a fallback when the socket is unavailable, so it must not
    // redirect on a transient 401.
    myPosition: (sessionId: string) =>
        httpClient
            .get<ApiResponse<MyQueuePosition>>(`/support/${sessionId}/my-position`, { _silent: true })
            .then(unwrap),

    // ---- mentor
    /** Sessions this person hosted that are over, newest first, with attendance counts. */
    myPastSessions: (params?: { page?: number; limit?: number }) =>
        httpClient.get<ApiResponse<MentorPastSession[]>>("/support/manage/mine/past", { params }).then(unwrapList),

    queueBoard: (sessionId: string) =>
        httpClient.get<ApiResponse<QueueBoard>>(`/support/manage/${sessionId}/queue`).then(unwrap),

    serveNext: (sessionId: string, mentorNote?: string) =>
        httpClient
            .post<ApiResponse<{ queueNumber: number } | null>>(
                `/support/manage/${sessionId}/serve-next`,
                { mentorNote },
            )
            .then(unwrap),

    completeCurrent: (sessionId: string, mentorNote?: string) =>
        httpClient.post(`/support/manage/${sessionId}/complete`, { mentorNote }).then(() => undefined),

    skip: (queueId: string, mentorNote?: string) =>
        httpClient.post(`/support/manage/queue/${queueId}/skip`, { mentorNote }).then(() => undefined),

    sessionsForManagedCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<MentorSupportSession[]>>(`/support/manage/course/${courseId}`)
            .then(unwrap),

    createSession: (payload: {
        courseId: string;
        title?: string;
        meetingLink?: string;
        startTime: string;
        endTime: string;
        slotMinutes?: number;
        notes?: string;
        /** Admin only — which mentor hosts it. Ignored when a mentor creates their own. */
        mentorId?: string;
    }) =>
        httpClient
            .post<ApiResponse<MentorSupportSession>>("/support/manage", payload)
            .then(unwrap),

    sessionHistory: (sessionId: string) =>
        httpClient
            .get<ApiResponse<QueueHistoryEntry[]>>(`/support/manage/${sessionId}/history`)
            .then(unwrap),

    setSessionStatus: (sessionId: string, status: string) =>
        httpClient
            .patch<ApiResponse<MentorSupportSession>>(`/support/manage/${sessionId}/status`, { status })
            .then(unwrap),

    updateSession: (
        sessionId: string,
        payload: Partial<{
            title: string;
            meetingLink: string | null;
            startTime: string;
            endTime: string;
            slotMinutes: number;
            notes: string;
            /** The join-cutoff switch — false blocks new sign-ups. */
            joinOpen: boolean;
            /** Admin only — reassign the host. */
            mentorId: string;
        }>,
    ) =>
        httpClient
            .patch<ApiResponse<MentorSupportSession>>(`/support/manage/${sessionId}`, payload)
            .then(unwrap),

    deleteSession: (sessionId: string) =>
        httpClient.delete(`/support/manage/${sessionId}`).then(() => undefined),
};

// ---------------------------------------------------------------------------
// Certificates, leaderboard, notifications, dashboards
// ---------------------------------------------------------------------------

export const certificateService = {
    /** Public — no session required. */
    verify: (certificateNo: string) =>
        httpClient
            .get<ApiResponse<CertificateVerification>>(`/certificates/verify/${certificateNo}`)
            .then(unwrap),

    mine: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<Certificate[]>>("/certificates/my", { params }).then(unwrapList),

    eligibility: (courseId: string) =>
        httpClient
            .get<ApiResponse<EligibilityReport>>(`/certificates/eligibility/${courseId}`)
            .then(unwrap),

    claim: (courseId: string) =>
        httpClient.post<ApiResponse<Certificate>>(`/certificates/claim/${courseId}`).then(unwrap),

    /**
     * Absolute URL of the PDF. Returned rather than fetched so the browser can
     * open it directly — streaming a blob through JS would lose the filename
     * and the native PDF viewer.
     */
    downloadUrl: (certificateNo: string) =>
        `${envConfig.apiBaseUrl}/certificates/download/${encodeURIComponent(certificateNo)}`,
};

export const leaderboardService = {
    forCourse: (courseId: string, params?: Record<string, string | number | undefined>) =>
        httpClient
            .get<ApiResponse<LeaderboardRow[]>>(`/leaderboard/courses/${courseId}`, { params })
            .then(unwrapList),

    myRank: (courseId: string) =>
        httpClient
            .get<ApiResponse<{ rank: number | null; totalXp: number; totalStudents: number }>>(
                `/leaderboard/courses/${courseId}/my-rank`,
            )
            .then(unwrap),

    myXp: (params?: Record<string, string | number | undefined>) =>
        httpClient.get<ApiResponse<XpHistoryEntry[]>>("/leaderboard/my-xp", { params }).then(unwrapList),
};

export const notificationService = {
    /** An array value asks for any of them: `{ type: ["GENERAL", "SYSTEM"] }`. */
    list: (params?: Record<string, string | string[] | number | undefined>) =>
        httpClient.get<ApiResponse<AppNotification[]>>("/notifications", { params }).then(unwrapList),

    unreadCount: () =>
        httpClient
            .get<ApiResponse<UnreadCount>>("/notifications/unread-count", { _silent: true })
            .then(unwrap),

    markRead: (id: string) =>
        httpClient.patch(`/notifications/${id}/read`).then(() => undefined),

    markUnread: (id: string) =>
        httpClient.patch(`/notifications/${id}/unread`).then(() => undefined),

    markAllRead: () => httpClient.patch("/notifications/read-all").then(() => undefined),

    remove: (id: string) => httpClient.delete(`/notifications/${id}`).then(() => undefined),

    /** Deletes every notification already read; resolves how many went. */
    clearRead: () =>
        httpClient.delete<ApiResponse<{ count: number }>>("/notifications/read").then((response) => response.data.data.count),

    /** Admin broadcasts flagged to pop up at login — see `LoginPopupListener`. */
    loginPopups: () =>
        httpClient
            .get<ApiResponse<LoginPopups>>("/notifications/login-popups", { _silent: true })
            .then(unwrap),
};

export const curriculumService = {
    milestonesForCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<MentorMilestone[]>>(`/milestones/course/${courseId}`)
            .then(unwrap),
};

/** The admission ticket a student gets on enrolling — see `lib/admissionTicket`. */
export const admissionTicketService = {
    mine: (courseId: string) =>
        httpClient.get<ApiResponse<MyAdmissionTicket>>(`/admission-tickets/mine/${courseId}`, { _silent: true }).then(unwrap),
};

export const dashboardService = {
    student: () => httpClient.get<ApiResponse<StudentDashboard>>("/dashboard/student").then(unwrap),
    mentor: () => httpClient.get<ApiResponse<MentorDashboard>>("/dashboard/mentor").then(unwrap),
    admin: () => httpClient.get<ApiResponse<unknown>>("/dashboard/admin").then(unwrap),
};
