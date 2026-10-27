import type {
    BundlePricing,
    CourseDelivery,
    CoursePhase,
    CoursePricing,
    CourseStatus,
    CourseType,
    EnrollmentStatus,
    OrderStatus,
    RewardCondition,
    Role,
    UserStatus,
} from "./api.types";
import type {
    AdmissionTicketSettings,
    Certificate,
    CourseCard,
    CourseFaq,
    CourseFeature,
    CourseIconLine,
    CourseTechStackItem,
    DeviceInfo,
    MentorProfile,
    UserSummary,
} from "./domain.types";
import type {
    ProfileSectionFlags,
    StudentAdditionalInfo,
    StudentAddress,
    StudentCourseRequest,
    StudentEducation,
    StudentHiredRecord,
    StudentJobExperience,
    StudentJobProfile,
    StudentLinks,
    StudentProject,
    StudentSkill,
} from "./profile.types";

export interface AdminDashboard {
    summary: {
        totalStudents: number;
        totalMentors: number;
        totalCourses: number;
        publishedCourses: number;
        totalEnrollments: number;
        completedEnrollments: number;
        certificates: number;
        /** Settled orders only — pending ones are not money. */
        totalRevenue: number;
        activeSupportSessions: number;
        waitingStudents: number;
    };
    /** Every order still waiting on payment, and what they'd come to. */
    pendingOrders: { count: number; total: number };
    /** The last 30 days, oldest first, by Dhaka day ("YYYY-MM-DD"). */
    trend: AdminDashboardDay[];
    /** The last 30 days against the 30 before them. */
    period: Record<AdminDashboardMetric, { current: number; previous: number }>;
    recentUsers: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        role: Role;
        createdAt: string;
    }[];
    recentOrders: {
        id: string;
        orderNumber: string;
        total: number;
        status: OrderStatus;
        createdAt: string;
        student: { id: string; name: string; email: string };
        course: { id: string; title: string };
    }[];
    recentEnrollments: {
        id: string;
        progress: number;
        createdAt: string;
        /** Null when an admin enrolled them by hand. */
        orderId: string | null;
        student: UserSummary;
        course: { id: string; title: string; slug: string };
    }[];
    /** Published courses with the most students who still have access. */
    topCourses: {
        course: {
            id: string;
            title: string;
            slug: string;
            thumbnail: string | null;
            price: number;
            discountPrice: number | null;
            courseType: CourseType;
        };
        /** Active and completed enrolments. */
        enrolled: number;
        completed: number;
        /** Settled orders, all time. */
        revenue: number;
    }[];
}

export type AdminDashboardMetric = "revenue" | "enrolments" | "learners" | "completions";

export type AdminDashboardDay = { date: string } & Record<AdminDashboardMetric, number>;

/** One person in the super admin's admin directory. */
export interface AdminDirectoryEntry extends AdminUser {
    /** False until they first open Half Coders. */
    hasOpenedHalfCoders: boolean;
    /** When they last did something in the console (the staff activity log). */
    lastActionAt: string | null;
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    image: string | null;
    role: Role;
    status: UserStatus;
    emailVerified: boolean;
    /** When they joined Half Coders (their learning profile), if they have. */
    createdAt: string;
    /** When the central account was created. */
    accountCreatedAt?: string;
    /** The account's central role; `role` is its Half Coders role. */
    centralRole?: string;
    _count?: { enrollments: number; certificates: number; mentoredCourses: number; submissions?: number };
    mentorProfile?: {
        designation: string | null;
        expertise: string[];
        experience: string | null;
    } | null;
    /** Student register only — their Half Coders id, e.g. "HC-000123", once assigned. */
    studentId?: string | null;
    whatsapp?: string | null;
    /** Student register only — courses they're on (not cancelled), most recently touched first. */
    enrollments?: {
        id: string;
        status: EnrollmentStatus;
        progress: number;
        course: { id: string; title: string; thumbnail: string | null };
    }[];
    totalXp?: number;
    /** The last lesson, submission, quiz or practice day — null if they've done none. */
    lastActiveAt?: string | null;
}

/** How many students each register filter holds — `GET /users/students/counts`. */
export interface AdminStudentCounts {
    all: number;
    active: number;
    blocked: number;
    unverified: number;
}

