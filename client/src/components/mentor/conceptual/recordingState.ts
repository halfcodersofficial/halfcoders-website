import type { StaffConceptualCourse, StaffConceptualRecording, StaffConceptualTopic } from "@/types/conceptual.types";

/**
 * Where a recording stands with students. It's live only when both it and its
 * topic are published; a published recording in a hidden topic waits for the
 * topic, and students are told the first time it actually goes live.
 */
export type RecordingState = "live" | "draft" | "waiting";

export const stateOf = (recording: StaffConceptualRecording, topic: StaffConceptualTopic): RecordingState =>
    recording.isPublished ? (topic.isPublished ? "live" : "waiting") : "draft";

export const STATE_LABEL: Record<RecordingState, string> = {
    live: "Live",
    draft: "Draft",
    waiting: "Topic not live",
};

export interface Filed {
    recording: StaffConceptualRecording;
    topic: StaffConceptualTopic;
    state: RecordingState;
}

/** A course's recordings with their topic and state, newest first. */
export const filedIn = (course: StaffConceptualCourse): Filed[] =>
    course.topics
        .flatMap((topic) => topic.sessions.map((recording) => ({ recording, topic, state: stateOf(recording, topic) })))
        .sort((a, b) => b.recording.createdAt.localeCompare(a.recording.createdAt));

/** Watch ticks against everyone who could have watched what's live — an aggregate, never who. */
export const watchRate = (course: StaffConceptualCourse) => {
    const live = filedIn(course).filter((entry) => entry.state === "live");
    const ticks = live.reduce((sum, entry) => sum + entry.recording._count.watches, 0);
    const possible = live.length * course.students;
    return { ticks, possible, percent: possible > 0 ? Math.round((ticks / possible) * 100) : null };
};
