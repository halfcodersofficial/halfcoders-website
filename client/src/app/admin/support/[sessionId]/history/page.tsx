"use client";

import { useParams, useSearchParams } from "next/navigation";
import SupportSessionHistory from "@/components/staff/SupportSessionHistory";

export default function AdminSessionHistoryPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    // Opened from a course's session list, "back" returns to that course — and the board link keeps it.
    const course = useSearchParams().get("course");
    const courseQuery = course ? `?course=${encodeURIComponent(course)}` : "";

    return (
        <SupportSessionHistory
            sessionId={sessionId}
            area="admin"
            backHref={course ? `/admin/support/courses/${encodeURIComponent(course)}` : undefined}
            boardHref={`/admin/support/${sessionId}${courseQuery}`}
        />
    );
}