/** One student, with everything the console can act on — `GET /users/students/:id`. */
export interface AdminStudentDetail extends AdminUser {
    bio: string | null;
    address: string | null;
    enrollments: {
        id: string;
        status: EnrollmentStatus;
        progress: number;
        startedAt: string;
        completedAt: string | null;
        createdAt: string;
        course: { id: string; title: string; slug: string; thumbnail: string | null };
        certificate: { id: string; certificateNo: string; issuedAt: string } | null;
    }[];
    orders: {
        id: string;
        orderNumber: string;
        total: number;
        status: OrderStatus;
        createdAt: string;
    }[];
    courseXp: { totalXp: number; course: { id: string; title: string } }[];
}

/** Someone who marked work — a mentor, or an admin. */
export interface Marker {
    id: string;
    name: string;
    image: string | null;
    role: Role | null;
}

/** One assignment submission, with its marks and who gave them. */
export interface StudentSubmission {
    id: string;
    enrollmentId: string;
    status: string;
    score: number | null;
    /** A late submission's cap; `null` means it could earn the assignment's full marks. */
    maxScore: number | null;
    /** The score as a percentage of what it could earn. */
    percent: number | null;
    /** Marked out of a late window's cap rather than full marks. */
    late: boolean;
    feedback: string | null;
    content: string | null;
    submissionUrl: string | null;
    fileUrls: string[];
    submittedAt: string;
    updatedAt: string;
    reviewedAt: string | null;
    /** Whoever marked it last. */
    reviewedBy: Marker | null;
    assignment: {
        id: string;
        title: string;
        totalMarks: number;
        deadline: string | null;
        milestone: { id: string; title: string; order: number };
        course: { id: string; title: string; milestoneLabel: string };
    };
    /** Each time it was marked, oldest first, and by whom — only since the change history began. */
    history: { status: string | null; score: number | null; at: string; by: Marker }[];
}

/** One course a student is on, with how far they've got — part of `StudentOverview`. */
export interface StudentEnrollment {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    progress: number;
    startedAt: string;
    completedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    course: {
        id: string;
        title: string;
        slug: string;
        thumbnail: string | null;
        courseType: "BOOTCAMP" | "TRADITIONAL";
        status: CourseStatus;
        milestoneLabel: string;
        moduleLabel: string;
    };
    currentMilestone: { id: string; title: string; order: number } | null;
    currentModule: { id: string; title: string; order: number } | null;
    certificate: { id: string; certificateNo: string; issuedAt: string; status: string } | null;
    /** Null for a manual enrolment. */
    order: { id: string; orderNumber: string; total: number; status: OrderStatus } | null;
    lessons: { completed: number; total: number };
    assignments: {
        total: number;
        submitted: number;
        accepted: number;
        awaitingReview: number;
        needsRevision: number;
        /** Closed without a submission. */
        missed: number;
        averagePercent: number | null;
    };
    /** `averagePercent` is over each quiz's best attempt. */
    quizzes: { total: number; taken: number; averagePercent: number | null };
    practice: { total: number; completed: number };
    xp: number;
    lastActivityAt: string | null;
}

export interface StudentQuizAttempt {
    id: string;
    enrollmentId: string;
    status: "IN_PROGRESS" | "COMPLETED";
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    percentage: number;
    startedAt: string;
    completedAt: string | null;
    quiz: {
        id: string;
        title: string;
        module: { title: string; order: number; milestone: { title: string; order: number } };
        course: { id: string; title: string; milestoneLabel: string; moduleLabel: string };
    };
}

