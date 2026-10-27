"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import CourseWorkspace from "@/components/mentor/course/CourseWorkspace";

/** Every page of one course the mentor teaches sits under its header and tabs. */
export default function MentorCourseLayout({ children }: { children: ReactNode }) {
    const { courseId } = useParams<{ courseId: string }>();
    return <CourseWorkspace courseId={courseId}>{children}</CourseWorkspace>;
}
