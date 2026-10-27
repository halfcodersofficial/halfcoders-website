import type { Role } from "@/types/api.types";
import type { StudentSubmission } from "@/types/admin.types";

/** "Week 03", in whatever the course calls its weeks. */
export const weekLabel = (label: string, order: number) => `${label} ${String(order).padStart(2, "0")}`;

/** "88 / 100", against a late submission's cap when it had one. */
export const marksLabel = (submission: Pick<StudentSubmission, "score" | "maxScore" | "assignment">) =>
    `${submission.score} / ${submission.maxScore ?? submission.assignment.totalMarks}`;

/** A percentage to a whole number, or a dash. */
export const percentLabel = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${Math.round(value)}%`);

/** Marks read at a glance: strong, middling, weak. */
export const percentTone = (value: number | null | undefined) =>
    value === null || value === undefined
        ? "text-muted-foreground"
        : value >= 80
            ? "text-success"
            : value >= 50
                ? "text-foreground"
                : "text-destructive";

const ROLE_LABEL: Record<Role, string> = {
    STUDENT: "Student",
    MENTOR: "Mentor",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super admin",
};

export const roleLabel = (role: Role | null | undefined) => (role ? ROLE_LABEL[role] : "Staff");

export const GATEWAY_LABEL: Record<string, string> = {
    BKASH: "bKash",
    MANUAL: "Cash / bank transfer",
    FREE: "Free",
};

export const XP_SOURCE_LABEL: Record<string, string> = {
    VIDEO_COMPLETE: "Lessons completed",
    ASSIGNMENT_SUBMIT: "Assignments submitted",
    ASSIGNMENT_SCORE: "Assignment marks",
    PRACTICE_COMPLETE: "Practice days",
    QUIZ_COMPLETE: "Quizzes",
    MODULE_COMPLETE: "Modules finished",
    MILESTONE_COMPLETE: "Weeks finished",
    COURSE_COMPLETE: "Courses finished",
    SUPPORT_PARTICIPATION: "Support sessions",
};

/** "12:05" from seconds, or "1:02:05" past an hour. */
export const clockLabel = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};
