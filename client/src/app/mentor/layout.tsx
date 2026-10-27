"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Bell,
    BookOpen,
    Clapperboard,
    ClipboardCheck,
    Headphones,
    LayoutDashboard,
    MessagesSquare,
    MonitorSmartphone,
    UserCircle,
} from "lucide-react";
import ConsoleShell, { type ConsoleConfig } from "@/components/shared/ConsoleShell";
import RoleGuard from "@/components/shared/RoleGuard";
import { MENTOR_ROLES } from "@/lib/access";
import { dashboardService, lessonQaService } from "@/services";

// More than announcements now — hand-ins, sessions going live, course changes.
const NOTIFICATIONS = { href: "/mentor/notifications", label: "Notifications", icon: Bell };
const REVIEWS_HREF = "/mentor/reviews";
const QUESTIONS_HREF = "/mentor/questions";

/**
 * The same console as the admin's — one shell, one sidebar — scoped to the
 * mentor's own job: their courses, their review queue, the sessions they
 * host. Profile is the account card itself.
 */
const MENTOR_CONSOLE: ConsoleConfig = {
    name: "Mentor",
    home: "/mentor",
    storageKey: "mentor.sidebar.collapsed",
    notifications: NOTIFICATIONS,
    profile: { href: "/mentor/profile", label: "Profile & settings", icon: UserCircle },
    footerItems: [{ href: "/mentor/devices", label: "My devices", icon: MonitorSmartphone }],
    groups: [
        {
            label: null,
            items: [{ href: "/mentor", label: "Dashboard", icon: LayoutDashboard, exact: true }, NOTIFICATIONS],
        },
        {
            label: "Teaching",
            items: [
                { href: "/mentor/courses", label: "My courses", icon: BookOpen },
                { href: "/mentor/conceptual", label: "Conceptual sessions", icon: Clapperboard },
                { href: REVIEWS_HREF, label: "Review queue", icon: ClipboardCheck },
                { href: QUESTIONS_HREF, label: "Student questions", icon: MessagesSquare },
                { href: "/mentor/support", label: "Support sessions", icon: Headphones },
            ],
        },
    ],
};

/**
 * Mentors only.
 *
 * This console is built entirely around *your* assignments — the courses you
 * teach, your review queue, the sessions you host — so an admin who wandered in
 * got a working page reporting zero of everything. Admins do the course-scoped
 * half of this job (curriculum, roster, attendance) inside their own console,
 * from the same components.
 */
export default function MentorLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allow={MENTOR_ROLES}>
            <MentorConsole>{children}</MentorConsole>
        </RoleGuard>
    );
}

function MentorConsole({ children }: { children: React.ReactNode }) {
    // The dashboard's own query (the review queue refreshes it after every
    // review), so the count beside "Review queue" is the one on the dashboard.
    const { data } = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    const pending = data?.summary.pendingSubmissions ?? 0;
    // Questions still waiting for an answer — the inbox's own count, one row fetched.
    const questions = useQuery({
        queryKey: ["lesson-questions", "inbox", "open", "count"],
        queryFn: () => lessonQaService.inbox({ status: "open", limit: 1 }),
        refetchInterval: 120_000,
    });
    const waiting = questions.data?.meta?.open ?? 0;

    return (
        <ConsoleShell
            config={MENTOR_CONSOLE}
            badges={{
                [REVIEWS_HREF]: pending > 0 ? { count: pending, tone: "count" } : undefined,
                [QUESTIONS_HREF]: waiting > 0 ? { count: waiting, tone: "count" } : undefined,
            }}
        >
            {children}
        </ConsoleShell>
    );
}
