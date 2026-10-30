"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
    Bell,
    ChevronDown,
    ChevronRight,
    GitBranch,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type FocusEvent,
    type MouseEvent,
    type ReactNode,
} from "react";
import CommandPalette, { type CommandItem } from "@/components/shared/CommandPalette";
import Logo from "@/components/shared/Logo";
import ThemeToggle, { ThemePicker } from "@/components/shared/ThemeToggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
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

/** Where the page you're on sits in the console — the sidebar group it's under, for a `// group` eyebrow. */
export interface ConsoleSection {
    console: string;
    group: string | null;
    item: ConsoleNavItem | undefined;
}

const ConsoleSectionContext = createContext<ConsoleSection | null>(null);

/** The section the current console page is in; null outside a console. */
export const useConsoleSection = () => useContext(ConsoleSectionContext);

/** The account's role, as a person would say it — not the enum. */
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super admin", ADMIN: "Admin", MENTOR: "Mentor", STUDENT: "Student" };

/** The syntax colour each sidebar group's icons wear, in turn — an editor's coloured file icons. */
const GROUP_TONES = ["text-syn-keyword", "text-syn-func", "text-syn-string", "text-syn-number", "text-syn-tag"];

/** How many recently opened pages the title bar keeps as tabs. */
const MAX_TABS = 5;

export const isActivePath = (pathname: string, item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

const allItems = (config: ConsoleConfig) => [
    ...config.groups.flatMap((group) => group.items),
    ...(config.footerItems ?? []),
    config.profile,
];

/** Every item's icon tone and the group it's under, by href. */
const indexItems = (config: ConsoleConfig) => {
    const index = new Map<string, { item: ConsoleNavItem; group: string | null; tone: string }>();
    config.groups.forEach((group, at) =>
        group.items.forEach((item) => {
            // Notifications is listed in the top group and kept there.
            if (!index.has(item.href)) index.set(item.href, { item, group: group.label, tone: GROUP_TONES[at % GROUP_TONES.length] });
        }),
    );
    [...(config.footerItems ?? []), config.profile].forEach((item) => {
        if (!index.has(item.href)) index.set(item.href, { item, group: "Account", tone: "text-syn-comment" });
    });
    return index;
};

/** A page open in the title bar: the sidebar item it's under, and where in it you last were. */
interface OpenTab {
    href: string;
    path: string;
}

const dhakaTime = (now: number) =>
    new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });

