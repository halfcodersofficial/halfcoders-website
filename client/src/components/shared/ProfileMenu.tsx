"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    Bell,
    Flame,
    Headphones,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    MonitorSmartphone,
    Settings,
    ShieldCheck,
    User,
    Video,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { useLogout } from "@/hooks/useSession";
import { devicesFor } from "@/lib/access";
import { confirmSignOut } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types/domain.types";

interface MenuLink {
    href: string;
    label: string;
    icon: LucideIcon;
    /** Rendered at the right of the row — an unread count, a "New" flag. */
    badge?: number;
}

/**
 * What this account's menu offers.
 *
 * Built per role rather than filtered from one list, because the three consoles
 * share almost nothing: a mentor has no enrolments to review and a student has
 * no review queue. The account rows are common in *shape* only — a mentor's or
 * admin's profile and inbox live at their own `/mentor/*` / `/admin/*` routes,
 * inside that console's own guard and layout, not the student dashboard shell.
 */
const linksFor = (role: CurrentUser["role"], unread: number): MenuLink[] => {
    if (role === "STUDENT") {
        return [
            { href: "/dashboard", label: "My learning", icon: LayoutDashboard },
            { href: "/conceptual-sessions", label: "Conceptual sessions", icon: Video },
            { href: "/dashboard/streak", label: "Streak", icon: Flame },
            { href: devicesFor(role), label: "My devices", icon: MonitorSmartphone },
            { href: "/settings", label: "Settings", icon: Settings },
        ];
    }

    if (role === "MENTOR") {
        return [
            { href: "/mentor", label: "Mentor console", icon: LayoutDashboard },
            { href: "/mentor/reviews", label: "Review queue", icon: ShieldCheck },
            { href: "/mentor/support", label: "Support sessions", icon: MessageSquare },
            { href: "/mentor/notifications", label: "Notifications", icon: Bell, badge: unread },
            { href: devicesFor(role), label: "My devices", icon: MonitorSmartphone },
            { href: "/mentor/profile", label: "Profile & settings", icon: Settings },
        ];
    }

    return [
        { href: "/admin", label: "Admin console", icon: LayoutDashboard },
        { href: "/admin/students", label: "Students", icon: User },
        { href: "/admin/support", label: "Support sessions", icon: MessageSquare },
        { href: "/admin/notifications", label: "Notifications", icon: Bell, badge: unread },
        { href: devicesFor(role), label: "My devices", icon: MonitorSmartphone },
        { href: "/admin/profile", label: "Profile & settings", icon: Settings },
    ];
};

/** Where the menu's top "Profile" button goes — each role's own profile page. */
const profileFor = (role: CurrentUser["role"]): string => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/profile";
    if (role === "MENTOR") return "/mentor/profile";
    return "/dashboard/profile";
};

/** "Student", "Mentor", "Admin" — the console this account owns, in one word. */
const roleLabel = (role: CurrentUser["role"]) => {
    if (role === "SUPER_ADMIN") return "Super admin";
    return role.charAt(0) + role.slice(1).toLowerCase();
};

/**
 * The signed-in half of the header: avatar, and everything reachable from it.
 *
 * Radix rather than a hand-rolled panel — it brings arrow-key navigation, the
 * focus trap, Escape-to-close and click-outside, all of which a plain `useState`
 * popover gets wrong in a way nobody notices until they navigate by keyboard.
 *
 * `onDark` is the bar over a navy band: the initials go navy on a solid white
 * disc with a soft white ring, as the usual pale-blue tint all but vanishes there.
 */
export default function ProfileMenu({
    user,
    unreadCount,
    onOpenSupport,
    onDark = false,
}: {
    user: CurrentUser;
    unreadCount: number;
    onDark?: boolean;
    /** A student's "Support" row: opens the navbar's support picker. */
    onOpenSupport?: () => void;
}) {
    const logout = useLogout();
    const links = linksFor(user.role, unreadCount);
    const askToLogOut = useRef(false);
    const askForSupport = useRef(false);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label="Account menu"
                className={cn(
                    "rounded-full ring-2 transition-all",
                    onDark
                        ? "ring-white/30 hover:ring-white/60 data-[state=open]:ring-white/80"
                        : "ring-transparent hover:ring-primary/30 data-[state=open]:ring-primary/50",
                )}
            >
                <Avatar src={user.image} name={user.name} size={36} className={onDark ? "bg-white text-primary-950" : undefined} />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={10}
                    className="z-50 w-72 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                    style={{ boxShadow: "var(--shadow-panel)" }}
                    // "Log out" asks only once the menu has closed and handed
                    // focus back to the avatar. Asked any sooner, that hand-back
                    // lands after the dialog opens and pulls focus out of it —
                    // its Escape, Enter and Tab stop answering — and Cancel
                    // would return focus to a menu item that no longer exists.
                    onCloseAutoFocus={() => {
                        // The support picker opens the same way, once focus is back.
                        if (askForSupport.current) {
                            askForSupport.current = false;
                            onOpenSupport?.();
                            return;
                        }
                        if (!askToLogOut.current) return;
                        askToLogOut.current = false;
                        void confirmSignOut().then((confirmed) => confirmed && logout.mutate());
                    }}
                >
                    {/* Identity block. The avatar is repeated at size here on
                        purpose: it confirms *which* account is about to act,
                        which matters most on shared machines. */}
                    <div className="bg-surface px-4 py-5 text-center">
                        <Avatar
                            src={user.image}
                            name={user.name}
                            size={64}
                            className="mx-auto ring-2 ring-background"
                        />
                        <p className="mt-2.5 truncate font-semibold">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email ?? user.phone}</p>
                        <p className="mt-0.5 text-xs font-medium text-primary">
                            {roleLabel(user.role)}
                        </p>

                        {/* `buttonVariants` rather than `<Button asChild>`: the
                            menu item is already slotting into its child, and a
                            second Slot in the chain has nothing left to hold
                            the ref Radix needs for focus. */}
                        <DropdownMenu.Item asChild>
                            <Link
                                href={profileFor(user.role)}
                                className={cn(
                                    buttonVariants({ size: "sm" }),
                                    "mt-3 w-full cursor-pointer rounded-full",
                                )}
                            >
                                Profile
                            </Link>
                        </DropdownMenu.Item>
                    </div>

                    <div className="p-1.5">
                        {links.map((link) => (
                            <DropdownMenu.Item key={link.href} asChild>
                                <Link
                                    href={link.href}
                                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-secondary data-highlighted:bg-secondary"
                                >
                                    <link.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="flex-1 truncate">{link.label}</span>
                                    {link.badge ? (
                                        <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                                            {link.badge > 9 ? "9+" : link.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            </DropdownMenu.Item>
                        ))}
                        {onOpenSupport && (
                            <DropdownMenu.Item
                                onSelect={() => {
                                    askForSupport.current = true;
                                }}
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-secondary data-highlighted:bg-secondary"
                            >
                                <Headphones className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="flex-1 truncate">Support</span>
                            </DropdownMenu.Item>
                        )}
                    </div>

                    <DropdownMenu.Separator className="h-px bg-border" />

                    <div className="p-1.5">
                        <DropdownMenu.Item
                            onSelect={() => {
                                askToLogOut.current = true;
                            }}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive outline-none transition-colors focus:bg-destructive/10 data-highlighted:bg-destructive/10"
                        >
                            <LogOut className="size-4 shrink-0" aria-hidden />
                            Log out
                        </DropdownMenu.Item>
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
