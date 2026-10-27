"use client";

import {
    Award,
    Bell,
    BookOpen,
    Clapperboard,
    CreditCard,
    FolderTree,
    Gift,
    GraduationCap,
    Headphones,
    Layers,
    LayoutDashboard,
    Medal,
    MessageSquareQuote,
    MonitorPlay,
    MonitorSmartphone,
    Send,
    Settings,
    ShieldCheck,
    Star,
    Ticket,
    TicketPercent,
    Trophy,
    Undo2,
    UserCircle,
    UserCog,
    Users,
} from "lucide-react";
import { useMemo } from "react";
import ConsoleShell, { type ConsoleConfig } from "@/components/shared/ConsoleShell";
import RoleGuard from "@/components/shared/RoleGuard";
import { useSession } from "@/hooks/useSession";
import { ADMIN_ROLES } from "@/lib/access";

const NOTIFICATIONS = { href: "/admin/notifications", label: "Notifications", icon: Bell };

/**
 * Grouped by the job, not the data model, so an admin looking for "where do
 * I confirm a payment" scans a handful of headings rather than every row.
 * Settings and the admin's own devices sit apart at the foot; profile is the
 * account card itself.
 */
const ADMIN_CONSOLE: ConsoleConfig = {
    name: "Admin",
    home: "/admin",
    storageKey: "admin.sidebar.collapsed",
    notifications: NOTIFICATIONS,
    profile: { href: "/admin/profile", label: "Profile & settings", icon: UserCircle },
    footerItems: [
        { href: "/admin/devices", label: "My devices", icon: MonitorSmartphone },
        { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
    groups: [
        {
            label: null,
            items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }, NOTIFICATIONS],
        },
        {
            label: "Catalogue",
            items: [
                { href: "/admin/courses", label: "Courses", icon: BookOpen },
                { href: "/admin/conceptual", label: "Conceptual sessions", icon: Clapperboard },
                { href: "/admin/categories", label: "Categories", icon: FolderTree },
            ],
        },
        {
            label: "People",
            items: [
                { href: "/admin/students", label: "Students", icon: Users },
                { href: "/admin/mentors", label: "Mentors", icon: UserCog },
            ],
        },
        {
            label: "Sales & access",
            items: [
                { href: "/admin/orders", label: "Payments", icon: CreditCard },
                { href: "/admin/enrollments", label: "Enrolments", icon: GraduationCap },
                { href: "/admin/admission-tickets", label: "Admission tickets", icon: Ticket },
                { href: "/admin/certificates", label: "Certificates", icon: Award },
                { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
                { href: "/admin/refunds", label: "Refund requests", icon: Undo2 },
            ],
        },
        {
            label: "Promotions",
            items: [
                { href: "/admin/bundles", label: "Bundles", icon: Layers },
                { href: "/admin/offers", label: "Free-course offers", icon: Gift },
                { href: "/admin/rewards", label: "Completion rewards", icon: Medal },
            ],
        },
        {
            label: "Engagement",
            items: [
                { href: "/admin/support", label: "Support", icon: Headphones },
                { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
                { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
                { href: "/admin/reviews", label: "Course reviews", icon: Star },
                { href: "/admin/broadcast", label: "Broadcast", icon: Send, exact: true },
                { href: "/admin/broadcast/popup", label: "Popup Alert", icon: MonitorPlay },
            ],
        },
    ],
};

/** A super admin also sees the admin directory, under People. */
const withAdmins = (config: ConsoleConfig): ConsoleConfig => ({
    ...config,
    groups: config.groups.map((group) =>
        group.label === "People" ? { ...group, items: [...group.items, { href: "/admin/admins", label: "Admins", icon: ShieldCheck }] } : group,
    ),
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useSession();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const config = useMemo(() => (isSuperAdmin ? withAdmins(ADMIN_CONSOLE) : ADMIN_CONSOLE), [isSuperAdmin]);
    return (
        <RoleGuard allow={ADMIN_ROLES}>
            {/* Only mounted for an account the guard has already cleared. */}
            <ConsoleShell config={config} mainClassName="p-4 sm:p-6 lg:p-8">
                {children}
            </ConsoleShell>
        </RoleGuard>
    );
}