/** Everything on the student detail page — `GET /users/students/:id/overview`. */
export interface StudentOverview {
    student: Omit<AdminUser, "email"> & {
        /** Null for a phone-only account. */
        email: string | null;
        phoneVerified: boolean;
        studentId: string | null;
        whatsapp: string | null;
        bio: string | null;
        address: string | null;
        /** Account-wide status on the central account; `status` is Half Coders' own. */
        accountStatus: string;
    };
    profile: {
        additionalInfo: StudentAdditionalInfo | null;
        address: StudentAddress | null;
        education: StudentEducation | null;
        links: StudentLinks | null;
        jobProfile: StudentJobProfile | null;
        projects: StudentProject[];
        skills: StudentSkill[];
        jobExperiences: StudentJobExperience[];
        hiredRecords: StudentHiredRecord[];
        courseRequests: StudentCourseRequest[];
        sections: ProfileSectionFlags;
        completionPercent: number;
    };
    stats: {
        courses: { total: number; active: number; completed: number };
        averageProgress: number | null;
        lessonsCompleted: number;
        assignments: {
            submitted: number;
            marked: number;
            awaitingReview: number;
            missed: number;
            averagePercent: number | null;
        };
        quizzes: { attempts: number; averagePercent: number | null };
        certificates: number;
        xp: number;
        support: { visits: number; helped: number };
        /** Taka across paid orders. */
        paid: number;
        lastActivityAt: string | null;
    };
    enrollments: StudentEnrollment[];
    submissions: StudentSubmission[];
    quizAttempts: StudentQuizAttempt[];
    orders: {
        id: string;
        orderNumber: string;
        amount: number;
        discount: number;
        total: number;
        couponCode: string | null;
        status: OrderStatus;
        createdAt: string;
        course: { id: string; title: string };
        payment: {
            gateway: string;
            transactionId: string | null;
            amount: number;
            status: OrderStatus;
            paidAt: string | null;
            failureReason: string | null;
        } | null;
    }[];
    support: {
        id: string;
        queueNumber: number;
        status: string;
        topic: string | null;
        joinedAt: string;
        servedAt: string | null;
        completedAt: string | null;
        mentorNote: string | null;
        session: {
            id: string;
            title: string | null;
            startTime: string;
            endTime: string;
            status: string;
            course: { id: string; title: string };
            mentor: { id: string; name: string; image: string | null };
        };
    }[];
    xp: {
        total: number;
        bySource: { source: string; points: number; count: number }[];
        recent: {
            id: string;
            source: string;
            points: number;
            note: string | null;
            createdAt: string;
            course: { id: string; title: string } | null;
        }[];
    };
    testimonials: {
        id: string;
        quote: string;
        rating: number;
        videoUrl: string | null;
        isPublished: boolean;
        createdAt: string;
        course: { id: string; title: string } | null;
    }[];
    engagement: { notes: number; bookmarks: number; likes: number; dislikes: number };
    /** The last 30 days, oldest first; `date` is YYYY-MM-DD in Dhaka. */
    trend: { date: string; lessons: number; submissions: number; quizzes: number; practice: number }[];
    /** What they did, newest first. */
    feed: {
        id: string;
        kind: "lesson" | "submission" | "review" | "quiz" | "practice" | "support" | "enrolled" | "certificate" | "payment";
        at: string;
        title: string;
        course: { id: string; title: string } | null;
        detail?: string | null;
        amount?: number;
        by?: { id: string; name: string; image: string | null } | null;
    }[];
}

export interface StudentCourseLesson {
    id: string;
    title: string;
    type: string;
    /** Seconds. */
    duration: number;
    completed: boolean;
    completedAt: string | null;
    watchedSeconds: number;
    lastWatchedAt: string | null;
}

export type StudentCourseItem =
    | {
        kind: "module";
        id: string;
        title: string;
        order: number;
        position: number;
        publishedAt: string | null;
        isCurrent: boolean;
        lessons: StudentCourseLesson[];
        completedLessons: number;
        progress: number;
        completedAt: string | null;
        quiz: {
            id: string;
            title: string;
            questions: number;
            attempts: {
                id: string;
                status: "IN_PROGRESS" | "COMPLETED";
                totalQuestions: number;
                correctCount: number;
                percentage: number;
                startedAt: string;
                completedAt: string | null;
            }[];
            bestPercent: number | null;
        } | null;
    }
    | {
        kind: "assignment";
        id: string;
        title: string;
        totalMarks: number;
        deadline: string | null;
        position: number;
        publishedAt: string | null;
        /** When first submissions stop — the last late window, else the deadline. */
        closesAt: string | null;
        missed: boolean;
        submission: StudentSubmission | null;
    }
    | {
        kind: "practice";
        id: string;
        title: string;
        position: number;
        publishedAt: string | null;
        completion: { completedAt: string; note: string | null } | null;
    };

/** One course, week by week, for one student — `GET /users/students/:id/courses/:courseId`. */
export interface StudentCourseBreakdown {
    enrollment: {
        id: string;
        status: EnrollmentStatus;
        progress: number;
        currentMilestoneId: string | null;
        currentModuleId: string | null;
        course: {
            id: string;
            title: string;
            slug: string;
            courseType: "BOOTCAMP" | "TRADITIONAL";
            milestoneLabel: string;
            moduleLabel: string;
        };
    };
    weeks: {
        id: string;
        title: string;
        order: number;
        isCurrent: boolean;
        progress: number;
        completedAt: string | null;
        items: StudentCourseItem[];
    }[];
}

