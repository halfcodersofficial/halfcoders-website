"use client";

import { useParams } from "next/navigation";
import SupportSessionHistory from "@/components/staff/SupportSessionHistory";

export default function MentorSessionHistoryPage() {
    const { sessionId } = useParams<{ sessionId: string }>();

    return <SupportSessionHistory sessionId={sessionId} area="mentor" />;
}
