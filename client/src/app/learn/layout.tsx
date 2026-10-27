"use client";

import Navbar from "@/components/shared/Navbar";
import RoleGuard from "@/components/shared/RoleGuard";
import { STUDENT_ROLES } from "@/lib/access";

/**
 * The learning player, its assignments, practice days and support queue.
 *
 * Students only: every screen underneath writes progress against an enrolment,
 * and staff who want to see what a course looks like have the catalogue page
 * and the curriculum editor. The API applies the same rule.
 *
 * Carries the main site Navbar (no Footer — this is a working screen, not a
 * marketing one) so a student can still reach Courses/My Learning/notifications
 * without leaving the player. Screens under here that render their own sticky
 * sub-header account for the Navbar's height rather than stacking under it.
 */
export default function LearnLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allow={STUDENT_ROLES}>
            <Navbar />
            {children}
        </RoleGuard>
    );
}
