import httpClient from "@/lib/httpClient";
import type { ApiResponse } from "@/types/api.types";
import type {
    ConceptualCourse,
    ConceptualCourseSummary,
    LearnerLiveClass,
    StaffConceptualCourse,
    StaffConceptualCourseSummary,
    StaffConceptualRecording,
    StaffConceptualTopic,
    StaffLiveClass,
} from "@/types/conceptual.types";

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

/** A recording's fields as the staff forms send them. Duration as typed ("1:09:57"), or seconds. */
export interface RecordingInput {
    title: string;
    youtubeUrl: string;
    duration?: string | number;
    description?: string;
}

/** Recordings of the live conceptual classes, for the student who watches them. */
export const conceptualService = {
    myCourses: () =>
        httpClient.get<ApiResponse<ConceptualCourseSummary[]>>("/conceptual/my-courses").then(unwrap),

    course: (slug: string) =>
        httpClient.get<ApiResponse<ConceptualCourse>>(`/conceptual/courses/${slug}`).then(unwrap),

    setWatched: (sessionId: string, watched: boolean) =>
        httpClient
            .put<ApiResponse<{ sessionId: string; isWatched: boolean }>>(`/conceptual/sessions/${sessionId}/watched`, {
                watched,
            })
            .then(unwrap),
};

/** Filing them: topics and recordings, for admins and a course's mentors. */
export const conceptualAuthoring = {
    courses: () =>
        httpClient.get<ApiResponse<StaffConceptualCourseSummary[]>>("/conceptual/manage/courses").then(unwrap),

    course: (courseId: string) =>
        httpClient.get<ApiResponse<StaffConceptualCourse>>(`/conceptual/manage/courses/${courseId}`).then(unwrap),

    createTopic: (payload: { courseId: string; title: string; description?: string; isPublished?: boolean }) =>
        httpClient.post<ApiResponse<StaffConceptualTopic>>("/conceptual/topics", payload).then(unwrap),

    updateTopic: (topicId: string, payload: { title?: string; description?: string; isPublished?: boolean }) =>
        httpClient.patch<ApiResponse<StaffConceptualTopic>>(`/conceptual/topics/${topicId}`, payload).then(unwrap),

    deleteTopic: (topicId: string) => httpClient.delete(`/conceptual/topics/${topicId}`),

    reorderTopics: (courseId: string, orderedIds: string[]) =>
        httpClient.patch(`/conceptual/courses/${courseId}/topics/reorder`, { orderedIds }),

    createRecording: (payload: RecordingInput & { topicId: string; isPublished?: boolean }) =>
        httpClient.post<ApiResponse<StaffConceptualRecording>>("/conceptual/sessions", payload).then(unwrap),

    updateRecording: (
        sessionId: string,
        payload: Partial<RecordingInput> & { isPublished?: boolean; topicId?: string },
    ) =>
        httpClient
            .patch<ApiResponse<StaffConceptualRecording>>(`/conceptual/sessions/${sessionId}`, payload)
            .then(unwrap),

    deleteRecording: (sessionId: string) => httpClient.delete(`/conceptual/sessions/${sessionId}`),

    reorderRecordings: (topicId: string, orderedIds: string[]) =>
        httpClient.patch(`/conceptual/topics/${topicId}/sessions/reorder`, { orderedIds }),
};

export interface LiveClassInput {
    title: string;
    description?: string | null;
    startsAt: string;
    durationMinutes: number;
    joinUrl?: string | null;
    topicId?: string | null;
}

/** Live classes: a course's calendar for its staff, and what's coming for its students. */
export const liveClassService = {
    forCourse: (courseId: string) =>
        httpClient.get<ApiResponse<StaffLiveClass[]>>(`/live-classes/course/${courseId}`).then(unwrap),
    create: (courseId: string, payload: LiveClassInput) =>
        httpClient.post<ApiResponse<StaffLiveClass>>(`/live-classes/course/${courseId}`, payload).then(unwrap),
    update: (liveClassId: string, payload: Partial<LiveClassInput>) =>
        httpClient.patch<ApiResponse<StaffLiveClass>>(`/live-classes/${liveClassId}`, payload).then(unwrap),
    cancel: (liveClassId: string) => httpClient.post(`/live-classes/${liveClassId}/cancel`).then(() => undefined),
    remove: (liveClassId: string) => httpClient.delete(`/live-classes/${liveClassId}`).then(() => undefined),

    /** A student's view of one course, by its slug. */
    forLearner: (slug: string) =>
        httpClient
            .get<ApiResponse<{ course: { id: string; title: string; slug: string }; classes: LearnerLiveClass[] }>>(`/live-classes/learn/${slug}`)
            .then(unwrap),
    /** A student's next classes across their courses. */
    mine: () => httpClient.get<ApiResponse<LearnerLiveClass[]>>("/live-classes/mine").then(unwrap),
};