/** One mentor with their profile and assignments — `GET /users/mentors/:id`. */
export interface AdminMentorDetail extends AdminUser {
    bio: string | null;
    mentorProfile: MentorProfile | null;
    mentoredCourses: {
        role: string;
        course: {
            id: string;
            title: string;
            slug: string;
            thumbnail: string | null;
            status: CourseStatus;
            _count: { enrollments: number };
        };
    }[];
}

/** A device label read from a user agent — self-reported, so a label, not a fact. */
export type { DeviceInfo };

/** Everything on the mentor detail page — `GET /users/mentors/:id/overview`. */
export interface MentorOverview {
    mentor: AdminMentorDetail;
    courses: (AdminMentorDetail["mentoredCourses"][number]["course"] & {
        role: string;
        /** Enrolled, not counting cancelled enrolments. */
        students: number;
        completed: number;
        /** 0–100. */
        averageProgress: number;
    })[];
    stats: {
        courses: number;
        students: number;
        certificates: number;
        support: {
            total: number;
            ended: number;
            live: number;
            cancelled: number;
            upcoming: number;
            studentsHelped: number;
        };
        reviews: {
            total: number;
            pending: number;
            averageTurnaroundHours: number | null;
            /** Percent of reviews returned within `promptHours`. */
            promptShare: number | null;
            promptHours: number;
        };
        content: {
            /** Every entry in the change history. */
            changes: number;
            lessonsAdded: number;
            modulesAdded: number;
            quizzesAdded: number;
            assignmentsAdded: number;
            /** From each quiz's author column, which predates the change history. */
            quizzesAuthored: number;
        };
        lastActivityAt: string | null;
    };
    /** The last 30 days, oldest first; `date` is YYYY-MM-DD in Dhaka. */
    trend: { date: string; changes: number; reviews: number; supportSessions: number }[];
    recentSupportSessions: {
        id: string;
        title: string | null;
        status: string;
        startTime: string;
        endTime: string;
        course: { id: string; title: string };
        studentsJoined: number;
        studentsHelped: number;
    }[];
}

/** A submission the mentor marked — `GET /users/mentors/:id/reviews`. */
export interface MentorReview {
    id: string;
    status: string;
    score: number | null;
    /** A late submission's cap; `null` means it could earn the assignment's full marks. */
    maxScore: number | null;
    /** The score as a percentage of what it could earn. */
    percent: number | null;
    feedback: string | null;
    submissionUrl: string | null;
    fileUrls: string[];
    submittedAt: string;
    reviewedAt: string;
    student: { id: string; name: string; email: string; image: string | null; studentId: string | null };
    assignment: {
        id: string;
        title: string;
        totalMarks: number;
        deadline: string | null;
        milestone: { title: string; order: number };
        course: { id: string; title: string };
    };
    /** Each time this mentor marked it, oldest first — only since the change history began. */
    history: { status: string | null; score: number | null; at: string }[];
}

/** Marks given per course, across everything the mentor has marked. */
export interface MentorReviewCourse {
    id: string;
    title: string;
    reviews: number;
    accepted: number;
    scored: number;
    averagePercent: number | null;
}

/** One entry in a mentor's change history — `GET /users/mentors/:id/activity`. */
export interface MentorActivityEntry {
    id: string;
    action: string;
    summary: string;
    entityType: string | null;
    entityId: string | null;
    detail: { fields?: string[]; count?: number; published?: boolean; status?: string; score?: number } | null;
    ipAddress: string | null;
    createdAt: string;
    course: { id: string; title: string } | null;
    device: DeviceInfo;
}

