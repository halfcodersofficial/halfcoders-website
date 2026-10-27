"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
    Bell,
    ChevronRight,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import CommandPalette, { type CommandItem } from "@/components/shared/CommandPalette";
import Logo from "@/components/shared/Logo";
import ThemeToggle, { ThemePicker } from "@/components/shared/ThemeToggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLogout, useSession } from "@/hooks/useSession";
import { confirmSignOut } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { notificationService } from "@/services";

export interface ConsoleNavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    exact?: boolean;
}

export interface ConsoleNavGroup {
    label: string | null;
    items: ConsoleNavItem[];
}

/** One console's navigation — the admin's and the mentor's are both this shape. */
export interface ConsoleConfig {
    /** The tag beside the brand: "Admin", "Mentor". */
    name: string;
    home: string;
    groups: ConsoleNavGroup[];
    /** Pinned at the foot, above the account card — the admin's Settings. */
    footerItems?: ConsoleNavItem[];
    /** Where the account card goes. */
    profile: ConsoleNavItem;
    /** Carries the unread count, here and on the phone bar's bell. */
    notifications: ConsoleNavItem;
    /** The rail-or-list preference, per console. */
    storageKey: string;
}

/** A count beside a nav item: `alert` is the unread red, `count` a quieter tally of work waiting. */
export type ConsoleBadges = Record<string, { count: number; tone: "alert" | "count" } | undefined>;

/** The account's role, as a person would say it — not the enum. */
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super admin", ADMIN: "Admin", MENTOR: "Mentor", STUDENT: "Student" };

export const isActivePath = (pathname: string, item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

const allItems = (config: ConsoleConfig) => [
    ...config.groups.flatMap((group) => group.items),
    ...(config.footerItems ?? []),
    config.profile,
];

/**
 * The chrome around a staff console: the sidebar (a full list, or an icon
 * rail the admin can collapse it to), and below `lg` a slim bar with the page
 * you're on, search and notifications, opening the same sidebar as a drawer.
 * ⌘K opens the palette from anywhere.
 *
 * The sidebar's width is published as `--console-sidebar`, so anything fixed
 * to the viewport — a page's save bar, the rail's name tips — sits beside it.
 */
export default function ConsoleShell({
    config,
    badges = {},
    mainClassName,
    children,
}: {
    config: ConsoleConfig;
    /** Extra counts by href; the notifications one is added here. */
    badges?: ConsoleBadges;
    mainClassName?: string;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const { user } = useSession();
    const logout = useLogout();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const { data: unread } = useQuery({
        queryKey: ["notifications", "unread-count"],
        queryFn: notificationService.unreadCount,
    });
    const unreadCount = unread?.count ?? 0;
    const allBadges: ConsoleBadges = {
        ...badges,
        [config.notifications.href]: unreadCount > 0 ? { count: unreadCount, tone: "alert" } : undefined,
    };

    // Read after mount, so the server render and the first client render agree.
    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(config.storageKey) === "1");
        } catch {
            // Storage blocked — the full sidebar it is.
        }
    }, [config.storageKey]);
    const toggleCollapsed = () =>
        setCollapsed((current) => {
            try {
                localStorage.setItem(config.storageKey, current ? "0" : "1");
            } catch {
                // Not remembered this time; it still toggles.
            }
            return !current;
        });

    // A link followed from the phone drawer closes it.
    useEffect(() => setDrawerOpen(false), [pathname]);

    // Ctrl/Cmd+K from anywhere in the console.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // `key` is missing on the keydown Chrome fires for an autofill pick.
            if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setPaletteOpen((open) => !open);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const commands: CommandItem[] = [
        ...config.groups.flatMap((group) =>
            group.items.map((item) => ({ href: item.href, label: item.label, group: group.label ?? "General", icon: item.icon })),
        ),
        ...[...(config.footerItems ?? []), config.profile].map((item) => ({
            href: item.href,
            label: item.label,
            group: "Account",
            icon: item.icon,
        })),
    ];

    const sidebarProps: SidebarProps = {
        config,
        pathname,
        badges: allBadges,
        onSearch: () => {
            setDrawerOpen(false);
            setPaletteOpen(true);
        },
        user: user ? { name: user.name, image: user.image, role: user.role } : null,
        onSignOut: async () => {
            if (await confirmSignOut("Sign out")) logout.mutate();
        },
        signingOut: logout.isPending,
    };
    const current = allItems(config).find((item) => isActivePath(pathname, item));

    return (
        <div className="flex min-h-dvh" style={{ "--console-sidebar": collapsed ? "4.5rem" : "16rem" } as CSSProperties}>
            <aside
                className={cn(
                    "hidden shrink-0 border-r border-border bg-secondary/30 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
                    collapsed ? "w-18" : "w-64",
                )}
            >
                <div className="sticky top-0 h-dvh">
                    <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* Below lg there's no room for the sidebar: a slim bar with the
                    page you're on, and the same sidebar as a drawer. */}
                <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur lg:hidden">
                    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <Dialog.Trigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Open the menu">
                                <Menu className="size-5" />
                            </Button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                            <Dialog.Content
                                className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-border bg-secondary shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left"
                                aria-describedby={undefined}
                                // Focus the drawer itself rather than its first control —
                                // still inside it for a keyboard, without ringing the search box.
                                onOpenAutoFocus={(event) => {
                                    event.preventDefault();
                                    (event.currentTarget as HTMLElement).focus();
                                }}
                                tabIndex={-1}
                                // Sign out asks from in here: lib/confirm.ts mounts its
                                // dialog inside, where the drawer lets it be clicked, and
                                // Escape answers that dialog rather than closing the drawer.
                                data-modal=""
                                onEscapeKeyDown={(event) => {
                                    if (document.querySelector(".swal2-container")) event.preventDefault();
                                }}
                            >
                                <Dialog.Title className="sr-only">{config.name} menu</Dialog.Title>
                                <Sidebar {...sidebarProps} />
                                <Dialog.Close
                                    className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                                    aria-label="Close the menu"
                                >
                                    <X className="size-4" />
                                </Dialog.Close>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>

                    <Link href={config.home} className="flex min-w-0 items-center gap-2 font-semibold">
                        <Logo variant="icon" height={24} className="shrink-0" />
                        <span className="truncate">{current?.label ?? config.name}</span>
                    </Link>

                    <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Search" title="Search" onClick={() => setPaletteOpen(true)}>
                            <Search className="size-4" />
                        </Button>
                        <ThemeToggle />
                        <Button asChild variant="ghost" size="icon" className="relative">
                            <Link
                                href={config.notifications.href}
                                aria-label={unreadCount > 0 ? `${config.notifications.label}, ${unreadCount} unread` : config.notifications.label}
                                title={config.notifications.label}
                            >
                                <Bell className="size-4" />
                                {unreadCount > 0 && (
                                    <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </Link>
                        </Button>
                    </div>
                </header>

                <main className={cn("flex-1", mainClassName)}>{children}</main>
            </div>

            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} />
        </div>
    );
}

