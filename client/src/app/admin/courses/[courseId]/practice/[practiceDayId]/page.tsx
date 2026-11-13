"use client";

import { useParams } from "next/navigation";
import PracticeContentPage from "@/components/staff/PracticeContentPage";

/** One practice day's instructions and lessons, inside the admin console. */
export default function AdminPracticeDayPage() {
    const { courseId, practiceDayId } = useParams<{ courseId: string; practiceDayId: string }>();

    return <PracticeContentPage courseId={courseId} practiceDayId={practiceDayId} area="admin" />;
}