/** A live sign-in — `GET /users/mentors/:id/devices`. */
export interface MentorDevice extends DeviceInfo {
    id: string;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/** What an admin may change on a mentor after creation — `updateMentorZodSchema`. */
/** Email and phone belong to the account holder; an admin can't change them. */
export interface MentorProfileInput {
    name?: string;
    bio?: string;
    designation?: string;
    expertise?: string[];
    experience?: string;
}

export interface AdminOrder {
    id: string;
    orderNumber: string;
    amount: number;
    discount: number;
    total: number;
    couponCode: string | null;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
    student: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        image: string | null;
        /** How Half Coders reaches them: the contact email and mobile they gave at sign-up. */
        learningProfile?: { contactEmail: string | null; whatsapp: string | null } | null;
    };
    course: { id: string; title: string; slug: string; thumbnail: string | null };
    payment: {
        id: string;
        gateway: string;
        transactionId: string | null;
        amount: number;
        status: OrderStatus;
        paidAt: string | null;
        failureReason: string | null;
        /** For a bKash payment the student sent in: `{ senderNumber, submittedAt }`. Kept for disputes. */
        gatewayData: unknown;
        createdAt: string;
        updatedAt: string;
    } | null;
    /** What a paid order turned into; null until it's paid. */
    enrollment: { id: string; status: EnrollmentStatus; progress: number } | null;
    /**
     * A failed order only: the order the student paid for the same course
     * afterwards (a retry places a new order), or null if they haven't.
     */
    paidLater: { id: string; orderNumber: string; paidAt: string | null } | null;
}

/** A course on the Payments screen, with its orders rolled up. */
export interface AdminOrderCourse {
    course: {
        id: string;
        title: string;
        slug: string;
        thumbnail: string | null;
        price: number;
        discountPrice: number | null;
        status: CourseStatus;
        courseType: CourseType;
        phase: CoursePhase;
        pricing: CoursePricing | null;
        delivery: CourseDelivery | null;
        isDeleted: boolean;
        category: { title: string } | null;
    };
    counts: Record<OrderStatus, number> & { total: number };
    /** Sum of PAID orders — net of refunds, which leave PAID. */
    collected: number;
    /** Sum of orders still awaiting payment. */
    awaiting: number;
    lastOrderAt: string | null;
}

export interface AdminEnrollment {
    id: string;
    status: EnrollmentStatus;
    progress: number;
    startedAt: string;
    completedAt: string | null;
    /** Cohort access window, when the course has one. */
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    student: { id: string; name: string; email: string; image: string | null; phone: string | null };
    course: { id: string; title: string; slug: string; thumbnail: string | null; milestoneLabel: string; moduleLabel: string };
    /** Null when an admin enrolled them by hand. */
    order: { id: string; orderNumber: string; total: number; status: OrderStatus; createdAt: string } | null;
    /** Where they are in the course. */
    currentMilestone: { id: string; title: string; order: number } | null;
    currentModule: { id: string; title: string; order: number } | null;
    certificate: { id: string; certificateNo: string; status: "ISSUED" | "REVOKED"; issuedAt: string } | null;
}

/** The course fields the admin's per-course screens (Payments, Enrolments) head a list with. */
export type AdminSummaryCourse = AdminOrderCourse["course"];

/**
 * Who each broadcast audience reaches right now — `GET /notifications/broadcast/audience`.
 * Resolved the same way as the send, so these are the recipient counts it will report.
 */
export interface BroadcastAudience {
    students: number;
    mentors: number;
    /** Most recipients first. */
    courses: { course: AdminSummaryCourse; recipients: number }[];
}

/** A pop-up broadcast still flagged to show at login — `GET /notifications/broadcast/popups`. */
export interface AdminLivePopup {
    /** A handle for the whole broadcast (one of its rows); what Stop takes. */
    id: string;
    title: string;
    message: string;
    type: string;
    link: string | null;
    repeatOnLogin: boolean;
    sentAt: string;
    recipients: number;
    /** Still to see it — for a repeating one, still to read it in their bell. */
    pending: number;
}

/** A course on the Enrolments screen, with its students rolled up. */
export interface AdminEnrollmentCourse {
    course: AdminSummaryCourse;
    counts: Record<EnrollmentStatus, number> & { total: number };
    /** Mean progress of the students who still have access (active + completed). */
    averageProgress: number;
    /** Enrolled by an admin rather than through a paid order. */
    manual: number;
    /** Certificates issued and not revoked. */
    certificates: number;
    lastEnrolledAt: string | null;
}

export interface AdminCertificate extends Certificate {
    student: { id: string; name: string; email: string; image: string | null };
}

export type AdminCourse = CourseCard & {
    status: CourseStatus;
    /** Bootcamp only: a finished batch taken off the homepage / the /courses list. */
    hiddenFromHomepage: boolean;
    hiddenFromCatalogue: boolean;
};

/** The platform's tunables — one stored row each, over a built-in default. */
export interface PlatformSettingValues {
    /** Points per XpSource. */
    "xp.rules": Record<string, number>;
    "support.slotMinutes": number;
    "certificate.prefix": string;
    "learning.sequential": boolean;
}

