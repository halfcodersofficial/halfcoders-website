"use client";

import { useParams } from "next/navigation";
import CourseResultsView from "@/components/mentor/course/CourseResultsView";

/** The course's assignment and quiz marks — students by name only. */
export default function MentorCourseResultsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    return <CourseResultsView courseId={courseId} />;
}
