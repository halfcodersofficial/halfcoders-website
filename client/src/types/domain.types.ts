import type {
    BundlePricing,
    ClassMode,
    CourseDelivery,
    CourseLevel,
    CourseMode,
    CoursePhase,
    CoursePricing,
    CourseStatus,
    CourseType,
    EnrollmentStatus,
    OrderStatus,
    Role,
    SubmissionStatus,
    SupportQueueStatus,
    SupportSessionStatus,
    UserStatus,
} from "./api.types";

export interface MentorProfile {
    designation: string | null;
    expertise: string[];
    experience: string | null;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    websiteUrl?: string | null;
    isFeatured?: boolean;
}

export interface UserSummary {
    id: string;
    name: string;
    image: string | null;
    bio?: string | null;
    mentorProfile?: MentorProfile | null;
}

/** `{ eyeCare, goodPosture, meditation, stretching, screenBreak }`, each independently optional. */
export interface HealthCautionCategories {
    eyeCare?: boolean;
    goodPosture?: boolean;
    meditation?: boolean;
    stretching?: boolean;
    screenBreak?: boolean;
}

/** Account-level preferences. Absent keys mean "use the default" — see `DEFAULT_PREFERENCES`. */
export interface UserPreferences {
    healthCaution?: {
        enabled?: boolean;
        /** Minutes into a learning session before the first reminder, and between repeats. */
        intervalMinutes?: number;
        categories?: HealthCautionCategories;
    };
    /** Receive product update / announcement emails. */
    emailPreference?: boolean;
}

/**
 * The signed-in person: their account (name, email, phone, photo, role,
 * verification) merged with their learning profile (status, student id,
 * WhatsApp, bio, address, preferences).
 */
export interface CurrentUser {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    phoneVerified?: boolean;
    whatsapp: string | null;
    /** Display id shown on the profile, e.g. "HC-000123". Null for non-students. */
    studentId: string | null;
    image: string | null;
    bio: string | null;
    address: string | null;
    preferences: UserPreferences | null;
    role: Role;
    status: UserStatus;
    emailVerified: boolean;
    needPasswordChange: boolean;
    /** False for an account made with Google, which never has one. */
    hasPassword: boolean;
    /** Linked to a Google account. With no password, Google is the only way in. */
    signsInWithGoogle: boolean;
    /** When the account was created. */
    createdAt: string;
    /** When this account first used Half Coders. */
    learnerSince?: string;
    mentorProfile: MentorProfile | null;
    _count?: { enrollments: number; certificates: number };
}

/** What a sign-in's user agent says about the device — server lib/userAgent.ts. */
export interface DeviceInfo {
    browser: string | null;
    os: string | null;
    deviceType: "desktop" | "mobile" | "tablet" | "unknown";
}

/** One device the account is signed in on — `GET /auth/me/devices`. */
export interface MyDevice extends DeviceInfo {
    /** The session's id: what signing this device out sends. */
    id: string;
    signedInAt: string;
    ipAddress: string | null;
    /** The device asking. */
    current: boolean;
}

/** A sign-in refused for being one device too many — the 409's `data`. */
export interface DeviceLimitError {
    code: "DEVICE_LIMIT_EXCEEDED";
    maxDevices: number;
    devices: (DeviceInfo & { signedInAt: string })[];
}

export interface Category {
    id: string;
    title: string;
    slug: string;
    icon: string | null;
    description: string | null;
    courseCount?: number;
}

export interface CourseCounts {
    enrollments: number;
    milestones: number;
    modules: number;
    videos: number;
}

