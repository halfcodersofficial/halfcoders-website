"use client";

import RoleGuard from "@/components/shared/RoleGuard";
import { STUDENT_ROLES } from "@/lib/access";

/**
 * Students only. No sidebar or secondary nav here — every top-level
 * destination (My learning, Browse courses) is already one click away from
 * the account menu in the main site header, so `/dashboard` is a plain page
 * like `/contact`.
 *
 * `/dashboard/profile/*` is the one deliberate exception: that subtree has
 * 15 destinations of its own (My Profile, Address, Education, Order
 * History, Settings, …), so it owns its own sidebar shell in
 * `dashboard/profile/layout.tsx`, nested inside this one. `/dashboard/devices`
 * is listed in that sidebar, so it wears the same shell.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <RoleGuard allow={STUDENT_ROLES}>{children}</RoleGuard>;
}
