"use client";

import { useParams } from "next/navigation";
import OutlineMakerPage from "@/components/staff/OutlineMakerPage";

/** The Outline Maker inside the mentor console, scoped to assigned courses. */
export default function MentorOutlinePage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <OutlineMakerPage courseId={courseId} area="mentor" />;
}
