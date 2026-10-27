"use client";

import { useParams } from "next/navigation";
import ConceptualSessionsManager from "@/components/staff/ConceptualSessionsManager";

/** One course's conceptual session topics and recordings, scoped to assigned courses. */
export default function MentorConceptualManagerPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <ConceptualSessionsManager courseId={courseId} area="mentor" />;
}
