"use client";

import { useParams } from "next/navigation";
import CourseStudents from "@/components/staff/CourseStudents";

export default function AdminCourseStudentsPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <CourseStudents courseId={courseId} area="admin" />;
}
