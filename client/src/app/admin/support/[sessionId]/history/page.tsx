"use client";

import { useParams, useSearchParams } from "next/navigation";
import SupportSessionHistory from "@/components/staff/SupportSessionHistory";

export default function AdminSessionHistoryPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    // Opened from a course's session list, "back" returns to that course.
    const course = useSearchParams().get("course");

    return (
        <SupportSessionHistory
            sessionId={sessionId}
            area="admin"
            backHref={course ? `/admin/support/courses/${encodeURIComponent(course)}` : undefined}
        />
    );
}
