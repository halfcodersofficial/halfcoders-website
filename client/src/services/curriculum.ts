import httpClient from "@/lib/httpClient";
import type { AdminCourseDetail, AdminQuiz, CourseContentInput, QuizOptionInput } from "@/types/admin.types";
import type { ApiResponse, ClassMode, CourseDelivery, CourseMode, CoursePhase, CoursePricing, CourseType } from "@/types/api.types";
import type { LessonType, OutlineItemKind, OutlineWeek } from "@/types/domain.types";
import type { AssignmentMaterial } from "@/types/learning.types";
import type { CourseResults, MentorMilestone, QuizResultsDetail, RubricLine } from "@/types/mentor.types";

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

/** The three kinds of item that share a week's one ordered list. */
export type WeekItemKind = "MODULE" | "ASSIGNMENT" | "PRACTICE";

/** A lesson as the Module Manager edits it — any of the three types. */
export interface CurriculumVideo {
    id: string;
    type: LessonType;
    title: string;
    description: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    content: string | null;
    resourceUrl: string | null;
    thumbnail: string | null;
    duration: number;
    order: number;
    isPublished: boolean;
    isFreePreview: boolean;
}

/**
 * Curriculum authoring — milestones, modules, videos, assignments and practice
 * days. Mentors reach these for the courses they're assigned to; admins for any
 * course. The API decides which, per request.
 */
/** Just enough of a course to head the editor, for whoever may manage it. */
export interface StaffCourseSummary {
    id: string;
    title: string;
    slug: string;
    status: string;
    courseType: CourseType;
    /** An upcoming course has no Module Manager or Outline Maker yet. */
    phase: CoursePhase;
    pricing: CoursePricing;
    delivery: CourseDelivery;
    /** BOTH has the editors mark each module and outline item online or offline. */
    mode: CourseMode | null;
    thumbnail: string | null;
    milestoneLabel: string;
    moduleLabel: string;
    _count: { enrollments: number; milestones: number; modules: number; videos: number };
}

