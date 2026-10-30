import httpClient from "@/lib/httpClient";
import type { ApiMeta, ApiResponse, RewardCondition } from "@/types/api.types";
import type { AdmissionTicketWords } from "@/types/domain.types";
import type {
    AdmissionTicketCourseDetail,
    AdmissionTicketCourseSummary,
    AdminBundle,
    AdminBundleOrder,
    BundleInput,
    PromotionCourseDetail,
    PromotionCourseSummary,
    RewardCoursesGiven,
    AdminCategory,
    AdminCertificate,
    AdminCourseDetail,
    AdminLeaderboardCourse,
    AdminLivePopup,
    AdminSupportCourse,
    AdminSupportCourseDetail,
    AdminSupportSession,
    AdminTestimonial,
    AdminCourse,
    AdminCourseReview,
    AdminCoupon,
    AdminCouponDetail,
    AdminRefundRequest,
    CouponInput,
    AdminDashboard,
    AdminDirectoryEntry,
    AdminEnrollment,
    AdminEnrollmentCourse,
    AdminMentorDetail,
    AdminOrder,
    AdminOrderCourse,
    AdminStudentCounts,
    AdminStudentDetail,
    AdminUser,
    BroadcastAudience,
    MentorActivityEntry,
    MentorDevice,
    MentorOverview,
    MentorProfileInput,
    MentorReview,
    MentorReviewCourse,
    PlatformSettingKey,
    PlatformSettings,
    StudentCourseBreakdown,
    StudentOverview,
    TestimonialInput,
} from "@/types/admin.types";

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

const unwrapList = <T>(response: { data: ApiResponse<T> }): { data: T; meta?: ApiMeta } => ({
    data: response.data.data,
    meta: response.data.meta,
});

/** A nested object is a range — `{ "payment.paidAt": { gte } }` goes out as `payment.paidAt[gte]=`. */
type Params = Record<string, string | number | boolean | undefined | Record<string, string>>;

