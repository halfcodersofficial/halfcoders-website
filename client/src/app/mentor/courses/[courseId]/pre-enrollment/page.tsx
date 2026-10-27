"use client";

import { useParams } from "next/navigation";
import PreEnrollmentOutlinePage from "@/components/staff/PreEnrollmentOutlinePage";

/** The pre-enrolment roadmap PDF, managed from the mentor console for assigned courses. */
export default function MentorPreEnrollmentPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <PreEnrollmentOutlinePage courseId={courseId} area="mentor" />;
}