export interface CourseCard {
    id: string;
    title: string;
    slug: string;
    subtitle: string | null;
    description: string;
    thumbnail: string | null;
    /** Whole Taka — the API never sends fractional currency. */
    price: number;
    discountPrice: number | null;
    duration: string | null;
    level: CourseLevel;
    language: string;
    status: CourseStatus;
    /** Which learning experience this course uses — drives whether
     *  `/learn/[slug]/outline` (bootcamp) or the plain syllabus
     *  (`/learn/[slug]`, traditional) is the course's outline page. */
    courseType: CourseType;
    /** Present, upcoming or previous (recorded) — see `lib/courseClassification.ts`. */
    phase: CoursePhase;
    /** Free or paid, as the admin classified it. A free course's price is 0.
     *  Null on a draft nobody has classified yet (a seeded course) — a
     *  published course always has all three. */
    pricing: CoursePricing | null;
    /** Live, recorded, or both. */
    delivery: CourseDelivery | null;
    /** Online, in person, or both — an offline or both course may say where in `venue`. */
    mode: CourseMode | null;
    venue: string | null;
    /** This course's own terminology for its two-tier curriculum — e.g.
     *  "Week" instead of "Milestone". Defaults to "Milestone"/"Module". */
    milestoneLabel: string;
    moduleLabel: string;
    isFeatured: boolean;
    isPopular: boolean;
    category: Category | null;
    mentors: { role: string; mentor: UserSummary }[];
    _count: CourseCounts;
    /** The facts the admin wrote for the course page's hero — the catalogue
     *  list sends them too; other endpoints may not. */
    heroFacts?: CourseIconLine[];
    /** Bootcamp batch instants, as on `CourseDetail` — sent by the catalogue list. */
    enrollmentStartsAt?: string | null;
    enrollmentEndsAt?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    nextEnrollmentStartsAt?: string | null;
    nextEnrollmentEndsAt?: string | null;
    nextStartsAt?: string | null;
    nextEndsAt?: string | null;
}

/** VIDEO plays a YouTube link, TEXT is a written lesson, RESOURCE links out. */
export type LessonType = "VIDEO" | "TEXT" | "RESOURCE";

export interface LessonPreview {
    id: string;
    type: LessonType;
    title: string;
    duration: number;
    order: number;
    isFreePreview: boolean;
    /** Only ever set on a free-preview lesson; every other lesson gets `null`. */
    youtubeVideoId: string | null;
}

/** One tile in "How this course is structured". `icon` is a key into `COURSE_FEATURE_ICONS`. */
export interface CourseFeature {
    icon: string;
    title: string;
    description?: string;
}

export interface CourseFaq {
    question: string;
    answer: string;
}

/** One chip in the tech-stack grid. `icon` is a key into `TECH_STACK_ICONS`. */
export interface CourseTechStackItem {
    icon: string;
    name: string;
}

/** One line on the course page with an icon — `icon` is a `COURSE_FEATURE_ICONS` key. */
export interface CourseIconLine {
    icon: string;
    text: string;
}

export interface CourseTestimonial {
    id: string;
    name: string;
    designation: string | null;
    avatar: string | null;
    /** A YouTube link when this is a video testimonial, else null. */
    videoUrl: string | null;
    quote: string;
    rating: number;
}

export interface CourseDetail extends CourseCard {
    overview: string | null;
    /** The images after the thumbnail, in slideshow order. */
    gallery: string[];
    promoVideoUrl: string | null;
    outcomes: string[];
    requirements: string[];
    features: CourseFeature[];
    techStack: CourseTechStackItem[];
    faqs: CourseFaq[];
    /** The facts under the hero's description, likewise. */
    heroFacts: CourseIconLine[];
    /** Bootcamp batches as ISO instants — see `lib/courseBatch.ts`. Null on a traditional course. */
    enrollmentStartsAt: string | null;
    enrollmentEndsAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    nextEnrollmentStartsAt: string | null;
    nextEnrollmentEndsAt: string | null;
    nextStartsAt: string | null;
    nextEndsAt: string | null;
    /** A finished bootcamp batch taken off the homepage / the /courses list. Its page still opens by link. */
    hiddenFromHomepage: boolean;
    hiddenFromCatalogue: boolean;
    assignmentInfo: string | null;
    practiceInfo: string | null;
    supportInfo: string | null;
    milestones: {
        id: string;
        title: string;
        description: string | null;
        order: number;
        modules: { id: string; title: string; order: number; videos: LessonPreview[] }[];
        assignments: { id: string; title: string; totalMarks: number; order: number }[];
        practiceDays: { id: string; title: string; order: number }[];
    }[];
    totalDurationSeconds: number;
    totalDuration: string;
    totalAssignments: number;
    totalPracticeDays: number;
    freePreviewCount: number;
    isEnrolled: boolean;
    /** Published quotes an admin attached to this course. */
    testimonials: CourseTestimonial[];
}

