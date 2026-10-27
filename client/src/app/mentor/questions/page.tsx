"use client";

import { Suspense } from "react";
import QuestionsDesk from "@/components/mentor/questions/QuestionsDesk";

/** Students' questions on lessons, across the courses this mentor teaches. */
export default function MentorQuestionsPage() {
    return (
        <Suspense>
            <QuestionsDesk />
        </Suspense>
    );
}
