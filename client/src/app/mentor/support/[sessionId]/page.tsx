"use client";

import { useParams } from "next/navigation";
import SupportQueueBoard from "@/components/staff/SupportQueueBoard";

export default function MentorQueueBoardPage() {
    const { sessionId } = useParams<{ sessionId: string }>();

    return <SupportQueueBoard sessionId={sessionId} area="mentor" />;
}