export interface Enrollment {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    progress: number;
    startedAt: string;
    completedAt: string | null;
    course: CourseCard;
    currentModule: { id: string; title: string; order: number } | null;
    currentMilestone: { id: string; title: string; order: number } | null;
    certificate?: { id: string; certificateNo: string; issuedAt: string } | null;
    /** Dashboard payload only: the course hands this student an admission ticket. */
    hasAdmissionTicket?: boolean;
    /**
     * Dashboard payload only: the main course this one came with as a reward
     * course, when that's how the student has it. A reward course has no
     * certificate of its own — the main course's is the one.
     */
    rewardWith?: { id: string; title: string; slug: string } | null;
    /** Present on the dashboard payload only — Bootcamp and Traditional
     *  courses earn it under different rules, so it's per enrollment rather
     *  than one shared number. `history` is oldest-to-newest: the last 7
     *  calendar days for Traditional, the last 7 module releases for
     *  Bootcamp (so gaps with no release simply aren't in the list). */
    streak?: {
        currentStreakDays: number;
        courseType: CourseType;
        history: { date: string; isActive: boolean }[];
    };
}

// ---- Learning page -------------------------------------------------------

export interface LearningVideo {
    id: string;
    type: LessonType;
    title: string;
    description: string | null;
    order: number;
    thumbnail: string | null;
    duration: number;
    durationLabel: string;
    /** Null while the module is locked, so locked content is truly unreachable. */
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    /** A text lesson's body — null for other types, and while locked. */
    content: string | null;
    /** A resource lesson's link — null for other types, and while locked. */
    resourceUrl: string | null;
    isCompleted: boolean;
    watchedSeconds: number;
}

/** A module's quiz, as it appears in the course-content sidebar — enough to
 *  show its title and completion state without a separate round trip. */
export interface LearningQuiz {
    id: string;
    title: string;
    isCompleted: boolean;
    /** The student's best completed-attempt percentage, or null if never completed. */
    bestScore: number | null;
}

export interface LearningModule {
    id: string;
    title: string;
    description: string | null;
    order: number;
    /** Place in the week's mixed list with its assignments and practice days. */
    position: number;
    /** Online or offline, on a course that runs both — null anywhere else, or not marked. */
    mode: ClassMode | null;
    isLocked: boolean;
    isCompleted: boolean;
    progress: number;
    completedVideos: number;
    totalVideos: number;
    quiz: LearningQuiz | null;
    videos: LearningVideo[];
}

export interface LearningMilestone {
    id: string;
    title: string;
    description: string | null;
    order: number;
    isCompleted: boolean;
    progress: number;
    modules: LearningModule[];
    assignments: {
        id: string;
        title: string;
        description: string;
        totalMarks: number;
        deadline: string | null;
        order: number;
        position: number;
        submissionStatus: SubmissionStatus | null;
        score: number | null;
        isSubmitted: boolean;
        isAccepted: boolean;
    }[];
    practiceDays: {
        id: string;
        title: string;
        description: string | null;
        order: number;
        position: number;
        isCompleted: boolean;
        completedAt: string | null;
    }[];
}

// ---- Lesson notes / bookmarks / reactions --------------------------------

export type LessonReaction = "LIKE" | "DISLIKE";

export interface LessonState {
    note: string | null;
    noteUpdatedAt: string | null;
    isBookmarked: boolean;
    reaction: LessonReaction | null;
}

export interface BookmarkedLesson {
    videoId: string;
    title: string;
    durationLabel: string;
    moduleId: string;
    moduleTitle: string;
}

export interface CourseLearning {
    course: {
        id: string;
        title: string;
        slug: string;
        thumbnail: string | null;
        duration: string | null;
        courseType: CourseType;
        phase: CoursePhase;
        milestoneLabel: string;
        moduleLabel: string;
    };
    enrollment: {
        id: string;
        progress: number;
        status: EnrollmentStatus;
        startedAt: string;
        completedAt: string | null;
        currentModuleId: string | null;
        currentMilestoneId: string | null;
    } | null;
    /** True for staff previewing the course — no progress to record. */
    isPreview: boolean;
    sequentialLearning: boolean;
    curriculum: LearningMilestone[];
}

