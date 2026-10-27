"use client";

import { useParams } from "next/navigation";
import ModuleManagerPage from "@/components/staff/ModuleManagerPage";

/** The Module Manager inside the mentor console, scoped to assigned courses. */
export default function MentorModuleManagerPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <ModuleManagerPage courseId={courseId} area="mentor" />;
}