interface SidebarProps {
    config: ConsoleConfig;
    pathname: string;
    badges: ConsoleBadges;
    /** The icon rail. Only the desktop sidebar collapses; the phone drawer is always full. */
    collapsed?: boolean;
    /** Omitted in the phone drawer, which closes instead. */
    onToggleCollapsed?: () => void;
    onSearch: () => void;
    user: { name: string; image: string | null; role: string } | null;
    onSignOut: () => void;
    signingOut: boolean;
}

/**
 * Brand, search, the grouped sections, then — pinned at the foot, outside the
 * scroll — any footer items, the account card (which opens the profile), and
 * the way out: sign out. As a rail it
 * keeps every icon and shows each name on hover.
 */
function Sidebar({
    config,
    pathname,
    badges,
    collapsed = false,
    onToggleCollapsed,
    onSearch,
    user,
    onSignOut,
    signingOut,
}: SidebarProps) {
    // The rail's names, drawn beside it rather than inside the scrolling list,
    // which would clip anything that reaches past its edge.
    const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
    const showTip = (element: HTMLElement, label: string) => {
        const rect = element.getBoundingClientRect();
        setTip({ label, top: rect.top + rect.height / 2 });
    };
    const tipFor = (label: string) =>
        collapsed
            ? {
                onMouseEnter: (event: MouseEvent<HTMLElement>) => showTip(event.currentTarget, label),
                onFocus: (event: FocusEvent<HTMLElement>) => showTip(event.currentTarget, label),
                onMouseLeave: () => setTip(null),
                onBlur: () => setTip(null),
            }
            : {};

    const link = (item: ConsoleNavItem) => {
        const active = isActivePath(pathname, item);
        const badge = badges[item.href];
        const shown = badge && (badge.count > 9 ? "9+" : String(badge.count));
        const badgeWord = badge?.tone === "alert" ? "unread" : "waiting";

        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                {...tipFor(badge ? `${item.label} · ${badge.count} ${badgeWord}` : item.label)}
                className={cn(
                    "relative flex h-8 items-center gap-3 rounded-lg text-sm font-medium transition-[background-color,color,box-shadow]",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                        ? "bg-card font-semibold text-foreground shadow-sm ring-1 ring-border"
                        : "text-foreground/75 hover:bg-card/70 hover:text-foreground",
                )}
            >
                <item.icon className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                {badge && (
                    <span
                        className={cn(
                            "grid place-items-center rounded-full font-bold",
                            badge.tone === "alert"
                                ? "bg-destructive text-destructive-foreground"
                                : // A tint reads beside a label; perched on an icon it needs to be solid.
                                  collapsed
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-primary/12 text-primary",
                            collapsed
                                ? "absolute right-1.5 top-0.5 min-w-4 px-1 text-[10px] leading-4 ring-2 ring-background"
                                : "min-w-5 px-1.5 text-[11px]",
                        )}
                    >
                        {shown}
                        <span className="sr-only"> {badgeWord}</span>
                    </span>
                )}
            </Link>
        );
    };

    const profileActive = isActivePath(pathname, config.profile);

    return (
        <div className="relative flex h-full flex-col">
            {/* Brand, and the rail toggle. */}
            <div className={cn("flex h-14 shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2 px-4")}>
                {/* The brand's own logo; the rail has room for the mark alone. */}
                <Link href={config.home} className="flex min-w-0 items-center gap-2" {...tipFor(`Half Coders ${config.name.toLowerCase()}`)}>
                    <Logo variant={collapsed ? "icon" : "compact"} height={26} className="shrink-0" />
                    <span
                        className={cn(
                            "rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary",
                            collapsed && "sr-only",
                        )}
                    >
                        {config.name}
                    </span>
                </Link>
                {onToggleCollapsed && !collapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        aria-label="Collapse the sidebar"
                        title="Collapse the sidebar"
                        className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    >
                        <PanelLeftClose className="size-4" aria-hidden />
                    </button>
                )}
            </div>

            {/* Search — the ⌘K palette. */}
            <div className="shrink-0 px-3 pt-3">
                <button
                    type="button"
                    onClick={onSearch}
                    {...tipFor("Search  ⌘K")}
                    className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground",
                        collapsed ? "justify-center" : "px-2.5",
                    )}
                >
                    <Search className="size-4 shrink-0" aria-hidden />
                    <span className={cn("flex-1 text-left", collapsed && "sr-only")}>Search…</span>
                    {!collapsed && (
                        <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
                    )}
                </button>
            </div>

            <nav
                aria-label={config.name}
                // A scrollbar only when one is needed, and only while the pointer is over the list.
                className="min-h-0 flex-1 overflow-y-auto px-3 pb-1 [scrollbar-color:transparent_transparent] scrollbar-thin hover:[scrollbar-color:var(--border)_transparent]"
            >
                {config.groups.map((group) => (
                    <div key={group.label ?? "top"} className={group.label ? "pt-2.5" : "pt-3"}>
                        {group.label &&
                            (collapsed ? (
                                <span className="mx-auto mb-2 block h-px w-6 bg-border" aria-hidden />
                            ) : (
                                <p className="px-2.5 pb-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {group.label}
                                </p>
                            ))}
                        <div className="space-y-0.5">{group.items.map(link)}</div>
                    </div>
                ))}
            </nav>

            {/* The foot: pinned items, the theme, who's signed in, and the ways out. */}
            <div className="shrink-0 space-y-1.5 border-t border-border px-3 py-2.5">
                {config.footerItems?.map(link)}

                {collapsed ? (
                    <ThemeToggle className="h-8 w-full rounded-lg text-muted-foreground hover:bg-card hover:text-foreground" />
                ) : (
                    <ThemePicker />
                )}

                <Link
                    href={config.profile.href}
                    {...tipFor(user ? `${user.name} · ${config.profile.label}` : config.profile.label)}
                    aria-current={profileActive ? "page" : undefined}
                    className={cn(
                        "group flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-card",
                        collapsed && "justify-center",
                        profileActive && "bg-card shadow-sm ring-1 ring-border",
                    )}
                >
                    <Avatar src={user?.image} name={user?.name ?? "?"} size={32} />
                    <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
                        <span className="block truncate text-sm font-semibold">{user?.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                            {user ? (ROLE_LABEL[user.role] ?? user.role) : ""} · Profile
                        </span>
                    </span>
                    {!collapsed && (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    )}
                </Link>

                <Button
                    variant="brand-outline"
                    size={collapsed ? "icon" : "default"}
                    className={cn("w-full", collapsed ? "h-10" : "h-9")}
                    onClick={onSignOut}
                    isLoading={signingOut}
                    aria-label={collapsed ? "Sign out" : undefined}
                    {...tipFor("Sign out")}
                >
                    {!signingOut && <LogOut aria-hidden />}
                    {!collapsed && (signingOut ? "Signing out…" : "Sign out")}
                </Button>

                {onToggleCollapsed && collapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        aria-label="Expand the sidebar"
                        {...tipFor("Expand the sidebar")}
                        className="grid h-8 w-full place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    >
                        <PanelLeftOpen className="size-4" aria-hidden />
                    </button>
                )}
            </div>

            {tip && (
                <span
                    role="tooltip"
                    className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: tip.top, left: "calc(var(--console-sidebar, 4.5rem) + 0.5rem)" }}
                >
                    {tip.label}
                </span>
            )}
        </div>
    );
}