export const curriculumAuthoring = {
    /**
     * The editor runs in the admin console as well as the mentor one, so it
     * asks for the course directly rather than picking it out of a dashboard
     * only one of those roles has.
     */
    getCourse: (courseId: string) =>
        httpClient
            .get<ApiResponse<StaffCourseSummary>>(`/courses/staff/${courseId}`)
            .then(unwrap),

    /** An assignment's marking rubric, and whether any hand-in has been marked with it. */
    getRubric: (assignmentId: string) =>
        httpClient
            .get<ApiResponse<{ totalMarks: number; criteria: RubricLine[]; marked: boolean }>>(`/assignments/manage/${assignmentId}/rubric`)
            .then(unwrap),

    /** Replaces the rubric — lines whose points add up to the assignment's marks; none removes it. */
    setRubric: (assignmentId: string, criteria: { id?: string; title: string; description?: string; maxPoints: number }[]) =>
        httpClient
            .put<ApiResponse<{ totalMarks: number; criteria: RubricLine[]; marked: boolean }>>(`/assignments/manage/${assignmentId}/rubric`, { criteria })
            .then(unwrap),

    /** Assignment and quiz results, students by name only. */
    getResults: (courseId: string) =>
        httpClient.get<ApiResponse<CourseResults>>(`/courses/staff/${courseId}/results`).then(unwrap),

    /** One quiz's attempts and per-question breakdown, students by name only. */
    getQuizResults: (quizId: string) =>
        httpClient.get<ApiResponse<QuizResultsDetail>>(`/quizzes/manage/${quizId}/results`).then(unwrap),

    /** The full record, for the mentor's course overview and content editor. */
    getCourseDetail: (courseId: string) =>
        httpClient
            .get<ApiResponse<AdminCourseDetail>>(`/courses/staff/${courseId}/detail`)
            .then(unwrap),

    /**
     * The words on the public page — description, outcomes, feature tiles,
     * FAQ. Price, category and publish state are admin-only and go through
     * `adminService.updateCourse` instead.
     */
    updateContent: (courseId: string, payload: CourseContentInput) =>
        httpClient.patch(`/courses/staff/${courseId}/content`, payload).then(() => undefined),

    /**
     * Stores one course image (already cropped to 16:9) and answers with its
     * URL. The course itself only changes when a form holding the URL is
     * saved — the thumbnail or gallery field of `updateContent` or
     * `adminService.updateCourse`.
     */
    uploadCourseImage: (courseId: string, image: Blob, onProgress?: (percent: number) => void) => {
        const formData = new FormData();
        formData.append("image", image, "course-image.jpg");
        return httpClient
            .post<ApiResponse<{ url: string }>>(`/courses/staff/${courseId}/images`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (event) => {
                    if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
                },
            })
            .then(unwrap)
            .then(({ url }) => url);
    },

    // ---- Milestones
    listMilestones: (courseId: string) =>
        httpClient
            .get<ApiResponse<MentorMilestone[]>>(`/milestones/course/${courseId}`)
            .then(unwrap),

    createMilestone: (payload: {
        courseId: string;
        title: string;
        description?: string;
        isPublished?: boolean;
    }) => httpClient.post("/milestones", payload).then(() => undefined),

    updateMilestone: (milestoneId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/milestones/${milestoneId}`, payload).then(() => undefined),

    deleteMilestone: (milestoneId: string) =>
        httpClient.delete(`/milestones/${milestoneId}`).then(() => undefined),

    /** Takes the complete ordered list; a partial one is rejected. */
    reorderMilestones: (courseId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/milestones/course/${courseId}/reorder`, { orderedIds })
            .then(() => undefined),

    // ---- Modules
    /** Returns the new module, so the caller can go straight to its lessons. */
    createModule: (payload: {
        milestoneId: string;
        title: string;
        description?: string;
        isPublished?: boolean;
        releaseAt?: string | null;
        /** Only on a course that runs both online and offline. */
        mode?: ClassMode | null;
    }) => httpClient.post<ApiResponse<{ id: string; title: string }>>("/modules", payload).then(unwrap),

    updateModule: (moduleId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/modules/${moduleId}`, payload).then(() => undefined),

    deleteModule: (moduleId: string) =>
        httpClient.delete(`/modules/${moduleId}`).then(() => undefined),

    /**
     * A week's one mixed list — modules, assignments and practice days — in
     * its new order. Every item of the week, exactly once.
     */
    reorderWeekItems: (milestoneId: string, items: { kind: WeekItemKind; id: string }[]) =>
        httpClient.patch(`/milestones/${milestoneId}/items/reorder`, { items }).then(() => undefined),

    /** A week's modules in their new order — the complete list. */
    reorderModules: (milestoneId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/modules/milestone/${milestoneId}/reorder`, { orderedIds })
            .then(() => undefined),

    // ---- Videos
    listVideos: (moduleId: string) =>
        httpClient
            .get<ApiResponse<CurriculumVideo[]>>(`/videos/module/${moduleId}`)
            .then(unwrap),

    /** Any lesson type — send the one field the type needs. */
    createVideo: (payload: {
        moduleId: string;
        type: LessonType;
        title: string;
        youtubeUrl?: string;
        content?: string;
        resourceUrl?: string;
        duration?: string;
        description?: string;
        isPublished?: boolean;
    }) => httpClient.post("/videos", payload).then(() => undefined),

    /** Mentors typically paste a whole module's worth of links at once. */
    bulkCreateVideos: (payload: {
        moduleId: string;
        isPublished?: boolean;
        videos: { title: string; youtubeUrl: string; duration?: string }[];
    }) => httpClient.post("/videos/bulk", payload).then(() => undefined),

    updateVideo: (videoId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/videos/${videoId}`, payload).then(() => undefined),

    deleteVideo: (videoId: string) =>
        httpClient.delete(`/videos/${videoId}`).then(() => undefined),

    bulkPublishVideos: (videoIds: string[], isPublished: boolean) =>
        httpClient.patch("/videos/bulk/publish", { videoIds, isPublished }).then(() => undefined),

    reorderVideos: (moduleId: string, orderedIds: string[]) =>
        httpClient.patch(`/videos/module/${moduleId}/reorder`, { orderedIds }).then(() => undefined),

    // ---- Assignments & practice
    createAssignment: (payload: {
        milestoneId: string;
        title: string;
        description: string;
        instructions?: string;
        totalMarks?: number;
        deadline?: string;
        /** Late windows after the deadline — each `until` an ISO instant. */
        lateTiers?: { until: string; maxMarks: number }[];
        isPublished?: boolean;
    }) =>
        // Returns the new assignment, so the caller can go straight to its lessons.
        httpClient.post<ApiResponse<{ id: string }>>("/assignments/manage", payload).then(unwrap),

    updateAssignment: (assignmentId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/assignments/manage/${assignmentId}`, payload).then(() => undefined),

    deleteAssignment: (assignmentId: string) =>
        httpClient.delete(`/assignments/manage/${assignmentId}`).then(() => undefined),

    /** A week's assignments in their new order — the complete list. */
    reorderAssignments: (milestoneId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/assignments/manage/milestone/${milestoneId}/reorder`, { orderedIds })
            .then(() => undefined),

    // ---- An assignment's own lessons
    listAssignmentMaterials: (assignmentId: string) =>
        httpClient
            .get<ApiResponse<AssignmentMaterial[]>>(`/assignment-materials/assignment/${assignmentId}`)
            .then(unwrap),

    createAssignmentMaterial: (payload: {
        assignmentId: string;
        type: LessonType;
        title: string;
        description?: string;
        youtubeUrl?: string;
        content?: string;
        resourceUrl?: string;
    }) => httpClient.post("/assignment-materials", payload).then(() => undefined),

    updateAssignmentMaterial: (materialId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/assignment-materials/${materialId}`, payload).then(() => undefined),

    deleteAssignmentMaterial: (materialId: string) =>
        httpClient.delete(`/assignment-materials/${materialId}`).then(() => undefined),

    reorderAssignmentMaterials: (assignmentId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/assignment-materials/assignment/${assignmentId}/reorder`, { orderedIds })
            .then(() => undefined),

    createPracticeDay: (payload: {
        milestoneId: string;
        title: string;
        description?: string;
        instructions?: string;
        isPublished?: boolean;
    }) => httpClient.post("/practice-days/manage", payload).then(() => undefined),

    updatePracticeDay: (practiceDayId: string, payload: Record<string, unknown>) =>
        httpClient.patch(`/practice-days/manage/${practiceDayId}`, payload).then(() => undefined),

    deletePracticeDay: (practiceDayId: string) =>
        httpClient.delete(`/practice-days/manage/${practiceDayId}`).then(() => undefined),

    // ---- Quiz
    /** Null when the module has no quiz yet. */
    getModuleQuiz: (moduleId: string) =>
        httpClient
            .get<ApiResponse<AdminQuiz | null>>(`/quizzes/manage/module/${moduleId}`)
            .then(unwrap),

    createQuiz: (payload: { moduleId: string; title: string; description?: string }) =>
        httpClient.post<ApiResponse<AdminQuiz>>("/quizzes/manage", payload).then(unwrap),

    updateQuiz: (
        quizId: string,
        payload: { title?: string; description?: string | null; isPublished?: boolean },
    ) => httpClient.patch(`/quizzes/manage/${quizId}`, payload).then(() => undefined),

    deleteQuiz: (quizId: string) => httpClient.delete(`/quizzes/manage/${quizId}`).then(() => undefined),

    createQuestion: (
        quizId: string,
        payload: { question: string; explanation?: string; options: QuizOptionInput[] },
    ) => httpClient.post(`/quizzes/manage/${quizId}/questions`, payload).then(() => undefined),

    updateQuestion: (
        questionId: string,
        payload: { question?: string; explanation?: string | null; options?: QuizOptionInput[] },
    ) => httpClient.patch(`/quizzes/manage/questions/${questionId}`, payload).then(() => undefined),

    deleteQuestion: (questionId: string) =>
        httpClient.delete(`/quizzes/manage/questions/${questionId}`).then(() => undefined),

    reorderQuestions: (quizId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/quizzes/manage/${quizId}/questions/reorder`, { orderedIds })
            .then(() => undefined),

    // ---- Outline Maker — the planned schedule, independent of the modules above
    getOutline: (courseId: string) =>
        httpClient.get<ApiResponse<OutlineWeek[]>>(`/outline/course/${courseId}`).then(unwrap),

    /** Appends a week; returns it so the page can scroll to it. */
    createOutlineWeek: (payload: { courseId: string; title?: string }) =>
        httpClient.post<ApiResponse<OutlineWeek>>("/outline/weeks", payload).then(unwrap),

    updateOutlineWeek: (weekId: string, payload: { title: string }) =>
        httpClient.patch(`/outline/weeks/${weekId}`, payload).then(() => undefined),

    deleteOutlineWeek: (weekId: string) =>
        httpClient.delete(`/outline/weeks/${weekId}`).then(() => undefined),

    /** Takes the complete ordered list, like the milestone reorder. */
    reorderOutlineWeeks: (courseId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/outline/course/${courseId}/weeks/reorder`, { orderedIds })
            .then(() => undefined),

    createOutlineItem: (payload: {
        weekId: string;
        kind: OutlineItemKind;
        title: string;
        note?: string;
        /** Bootcamp only — a traditional course's outline has no dates. */
        scheduledAt?: string | null;
        /** Only on a course that runs both online and offline. */
        mode?: ClassMode | null;
    }) => httpClient.post("/outline/items", payload).then(() => undefined),

    updateOutlineItem: (
        itemId: string,
        payload: {
            weekId?: string;
            kind?: OutlineItemKind;
            title?: string;
            note?: string;
            /** Bootcamp only. */
            scheduledAt?: string | null;
            /** Traditional only. */
            isPublished?: boolean;
            /** Only on a course that runs both online and offline. */
            mode?: ClassMode | null;
        },
    ) => httpClient.patch(`/outline/items/${itemId}`, payload).then(() => undefined),

    deleteOutlineItem: (itemId: string) =>
        httpClient.delete(`/outline/items/${itemId}`).then(() => undefined),

    /** Traditional only. Publishes every draft in the outline, or just one week's. */
    publishAllOutlineItems: (courseId: string, weekId?: string) =>
        httpClient
            .patch<ApiResponse<{ count: number }>>(`/outline/course/${courseId}/publish-all`, { weekId })
            .then(unwrap),

    /** The week's dates stay put; the items are dealt back into them in this order. */
    reorderOutlineItems: (weekId: string, orderedIds: string[]) =>
        httpClient
            .patch(`/outline/weeks/${weekId}/items/reorder`, { orderedIds })
            .then(() => undefined),

    /** One-time starting point for an empty outline — refused once it has weeks. */
    copyOutlineFromModules: (courseId: string) =>
        httpClient.post(`/outline/course/${courseId}/copy-from-modules`).then(() => undefined),
};