export type PlatformSettingKey = keyof PlatformSettingValues;

/** `GET /settings` — what each setting is now, its default, and when it was last changed (`null` while on its default). */
export interface PlatformSettings {
    values: PlatformSettingValues;
    defaults: PlatformSettingValues;
    changedAt: Record<PlatformSettingKey, string | null>;
}

export interface AdminTestimonial {
    id: string;
    name: string;
    designation: string | null;
    /** The linked student's photo, snapshotted when they were linked. */
    avatar: string | null;
    /** Stored as a canonical YouTube watch URL. */
    videoUrl: string | null;
    quote: string;
    rating: number;
    isPublished: boolean;
    /** Position on the wall; lower comes first. */
    order: number;
    createdAt: string;
    course: { id: string; title: string; slug: string; thumbnail: string | null; status: CourseStatus } | null;
    student: { id: string; name: string; email: string; image: string | null } | null;
}

/** What the testimonial editor saves. `null` clears an optional field. */
export interface TestimonialInput {
    name: string;
    designation: string | null;
    quote: string;
    videoUrl: string | null;
    rating: number;
    courseId: string | null;
    studentId: string | null;
    isPublished: boolean;
}

export interface AdminSupportSession {
    id: string;
    title: string | null;
    startTime: string;
    endTime: string;
    status: string;
    slotMinutes: number;
    isLive: boolean;
    mentor: { id: string; name: string; image: string | null };
    _count: { queue: number };
}

/** A course on the admin Support overview, with its sessions rolled up. */
export interface AdminSupportCourse {
    course: AdminSummaryCourse;
    /** "live" is the clock's call; "held" is past or ended; "upcoming" hasn't started. */
    counts: { live: number; upcoming: number; held: number; cancelled: number; total: number };
    /** Students who took a number, across every session. */
    joined: number;
    /** The live session, else the soonest upcoming one. */
    next: {
        id: string;
        title: string | null;
        startTime: string;
        endTime: string;
        isLive: boolean;
        mentorName: string;
    } | null;
    lastHeldAt: string | null;
}

/** One course's roll-up, with the mentors who can host its sessions. */
export interface AdminSupportCourseDetail extends AdminSupportCourse {
    mentors: { id: string; name: string; image: string | null }[];
}

/** XP sources as the admin Leaderboard groups them: the kinds of work that earn it. */
export type XpGroup = "lessons" | "assignments" | "practice" | "support" | "milestones";

/** A course on the admin Leaderboard overview, with its standings rolled up. */
export interface AdminLeaderboardCourse {
    course: AdminSummaryCourse;
    /** Students with any XP on the course — everyone on its board. */
    ranked: number;
    totalXp: number;
    averageXp: number;
    xpThisWeek: number;
    lastXpAt: string | null;
    bySource: Record<XpGroup, number>;
    /** The board's top three, in its own order. */
    top: { rank: number; totalXp: number; student: { id: string; name: string; image: string | null } }[];
}

export interface AdminCategory {
    id: string;
    title: string;
    slug: string;
    icon: string | null;
    description: string | null;
    order: number;
    isActive: boolean;
    _count: { courses: number };
}

/** Full course record behind the admin editor and the mentor's course page. */
export interface AdminCourseDetail extends AdminCourse {
    overview: string | null;
    /** Goes into the course's certificate IDs — "CE" in HCC-CE-2026-000125. */
    certificateCode: string | null;
    /** The images after the thumbnail, in slideshow order. */
    gallery: string[];
    promoVideoUrl: string | null;
    outcomes: string[];
    requirements: string[];
    features: CourseFeature[];
    techStack: CourseTechStackItem[];
    faqs: CourseFaq[];
    heroFacts: CourseIconLine[];
    /** Bootcamp batches — see `lib/courseBatch.ts`. */
    enrollmentStartsAt: string | null;
    enrollmentEndsAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    nextEnrollmentStartsAt: string | null;
    nextEnrollmentEndsAt: string | null;
    nextStartsAt: string | null;
    nextEndsAt: string | null;
    publishedAt: string | null;
    /** The static pre-enrolment roadmap PDF — separate from the milestones below. */
    curriculumPdfUrl: string | null;
    curriculumPdfFileName: string | null;
    curriculumPdfUpdatedAt: string | null;
    assignmentInfo: string | null;
    practiceInfo: string | null;
    supportInfo: string | null;
    categoryId: string | null;
    /** The whole curriculum, published or not — the staff view needs both. */
    milestones: {
        id: string;
        title: string;
        order: number;
        isPublished: boolean;
        modules: {
            id: string;
            title: string;
            order: number;
            isPublished: boolean;
            _count: { videos: number };
        }[];
        assignments: { id: string; title: string; isPublished: boolean }[];
        practiceDays: { id: string; title: string; isPublished: boolean }[];
    }[];
}

