"use client";

import { useParams } from "next/navigation";
import ConceptualSessionsManager from "@/components/staff/ConceptualSessionsManager";

/** One course's conceptual session topics and recordings, inside the admin console. */
export default function AdminConceptualManagerPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <ConceptualSessionsManager courseId={courseId} area="admin" />;
}
