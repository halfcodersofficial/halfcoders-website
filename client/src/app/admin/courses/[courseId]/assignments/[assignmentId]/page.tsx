"use client";

import { useParams } from "next/navigation";
import AssignmentContentPage from "@/components/staff/AssignmentContentPage";

/** One assignment's brief and lessons, inside the admin console. */
export default function AdminAssignmentPage() {
    const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();

    return <AssignmentContentPage courseId={courseId} assignmentId={assignmentId} area="admin" />;
}
