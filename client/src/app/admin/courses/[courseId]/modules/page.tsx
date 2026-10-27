"use client";

import { useParams } from "next/navigation";
import ModuleManagerPage from "@/components/staff/ModuleManagerPage";

/** The Module Manager — the real course content — inside the admin console. */
export default function AdminModuleManagerPage() {
    const { courseId } = useParams<{ courseId: string }>();

    return <ModuleManagerPage courseId={courseId} area="admin" />;
}
