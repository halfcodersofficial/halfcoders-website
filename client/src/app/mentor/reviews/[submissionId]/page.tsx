"use client";

import { useParams } from "next/navigation";
import HandInHistory from "@/components/mentor/reviews/HandInHistory";

/** One hand-in's whole history: every version sent, marking and recheck, in full. */
export default function HandInHistoryPage() {
    const { submissionId } = useParams<{ submissionId: string }>();
    return <HandInHistory submissionId={submissionId} />;
}