/**
 * The planned course outline (`/learn/[slug]/outline`), written in the
 * Outline Maker. A schedule only — deliberately unrelated to the
 * `LearningMilestone`/`LearningModule` tree the player uses, and never synced
 * with it. An item counts as published once `scheduledAt` has passed, however
 * the real module it names is doing.
 */
export type OutlineItemKind = "MODULE" | "PRACTICE" | "NO_MODULE";

export interface OutlineItem {
    id: string;
    kind: OutlineItemKind;
    title: string;
    note: string | null;
    /** Bootcamp only. Null while the date is still to be announced. */
    scheduledAt: string | null;
    /** Traditional only — a bootcamp item's status comes from its date. */
    isPublished: boolean;
    /** Online or offline, on a course that runs both — null anywhere else, or not marked. */
    mode: ClassMode | null;
}

export interface OutlineWeek {
    id: string;
    /** Optional theme; the week is always labelled by position ("Week 03"). */
    title: string | null;
    order: number;
    items: OutlineItem[];
}

export interface CourseOutline {
    course: {
        id: string;
        title: string;
        slug: string;
        courseType: CourseType;
        milestoneLabel: string;
        moduleLabel: string;
    };
    enrollment: { status: EnrollmentStatus } | null;
    isPreview: boolean;
    weeks: OutlineWeek[];
}

// ---- Dashboards ----------------------------------------------------------

/**
 * The dashboard's "Up next", in detail: the lesson the course player will
 * open (the first unfinished one the student may play — null when there's
 * none, e.g. everything left is locked), and the course as its milestones in
 * order with how many lessons of each are done.
 */
export interface UpNextPlan {
    nextLesson: {
        id: string;
        title: string;
        type: LessonType;
        /** Seconds; 0 when the lesson has no running time (text, a link). */
        duration: number;
        watchedSeconds: number;
        /** Its place in the whole course, counting from 1. */
        number: number;
        milestone: { id: string; title: string; order: number };
        module: { id: string; title: string; order: number };
    } | null;
    milestones: { id: string; title: string; order: number; totalLessons: number; completedLessons: number }[];
    totalLessons: number;
    completedLessons: number;
}

export interface StudentDashboard {
    summary: {
        enrolledCourses: number;
        completedCourses: number;
        certificates: number;
        totalXp: number;
        unreadNotifications: number;
    };
    continueLearning: (Enrollment & { upNext?: UpNextPlan }) | null;
    enrollments: Enrollment[];
    upcomingAssignments: {
        id: string;
        title: string;
        deadline: string | null;
        totalMarks: number;
        course: { id: string; title: string; slug: string };
    }[];
    upcomingSupport: {
        id: string;
        title: string | null;
        startTime: string;
        endTime: string;
        status: SupportSessionStatus;
        isLive: boolean;
        course: { id: string; title: string; slug: string };
        mentor: UserSummary;
    }[];
}

// ---- Support -------------------------------------------------------------

export interface SupportSessionCard {
    id: string;
    title: string | null;
    startTime: string;
    endTime: string;
    status: SupportSessionStatus;
    slotMinutes: number;
    notes: string | null;
    mentor: UserSummary;
    isLive: boolean;
    /** False once the mentor has cut off new sign-ups for this session. */
    joinOpen: boolean;
    waitingCount: number;
    /** Withheld until the session is actually live. */
    meetingLink: string | null;
    myQueue: { queueNumber: number; status: SupportQueueStatus } | null;
}

export interface MyQueuePosition {
    inQueue: boolean;
    myStatus: SupportQueueStatus | null;
    myQueueNumber: number | null;
    nowServing: number | null;
    peopleAhead?: number;
    estimatedWaitMinutes?: number;
    waitingCount: number;
    isLive: boolean;
}

export interface QueueBoard {
    sessionId: string;
    courseId: string;
    course?: { id: string; title: string; slug: string };
    title?: string | null;
    /** Only while the session is on — as students get it. */
    meetingLink?: string | null;
    helpedCount?: number;
    skippedCount?: number;
    status: SupportSessionStatus;
    isLive: boolean;
    /** False once the mentor has cut off new sign-ups for this session. */
    joinOpen: boolean;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    nowServing: {
        queueNumber: number;
        /** By name — the board carries no photos (see the API's lib/studentPrivacy). */
        student: { id: string; name: string; image?: string | null };
        servedAt: string | null;
        topic: string | null;
    } | null;
    waiting: {
        id: string;
        queueNumber: number;
        student: { id: string; name: string; image?: string | null };
        topic: string | null;
        joinedAt: string;
    }[];
    waitingCount: number;
}