// ---- Quiz authoring (admin + assigned mentors) ---------------------------

/** Full detail, correct answers included — staff editing only, never sent to a student. */
export interface AdminQuizOption {
    id: string;
    text: string;
    isCorrect: boolean;
    order: number;
}

export interface AdminQuizQuestion {
    id: string;
    question: string;
    explanation: string | null;
    order: number;
    options: AdminQuizOption[];
}

export interface AdminQuiz {
    id: string;
    moduleId: string;
    title: string;
    description: string | null;
    isPublished: boolean;
    publishedAt: string | null;
    questions: AdminQuizQuestion[];
}

export interface QuizOptionInput {
    id?: string;
    text: string;
    isCorrect: boolean;
}

/** The fields a mentor may edit on a course they teach — see `courseContentZodSchema` on the API. */
export interface CourseContentInput {
    subtitle?: string | null;
    description?: string;
    overview?: string | null;
    thumbnail?: string | null;
    gallery?: string[];
    promoVideoUrl?: string | null;
    outcomes?: string[];
    requirements?: string[];
    features?: CourseFeature[];
    techStack?: CourseTechStackItem[];
    faqs?: CourseFaq[];
    heroFacts?: CourseIconLine[];
    assignmentInfo?: string | null;
    practiceInfo?: string | null;
    supportInfo?: string | null;
    milestoneLabel?: string;
    moduleLabel?: string;
}

/** A course review in the admin's moderation list. */
export interface AdminCourseReview {
    id: string;
    rating: number;
    comment: string | null;
    status: "PENDING" | "PUBLISHED" | "HIDDEN";
    createdAt: string;
    updatedAt: string;
    moderatedAt: string | null;
    student: { id: string; name: string; email: string; image: string | null };
    course: { id: string; title: string; slug: string };
    moderatedBy: { id: string; name: string } | null;
}

/** A course a coupon is limited to. */
export interface CouponCourse {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    price: number;
    discountPrice: number | null;
    status: CourseStatus;
    isDeleted: boolean;
}

/** A checkout coupon, with what it has done: paid uses, uses held by students paying now, refunds, money. */
export interface AdminCoupon {
    id: string;
    code: string;
    /** Shown to students beside the code. */
    label: string | null;
    /** For admins only. */
    description: string | null;
    kind: "PERCENT" | "FIXED";
    value: number;
    /** PERCENT only: the most it takes off one order. */
    maxDiscount: number | null;
    /** The course's sale price must be at least this. */
    minAmount: number | null;
    allCourses: boolean;
    /** Empty when `allCourses`. */
    courses: CouponCourse[];
    /** Paid orders in all; null for no limit. */
    maxRedemptions: number | null;
    /** Paid orders per student; null for no limit. */
    perStudentLimit: number | null;
    startsAt: string | null;
    endsAt: string | null;
    isActive: boolean;
    createdAt: string;
    createdBy: { id: string; name: string } | null;
    /** Paid orders carrying it. */
    used: number;
    /** Unpaid orders it went on in the last half hour — each holds a use. */
    held: number;
    refunded: number;
    /** What it took off paid orders. */
    discountGiven: number;
    /** What paid orders carrying it brought in. */
    revenue: number;
}

/** One order a coupon went on. */
export interface CouponRedemption {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    amount: number;
    discount: number;
    couponDiscount: number;
    total: number;
    createdAt: string;
    /** Unpaid, and holding one of the code's uses right now. */
    held: boolean;
    student: { id: string; name: string; email: string; phone: string | null; image: string | null };
    course: { id: string; title: string; slug: string };
    payment: { gateway: string; paidAt: string | null } | null;
}

export interface AdminCouponDetail extends AdminCoupon {
    /** How long an unpaid order holds a use. */
    holdMinutes: number;
    /** Newest first, at most 500 — the CSV has every one. */
    redemptions: CouponRedemption[];
}

