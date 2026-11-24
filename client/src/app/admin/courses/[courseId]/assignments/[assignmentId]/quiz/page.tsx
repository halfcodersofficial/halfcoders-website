"use client";

import { useParams } from "next/navigation";
import ModuleQuizEditor from "@/components/staff/ModuleQuizEditor";

/** An assignment's quiz — its questions, taken after the assignment's lessons. */
export default function AdminAssignmentQuizPage() {
    const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();

    return <ModuleQuizEditor courseId={courseId} assignmentId={assignmentId} area="admin" />;
}
