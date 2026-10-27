"use client";

import { useParams } from "next/navigation";
import ModuleQuizEditor from "@/components/staff/ModuleQuizEditor";

export default function MentorModuleQuizPage() {
    const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();

    return <ModuleQuizEditor courseId={courseId} moduleId={moduleId} area="mentor" />;
}
