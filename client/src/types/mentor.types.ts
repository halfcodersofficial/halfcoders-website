import type { ClassMode, SubmissionStatus, SupportQueueStatus, SupportSessionStatus } from "./api.types";
import type { AssignmentLateTier } from "./learning.types";

/** A student as a mentor sees them — by name, nothing more. */
export interface StudentName {
    id: string;
    name: string;
}

export interface MentorCourse {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    status: string;
    courseType: "BOOTCAMP" | "TRADITIONAL";
    phase: "PRESENT" | "UPCOMING" | "PREVIOUS";
    milestoneLabel: string;
    moduleLabel: string;
    /** The mentor's role on this course — LEAD, CO_MENTOR or SUPPORT. */
    role: string;
    _count: { enrollments: number; milestones: number; modules: number; videos: number };
    stats: MentorCourseStats;
}

export type ReleaseItemType = "MODULE" | "ASSIGNMENT" | "PRACTICE";

/** How a course is doing, from the mentor dashboard. */
export interface MentorCourseStats {
    /** Everyone with an enrolment that wasn't cancelled. */
    students: number;
    active: number;
    completed: number;
    /** Across active and completed enrolments, 0–100. */
    averageProgress: number;
    toReview: number;
    oldestWaitingAt: string | null;
    /** Bootcamp only: the next item scheduled to go out. */
    nextRelease: {
        itemType: ReleaseItemType;
        title: string;
        at: string;
        milestoneOrder: number;
        /** The module's number in its milestone; null for assignments and practice days. */
        order: number | null;
    } | null;
}

/** The course as an agenda row or a quiet student names it. */
export interface MentorCourseRef {
    id: string;
    title: string;
    milestoneLabel: string;
    moduleLabel: string;
}

/** Something on the mentor's week, by when it happens. */
export type MentorAgendaItem =
    | {
        kind: "session";
        id: string;
        title: string | null;
        at: string;
        endAt: string;
        status: SupportSessionStatus;
        isLive: boolean;
        hasMeetingLink: boolean;
        queue: SupportQueueStats;
        course: { id: string; title: string };
        /** A co-mentor's session on a shared course; null for the mentor's own. */
        host: { id: string; name: string } | null;
    }
    | {
        kind: "release";
        id: string;
        itemType: ReleaseItemType;
        title: string;
        at: string;
        /** Already out — the time has passed and it's published. */
        released: boolean;
        milestoneOrder: number;
        order: number | null;
        course: MentorCourseRef;
    }
    | {
        kind: "deadline";
        id: string;
        title: string;
        at: string;
        handedIn: number;
        toReview: number;
        /** Students learning the course, active or finished. */
        expected: number;
        course: MentorCourseRef;
    };

export interface SupportQueueStats {
    waiting: number;
    serving: number;
    done: number;
}

export interface MentorWaitingReview {
    id: string;
    status: SubmissionStatus;
    submittedAt: string;
    maxScore: number | null;
    student: StudentName;
    assignment: { id: string; title: string; totalMarks: number; course: { id: string; title: string } };
}

export type MentorPeriodMetric = "reviews" | "helped";

export interface MentorSupportSession {
    id: string;
    title: string | null;
    startTime: string;
    endTime: string;
    status: SupportSessionStatus;
    slotMinutes: number;
    meetingLink: string | null;
    notes: string | null;
    isLive: boolean;
    /** False once the mentor has cut off new sign-ups for this session. */
    joinOpen: boolean;
    course: { id: string; title: string; slug: string };
    _count?: { queue: number };
    /** Sent by the mentor dashboard. */
    queueStats?: SupportQueueStats;
}

/** A co-mentor's upcoming session on a course they share — any of its mentors can run the board. */
export interface MentorColleagueSession {
    id: string;
    title: string | null;
    startTime: string;
    endTime: string;
    status: SupportSessionStatus;
    isLive: boolean;
    course: { id: string; title: string; slug: string };
    mentor: { id: string; name: string };
    queueStats: SupportQueueStats;
}

/** A session this mentor hosted that's over, with how its line went — counts only. */
export interface MentorPastSession extends MentorSupportSession {
    attendance: { joined: number; helped: number; skipped: number; left: number };
}

export interface ReviewQueueItem {
    id: string;
    content: string | null;
    submissionUrl: string | null;
    fileUrls: string[];
    status: SubmissionStatus;
    score: number | null;
    /** Set when it came in late: the most it can score. Null means the full total. */
    maxScore: number | null;
    feedback: string | null;
    submittedAt: string;
    /** In review, when the reviewer took it on. */
    updatedAt: string;
    reviewedAt: string | null;
    /** In review: the colleague reviewing it. Once marked: who marked it. */
    reviewedBy: { id: string; name: string } | null;
    /** A mentor gets the name only (see the API's lib/studentPrivacy); admins get the rest too. */
    student: StudentName & { email?: string; image?: string | null };
    assignment: {
        id: string;
        title: string;
        totalMarks: number;
        deadline: string | null;
        course: { id: string; title: string; slug: string; milestoneLabel: string };
        milestone: { id: string; title: string; order: number };
        /** Its marking rubric, in order; empty when it's marked with a single score. */
        rubric: RubricLine[];
    };
    /** Points given on each rubric line at the last review. */
    rubricScores: RubricScore[];
}

/** One line of an assignment's marking rubric. */
export interface RubricLine {
    id: string;
    title: string;
    description: string | null;
    maxPoints: number;
    order: number;
}