// ---- Misc ----------------------------------------------------------------

export interface Certificate {
    id: string;
    certificateNo: string;
    studentName: string;
    courseName: string;
    completionDate: string;
    issuedAt: string;
    status: "ISSUED" | "REVOKED";
    verificationUrl?: string;
    course?: { id: string; title: string; slug: string; thumbnail: string | null };
}

export interface CertificateVerification {
    valid: boolean;
    certificateNo: string;
    studentName: string;
    courseName: string;
    completionDate: string;
    issuedAt: string;
    status: "ISSUED" | "REVOKED";
    revokedAt: string | null;
    issuer: string;
}

export interface EligibilityReport {
    eligible: boolean;
    progress: number;
    requiredAssignments: number;
    acceptedAssignments: number;
    totalMilestones: number;
    completedMilestones: number;
    blockers: string[];
    certificate?: { id: string; certificateNo: string; issuedAt: string } | null;
    alreadyIssued?: boolean;
}

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
    /** Whoever sent it — an admin's announcement; null when Half Coders did. */
    sender?: { name: string; image: string | null } | null;
}

/** The unread total and, per notification type, how many of those. */
export interface UnreadCount {
    count: number;
    byType?: Partial<Record<string, number>>;
}

/** An admin broadcast flagged to pop up at login — see `LoginPopupListener`. */
export interface LoginPopupNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    link: string | null;
    /** Shown once in every login session, rather than once ever. */
    repeatOnLogin: boolean;
}

/** `GET /notifications/login-popups` — the pop-ups still to see, and which login this is. */
export interface LoginPopups {
    /** Opaque and stable for one sign-in; a new sign-in gets a new one. Null when the API can't tell. */
    session: string | null;
    popups: LoginPopupNotification[];
}

export interface Order {
    id: string;
    orderNumber: string;
    amount: number;
    discount: number;
    total: number;
    currency: string;
    couponCode?: string | null;
    status: OrderStatus;
    createdAt: string;
    course: { id: string; title: string; slug: string; thumbnail: string | null };
}

export interface LeaderboardRow {
    rank: number;
    student: UserSummary;
    totalXp: number;
}

export type XpSource =
    | "VIDEO_COMPLETE"
    | "ASSIGNMENT_SUBMIT"
    | "ASSIGNMENT_SCORE"
    | "PRACTICE_COMPLETE"
    | "MODULE_COMPLETE"
    | "MILESTONE_COMPLETE"
    | "COURSE_COMPLETE"
    | "SUPPORT_PARTICIPATION";

/** One row of a student's XP ledger — backs the "how you earned this" panel. */
export interface XpHistoryEntry {
    id: string;
    studentId: string;
    courseId: string | null;
    source: XpSource;
    points: number;
    refId: string | null;
    note: string | null;
    createdAt: string;
    course: { id: string; title: string; slug: string } | null;
}

/** A post on a course's notice board — by one of its mentors or an admin. */
export interface CourseAnnouncement {
    id: string;
    courseId: string;
    title: string;
    body: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    author: { id: string; name: string; image: string | null };
    /** Only on the reply to a new post: how many students were told. */
    recipients?: number;
}

/** Someone in a lesson's Q&A — by name only; `isStaff` marks the course's mentors (and admins). */
export interface QaPerson {
    id: string;
    name: string;
    isStaff: boolean;
}

export interface LessonAnswer {
    id: string;
    body: string;
    createdAt: string;
    author: QaPerson;
    isMine: boolean;
}

export interface LessonQuestion {
    id: string;
    videoId: string;
    courseId: string;
    body: string;
    isResolved: boolean;
    createdAt: string;
    author: QaPerson;
    isMine: boolean;
    answers: LessonAnswer[];
}

/** A question in the staff inbox, with where it was asked. */
export interface InboxQuestion extends LessonQuestion {
    video: { id: string; title: string; module: { title: string; order: number; milestone: { order: number } } };
    course: { id: string; title: string; slug: string; milestoneLabel: string; moduleLabel: string };
}

