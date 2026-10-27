"use client";

import { useParams } from "next/navigation";
import PreEnrollmentOutlinePage from "@/components/staff/PreEnrollmentOutlinePage";

/** The pre-enrolment roadmap PDF, managed from the admin console. */
export default function AdminPreEnrollmentPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <PreEnrollmentOutlinePage courseId={courseId} area="admin" />;
}
