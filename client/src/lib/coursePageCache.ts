/**
 * Cache tag on the public course page's API fetch. The page keeps the course
 * for a couple of minutes; `refreshCoursePages` drops it early, so a mentor
 * just assigned — or a course page just edited — shows on the next visit.
 */
export const COURSE_PAGE_TAG = "course-page";
