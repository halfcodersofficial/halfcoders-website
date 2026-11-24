"use client";

import { useParams } from "next/navigation";
import CourseStudentRecord from "@/components/mentor/course/CourseStudentRecord";

/** One student's whole record on the course: progress, quizzes, assignments, week by week. */
export default function MentorCourseStudentPage() {
    const { courseId, studentId } = useParams<{ courseId: string; studentId: string }>();
    return <CourseStudentRecord courseId={courseId} studentId={studentId} />;
}
