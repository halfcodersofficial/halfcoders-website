import { Router } from "express";
import { AdmissionTicketRoutes } from "../module/admissionTicket/admissionTicket.route";
import { AnnouncementRoutes } from "../module/announcement/announcement.route";
import { LiveClassRoutes } from "../module/liveClass/liveClass.route";
import { LessonQaRoutes } from "../module/lessonQa/lessonQa.route";
import { CourseReviewRoutes } from "../module/courseReview/courseReview.route";
import { CouponRoutes } from "../module/coupon/coupon.route";
import { BundleRoutes } from "../module/bundle/bundle.route";
import { PromotionRoutes } from "../module/promotion/promotion.route";
import { RefundRequestRoutes } from "../module/refundRequest/refundRequest.route";
import { AssignmentRoutes } from "../module/assignment/assignment.route";
import { AssignmentMaterialRoutes } from "../module/assignmentMaterial/assignmentMaterial.route";
import { AuthRoutes } from "../module/auth/auth.route";
import { CategoryRoutes } from "../module/category/category.route";
import { CertificateRoutes } from "../module/certificate/certificate.route";
import { CourseRoutes } from "../module/course/course.route";
import { ConceptualRoutes } from "../module/conceptual/conceptual.route";
import { CourseModuleRoutes } from "../module/courseModule/courseModule.route";
import { DashboardRoutes } from "../module/dashboard/dashboard.route";
import { FileRoutes } from "../module/file/file.route";
import { EnrollmentRoutes } from "../module/enrollment/enrollment.route";
import { LeaderboardRoutes } from "../module/leaderboard/leaderboard.route";
import { LearningRoutes } from "../module/learning/learning.route";
import { LessonRoutes } from "../module/lesson/lesson.route";
import { MilestoneRoutes } from "../module/milestone/milestone.route";
import { NotificationRoutes } from "../module/notification/notification.route";
import { OrderRoutes } from "../module/order/order.route";
import { OutlineRoutes } from "../module/outline/outline.route";
import { PracticeRoutes } from "../module/practice/practice.route";
import { ProgressRoutes } from "../module/progress/progress.route";
import { QuizRoutes } from "../module/quiz/quiz.route";
import { SettingsRoutes } from "../module/settings/settings.route";
import { StatsRoutes } from "../module/stats/stats.route";
import { StudentCourseRequestsRoutes } from "../module/studentCourseRequests/studentCourseRequests.route";
import { StudentHiredRecordsRoutes } from "../module/studentHiredRecords/studentHiredRecords.route";
import { StudentJobExperiencesRoutes } from "../module/studentJobExperiences/studentJobExperiences.route";
import { StudentProfileRoutes } from "../module/studentProfile/studentProfile.route";
import { StudentProjectsRoutes } from "../module/studentProjects/studentProjects.route";
import { StudentSkillsRoutes } from "../module/studentSkills/studentSkills.route";
import { SupportRoutes } from "../module/support/support.route";
import { TestimonialRoutes } from "../module/testimonial/testimonial.route";
import { UserRoutes } from "../module/user/user.route";
import { VideoRoutes } from "../module/video/video.route";

const router = Router();

const moduleRoutes = [
    { path: "/auth", route: AuthRoutes },
    { path: "/users", route: UserRoutes },
    { path: "/categories", route: CategoryRoutes },
    { path: "/courses", route: CourseRoutes },
    { path: "/milestones", route: MilestoneRoutes },
    { path: "/modules", route: CourseModuleRoutes },
    { path: "/videos", route: VideoRoutes },
    { path: "/assignments", route: AssignmentRoutes },
    { path: "/assignment-materials", route: AssignmentMaterialRoutes },
    { path: "/practice-days", route: PracticeRoutes },
    { path: "/quizzes", route: QuizRoutes },
    { path: "/outline", route: OutlineRoutes },
    { path: "/enrollments", route: EnrollmentRoutes },
    { path: "/admission-tickets", route: AdmissionTicketRoutes },
    { path: "/orders", route: OrderRoutes },
    { path: "/learning", route: LearningRoutes },
    { path: "/lessons", route: LessonRoutes },
    { path: "/progress", route: ProgressRoutes },
    { path: "/leaderboard", route: LeaderboardRoutes },
    { path: "/certificates", route: CertificateRoutes },
    { path: "/support", route: SupportRoutes },
    { path: "/conceptual", route: ConceptualRoutes },
    { path: "/testimonials", route: TestimonialRoutes },
    { path: "/stats", route: StatsRoutes },
    { path: "/notifications", route: NotificationRoutes },
    { path: "/announcements", route: AnnouncementRoutes },
    { path: "/live-classes", route: LiveClassRoutes },
    { path: "/lesson-questions", route: LessonQaRoutes },
    { path: "/course-reviews", route: CourseReviewRoutes },
    { path: "/coupons", route: CouponRoutes },
    { path: "/bundles", route: BundleRoutes },
    { path: "/promotions", route: PromotionRoutes },
    { path: "/refund-requests", route: RefundRequestRoutes },
    { path: "/dashboard", route: DashboardRoutes },
    { path: "/files", route: FileRoutes },
    { path: "/settings", route: SettingsRoutes },
    { path: "/student-profile", route: StudentProfileRoutes },
    { path: "/student-skills", route: StudentSkillsRoutes },
    { path: "/student-projects", route: StudentProjectsRoutes },
    { path: "/student-job-experiences", route: StudentJobExperiencesRoutes },
    { path: "/student-hired-records", route: StudentHiredRecordsRoutes },
    { path: "/student-course-requests", route: StudentCourseRequestsRoutes },
];

// API index — a discoverable list of what's mounted. Handy as a quick health
// check in a browser and for onboarding without spelunking the codebase.
router.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        name: "Half Coders API",
        version: "v1",
        status: "ok",
        timestamp: new Date().toISOString(),
        endpoints: moduleRoutes.map((r) => `/api/v1${r.path}`),
    });
});

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export const IndexRoutes = router;