export const adminService = {
    dashboard: () => httpClient.get<ApiResponse<AdminDashboard>>("/dashboard/admin").then(unwrap),

    // ---- People
    students: (params?: Params) =>
        httpClient.get<ApiResponse<AdminUser[]>>("/users/students", { params }).then(unwrapList),

    student: (userId: string) =>
        httpClient.get<ApiResponse<AdminStudentDetail>>(`/users/students/${userId}`).then(unwrap),

    studentCounts: () =>
        httpClient.get<ApiResponse<AdminStudentCounts>>("/users/students/counts").then(unwrap),

    // ---- The student detail page
    studentOverview: (userId: string) =>
        httpClient.get<ApiResponse<StudentOverview>>(`/users/students/${userId}/overview`).then(unwrap),

    studentCourse: (userId: string, courseId: string) =>
        httpClient
            .get<ApiResponse<StudentCourseBreakdown>>(`/users/students/${userId}/courses/${courseId}`)
            .then(unwrap),

    mentors: (params?: Params) =>
        httpClient.get<ApiResponse<AdminUser[]>>("/users/mentors", { params }).then(unwrapList),

    mentor: (mentorId: string) =>
        httpClient.get<ApiResponse<AdminMentorDetail>>(`/users/mentors/${mentorId}`).then(unwrap),

    // ---- The mentor detail page
    mentorOverview: (mentorId: string) =>
        httpClient.get<ApiResponse<MentorOverview>>(`/users/mentors/${mentorId}/overview`).then(unwrap),

    mentorActivity: (mentorId: string, params?: Params) =>
        httpClient
            .get<ApiResponse<MentorActivityEntry[]>>(`/users/mentors/${mentorId}/activity`, { params })
            .then(unwrapList),

    mentorReviews: (mentorId: string, params?: Params) =>
        httpClient
            .get<ApiResponse<{ reviews: MentorReview[]; courses: MentorReviewCourse[] }>>(
                `/users/mentors/${mentorId}/reviews`,
                { params },
            )
            .then(unwrapList),

    /** The mentor's live sessions. */
    mentorDevices: (mentorId: string) =>
        httpClient.get<ApiResponse<MentorDevice[]>>(`/users/mentors/${mentorId}/devices`).then(unwrap),

    updateMentor: (mentorId: string, payload: MentorProfileInput) =>
        httpClient.patch(`/users/mentors/${mentorId}`, payload).then(() => undefined),

    /** Multipart — stored as the mentor's shared account profile photo. */
    updateMentorPhoto: (mentorId: string, photo: Blob) => {
        const formData = new FormData();
        formData.append("photo", photo, "mentor-photo.jpg");
        return httpClient
            .patch(`/users/mentors/${mentorId}/photo`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then(() => undefined);
    },

    createMentor: (payload: {
        name: string;
        email: string;
        password: string;
        phone?: string;
        designation?: string;
        expertise?: string[];
        experience?: string;
        bio?: string;
    }) =>
        httpClient
            // `linkedExistingAccount`: the email already had a central
            // account, which was reused (its own password still applies).
            .post<ApiResponse<AdminUser & { linkedExistingAccount?: boolean }>>("/users/mentors", payload)
            .then(unwrap),

    /** Super admin: adds an administrator on a temporary password. */
    createAdmin: (payload: { name: string; email: string; password: string; phone?: string }) =>
        httpClient.post<ApiResponse<AdminDirectoryEntry>>("/users/admins", payload).then(unwrap),

    /** Super admin: everyone who administers Half Coders, whether or not they've opened it yet. */
    admins: (params?: Params) =>
        httpClient.get<ApiResponse<AdminDirectoryEntry[]>>("/users/admins", { params }).then(unwrapList),

    coupons: () => httpClient.get<ApiResponse<AdminCoupon[]>>("/coupons/manage").then(unwrap),
    coupon: (couponId: string) => httpClient.get<ApiResponse<AdminCouponDetail>>(`/coupons/manage/${couponId}`).then(unwrap),
    createCoupon: (payload: CouponInput) => httpClient.post<ApiResponse<AdminCoupon>>("/coupons/manage", payload).then(unwrap),
    updateCoupon: (couponId: string, payload: Partial<CouponInput>) =>
        httpClient.patch<ApiResponse<AdminCoupon>>(`/coupons/manage/${couponId}`, payload).then(unwrap),
    deleteCoupon: (couponId: string) => httpClient.delete(`/coupons/manage/${couponId}`).then(() => undefined),

    // ---- Bundles
    bundles: () => httpClient.get<ApiResponse<AdminBundle[]>>("/bundles/manage").then(unwrap),
    createBundle: (payload: BundleInput) => httpClient.post<ApiResponse<AdminBundle>>("/bundles/manage", payload).then(unwrap),
    updateBundle: (bundleId: string, payload: Partial<BundleInput>) =>
        httpClient.patch<ApiResponse<AdminBundle>>(`/bundles/manage/${bundleId}`, payload).then(unwrap),
    deleteBundle: (bundleId: string) => httpClient.delete(`/bundles/manage/${bundleId}`).then(() => undefined),
    bundleOrders: (bundleId: string) =>
        httpClient.get<ApiResponse<AdminBundleOrder[]>>(`/bundles/manage/${bundleId}/orders`).then(unwrap),
    markBundleOrderPaid: (bundleOrderId: string) =>
        httpClient.patch(`/bundles/manage/orders/${bundleOrderId}/paid`).then(() => undefined),
    refundBundleOrder: (bundleOrderId: string, reason?: string) =>
        httpClient.patch(`/bundles/manage/orders/${bundleOrderId}/refund`, { reason }).then(() => undefined),

    // ---- Free-course offers and completion rewards, course by course
    promotionCourses: () =>
        httpClient.get<ApiResponse<PromotionCourseSummary[]>>("/promotions/manage/courses").then(unwrap),
    promotionCourse: (courseId: string) =>
        httpClient.get<ApiResponse<PromotionCourseDetail>>(`/promotions/manage/courses/${courseId}`).then(unwrap),
    saveOffer: (courseId: string, payload: { courseIds: string[]; isActive: boolean; startsAt: string | null; endsAt: string | null }) =>
        httpClient.put(`/promotions/manage/courses/${courseId}/offer`, payload).then(() => undefined),
    deleteOffer: (courseId: string) => httpClient.delete(`/promotions/manage/courses/${courseId}/offer`).then(() => undefined),
    saveReward: (
        courseId: string,
        payload: { courseIds: string[]; condition: RewardCondition; deadlineAt: string | null; withinDays: number | null; isActive: boolean },
    ) => httpClient.put(`/promotions/manage/courses/${courseId}/reward`, payload).then(() => undefined),
    deleteReward: (courseId: string) => httpClient.delete(`/promotions/manage/courses/${courseId}/reward`).then(() => undefined),

    // ---- Reward courses given with a course
    giveRewardCourses: (courseId: string, payload: { courseIds: string[]; audience: "STUDENTS" | "EVERYONE"; studentIds?: string[] }) =>
        httpClient
            .post<ApiResponse<RewardCoursesGiven>>(`/promotions/manage/courses/${courseId}/reward-courses`, payload)
            .then(unwrap),
    setRewardForEveryone: (bonusId: string, forEveryone: boolean) =>
        httpClient.patch<ApiResponse<RewardCoursesGiven>>(`/promotions/manage/reward-courses/${bonusId}`, { forEveryone }).then(unwrap),
    takeBackRewardCourse: (bonusId: string, studentId: string) =>
        httpClient.delete(`/promotions/manage/reward-courses/${bonusId}/students/${studentId}`).then(() => undefined),
    removeRewardCourse: (bonusId: string) =>
        httpClient.delete<ApiResponse<{ takenBack: number }>>(`/promotions/manage/reward-courses/${bonusId}`).then(unwrap),

    // ---- Admission tickets, course by course
    admissionTicketCourses: () =>
        httpClient.get<ApiResponse<AdmissionTicketCourseSummary[]>>("/admission-tickets/manage/courses").then(unwrap),
    admissionTicketCourse: (courseId: string) =>
        httpClient.get<ApiResponse<AdmissionTicketCourseDetail>>(`/admission-tickets/manage/courses/${courseId}`).then(unwrap),
    saveAdmissionTicket: (courseId: string, payload: AdmissionTicketWords & { isActive: boolean }) =>
        httpClient.put(`/admission-tickets/manage/courses/${courseId}`, payload).then(() => undefined),
    deleteAdmissionTicket: (courseId: string) =>
        httpClient.delete(`/admission-tickets/manage/courses/${courseId}`).then(() => undefined),

    refundRequests: (params?: Params) =>
        httpClient.get<ApiResponse<AdminRefundRequest[]>>("/refund-requests/manage", { params }).then(unwrapList),
    refundRequestCounts: () =>
        httpClient.get<ApiResponse<Record<AdminRefundRequest["status"], number>>>("/refund-requests/manage/counts").then(unwrap),
    decideRefund: (requestId: string, decision: "APPROVE" | "DECLINE", note?: string) =>
        httpClient.patch(`/refund-requests/manage/${requestId}`, { decision, note }).then(() => undefined),

    /** Course reviews to moderate, by status and course. */
    courseReviews: (params?: Params) =>
        httpClient.get<ApiResponse<AdminCourseReview[]>>("/course-reviews/manage", { params }).then(unwrapList),
    courseReviewCounts: () =>
        httpClient.get<ApiResponse<Record<AdminCourseReview["status"], number>>>("/course-reviews/manage/counts").then(unwrap),
    moderateCourseReview: (reviewId: string, status: AdminCourseReview["status"]) =>
        httpClient.patch(`/course-reviews/manage/${reviewId}`, { status }).then(() => undefined),

    setUserStatus: (userId: string, status: string) =>
        httpClient.patch(`/users/${userId}/status`, { status }).then(() => undefined),

    /**
     * Credential recovery: the person is emailed a reset code to choose a new
     * password. No password is ever shown to the admin.
     */
    resetUserPassword: (userId: string) =>
        httpClient
            .patch<ApiResponse<{ userId: string; sentTo: string }>>(`/users/${userId}/reset-password`)
            .then(unwrap),

    // ---- Courses
    courses: (params?: Params) =>
        httpClient.get<ApiResponse<AdminCourse[]>>("/courses/manage", { params }).then(unwrapList),

    createCourse: (payload: Record<string, unknown>) =>
        httpClient.post<ApiResponse<AdminCourse>>("/courses/manage", payload).then(unwrap),

    course: (courseId: string) =>
        httpClient.get<ApiResponse<AdminCourseDetail>>(`/courses/manage/${courseId}`).then(unwrap),

    updateCourse: (courseId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/courses/manage/${courseId}`, payload).then(() => undefined),

    deleteCourse: (courseId: string) =>
        httpClient.delete(`/courses/manage/${courseId}`).then(() => undefined),


    removeMentor: (courseId: string, mentorId: string) =>
        httpClient.delete(`/courses/manage/${courseId}/mentors/${mentorId}`).then(() => undefined),

    setCourseStatus: (courseId: string, status: string) =>
        httpClient.patch(`/courses/manage/${courseId}/status`, { status }).then(() => undefined),

    /** The pre-enrolment roadmap PDF — upload also replaces whatever was there before. */
    uploadCurriculumPdf: (courseId: string, file: File) => {
        const formData = new FormData();
        formData.append("curriculumPdf", file);
        return httpClient
            .patch<
                ApiResponse<{
                    curriculumPdfUrl: string | null;
                    curriculumPdfFileName: string | null;
                    curriculumPdfUpdatedAt: string | null;
                }>
            >(`/courses/manage/${courseId}/curriculum-pdf`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then(unwrap);
    },

    removeCurriculumPdf: (courseId: string) =>
        httpClient.delete(`/courses/manage/${courseId}/curriculum-pdf`).then(() => undefined),

    assignMentor: (courseId: string, mentorId: string, role?: string) =>
        httpClient.post(`/courses/manage/${courseId}/mentors`, { mentorId, role }).then(() => undefined),

    // ---- Money
    orders: (params?: Params) =>
        httpClient.get<ApiResponse<AdminOrder[]>>("/orders/manage", { params }).then(unwrapList),

    /** Every course with its orders rolled up — the Payments screen's first view. */
    orderCourses: (params?: Params) =>
        httpClient.get<ApiResponse<AdminOrderCourse[]>>("/orders/manage/courses", { params }).then(unwrap),

    orderCourse: (courseId: string) =>
        httpClient.get<ApiResponse<AdminOrderCourse>>(`/orders/manage/courses/${courseId}`).then(unwrap),

    /**
     * Manual settlement. Until a gateway is wired up this is the only path from
     * a paid-in-person order to an actual enrolment, so it is the busiest
     * screen in the console.
     */
    markOrderPaid: (orderId: string, payload: { gateway: string; transactionId?: string }) =>
        httpClient.patch(`/orders/manage/${orderId}/paid`, payload).then(() => undefined),

    markOrderFailed: (orderId: string, reason?: string) =>
        httpClient.patch(`/orders/manage/${orderId}/failed`, { reason }).then(() => undefined),

    refundOrder: (orderId: string, reason?: string) =>
        httpClient.patch(`/orders/manage/${orderId}/refund`, { reason }).then(() => undefined),

    // ---- Enrolments
    enrollments: (params?: Params) =>
        httpClient
            .get<ApiResponse<AdminEnrollment[]>>("/enrollments/manage", { params })
            .then(unwrapList),

    /** Every course with its students rolled up — the Enrolments screen's first view. */
    enrollmentCourses: () =>
        httpClient.get<ApiResponse<AdminEnrollmentCourse[]>>("/enrollments/manage/courses").then(unwrap),

    enrollmentCourse: (courseId: string) =>
        httpClient.get<ApiResponse<AdminEnrollmentCourse>>(`/enrollments/manage/courses/${courseId}`).then(unwrap),

    enrollManually: (studentId: string, courseId: string) =>
        httpClient.post("/enrollments/manage", { studentId, courseId }).then(() => undefined),

    cancelEnrollment: (enrollmentId: string) =>
        httpClient.patch(`/enrollments/manage/${enrollmentId}/cancel`).then(() => undefined),

    reactivateEnrollment: (enrollmentId: string) =>
        httpClient.patch(`/enrollments/manage/${enrollmentId}/reactivate`).then(() => undefined),

    // ---- Certificates
    certificates: (params?: Params) =>
        httpClient
            .get<ApiResponse<AdminCertificate[]>>("/certificates/manage", { params })
            .then(unwrapList),

    /** Admin override for a certificate earned outside the automatic check. */
    issueCertificate: (enrollmentId: string, reason?: string) =>
        httpClient.post("/certificates/manage/issue", { enrollmentId, reason }).then(() => undefined),

    revokeCertificate: (certificateId: string, reason: string) =>
        httpClient
            .patch(`/certificates/manage/${certificateId}/revoke`, { reason })
            .then(() => undefined),

    restoreCertificate: (certificateId: string) =>
        httpClient.patch(`/certificates/manage/${certificateId}/restore`).then(() => undefined),

    // ---- Platform
    settings: () => httpClient.get<ApiResponse<PlatformSettings>>("/settings").then(unwrap),

    /** The ID the next certificate would get under `prefix`. */
    certificatePreview: (prefix: string) =>
        httpClient
            .get<ApiResponse<{ next: string }>>("/settings/certificate-preview", { params: { prefix } })
            .then(unwrap),

    saveSetting: (key: PlatformSettingKey, value: unknown) =>
        httpClient.put("/settings", { key, value }).then(() => undefined),

    resetSetting: (key: PlatformSettingKey) =>
        httpClient.delete(`/settings/${encodeURIComponent(key)}`).then(() => undefined),

    livePopups: () =>
        httpClient.get<ApiResponse<AdminLivePopup[]>>("/notifications/broadcast/popups").then(unwrap),

    /** Ends a pop-up for everyone it went to; it stays in their bell. */
    stopPopup: (id: string) =>
        httpClient
            .patch<ApiResponse<{ stopped: number }>>(`/notifications/broadcast/popups/${id}/stop`)
            .then(unwrap),

    broadcastAudience: () =>
        httpClient.get<ApiResponse<BroadcastAudience>>("/notifications/broadcast/audience").then(unwrap),

    broadcast: (payload: {
        title: string;
        message: string;
        type?: string;
        link?: string;
        audience: "ALL_STUDENTS" | "ALL_MENTORS" | "COURSE";
        courseId?: string;
        showOnLogin?: boolean;
        repeatOnLogin?: boolean;
    }) =>
        httpClient
            .post<ApiResponse<{ recipients: number }>>("/notifications/broadcast", payload)
            .then(unwrap),

    // ---- Categories (plan §36)
    createCategory: (payload: { title: string; icon?: string; description?: string; order?: number }) =>
        httpClient.post("/categories/manage", payload).then(() => undefined),

    updateCategory: (categoryId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/categories/manage/${categoryId}`, payload).then(() => undefined),

    deleteCategory: (categoryId: string) =>
        httpClient.delete(`/categories/manage/${categoryId}`).then(() => undefined),

    allCategories: () =>
        httpClient
            .get<ApiResponse<AdminCategory[]>>("/categories/manage")
            .then(unwrap),

    // ---- Roles: student <-> mentor only (admins are added on the Admins page).
    changeUserRole: (userId: string, role: "STUDENT" | "MENTOR") =>
        httpClient.patch(`/users/${userId}/role`, { role }).then(() => undefined),

    // ---- Testimonials (plan §7)
    testimonials: () =>
        httpClient.get<ApiResponse<AdminTestimonial[]>>("/testimonials/manage").then(unwrap),

    createTestimonial: (payload: TestimonialInput) =>
        httpClient.post<ApiResponse<{ id: string }>>("/testimonials/manage", payload).then(unwrap),

    updateTestimonial: (id: string, payload: Partial<TestimonialInput>) =>
        httpClient.patch(`/testimonials/manage/${id}`, payload).then(() => undefined),

    /** The whole list, in its new order. */
    reorderTestimonials: (ids: string[]) =>
        httpClient.patch("/testimonials/manage/order", { ids }).then(() => undefined),

    deleteTestimonial: (id: string) =>
        httpClient.delete(`/testimonials/manage/${id}`).then(() => undefined),

    /** Support sessions for one course — the admin overview reads per course. */
    /** The Leaderboard's first view: every course with its standings rolled up. */
    leaderboardCourses: () =>
        httpClient.get<ApiResponse<AdminLeaderboardCourse[]>>("/leaderboard/manage/courses").then(unwrap),

    leaderboardCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<AdminLeaderboardCourse>>(`/leaderboard/manage/courses/${courseId}`)
            .then(unwrap),

    /** Support's first view: every course with its sessions rolled up. */
    supportCourses: () =>
        httpClient.get<ApiResponse<AdminSupportCourse[]>>("/support/manage/courses").then(unwrap),

    supportCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<AdminSupportCourseDetail>>(`/support/manage/courses/${courseId}`)
            .then(unwrap),

    supportSessions: (courseId: string) =>
        httpClient
            .get<ApiResponse<AdminSupportSession[]>>(`/support/manage/course/${courseId}`)
            .then(unwrap),

    categories: () =>
        httpClient
            .get<ApiResponse<{ id: string; title: string; slug: string }[]>>("/categories/manage")
            .then(unwrap),
};
