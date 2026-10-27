"use client";

import { useParams } from "next/navigation";
import AnnouncementsBoard from "@/components/staff/AnnouncementsBoard";

/** The course's notice board — post to everyone on it. */
export default function MentorCourseAnnouncementsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    return <AnnouncementsBoard courseId={courseId} area="mentor" />;
}