export interface RubricScore {
    criterionId: string;
    points: number;
    comment: string | null;
}

export interface MentorDashboard {
    summary: {
        assignedCourses: number;
        totalStudents: number;
        pendingSubmissions: number;
        upcomingSessions: number;
    };
    courses: MentorCourse[];
    upcomingSupport: MentorSupportSession[];
    /** Co-mentors' sessions still to come on the same courses, soonest first. */
    colleagueSessions: MentorColleagueSession[];
    /** The four waiting longest. */
    waitingReviews: MentorWaitingReview[];
    recentSubmissions: {
        id: string;
        status: SubmissionStatus;
        submittedAt: string;
        student: StudentName;
        assignment: { id: string; title: string; course: { id: string; title: string } };
    }[];
    /** Today and the six days after it, from Dhaka midnight. */
    agenda: { from: string; to: string; items: MentorAgendaItem[] };
    /** The last 30 days against the 30 before. */
    period: {
        reviews: { current: number; previous: number };
        helped: { current: number; previous: number };
        sessions: { current: number; previous: number };
        /** Median hours from hand-in to review; null with nothing reviewed. */
        turnaroundHours: { current: number | null; previous: number | null };
    };
    /** The last 30 Dhaka days, oldest first. */
    trend: ({ date: string } & Record<MentorPeriodMetric, number>)[];
}

export interface MentorMilestone {
    id: string;
    title: string;
    description: string | null;
    order: number;
    isPublished: boolean;
    modules: {
        id: string;
        title: string;
        order: number;
        /** Place in the week's mixed list with its assignments and practice days. */
        position: number;
        isPublished: boolean;
        publishedAt: string | null;
        /** Set while waiting for the scheduler to auto-publish — see `CurriculumEditor`. */
        releaseAt: string | null;
        /** Online or offline, on a course that runs both — null anywhere else, or not marked. */
        mode: ClassMode | null;
        _count: { videos: number; quizzes: number };
    }[];
    assignments: {
        id: string;
        title: string;
        description: string;
        instructions: string | null;
        order: number;
        position: number;
        isPublished: boolean;
        /** Set while waiting for the scheduler to auto-publish. */
        releaseAt: string | null;
        totalMarks: number;
        deadline: string | null;
        lateTiers: AssignmentLateTier[];
        _count: { materials: number; submissions: number };
    }[];
    practiceDays: {
        id: string;
        title: string;
        description: string | null;
        instructions: string | null;
        order: number;
        position: number;
        isPublished: boolean;
        /** Set while waiting for the scheduler to auto-publish. */
        releaseAt: string | null;
    }[];
}

/** One student's full record in a finished session's attendance list. */
export interface QueueHistoryEntry {
    id: string;
    queueNumber: number;
    status: SupportQueueStatus;
    topic: string | null;
    mentorNote: string | null;
    joinedAt: string;
    servedAt: string | null;
    completedAt: string | null;
    /** Admins get the contact details; a mentor gets the name. */
    student: StudentName & { email?: string; image?: string | null };
}

/** One student's standing on a course, for the mentor's progress view. */
export interface CourseStudent {
    id: string;
    status: string;
    progress: number;
    startedAt: string;
    student: { id: string; name: string; email: string; image: string | null };
    currentModule: { id: string; title: string; order: number } | null;
    currentMilestone: { id: string; title: string; order: number } | null;
    _count?: { submissions: number; practiceCompletions: number };
}

/** One hand-in on the course's results page. */
export interface ResultSubmission {
    id: string;
    status: SubmissionStatus;
    score: number | null;
    /** Set when it came in late: the most it can score. */
    maxScore: number | null;
    submittedAt: string;
    reviewedAt: string | null;
    student: StudentName;
}

/** A course's marks — assignments and quizzes — with students by name only. */
export interface CourseResults {
    course: { id: string; title: string; slug: string; courseType: "BOOTCAMP" | "TRADITIONAL"; milestoneLabel: string; moduleLabel: string };
    /** Students learning the course, active or finished — a count, never a list. */
    learners: number;
    assignments: {
        id: string;
        title: string;
        totalMarks: number;
        deadline: string | null;
        isPublished: boolean;
        releaseAt: string | null;
        milestone: { order: number; title: string };
        handedIn: number;
        counts: { waiting: number; accepted: number; returned: number; rejected: number };
        /** Of accepted work, as a percentage of the marks. */
        averagePercent: number | null;
        submissions: ResultSubmission[];
    }[];
    quizzes: {
        id: string;
        title: string;
        isPublished: boolean;
        module: { id: string; title: string; order: number; milestone: { order: number } };
        _count: { questions: number };
        takers: number;
        attempts: number;
        averagePercent: number | null;
        /** Each student's best finished attempt, best first. */
        results: { student: StudentName; bestPercent: number; attempts: number; lastAt: string | null }[];
    }[];
}

/** One quiz in depth: every finished attempt (students by name only) and how each question went. */
export interface QuizResultsDetail {
    quiz: { id: string; title: string; isPublished: boolean; module: { id: string; title: string; order: number } };
    /** Newest first. */
    attempts: { id: string; percentage: number; correctCount: number; totalQuestions: number; completedAt: string | null; student: StudentName }[];
    questions: {
        id: string;
        question: string;
        order: number;
        answered: number;
        correct: number;
        /** Null until someone has answered it. */
        percentCorrect: number | null;
        options: { id: string; text: string; isCorrect: boolean; picked: number }[];
    }[];
}
