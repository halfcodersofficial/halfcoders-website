-- =============================================================================
-- Half Coders: initial schema
--
-- Everything in the `learning` schema: identity (accounts, sessions, one-time
-- codes) and everything learning-specific.
-- =============================================================================

-- CreateSchema — only when missing. `CREATE SCHEMA IF NOT EXISTS` would still
-- demand the database-level CREATE privilege, which a least-privilege app role
-- deliberately lacks; there the schema already exists, owned by that role.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'learning') THEN
        CREATE SCHEMA "learning";
    END IF;
END $$;

-- CreateEnum
CREATE TYPE "learning"."LearningStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "learning"."CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "learning"."CourseType" AS ENUM ('BOOTCAMP', 'TRADITIONAL');

-- CreateEnum
CREATE TYPE "learning"."CoursePhase" AS ENUM ('PRESENT', 'UPCOMING', 'PREVIOUS');

-- CreateEnum
CREATE TYPE "learning"."CoursePricing" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "learning"."CourseDelivery" AS ENUM ('LIVE', 'RECORDED', 'HYBRID');

-- CreateEnum
CREATE TYPE "learning"."CourseMode" AS ENUM ('ONLINE', 'OFFLINE', 'BOTH');

-- CreateEnum
CREATE TYPE "learning"."BundlePricing" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "learning"."RewardCondition" AS ENUM ('COURSE_COMPLETE', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "learning"."GrantSource" AS ENUM ('OFFER', 'REWARD');

-- CreateEnum
CREATE TYPE "learning"."CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "learning"."CourseMentorRole" AS ENUM ('LEAD', 'CO_MENTOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "learning"."EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "learning"."OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "learning"."PaymentGateway" AS ENUM ('BKASH', 'MANUAL', 'FREE');

-- CreateEnum
CREATE TYPE "learning"."SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'NEEDS_REVISION', 'REJECTED');

-- CreateEnum
CREATE TYPE "learning"."SupportSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "learning"."SupportQueueStatus" AS ENUM ('WAITING', 'SERVING', 'COMPLETED', 'SKIPPED', 'LEFT');

-- CreateEnum
CREATE TYPE "learning"."NotificationType" AS ENUM ('GENERAL', 'COURSE', 'MODULE', 'ASSIGNMENT', 'QUIZ', 'SUPPORT', 'PAYMENT', 'CERTIFICATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "learning"."CertificateStatus" AS ENUM ('ISSUED', 'REVOKED');

-- CreateEnum
CREATE TYPE "learning"."ReactionType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "learning"."XpSource" AS ENUM ('VIDEO_COMPLETE', 'ASSIGNMENT_SUBMIT', 'ASSIGNMENT_SCORE', 'PRACTICE_COMPLETE', 'QUIZ_COMPLETE', 'MODULE_COMPLETE', 'MILESTONE_COMPLETE', 'COURSE_COMPLETE', 'SUPPORT_PARTICIPATION');

-- CreateEnum
CREATE TYPE "learning"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "learning"."CourseRequestStatus" AS ENUM ('PENDING', 'REVIEWED', 'FULFILLED', 'DECLINED');

-- CreateEnum
CREATE TYPE "learning"."LessonType" AS ENUM ('VIDEO', 'TEXT', 'RESOURCE');

-- CreateEnum
CREATE TYPE "learning"."OutlineItemKind" AS ENUM ('MODULE', 'PRACTICE', 'NO_MODULE');

-- CreateEnum
CREATE TYPE "learning"."CouponKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "learning"."RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "learning"."CourseReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "learning"."LiveClassStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "learning"."AccountStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "learning"."Role" AS ENUM ('STUDENT', 'MENTOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "learning"."AuthCodePurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "learning"."QuizQuestionType" AS ENUM ('SINGLE_CHOICE');

-- CreateEnum
CREATE TYPE "learning"."QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "learning"."staff_activity" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "courseId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."admission_ticket" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "ticketTitle" TEXT,
    "badge" TEXT,
    "learnerLabel" TEXT,
    "courseLabel" TEXT,
    "courseName" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "stubLabel" TEXT,
    "stubValue" TEXT,
    "showPhoto" BOOLEAN NOT NULL DEFAULT true,
    "taglineLead" TEXT,
    "taglineAccent" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."assignment" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalMarks" INTEGER NOT NULL DEFAULT 100,
    "deadline" TIMESTAMP(3),
    "lateTiers" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "releaseAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."assignment_material" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "learning"."LessonType" NOT NULL DEFAULT 'VIDEO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT,
    "youtubeVideoId" TEXT,
    "content" TEXT,
    "resourceUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."assignment_submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "content" TEXT,
    "fileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submissionUrl" TEXT,
    "status" "learning"."SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" INTEGER,
    "maxScore" INTEGER,
    "feedback" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."practice_day" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "order" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "releaseAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."practice_completion" (
    "id" TEXT NOT NULL,
    "practiceDayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."rubric_criterion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubric_criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."rubric_score" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubric_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."certificate" (
    "id" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "trainingDuration" TEXT,
    "assessed" BOOLEAN NOT NULL DEFAULT false,
    "layout" INTEGER NOT NULL DEFAULT 1,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "learning"."CertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "pdfUrl" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "kind" "learning"."CouponKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscount" INTEGER,
    "minAmount" INTEGER,
    "allCourses" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptions" INTEGER,
    "perStudentLimit" INTEGER DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."coupon_course" (
    "couponId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "coupon_course_pkey" PRIMARY KEY ("couponId","courseId")
);

-- CreateTable
CREATE TABLE "learning"."refund_request" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "learning"."RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."conceptual_topic" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conceptual_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."conceptual_session" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "thumbnail" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conceptual_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."conceptual_session_watch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conceptual_session_watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_category" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "overview" TEXT,
    "thumbnail" TEXT,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT,
    "promoVideoUrl" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "discountPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "duration" TEXT,
    "certificateCode" TEXT,
    "level" "learning"."CourseLevel" NOT NULL DEFAULT 'ALL_LEVELS',
    "language" TEXT NOT NULL DEFAULT 'Bangla',
    "status" "learning"."CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "courseType" "learning"."CourseType" NOT NULL DEFAULT 'BOOTCAMP',
    "phase" "learning"."CoursePhase" NOT NULL DEFAULT 'PRESENT',
    "pricing" "learning"."CoursePricing" DEFAULT 'PAID',
    "delivery" "learning"."CourseDelivery" DEFAULT 'HYBRID',
    "mode" "learning"."CourseMode" DEFAULT 'ONLINE',
    "venue" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignmentInfo" TEXT,
    "practiceInfo" TEXT,
    "supportInfo" TEXT,
    "features" JSONB NOT NULL DEFAULT '[]',
    "techStack" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "includes" JSONB NOT NULL DEFAULT '[]',
    "heroFacts" JSONB NOT NULL DEFAULT '[]',
    "enrollmentStartsAt" TIMESTAMP(3),
    "enrollmentEndsAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "nextEnrollmentStartsAt" TIMESTAMP(3),
    "nextEnrollmentEndsAt" TIMESTAMP(3),
    "nextStartsAt" TIMESTAMP(3),
    "nextEndsAt" TIMESTAMP(3),
    "hiddenFromHomepage" BOOLEAN NOT NULL DEFAULT false,
    "hiddenFromCatalogue" BOOLEAN NOT NULL DEFAULT false,
    "milestoneLabel" TEXT NOT NULL DEFAULT 'Milestone',
    "moduleLabel" TEXT NOT NULL DEFAULT 'Module',
    "curriculumPdfUrl" TEXT,
    "curriculumPdfPublicId" TEXT,
    "curriculumPdfFileName" TEXT,
    "curriculumPdfUpdatedAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_mentor" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "role" "learning"."CourseMentorRole" NOT NULL DEFAULT 'CO_MENTOR',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."milestone" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_module" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "releaseAt" TIMESTAMP(3),
    "mode" "learning"."CourseMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."video" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "learning"."LessonType" NOT NULL DEFAULT 'VIDEO',
    "youtubeUrl" TEXT,
    "youtubeVideoId" TEXT,
    "content" TEXT,
    "resourceUrl" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFreePreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_announcement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_review" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "learning"."CourseReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."lesson_question" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."lesson_answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."live_class" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "joinUrl" TEXT,
    "status" "learning"."LiveClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "remindedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "learning"."EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentMilestoneId" TEXT,
    "currentModuleId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."video_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."module_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedVideos" INTEGER NOT NULL DEFAULT 0,
    "totalVideos" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."milestone_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "completedModules" INTEGER NOT NULL DEFAULT 0,
    "totalModules" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "status" "learning"."AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "learning"."Role" NOT NULL DEFAULT 'STUDENT',
    "needPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."auth_code" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "learning"."AuthCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."xp_transaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "source" "learning"."XpSource" NOT NULL,
    "points" INTEGER NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_xp" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."platform_setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."learning_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "learning"."LearningStatus" NOT NULL DEFAULT 'ACTIVE',
    "studentId" TEXT,
    "whatsapp" TEXT,
    "bio" TEXT,
    "address" TEXT,
    "preferences" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."mentor_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designation" TEXT,
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" TEXT,
    "facebookUrl" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "websiteUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."lesson_note" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."lesson_interaction" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "reaction" "learning"."ReactionType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "learning"."NotificationType" NOT NULL DEFAULT 'GENERAL',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "showOnLogin" BOOLEAN NOT NULL DEFAULT false,
    "repeatOnLogin" BOOLEAN NOT NULL DEFAULT false,
    "senderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."outline_week" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outline_week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."outline_item" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" "learning"."OutlineItemKind" NOT NULL DEFAULT 'MODULE',
    "title" TEXT NOT NULL,
    "note" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "mode" "learning"."CourseMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outline_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "couponCode" TEXT,
    "couponDiscount" INTEGER NOT NULL DEFAULT 0,
    "couponAppliedAt" TIMESTAMP(3),
    "status" "learning"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "bundleOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gateway" "learning"."PaymentGateway" NOT NULL,
    "transactionId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "learning"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayData" JSONB,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_offer" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_offer_item" (
    "offerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "course_offer_item_pkey" PRIMARY KEY ("offerId","courseId")
);

-- CreateTable
CREATE TABLE "learning"."completion_reward" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "condition" "learning"."RewardCondition" NOT NULL DEFAULT 'COURSE_COMPLETE',
    "deadlineAt" TIMESTAMP(3),
    "withinDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completion_reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."completion_reward_item" (
    "rewardId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "completion_reward_item_pkey" PRIMARY KEY ("rewardId","courseId")
);

-- CreateTable
CREATE TABLE "learning"."course_grant" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" "learning"."GrantSource" NOT NULL,
    "offerId" TEXT,
    "rewardId" TEXT,
    "orderId" TEXT,
    "enrollmentId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_bundle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "pricing" "learning"."BundlePricing" NOT NULL DEFAULT 'PERCENT',
    "price" INTEGER,
    "discountPercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."course_bundle_item" (
    "bundleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "course_bundle_item_pkey" PRIMARY KEY ("bundleId","courseId")
);

-- CreateTable
CREATE TABLE "learning"."bundle_order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "items" JSONB NOT NULL,
    "status" "learning"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" "learning"."PaymentGateway",
    "transactionId" TEXT,
    "gatewayData" JSONB,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."quiz" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."quiz_question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "learning"."QuizQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "explanation" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."quiz_option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "quiz_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."quiz_attempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "learning"."QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "quiz_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."quiz_attempt_answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempt_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_additional_info" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" "learning"."Gender",
    "ageRange" TEXT,
    "primaryDeviceType" TEXT,
    "internetType" TEXT,
    "yearsOfExperience" TEXT,
    "employmentRole" TEXT,
    "areaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_additional_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presentCountry" TEXT,
    "presentDistrict" TEXT,
    "presentStreetAddress" TEXT,
    "permanentCountry" TEXT,
    "permanentDistrict" TEXT,
    "permanentStreetAddress" TEXT,
    "sameAsPresent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_education" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT,
    "examTitle" TEXT,
    "institutionName" TEXT,
    "passingYear" INTEGER,
    "isCurrentlyStudying" BOOLEAN NOT NULL DEFAULT false,
    "currentYear" TEXT,
    "isCseStudent" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "linkedinUrl" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_job_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wantsJob" BOOLEAN,
    "jobType" TEXT,
    "jobPreference" TEXT,
    "wantsJobOutsideBangladesh" BOOLEAN,
    "hasJobExperience" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_job_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_skill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearsOfExperience" TEXT,
    "projectLink" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_job_experience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "isRelatedToIt" BOOLEAN,
    "description" TEXT,
    "isCurrentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_job_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_hired_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "jobType" TEXT,
    "howGotJob" TEXT,
    "description" TEXT,
    "companyCountry" TEXT,
    "companyCity" TEXT,
    "isCurrentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "careerImpactNote" TEXT,
    "appointmentLetterUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_hired_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."student_course_request" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "category" TEXT,
    "status" "learning"."CourseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_course_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."support_session" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "title" TEXT,
    "meetingLink" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "learning"."SupportSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "slotMinutes" INTEGER NOT NULL DEFAULT 5,
    "joinOpen" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "liveNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."support_queue" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "status" "learning"."SupportQueueStatus" NOT NULL DEFAULT 'WAITING',
    "topic" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "mentorNote" TEXT,

    CONSTRAINT "support_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."testimonial" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "avatar" TEXT,
    "videoUrl" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "courseId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_activity_actorId_createdAt_idx" ON "learning"."staff_activity"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "staff_activity_courseId_createdAt_idx" ON "learning"."staff_activity"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admission_ticket_courseId_key" ON "learning"."admission_ticket"("courseId");

-- CreateIndex
CREATE INDEX "assignment_courseId_idx" ON "learning"."assignment"("courseId");

-- CreateIndex
CREATE INDEX "assignment_milestoneId_isPublished_idx" ON "learning"."assignment"("milestoneId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_milestoneId_order_key" ON "learning"."assignment"("milestoneId", "order");

-- CreateIndex
CREATE INDEX "assignment_material_courseId_idx" ON "learning"."assignment_material"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_material_assignmentId_order_key" ON "learning"."assignment_material"("assignmentId", "order");

-- CreateIndex
CREATE INDEX "assignment_submission_studentId_idx" ON "learning"."assignment_submission"("studentId");

-- CreateIndex
CREATE INDEX "assignment_submission_enrollmentId_idx" ON "learning"."assignment_submission"("enrollmentId");

-- CreateIndex
CREATE INDEX "assignment_submission_status_idx" ON "learning"."assignment_submission"("status");

-- CreateIndex
CREATE INDEX "assignment_submission_assignmentId_status_idx" ON "learning"."assignment_submission"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submission_assignmentId_studentId_key" ON "learning"."assignment_submission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "practice_day_courseId_idx" ON "learning"."practice_day"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_day_milestoneId_order_key" ON "learning"."practice_day"("milestoneId", "order");

-- CreateIndex
CREATE INDEX "practice_completion_enrollmentId_idx" ON "learning"."practice_completion"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_completion_practiceDayId_studentId_key" ON "learning"."practice_completion"("practiceDayId", "studentId");

-- CreateIndex
CREATE INDEX "rubric_criterion_assignmentId_order_idx" ON "learning"."rubric_criterion"("assignmentId", "order");

-- CreateIndex
CREATE INDEX "rubric_score_criterionId_idx" ON "learning"."rubric_score"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_score_submissionId_criterionId_key" ON "learning"."rubric_score"("submissionId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_certificateNo_key" ON "learning"."certificate"("certificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_enrollmentId_key" ON "learning"."certificate"("enrollmentId");

-- CreateIndex
CREATE INDEX "certificate_studentId_idx" ON "learning"."certificate"("studentId");

-- CreateIndex
CREATE INDEX "certificate_courseId_idx" ON "learning"."certificate"("courseId");

-- CreateIndex
CREATE INDEX "certificate_status_idx" ON "learning"."certificate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_code_key" ON "learning"."coupon"("code");

-- CreateIndex
CREATE INDEX "coupon_isActive_idx" ON "learning"."coupon"("isActive");

-- CreateIndex
CREATE INDEX "coupon_course_courseId_idx" ON "learning"."coupon_course"("courseId");

-- CreateIndex
CREATE INDEX "refund_request_status_createdAt_idx" ON "learning"."refund_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "refund_request_orderId_idx" ON "learning"."refund_request"("orderId");

-- CreateIndex
CREATE INDEX "conceptual_topic_courseId_isPublished_idx" ON "learning"."conceptual_topic"("courseId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "conceptual_topic_courseId_order_key" ON "learning"."conceptual_topic"("courseId", "order");

-- CreateIndex
CREATE INDEX "conceptual_session_courseId_isPublished_idx" ON "learning"."conceptual_session"("courseId", "isPublished");

-- CreateIndex
CREATE INDEX "conceptual_session_topicId_isPublished_idx" ON "learning"."conceptual_session"("topicId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "conceptual_session_topicId_order_key" ON "learning"."conceptual_session"("topicId", "order");

-- CreateIndex
CREATE INDEX "conceptual_session_watch_studentId_idx" ON "learning"."conceptual_session_watch"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "conceptual_session_watch_sessionId_studentId_key" ON "learning"."conceptual_session_watch"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "course_category_title_key" ON "learning"."course_category"("title");

-- CreateIndex
CREATE UNIQUE INDEX "course_category_slug_key" ON "learning"."course_category"("slug");

-- CreateIndex
CREATE INDEX "course_category_isActive_order_idx" ON "learning"."course_category"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "course_slug_key" ON "learning"."course"("slug");

-- CreateIndex
CREATE INDEX "course_status_isDeleted_idx" ON "learning"."course"("status", "isDeleted");

-- CreateIndex
CREATE INDEX "course_categoryId_idx" ON "learning"."course"("categoryId");

-- CreateIndex
CREATE INDEX "course_isFeatured_status_idx" ON "learning"."course"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "course_isPopular_status_idx" ON "learning"."course"("isPopular", "status");

-- CreateIndex
CREATE INDEX "course_createdAt_idx" ON "learning"."course"("createdAt");

-- CreateIndex
CREATE INDEX "course_courseType_idx" ON "learning"."course"("courseType");

-- CreateIndex
CREATE INDEX "course_phase_status_isDeleted_idx" ON "learning"."course"("phase", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "course_mode_idx" ON "learning"."course"("mode");

-- CreateIndex
CREATE INDEX "course_mentor_mentorId_idx" ON "learning"."course_mentor"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "course_mentor_courseId_mentorId_key" ON "learning"."course_mentor"("courseId", "mentorId");

-- CreateIndex
CREATE INDEX "milestone_courseId_isPublished_idx" ON "learning"."milestone"("courseId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_courseId_order_key" ON "learning"."milestone"("courseId", "order");

-- CreateIndex
CREATE INDEX "course_module_courseId_idx" ON "learning"."course_module"("courseId");

-- CreateIndex
CREATE INDEX "course_module_milestoneId_isPublished_idx" ON "learning"."course_module"("milestoneId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "course_module_milestoneId_order_key" ON "learning"."course_module"("milestoneId", "order");

-- CreateIndex
CREATE INDEX "video_courseId_idx" ON "learning"."video"("courseId");

-- CreateIndex
CREATE INDEX "video_moduleId_isPublished_idx" ON "learning"."video"("moduleId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "video_moduleId_order_key" ON "learning"."video"("moduleId", "order");

-- CreateIndex
CREATE INDEX "course_announcement_courseId_createdAt_idx" ON "learning"."course_announcement"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "course_review_courseId_status_idx" ON "learning"."course_review"("courseId", "status");

-- CreateIndex
CREATE INDEX "course_review_status_createdAt_idx" ON "learning"."course_review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "course_review_courseId_studentId_key" ON "learning"."course_review"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "lesson_question_videoId_createdAt_idx" ON "learning"."lesson_question"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_question_courseId_isResolved_idx" ON "learning"."lesson_question"("courseId", "isResolved");

-- CreateIndex
CREATE INDEX "lesson_answer_questionId_createdAt_idx" ON "learning"."lesson_answer"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "live_class_courseId_startsAt_idx" ON "learning"."live_class"("courseId", "startsAt");

-- CreateIndex
CREATE INDEX "live_class_status_startsAt_idx" ON "learning"."live_class"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_orderId_key" ON "learning"."enrollment"("orderId");

-- CreateIndex
CREATE INDEX "enrollment_courseId_status_idx" ON "learning"."enrollment"("courseId", "status");

-- CreateIndex
CREATE INDEX "enrollment_studentId_status_idx" ON "learning"."enrollment"("studentId", "status");

-- CreateIndex
CREATE INDEX "enrollment_createdAt_idx" ON "learning"."enrollment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_studentId_courseId_key" ON "learning"."enrollment"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "video_progress_enrollmentId_moduleId_idx" ON "learning"."video_progress"("enrollmentId", "moduleId");

-- CreateIndex
CREATE INDEX "video_progress_studentId_idx" ON "learning"."video_progress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_enrollmentId_videoId_key" ON "learning"."video_progress"("enrollmentId", "videoId");

-- CreateIndex
CREATE INDEX "module_progress_studentId_idx" ON "learning"."module_progress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "module_progress_enrollmentId_moduleId_key" ON "learning"."module_progress"("enrollmentId", "moduleId");

-- CreateIndex
CREATE INDEX "milestone_progress_studentId_idx" ON "learning"."milestone_progress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_progress_enrollmentId_milestoneId_key" ON "learning"."milestone_progress"("enrollmentId", "milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "learning"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "learning"."user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "session_tokenHash_key" ON "learning"."session"("tokenHash");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "learning"."session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "learning"."session"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_code_userId_purpose_idx" ON "learning"."auth_code"("userId", "purpose");

-- CreateIndex
CREATE INDEX "xp_transaction_studentId_courseId_idx" ON "learning"."xp_transaction"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "xp_transaction_courseId_createdAt_idx" ON "learning"."xp_transaction"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transaction_studentId_source_refId_key" ON "learning"."xp_transaction"("studentId", "source", "refId");

-- CreateIndex
CREATE INDEX "course_xp_courseId_totalXp_idx" ON "learning"."course_xp"("courseId", "totalXp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "course_xp_studentId_courseId_key" ON "learning"."course_xp"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_setting_key_key" ON "learning"."platform_setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profiles_userId_key" ON "learning"."learning_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profiles_studentId_key" ON "learning"."learning_profiles"("studentId");

-- CreateIndex
CREATE INDEX "learning_profiles_status_idx" ON "learning"."learning_profiles"("status");

-- CreateIndex
CREATE INDEX "learning_profiles_createdAt_idx" ON "learning"."learning_profiles"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profile_userId_key" ON "learning"."mentor_profile"("userId");

-- CreateIndex
CREATE INDEX "mentor_profile_isFeatured_idx" ON "learning"."mentor_profile"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_note_studentId_videoId_key" ON "learning"."lesson_note"("studentId", "videoId");

-- CreateIndex
CREATE INDEX "lesson_interaction_studentId_isBookmarked_idx" ON "learning"."lesson_interaction"("studentId", "isBookmarked");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_interaction_studentId_videoId_key" ON "learning"."lesson_interaction"("studentId", "videoId");

-- CreateIndex
CREATE INDEX "notification_userId_isRead_idx" ON "learning"."notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "learning"."notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_showOnLogin_isRead_idx" ON "learning"."notification"("userId", "showOnLogin", "isRead");

-- CreateIndex
CREATE INDEX "notification_type_idx" ON "learning"."notification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "outline_week_courseId_order_key" ON "learning"."outline_week"("courseId", "order");

-- CreateIndex
CREATE INDEX "outline_item_weekId_scheduledAt_idx" ON "learning"."outline_item"("weekId", "scheduledAt");

-- CreateIndex
CREATE INDEX "outline_item_courseId_idx" ON "learning"."outline_item"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "order_orderNumber_key" ON "learning"."order"("orderNumber");

-- CreateIndex
CREATE INDEX "order_studentId_status_idx" ON "learning"."order"("studentId", "status");

-- CreateIndex
CREATE INDEX "order_bundleOrderId_idx" ON "learning"."order"("bundleOrderId");

-- CreateIndex
CREATE INDEX "order_courseId_status_idx" ON "learning"."order"("courseId", "status");

-- CreateIndex
CREATE INDEX "order_status_createdAt_idx" ON "learning"."order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_couponCode_status_idx" ON "learning"."order"("couponCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orderId_key" ON "learning"."payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactionId_key" ON "learning"."payment"("transactionId");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "learning"."payment"("status");

-- CreateIndex
CREATE INDEX "payment_gateway_status_idx" ON "learning"."payment"("gateway", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_offer_courseId_key" ON "learning"."course_offer"("courseId");

-- CreateIndex
CREATE INDEX "course_offer_item_courseId_idx" ON "learning"."course_offer_item"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "completion_reward_courseId_key" ON "learning"."completion_reward"("courseId");

-- CreateIndex
CREATE INDEX "completion_reward_item_courseId_idx" ON "learning"."completion_reward_item"("courseId");

-- CreateIndex
CREATE INDEX "course_grant_studentId_idx" ON "learning"."course_grant"("studentId");

-- CreateIndex
CREATE INDEX "course_grant_orderId_idx" ON "learning"."course_grant"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "course_grant_offerId_studentId_courseId_key" ON "learning"."course_grant"("offerId", "studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_grant_rewardId_studentId_courseId_key" ON "learning"."course_grant"("rewardId", "studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_bundle_slug_key" ON "learning"."course_bundle"("slug");

-- CreateIndex
CREATE INDEX "course_bundle_isActive_idx" ON "learning"."course_bundle"("isActive");

-- CreateIndex
CREATE INDEX "course_bundle_item_courseId_idx" ON "learning"."course_bundle_item"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_order_orderNumber_key" ON "learning"."bundle_order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_order_transactionId_key" ON "learning"."bundle_order"("transactionId");

-- CreateIndex
CREATE INDEX "bundle_order_studentId_status_idx" ON "learning"."bundle_order"("studentId", "status");

-- CreateIndex
CREATE INDEX "bundle_order_bundleId_status_idx" ON "learning"."bundle_order"("bundleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_moduleId_key" ON "learning"."quiz"("moduleId");

-- CreateIndex
CREATE INDEX "quiz_courseId_idx" ON "learning"."quiz"("courseId");

-- CreateIndex
CREATE INDEX "quiz_moduleId_isPublished_idx" ON "learning"."quiz"("moduleId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_question_quizId_order_key" ON "learning"."quiz_question"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_option_questionId_order_key" ON "learning"."quiz_option"("questionId", "order");

-- CreateIndex
CREATE INDEX "quiz_attempt_quizId_studentId_idx" ON "learning"."quiz_attempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "quiz_attempt_studentId_idx" ON "learning"."quiz_attempt"("studentId");

-- CreateIndex
CREATE INDEX "quiz_attempt_enrollmentId_idx" ON "learning"."quiz_attempt"("enrollmentId");

-- CreateIndex
CREATE INDEX "quiz_attempt_answer_questionId_idx" ON "learning"."quiz_attempt_answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempt_answer_attemptId_questionId_key" ON "learning"."quiz_attempt_answer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_additional_info_userId_key" ON "learning"."student_additional_info"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_address_userId_key" ON "learning"."student_address"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_education_userId_key" ON "learning"."student_education"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_links_userId_key" ON "learning"."student_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_job_profile_userId_key" ON "learning"."student_job_profile"("userId");

-- CreateIndex
CREATE INDEX "student_project_userId_idx" ON "learning"."student_project"("userId");

-- CreateIndex
CREATE INDEX "student_skill_userId_idx" ON "learning"."student_skill"("userId");

-- CreateIndex
CREATE INDEX "student_job_experience_userId_idx" ON "learning"."student_job_experience"("userId");

-- CreateIndex
CREATE INDEX "student_hired_record_userId_idx" ON "learning"."student_hired_record"("userId");

-- CreateIndex
CREATE INDEX "student_course_request_userId_idx" ON "learning"."student_course_request"("userId");

-- CreateIndex
CREATE INDEX "support_session_courseId_startTime_idx" ON "learning"."support_session"("courseId", "startTime");

-- CreateIndex
CREATE INDEX "support_session_mentorId_startTime_idx" ON "learning"."support_session"("mentorId", "startTime");

-- CreateIndex
CREATE INDEX "support_session_status_startTime_idx" ON "learning"."support_session"("status", "startTime");

-- CreateIndex
CREATE INDEX "support_queue_sessionId_status_idx" ON "learning"."support_queue"("sessionId", "status");

-- CreateIndex
CREATE INDEX "support_queue_studentId_idx" ON "learning"."support_queue"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "support_queue_sessionId_queueNumber_key" ON "learning"."support_queue"("sessionId", "queueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "support_queue_sessionId_studentId_key" ON "learning"."support_queue"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "testimonial_isPublished_order_idx" ON "learning"."testimonial"("isPublished", "order");

-- AddForeignKey
ALTER TABLE "learning"."staff_activity" ADD CONSTRAINT "staff_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."staff_activity" ADD CONSTRAINT "staff_activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."admission_ticket" ADD CONSTRAINT "admission_ticket_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment" ADD CONSTRAINT "assignment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning"."milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment" ADD CONSTRAINT "assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_material" ADD CONSTRAINT "assignment_material_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning"."assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_material" ADD CONSTRAINT "assignment_material_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_submission" ADD CONSTRAINT "assignment_submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning"."assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_submission" ADD CONSTRAINT "assignment_submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_submission" ADD CONSTRAINT "assignment_submission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_submission" ADD CONSTRAINT "assignment_submission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_day" ADD CONSTRAINT "practice_day_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning"."milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_day" ADD CONSTRAINT "practice_day_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_completion" ADD CONSTRAINT "practice_completion_practiceDayId_fkey" FOREIGN KEY ("practiceDayId") REFERENCES "learning"."practice_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_completion" ADD CONSTRAINT "practice_completion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_completion" ADD CONSTRAINT "practice_completion_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."rubric_criterion" ADD CONSTRAINT "rubric_criterion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning"."assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."rubric_score" ADD CONSTRAINT "rubric_score_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning"."assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."rubric_score" ADD CONSTRAINT "rubric_score_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "learning"."rubric_criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."certificate" ADD CONSTRAINT "certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."certificate" ADD CONSTRAINT "certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."certificate" ADD CONSTRAINT "certificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."coupon" ADD CONSTRAINT "coupon_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."coupon_course" ADD CONSTRAINT "coupon_course_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "learning"."coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."coupon_course" ADD CONSTRAINT "coupon_course_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."refund_request" ADD CONSTRAINT "refund_request_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "learning"."order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."refund_request" ADD CONSTRAINT "refund_request_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."refund_request" ADD CONSTRAINT "refund_request_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conceptual_topic" ADD CONSTRAINT "conceptual_topic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conceptual_session" ADD CONSTRAINT "conceptual_session_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "learning"."conceptual_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conceptual_session" ADD CONSTRAINT "conceptual_session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conceptual_session_watch" ADD CONSTRAINT "conceptual_session_watch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "learning"."conceptual_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conceptual_session_watch" ADD CONSTRAINT "conceptual_session_watch_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course" ADD CONSTRAINT "course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "learning"."course_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course" ADD CONSTRAINT "course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_mentor" ADD CONSTRAINT "course_mentor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_mentor" ADD CONSTRAINT "course_mentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."milestone" ADD CONSTRAINT "milestone_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_module" ADD CONSTRAINT "course_module_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning"."milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_module" ADD CONSTRAINT "course_module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."video" ADD CONSTRAINT "video_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learning"."course_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."video" ADD CONSTRAINT "video_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_announcement" ADD CONSTRAINT "course_announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_announcement" ADD CONSTRAINT "course_announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_review" ADD CONSTRAINT "course_review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_review" ADD CONSTRAINT "course_review_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_review" ADD CONSTRAINT "course_review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_question" ADD CONSTRAINT "lesson_question_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_question" ADD CONSTRAINT "lesson_question_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "learning"."video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_question" ADD CONSTRAINT "lesson_question_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_answer" ADD CONSTRAINT "lesson_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "learning"."lesson_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_answer" ADD CONSTRAINT "lesson_answer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."live_class" ADD CONSTRAINT "live_class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."live_class" ADD CONSTRAINT "live_class_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "learning"."conceptual_topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."live_class" ADD CONSTRAINT "live_class_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollment" ADD CONSTRAINT "enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollment" ADD CONSTRAINT "enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollment" ADD CONSTRAINT "enrollment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "learning"."order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollment" ADD CONSTRAINT "enrollment_currentMilestoneId_fkey" FOREIGN KEY ("currentMilestoneId") REFERENCES "learning"."milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollment" ADD CONSTRAINT "enrollment_currentModuleId_fkey" FOREIGN KEY ("currentModuleId") REFERENCES "learning"."course_module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."video_progress" ADD CONSTRAINT "video_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."video_progress" ADD CONSTRAINT "video_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."video_progress" ADD CONSTRAINT "video_progress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "learning"."video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."module_progress" ADD CONSTRAINT "module_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."module_progress" ADD CONSTRAINT "module_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."module_progress" ADD CONSTRAINT "module_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learning"."course_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."milestone_progress" ADD CONSTRAINT "milestone_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."milestone_progress" ADD CONSTRAINT "milestone_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."milestone_progress" ADD CONSTRAINT "milestone_progress_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning"."milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."auth_code" ADD CONSTRAINT "auth_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."xp_transaction" ADD CONSTRAINT "xp_transaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."xp_transaction" ADD CONSTRAINT "xp_transaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_xp" ADD CONSTRAINT "course_xp_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_xp" ADD CONSTRAINT "course_xp_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."learning_profiles" ADD CONSTRAINT "learning_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."mentor_profile" ADD CONSTRAINT "mentor_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_note" ADD CONSTRAINT "lesson_note_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_note" ADD CONSTRAINT "lesson_note_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "learning"."video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_interaction" ADD CONSTRAINT "lesson_interaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_interaction" ADD CONSTRAINT "lesson_interaction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "learning"."video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."notification" ADD CONSTRAINT "notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."outline_week" ADD CONSTRAINT "outline_week_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."outline_item" ADD CONSTRAINT "outline_item_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "learning"."outline_week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."outline_item" ADD CONSTRAINT "outline_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."order" ADD CONSTRAINT "order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."order" ADD CONSTRAINT "order_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."order" ADD CONSTRAINT "order_bundleOrderId_fkey" FOREIGN KEY ("bundleOrderId") REFERENCES "learning"."bundle_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "learning"."order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_offer" ADD CONSTRAINT "course_offer_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_offer_item" ADD CONSTRAINT "course_offer_item_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "learning"."course_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_offer_item" ADD CONSTRAINT "course_offer_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."completion_reward" ADD CONSTRAINT "completion_reward_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."completion_reward_item" ADD CONSTRAINT "completion_reward_item_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "learning"."completion_reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."completion_reward_item" ADD CONSTRAINT "completion_reward_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "learning"."course_offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "learning"."completion_reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "learning"."order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_bundle_item" ADD CONSTRAINT "course_bundle_item_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "learning"."course_bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_bundle_item" ADD CONSTRAINT "course_bundle_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."bundle_order" ADD CONSTRAINT "bundle_order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."bundle_order" ADD CONSTRAINT "bundle_order_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "learning"."course_bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learning"."course_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_question" ADD CONSTRAINT "quiz_question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "learning"."quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_option" ADD CONSTRAINT "quiz_option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "learning"."quiz_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt" ADD CONSTRAINT "quiz_attempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "learning"."quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt" ADD CONSTRAINT "quiz_attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt" ADD CONSTRAINT "quiz_attempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning"."enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt_answer" ADD CONSTRAINT "quiz_attempt_answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "learning"."quiz_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt_answer" ADD CONSTRAINT "quiz_attempt_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "learning"."quiz_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."quiz_attempt_answer" ADD CONSTRAINT "quiz_attempt_answer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "learning"."quiz_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_additional_info" ADD CONSTRAINT "student_additional_info_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_address" ADD CONSTRAINT "student_address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_education" ADD CONSTRAINT "student_education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_links" ADD CONSTRAINT "student_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_job_profile" ADD CONSTRAINT "student_job_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_project" ADD CONSTRAINT "student_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_skill" ADD CONSTRAINT "student_skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_job_experience" ADD CONSTRAINT "student_job_experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_hired_record" ADD CONSTRAINT "student_hired_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."student_course_request" ADD CONSTRAINT "student_course_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_session" ADD CONSTRAINT "support_session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_session" ADD CONSTRAINT "support_session_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_queue" ADD CONSTRAINT "support_queue_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "learning"."support_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_queue" ADD CONSTRAINT "support_queue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."testimonial" ADD CONSTRAINT "testimonial_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."testimonial" ADD CONSTRAINT "testimonial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

