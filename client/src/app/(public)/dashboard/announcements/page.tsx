"use client";

import AnnouncementsView from "@/components/shared/AnnouncementsView";
import RoleGuard from "@/components/shared/RoleGuard";
import { STUDENT_ROLES } from "@/lib/access";

/**
 * Students only, like the rest of `/dashboard` — see `dashboard/layout.tsx`.
 * The bell dropdown (`NotificationsDropdown`) is where a student notices a
 * new one; this is where "View all" sends them to read it in full.
 */
export default function AnnouncementsPage() {
    return (
        <div className="container-page py-8 sm:py-10">
            <RoleGuard allow={STUDENT_ROLES}>
                <AnnouncementsView />
            </RoleGuard>
        </div>
    );
}