export interface CouponInput {
    code: string;
    label?: string | null;
    description?: string | null;
    kind: "PERCENT" | "FIXED";
    value: number;
    maxDiscount?: number | null;
    minAmount?: number | null;
    allCourses?: boolean;
    courseIds?: string[];
    maxRedemptions?: number | null;
    perStudentLimit?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
}

/** A refund request in the admins' queue. */
export interface AdminRefundRequest {
    id: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";
    adminNote: string | null;
    decidedAt: string | null;
    createdAt: string;
    student: { id: string; name: string; email: string; phone: string | null; image: string | null };
    order: {
        id: string;
        orderNumber: string;
        total: number;
        currency: string;
        status: string;
        createdAt: string;
        courseId: string;
        course: { id: string; title: string; slug: string };
        payment: { paidAt: string | null; gateway: string } | null;
    };
    decidedBy: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Promotions and bundles
// ---------------------------------------------------------------------------

/** A course as a promotion holds it. */
export interface AdminPromoCourse {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    price: number;
    discountPrice: number | null;
    status: CourseStatus;
    isDeleted: boolean;
}

/** A bundle in the console, with what it sells for and what it has sold. */
export interface AdminBundle {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail: string | null;
    pricing: BundlePricing;
    price: number | null;
    discountPercent: number | null;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    order: number;
    createdAt: string;
    items: { courseId: string; order: number; course: AdminPromoCourse & { phase: CoursePhase } }[];
    /** The courses one by one, at today's sale prices. */
    combined: number;
    bundlePrice: number;
    /** On, inside its window, and every course published — so students can buy it now. */
    sellable: boolean;
    sold: number;
    revenue: number;
    pending: number;
}

export interface BundleInput {
    title: string;
    description: string | null;
    thumbnail: string | null;
    pricing: BundlePricing;
    price: number | null;
    discountPercent: number | null;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    order: number;
    courseIds: string[];
}

/** One student's bundle checkout, and the course orders it became. */
export interface AdminBundleOrder {
    id: string;
    orderNumber: string;
    amount: number;
    discount: number;
    total: number;
    status: OrderStatus;
    gateway: string | null;
    paidAt: string | null;
    failureReason: string | null;
    createdAt: string;
    student: { id: string; name: string; email: string; phone: string | null; image: string | null };
    orders: { id: string; orderNumber: string; total: number; status: OrderStatus; course: { id: string; title: string } }[];
}

/** A course on the Offers and Rewards screens, with each in brief. */
export interface PromotionCourseSummary {
    course: AdminSummaryCourse;
    offer: {
        isActive: boolean;
        /** On, and inside its window. */
        live: boolean;
        startsAt: string | null;
        endsAt: string | null;
        freeCount: number;
        /** Courses it has given (not taken back). */
        given: number;
    } | null;
    reward: {
        isActive: boolean;
        condition: RewardCondition;
        deadlineAt: string | null;
        withinDays: number | null;
        rewardCount: number;
        given: number;
    } | null;
}

/** Someone a promotion gave a course to. */
export interface PromotionGrant {
    id: string;
    createdAt: string;
    revokedAt: string | null;
    student: { id: string; name: string; image: string | null };
    course: { id: string; title: string };
}

export interface PromotionCourseDetail {
    course: AdminSummaryCourse;
    offer: {
        id: string;
        isActive: boolean;
        startsAt: string | null;
        endsAt: string | null;
        freeCourses: { courseId: string; order: number; course: AdminPromoCourse }[];
    } | null;
    reward: {
        id: string;
        condition: RewardCondition;
        deadlineAt: string | null;
        withinDays: number | null;
        isActive: boolean;
        rewardCourses: { courseId: string; order: number; course: AdminPromoCourse }[];
    } | null;
    offerGrants: PromotionGrant[];
    rewardGrants: PromotionGrant[];
}

/** A course on the admission-tickets overview: its ticket, if written, and who it would go to. */
export interface AdmissionTicketCourseSummary {
    course: AdminSummaryCourse;
    ticket: { isActive: boolean; stubLabel: string | null; stubValue: string | null; updatedAt: string } | null;
    /** Students on the course now (active or finished). */
    students: number;
}

export interface AdmissionTicketCourseDetail {
    course: AdminSummaryCourse;
    ticket: AdmissionTicketSettings | null;
    students: number;
}
