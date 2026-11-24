"use client";

import { useParams } from "next/navigation";
import CourseRoster from "@/components/mentor/course/CourseRoster";

/** Everyone on the course and how far they've got — names and photos, no contact details. */
export default function MentorCourseStudentsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    return <CourseRoster courseId={courseId} />;
}
