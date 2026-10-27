/**
 * Curriculum authoring, the course roster and session attendance are the same
 * job whichever console you came from, so both mount the same components. Only
 * the URL prefix differs, and every internal link is built from here so a page
 * opened in the admin console never links its way into the mentor one.
 */
export type StaffArea = "admin" | "mentor";

export const staffCourseRoutes = (area: StaffArea, courseId: string) => {
    const base = `/${area}/courses/${courseId}`;

    return {
        /** The course itself: the admin editor, or the mentor's course page. */
        overview: base,
        /** The pre-enrolment roadmap PDF — what a student sees before joining. */
        preEnrollment: `${base}/pre-enrollment`,
        /** The Outline Maker — the planned, dated schedule students read after joining. */
        outline: `${base}/outline`,
        /**
         * The Module Manager — the real content: weeks, modules, and their
         * lessons, quizzes, assignments and practice days. Independent of the
         * outline; each keeps its own dates.
         */
        modules: `${base}/modules`,
        /** The roster — admin only; a mentor's link lands back on the course. */
        students: `${base}/students`,
        /** Assignment and quiz marks, students by name only. */
        results: `${base}/results`,
        /** The mentor's editor for the words on the public course page (the admin edits it in `overview`). */
        coursePage: `${base}/course-page`,
        /** The course's notice board: posts to everyone on it. */
        announcements: `${base}/announcements`,
        /** Recordings of the live conceptual classes, by topic — apart from the modules. */
        conceptual: `${base}/conceptual`,
        /** Every course's conceptual sessions — where a course's manager leads back to. */
        conceptualHome: `/${area}/conceptual`,
        /** One module's lessons (video, text, resource). */
        module: (moduleId: string) => `${base}/modules/${moduleId}`,
        quiz: (moduleId: string) => `${base}/modules/${moduleId}/quiz`,
        /** One assignment's brief and its lessons. */
        assignment: (assignmentId: string) => `${base}/assignments/${assignmentId}`,
        /** Where "back" goes: the course list for admins, the mentor's home. */
        home: area === "admin" ? "/admin/courses" : "/mentor",
        /** Every course this person manages — where a course's sub-pages lead back to. */
        courses: `/${area}/courses`,
    };
};

export const staffSupportRoutes = (area: StaffArea, sessionId: string) => ({
    /** Only mentors run a live queue; admins get the attendance record. */
    session: area === "admin" ? "/admin/support" : `/mentor/support/${sessionId}`,
    history: `/${area}/support/${sessionId}/history`,
    home: area === "admin" ? "/admin/support" : "/mentor/support",
});
