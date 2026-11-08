"use client";

import { useParams, useSearchParams } from "next/navigation";
import SupportQueueBoard from "@/components/staff/SupportQueueBoard";

/** The live queue board, run by an admin — the same board the mentor has. */
export default function AdminQueueBoardPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    // Opened from a course's session list, "back" returns to that course, and the attendance link keeps it.
    const course = useSearchParams().get("course");
    const courseQuery = course ? `?course=${encodeURIComponent(course)}` : "";

    return (
        <SupportQueueBoard
            sessionId={sessionId}
            area="admin"
            backHref={course ? `/admin/support/courses/${encodeURIComponent(course)}` : undefined}
            historyHref={`/admin/support/${sessionId}/history${courseQuery}`}
        />
    );
}
