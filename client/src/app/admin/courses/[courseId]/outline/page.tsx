"use client";

import { useParams } from "next/navigation";
import OutlineMakerPage from "@/components/staff/OutlineMakerPage";

/**
 * The Outline Maker inside the admin console — the same editor mentors use,
 * so an admin never has to walk into `/mentor` to plan a course.
 */
export default function AdminOutlinePage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <OutlineMakerPage courseId={courseId} area="admin" />;
}