/**
 * The chrome around a staff console, dressed as the code editor the public
 * site is: the sidebar is the editor's dark explorer (a full tree of the
 * console's pages, or an icon rail the admin can collapse it to), the pages
 * you've opened sit as tabs in a title bar across the top, and a violet status
 * bar runs along the foot. Below `lg` a slim bar with the page you're on,
 * search and notifications opens the same explorer as a drawer. ⌘K opens the
 * palette from anywhere.
 *
 * The sidebar's width is published as `--console-sidebar`, so anything fixed
 * to the viewport — a page's save bar, the rail's name tips — sits beside it;
 * the height of the title and status bars around `main` as `--console-chrome`,
 * so a page that fills the window (the course editor) can take it off.
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
    const router = useRouter();
    const { user } = useSession();
    const logout = useLogout();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [tabs, setTabs] = useState<OpenTab[]>([]);

    const { data: unread } = useQuery({
        queryKey: ["notifications", "unread-count"],
        queryFn: notificationService.unreadCount,
    });
    const unreadCount = unread?.count ?? 0;
    const allBadges: ConsoleBadges = {
        ...badges,
        [config.notifications.href]: unreadCount > 0 ? { count: unreadCount, tone: "alert" } : undefined,
    };

    const index = useMemo(() => indexItems(config), [config]);
    const current = allItems(config).find((item) => isActivePath(pathname, item));
    const section: ConsoleSection = useMemo(
        () => ({ console: config.name, group: current ? (index.get(current.href)?.group ?? null) : null, item: current }),
        [config.name, current, index],
    );

    const tabsKey = `${config.storageKey}.tabs`;

    // Read after mount, so the server render and the first client render agree.
    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(config.storageKey) === "1");
        } catch {
            // Storage blocked — the full sidebar it is.
        }
    }, [config.storageKey]);
    useEffect(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(tabsKey) ?? "[]");
            if (Array.isArray(saved)) {
                setTabs((open) => [
                    ...saved.filter(
                        (tab): tab is OpenTab =>
                            typeof tab?.href === "string" && typeof tab?.path === "string" && !open.some((o) => o.href === tab.href),
                    ),
                    ...open,
                ].slice(-MAX_TABS));
            }
        } catch {
            // Nothing remembered — the tabs start from this page.
        }
    }, [tabsKey]);

    // The page you're on is always open, as the tab of the item it's under.
    const currentHref = current?.href;
    useEffect(() => {
        if (!currentHref) return;
        setTabs((open) => {
            const at = open.findIndex((tab) => tab.href === currentHref);
            if (at === -1) return [...open, { href: currentHref, path: pathname }].slice(-MAX_TABS);
            if (open[at].path === pathname) return open;
            const next = [...open];
            next[at] = { href: currentHref, path: pathname };
            return next;
        });
    }, [currentHref, pathname]);

    // Never stores an empty list: there's always a page open once one has loaded.
    useEffect(() => {
        if (!tabs.length) return;
        try {
            sessionStorage.setItem(tabsKey, JSON.stringify(tabs));
        } catch {
            // Not remembered past this page; the tabs still work.
        }
    }, [tabs, tabsKey]);

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

    // Only tabs for pages this console still has (a role change drops some).
    const openTabs = tabs.filter((tab) => index.has(tab.href));
    const closeTab = (href: string) => {
        const at = openTabs.findIndex((tab) => tab.href === href);
        const rest = openTabs.filter((tab) => tab.href !== href);
        setTabs(rest);
        if (href === currentHref) router.push((rest[at] ?? rest[at - 1])?.path ?? config.home);
    };

    const sidebarProps: SidebarProps = {
        config,
        pathname,
        badges: allBadges,
        tones: index,
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

    return (
        <ConsoleSectionContext.Provider value={section}>
            <div
                // `--console-chrome`: the title bar (h-10) and the status bar (h-7), which only both show from lg.
                className="flex min-h-dvh lg:[--console-chrome:4.25rem]"
                style={{ "--console-sidebar": collapsed ? "4.5rem" : "16rem" } as CSSProperties}
            >
                <aside
                    className={cn(
                        "editor hidden shrink-0 border-r border-editor-line transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
                        collapsed ? "w-18" : "w-64",
                    )}
                >
                    <div className="sticky top-0 h-dvh">
                        <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Below lg there's no room for the sidebar: a slim bar with the
                        page you're on, and the same explorer as a drawer. */}
                    <header className="titlebar sticky top-0 z-40 flex h-14 items-center gap-2 px-3 lg:hidden">
                        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
                            <Dialog.Trigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Open the menu">
                                    <Menu className="size-5" />
                                </Button>
                            </Dialog.Trigger>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 z-50 bg-editor/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
                                <Dialog.Content
                                    className="editor fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-editor-line shadow-panel outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left motion-reduce:animate-none"
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
                                        className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-editor-muted hover:bg-editor-raised hover:text-editor-fg"
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
                            <BellLink href={config.notifications.href} label={config.notifications.label} unread={unreadCount} />
                        </div>
                    </header>

                    {/* From lg: the pages you've opened, as editor tabs. */}
                    <div className="titlebar hidden h-10 items-stretch lg:flex">
                        <ul aria-label="Recently opened" className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
                            {openTabs.map((tab) => {
                                const entry = index.get(tab.href)!;
                                const active = tab.href === currentHref;
                                return (
                                    <li
                                        key={tab.href}
                                        data-active={active || undefined}
                                        className={cn(
                                            "editor-tab group/tab flex shrink-0 items-stretch border-r border-border transition-colors",
                                            active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
                                        )}
                                    >
                                        <Link
                                            // The open tab goes back to the top of its section; the others to where you left them.
                                            href={active ? entry.item.href : tab.path}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "flex items-center gap-2 text-[0.8rem] font-medium",
                                                openTabs.length > 1 ? "pl-3.5 pr-1.5" : "px-3.5",
                                            )}
                                        >
                                            <entry.item.icon className={cn("size-3.5 shrink-0", entry.tone)} aria-hidden />
                                            {entry.item.label}
                                        </Link>
                                        {openTabs.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => closeTab(tab.href)}
                                                aria-label={`Close the ${entry.item.label} tab`}
                                                title="Close tab"
                                                className={cn(
                                                    "mr-2 grid size-5 place-items-center self-center rounded-sm text-muted-foreground transition-[opacity,background-color] hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100",
                                                    active ? "opacity-100" : "opacity-0",
                                                )}
                                            >
                                                <X className="size-3" aria-hidden />
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2 pr-3">
                            <button
                                type="button"
                                onClick={() => setPaletteOpen(true)}
                                className="flex h-7 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                            >
                                <Search className="size-3.5" aria-hidden />
                                Go to a page
                                <kbd className="rounded-sm border border-border bg-surface px-1 font-mono text-[0.65rem]">⌘K</kbd>
                            </button>
                            <BellLink href={config.notifications.href} label={config.notifications.label} unread={unreadCount} small />
                        </div>
                    </div>

                    {/* Every page fills the width beside the sidebar; the gutter is set here, once, for both consoles. */}
                    <main className={cn("relative isolate min-w-0 flex-1 p-4 sm:p-6 lg:p-8", mainClassName)}>
                        {/* Graph paper under the top of every page, fading out as the content goes on. */}
                        <div
                            aria-hidden
                            className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 mask-[linear-gradient(to_bottom,#000,transparent)]"
                        />
                        {children}
                    </main>

                    <StatusBar config={config} section={section} unread={unreadCount} onSearch={() => setPaletteOpen(true)} />
                </div>

                <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} />
            </div>
        </ConsoleSectionContext.Provider>
    );
}

/** The bell, with the unread count perched on it. */
function BellLink({ href, label, unread, small = false }: { href: string; label: string; unread: number; small?: boolean }) {
    return (
        <Button asChild variant="ghost" size="icon" className={cn("relative", small && "size-8")}>
            <Link href={href} aria-label={unread > 0 ? `${label}, ${unread} unread` : label} title={label}>
                <Bell className="size-4" />
                {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-sm bg-destructive px-1 font-mono text-[10px] font-bold leading-4 text-destructive-foreground">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </Link>
        </Button>
    );
}

/**
 * The editor's status bar along the foot: which console this is and where in
 * it you are on the left; unread notifications, the quick search and the
 * time in Bangladesh — what every schedule here is set in — on the right.
 */
function StatusBar({
    config,
    section,
    unread,
    onSearch,
}: {
    config: ConsoleConfig;
    section: ConsoleSection;
    unread: number;
    onSearch: () => void;
}) {
    const now = useNow(30_000);

    return (
        <footer className="flex h-7 shrink-0 items-center justify-between gap-3 overflow-hidden bg-primary px-3 font-mono text-[0.68rem] text-primary-foreground">
            <p className="flex min-w-0 items-center gap-3">
                <Link href={config.home} className="flex shrink-0 items-center gap-1.5 hover:underline">
                    <GitBranch className="size-3" aria-hidden />
                    {config.name} console
                </Link>
                {section.item && (
                    <span className="hidden min-w-0 truncate opacity-85 sm:inline">
                        {section.group && `${section.group} › `}
                        {section.item.label}
                    </span>
                )}
            </p>
            <p className="flex shrink-0 items-center gap-3">
                {unread > 0 && (
                    <Link href={config.notifications.href} className="flex items-center gap-1 hover:underline">
                        <Bell className="size-3" aria-hidden />
                        {unread} unread
                    </Link>
                )}
                <button type="button" onClick={onSearch} className="hidden items-center gap-1 hover:underline md:flex">
                    <Search className="size-3" aria-hidden />
                    Search ⌘K
                </button>
                <span className="hidden sm:inline" suppressHydrationWarning>
                    Dhaka {dhakaTime(now)}
                </span>
            </p>
        </footer>
    );
}

interface SidebarProps {
    config: ConsoleConfig;
    pathname: string;
    badges: ConsoleBadges;
    tones: Map<string, { tone: string }>;
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
 * The editor's explorer, on its dark surface: brand, search, the console's
 * pages as a tree of folders, then — pinned at the foot, outside the scroll —
 * any footer items, the theme, the account card (which opens the profile),
 * and the way out: sign out. As a rail it keeps every icon and shows each
 * name on hover.
 */
function Sidebar({
    config,
    pathname,
    badges,
    tones,
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

    /** `nested`: inside a folder, hung off its tree line. */
    const link = (item: ConsoleNavItem, nested = false) => {
        const active = isActivePath(pathname, item);
        const badge = badges[item.href];
        const shown = badge && (badge.count > 9 ? "9+" : String(badge.count));
        const badgeWord = badge?.tone === "alert" ? "unread" : "waiting";
        const tone = tones.get(item.href)?.tone ?? "text-editor-muted";

        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                {...tipFor(badge ? `${item.label} · ${badge.count} ${badgeWord}` : item.label)}
                className={cn(
                    "relative flex h-8 items-center gap-2.5 rounded-sm text-[0.85rem] transition-colors",
                    collapsed ? "justify-center px-0" : nested ? "-ml-px rounded-l-none border-l-2 pl-3 pr-2" : "px-2.5",
                    active
                        ? cn("bg-violet-500/20 font-medium text-editor-fg", nested && !collapsed && "border-violet-400")
                        : cn("text-editor-muted hover:bg-editor-panel hover:text-editor-fg", nested && !collapsed && "border-transparent"),
                )}
            >
                {/* The rail marks the open page with a bar down its left edge, the tree with its line. */}
                {collapsed && active && <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet-400" />}
                <item.icon className={cn("size-4 shrink-0", tone)} aria-hidden />
                <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                {badge && (
                    <span
                        className={cn(
                            "grid place-items-center rounded-sm font-mono font-bold",
                            badge.tone === "alert" ? "bg-destructive text-destructive-foreground" : "bg-violet-500 text-white",
                            collapsed
                                ? "absolute right-1.5 top-0.5 min-w-4 px-1 text-[10px] leading-4 ring-2 ring-editor"
                                : "min-w-5 px-1.5 text-[0.68rem] leading-[1.15rem]",
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
            <div
                className={cn(
                    "flex h-14 shrink-0 items-center border-b border-editor-line bg-editor-panel",
                    collapsed ? "justify-center px-2" : "gap-2 px-4",
                )}
            >
                {/* The brand's own logo; the rail has room for the mark alone. */}
                <Link href={config.home} className="flex min-w-0 items-center gap-2" {...tipFor(`Half Coders ${config.name.toLowerCase()}`)}>
                    <Logo variant={collapsed ? "icon" : "compact"} height={26} onDark className="shrink-0" />
                    <span
                        className={cn(
                            "rounded-sm border border-violet-400/40 px-1.5 font-mono text-[0.65rem] font-semibold leading-5 text-syn-keyword",
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
                        className="ml-auto grid size-8 place-items-center rounded-md text-editor-muted transition-colors hover:bg-editor-raised hover:text-editor-fg"
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
                        "flex h-9 w-full items-center gap-2.5 rounded-md border border-editor-line bg-editor-panel text-sm text-editor-muted transition-colors hover:border-violet-400/50 hover:text-editor-fg",
                        collapsed ? "justify-center" : "px-2.5",
                    )}
                >
                    <Search className="size-4 shrink-0" aria-hidden />
                    <span className={cn("flex-1 text-left", collapsed && "sr-only")}>Search…</span>
                    {!collapsed && (
                        <kbd className="rounded-sm border border-editor-line bg-editor px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
                    )}
                </button>
            </div>

            <nav
                aria-label={config.name}
                // A scrollbar only when one is needed, and only while the pointer is over the list.
                className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [scrollbar-color:transparent_transparent] scrollbar-thin hover:[scrollbar-color:var(--editor-line)_transparent]"
            >
                {config.groups.map((group) => (
                    <div key={group.label ?? "top"} className="pt-3">
                        {group.label &&
                            (collapsed ? (
                                <span className="mx-auto mb-2 block h-px w-6 bg-editor-line" aria-hidden />
                            ) : (
                                <p className="flex items-center gap-1.5 px-1 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-editor-muted">
                                    <ChevronDown className="size-3.5" aria-hidden />
                                    {group.label}
                                </p>
                            ))}
                        {group.label && !collapsed ? (
                            <div className="ml-2.5 space-y-px border-l border-editor-line">{group.items.map((item) => link(item, true))}</div>
                        ) : (
                            <div className="space-y-px">{group.items.map((item) => link(item))}</div>
                        )}
                    </div>
                ))}
            </nav>

            {/* The foot: pinned items, the theme, who's signed in, and the ways out. */}
            <div className="shrink-0 space-y-1.5 border-t border-editor-line px-3 py-2.5">
                {config.footerItems?.map((item) => link(item))}

                {collapsed ? (
                    <ThemeToggle className="h-8 w-full rounded-md text-editor-muted hover:bg-editor-panel hover:text-editor-fg" />
                ) : (
                    <ThemePicker onEditor />
                )}

                <Link
                    href={config.profile.href}
                    {...tipFor(user ? `${user.name} · ${config.profile.label}` : config.profile.label)}
                    aria-current={profileActive ? "page" : undefined}
                    className={cn(
                        "group flex items-center gap-2.5 rounded-card border p-1.5 transition-colors",
                        collapsed ? "justify-center border-transparent" : "border-editor-line bg-editor-panel",
                        profileActive ? "border-violet-400/60 bg-violet-500/15" : "hover:border-editor-gutter",
                    )}
                >
                    <Avatar src={user?.image} name={user?.name ?? "?"} size={32} />
                    <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
                        <span className="block truncate text-sm font-semibold">{user?.name}</span>
                        <span className="block truncate font-mono text-[0.68rem] text-editor-muted">
                            {user ? (ROLE_LABEL[user.role] ?? user.role) : ""} · Profile
                        </span>
                    </span>
                    {!collapsed && (
                        <ChevronRight
                            className="size-4 shrink-0 text-editor-muted transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                        />
                    )}
                </Link>

                <Button
                    variant="ghost"
                    size={collapsed ? "icon" : "default"}
                    className={cn("w-full text-syn-tag hover:bg-editor-panel hover:text-syn-tag", collapsed ? "h-10" : "h-9")}
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
                        className="grid h-8 w-full place-items-center rounded-md text-editor-muted transition-colors hover:bg-editor-panel hover:text-editor-fg"
                    >
                        <PanelLeftOpen className="size-4" aria-hidden />
                    </button>
                )}
            </div>

            {tip && (
                <span
                    role="tooltip"
                    className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-sm border border-editor-line bg-editor-raised px-2 py-1 text-xs font-medium text-editor-fg shadow-panel animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: tip.top, left: "calc(var(--console-sidebar, 4.5rem) + 0.5rem)" }}
                >
                    {tip.label}
                </span>
            )}
        </div>
    );
}
