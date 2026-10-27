import type { CourseType } from "@/types/api.types";
import type { AdminSummaryCourse } from "@/types/admin.types";

/*
 * Conceptual sessions: recordings of a course's live conceptual classes,
 * grouped by topic. Apart from the curriculum — no quizzes, assignments or
 * locks, and watching one moves no course progress.
 */

// ---- Students ---------------------------------------------------------------

/** One of the student's courses with recordings, on the Conceptual Sessions list. */
export interface ConceptualCourseSummary {
    course: { id: string; title: string; slug: string; thumbnail: string | null; courseType: CourseType };
    topics: number;
    recordings: number;
    /** How many of them the student has ticked as watched. */
    watched: number;
    /** Seconds. */
    totalDuration: number;
    latest: { id: string; title: string; addedAt: string } | null;
    /** The first recording, in course order, not yet watched. */
    next: { id: string; title: string } | null;
}

export interface ConceptualRecording {
    id: string;
    title: string;
    description: string | null;
    youtubeVideoId: string;
    thumbnail: string | null;
    /** Seconds; 0 when nobody entered it. */
    duration: number;
    /** "1:09:57", or null without a duration. */
    durationLabel: string | null;
    isWatched: boolean;
}

export interface ConceptualTopic {
    id: string;
    title: string;
    description: string | null;
    sessions: ConceptualRecording[];
}

/** One course's recordings, topic by topic, for the player. */
export interface ConceptualCourse {
    course: { id: string; title: string; slug: string; thumbnail: string | null; courseType: CourseType };
    topics: ConceptualTopic[];
}

// ---- Staff ------------------------------------------------------------------

/** A course on the staff overview, with its topics and recordings counted. */
export interface StaffConceptualCourseSummary {
    course: AdminSummaryCourse;
    topics: { total: number; live: number };
    /** `live`: published, in a published topic — what students can watch. */
    recordings: { total: number; live: number };
    /** Seconds of live recordings. */
    liveDuration: number;
    /** Students who can open the course. */
    students: number;
    lastAddedAt: string | null;
}

export interface StaffConceptualRecording {
    id: string;
    topicId: string;
    courseId: string;
    title: string;
    description: string | null;
    youtubeUrl: string;
    youtubeVideoId: string;
    thumbnail: string | null;
    duration: number;
    order: number;
    isPublished: boolean;
    /** When students were told about it; null until it first went live. */
    notifiedAt: string | null;
    createdAt: string;
    _count: { watches: number };
}

export interface StaffConceptualTopic {
    id: string;
    courseId: string;
    title: string;
    description: string | null;
    order: number;
    isPublished: boolean;
    sessions: StaffConceptualRecording[];
}

export interface StaffConceptualCourse {
    course: AdminSummaryCourse;
    students: number;
    topics: StaffConceptualTopic[];
}

export type LiveClassStatus = "SCHEDULED" | "CANCELLED";

/** A live class on a course's calendar, as its staff manage it. */
export interface StaffLiveClass {
    id: string;
    courseId: string;
    title: string;
    description: string | null;
    startsAt: string;
    durationMinutes: number;
    joinUrl: string | null;
    status: LiveClassStatus;
    topic: { id: string; title: string } | null;
    createdBy: { id: string; name: string } | null;
    /** Only on the reply to scheduling one: how many students were told. */
    recipients?: number;
}

/** A live class as a student sees it: the link only while it's open to join. */
export interface LearnerLiveClass {
    id: string;
    courseId: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    status: LiveClassStatus;
    topic: { id: string; title: string } | null;
    isLive: boolean;
    /** A link is set, even while it isn't handed out yet. */
    hasLink: boolean;
    /** When the link is handed out — shortly before the start. */
    joinOpensAt: string;
    joinUrl: string | null;
    /** On the across-courses list. */
    course?: { id: string; title: string; slug: string };
}
