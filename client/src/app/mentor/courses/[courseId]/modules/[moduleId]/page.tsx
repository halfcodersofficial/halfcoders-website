"use client";

import { useParams } from "next/navigation";
import ModuleLessonsEditor from "@/components/staff/ModuleLessonsEditor";

export default function MentorModuleLessonsPage() {
    const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();

    return <ModuleLessonsEditor courseId={courseId} moduleId={moduleId} area="mentor" />;
}