export type CourseReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN";

/** Average, count and the 5→1 spread of a course's ratings. */
export interface RatingSummary {
    count: number;
    average: number | null;
    spread: { stars: number; count: number }[];
}

/** A published review, as the course page shows it. */
export interface PublicCourseReview {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    student: { id: string; name: string; image: string | null };
}

/** A student's own review of a course. */
export interface MyCourseReview {
    id: string;
    rating: number;
    comment: string | null;
    status: CourseReviewStatus;
    createdAt: string;
    updatedAt: string;
}

// ---------------------------------------------------------------------------
// Promotions and bundles
// ---------------------------------------------------------------------------

/** A course as a promotion lists it — enough for a small card. */
export interface PromoCourse {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    price: number;
    discountPrice: number | null;
}

/** A course inside a bundle, flagged when the viewer already has it. */
export interface BundleCourse extends PromoCourse {
    subtitle: string | null;
    level: CourseLevel;
    phase: CoursePhase;
    delivery: CourseDelivery;
    mode: CourseMode;
    category: { title: string } | null;
    owned: boolean;
}

/** A bundle on sale, priced for the viewer (less when they own some of it). */
export interface PublicBundle {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail: string | null;
    pricing: BundlePricing;
    discountPercent: number | null;
    endsAt: string | null;
    courses: BundleCourse[];
    quote: {
        /** Every course on its own, at today's sale prices. */
        combined: number;
        bundlePrice: number;
        /** What the whole bundle saves on buying the courses one by one. */
        savings: number;
        /** This viewer's price. */
        total: number;
        ownedCount: number;
        ownsAll: boolean;
    };
}

/** What a course's page and checkout say about promotions. */
export interface CoursePromotions {
    /** The free courses buying this one earns, while the offer is on. */
    offer: { endsAt: string | null; courses: PromoCourse[] } | null;
    /** The courses finishing this one in time earns. */
    reward: {
        condition: "COURSE_COMPLETE" | "CERTIFICATE";
        deadlineAt: string | null;
        withinDays: number | null;
        /** The viewer's own deadline, once they're enrolled. */
        yourDeadline: string | null;
        earned: boolean;
        courses: PromoCourse[];
    } | null;
    /** Bundles on sale that hold this course. */
    bundles: PublicBundle[];
}

/** One checkout for a bundle; once paid, `orders` holds the order each course became. */
export interface BundleOrder {
    id: string;
    orderNumber: string;
    amount: number;
    discount: number;
    total: number;
    currency: string;
    status: OrderStatus;
    items: { courseId: string; title: string; salePrice: number; share: number }[];
    gateway: string | null;
    /** The bKash TrxID the student sent in, while it waits for an admin — and after. */
    transactionId: string | null;
    gatewayData: { senderNumber?: string; submittedAt?: string } | null;
    paidAt: string | null;
    failureReason: string | null;
    createdAt: string;
    bundle: { id: string; title: string; slug: string; thumbnail: string | null };
    orders: {
        id: string;
        orderNumber: string;
        total: number;
        status: OrderStatus;
        course: { id: string; title: string; slug: string; thumbnail: string | null };
    }[];
}

/**
 * What one course's admission ticket says where — written per course by an
 * admin, drawn with the student's name and photo by `lib/admissionTicket`.
 */
export interface AdmissionTicketWords {
    headline: string;
    subheadline: string | null;
    ticketTitle: string | null;
    badge: string | null;
    learnerLabel: string | null;
    courseLabel: string | null;
    /** What the ticket calls the course; the title when empty. */
    courseName: string | null;
    fields: { label: string; value: string }[];
    stubLabel: string | null;
    stubValue: string | null;
    showPhoto: boolean;
    taglineLead: string | null;
    taglineAccent: string | null;
    footerText: string | null;
}

export interface AdmissionTicketSettings extends AdmissionTicketWords {
    isActive: boolean;
    updatedAt: string;
}

/** A student's own ticket for a course they're on. */
export interface MyAdmissionTicket {
    ticket: AdmissionTicketSettings;
    learner: { name: string; image: string | null };
    course: { id: string; title: string; slug: string };
    enrolledAt: string;
}
