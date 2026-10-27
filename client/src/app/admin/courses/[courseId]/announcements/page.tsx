"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import AnnouncementsBoard from "@/components/staff/AnnouncementsBoard";
import { adminService } from "@/services/admin";

/** One course's notice board, inside the admin console — named, so a post never goes to the wrong course. */
export default function AdminCourseAnnouncementsPage() {
    const { courseId } = useParams<{ courseId: string }>();
    // The editor's own query: usually cached already, since this page opens from there.
    const { data: course } = useQuery({ queryKey: ["admin", "course", courseId], queryFn: () => adminService.course(courseId) });
    return <AnnouncementsBoard courseId={courseId} area="admin" courseTitle={course?.title} />;
}
