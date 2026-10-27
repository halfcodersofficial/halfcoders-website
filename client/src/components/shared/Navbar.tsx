"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown, GraduationCap, LogOut, MonitorSmartphone, PanelLeft, User, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/shared/Logo";
import NotificationsDropdown from "@/components/shared/NotificationsDropdown";
import ProfileMenu from "@/components/shared/ProfileMenu";
import SupportSessionModal from "@/components/shared/SupportSessionModal";
import ThemeToggle, { ThemePicker } from "@/components/shared/ThemeToggle";
import { XpHistoryPanel } from "@/components/shared/XpHistoryPanel";
import CtaButton from "@/components/site/CtaButton";
import { FileIcon } from "@/components/site/EditorWindow";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLogout, useSession } from "@/hooks/useSession";
import { devicesFor, homeFor } from "@/lib/access";
import { confirmSignOut } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { dashboardService, notificationService } from "@/services";

/* The bar's pages, each shown as a file open in a tab. */
const NAV_LINKS: { href: string; label: string; file: string }[] = [
    { href: "/home", label: "Home", file: "home.tsx" },
    { href: "/courses", label: "Courses", file: "courses/" },
    { href: "/about", label: "About", file: "about.md" },
];

/** Recordings of the live conceptual classes — the list, and each course's player under /learn. */
const CONCEPTUAL_HREF = "/conceptual-sessions";

/** Where the bar takes over from the explorer: `lg`, in the same rem the breakpoint uses. */
const DESKTOP_QUERY = "(min-width: 64rem)";

/* Pages mark a dark section under the bar (an editor-surface header) with
   this; while one is under the bar's middle line, the bar goes dark too. */
const DARK_UNDER = '[data-nav-tone="dark"]';
const BAR_MIDDLE = 32;
type Tone = "light" | "dark";

/**
 * The public site's bar, dressed as an editor's title bar: the logo on the
 * left and everything else on the right — the pages as editor tabs (an icon
 * and a plain name) with a violet line across the open one, then the
 * account's things and Start Learning, which never leaves the bar at any
 * width. Nothing sits in the middle. (Bundles live under the catalogue's
 * Courses / Bundles switch; Contact is in the footer.)
 *
 * Over a dark editor-surface header (`data-nav-tone="dark"`) the bar turns
 * dark to match, and back to light as light content comes under it. A
 * signed-in account adds its bell and avatar from `md` and the light/dark
 * switch from `sm` (in the explorer below that); a student's learning
 * pages are in the avatar's menu and in the explorer (the phone menu), which
 * slides in from the left like an editor's file tree.
 *
 * The bar is 4rem tall: pages that stick things under it line up with that.
 */
export default function Navbar() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [xpOpen, setXpOpen] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);
    // Light until a dark section scrolls under the bar (pages start below it, so never at load).
    const [tone, setTone] = useState<Tone>("light");
    const { user, isAuthenticated, isLoading, isStudent } = useSession();
    const logout = useLogout();

    // Each role lands on its own console; "My learning" is a student's word for theirs.
    const dashboardHref = homeFor(user?.role);

    const { data: unread } = useQuery({
        queryKey: ["notifications", "unread-count"],
        queryFn: notificationService.unreadCount,
        enabled: isAuthenticated,
        refetchInterval: 60_000,
    });

    // XP for the header. Same query key as the dashboard page, so the two share one response.
    const { data: dashboard } = useQuery({
        queryKey: ["dashboard", "student"],
        queryFn: dashboardService.student,
        enabled: isStudent,
        staleTime: 5 * 60_000,
    });

    // The bar takes the tone of what's under it.
    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const dark = [...document.querySelectorAll(DARK_UNDER)].some((section) => {
                const box = section.getBoundingClientRect();
                return box.top <= BAR_MIDDLE && box.bottom > BAR_MIDDLE;
            });
            setTone(dark ? "dark" : "light");
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [pathname]);

    // A menu left open across a navigation covers the page you just asked for.
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    // …and one left open as a tablet turns to landscape would outlive its button.
    useEffect(() => {
        const desktop = window.matchMedia(DESKTOP_QUERY);
        const close = () => desktop.matches && setMenuOpen(false);
        desktop.addEventListener("change", close);
        return () => desktop.removeEventListener("change", close);
    }, []);

    const onConceptual = pathname.startsWith(CONCEPTUAL_HREF) || /^\/learn\/[^/]+\/conceptual/.test(pathname);
    const isActive = (href: string) => (href === "/dashboard" || href === "/" ? pathname === href : pathname.startsWith(href));
    const unreadCount = unread?.count ?? 0;
    const totalXp = dashboard?.summary.totalXp;
    const signedIn = !isLoading && isAuthenticated && user;
    const dark = tone === "dark";

    return (
        <header data-tone={tone} className="titlebar sticky top-0 z-50 transition-[background-color,box-shadow,color] duration-300">
            <nav aria-label="Main" className="flex h-16 items-stretch gap-1 pl-4 pr-3 sm:pl-6 sm:pr-5">
                <Link href="/" aria-label="Half Coders — home" className="flex shrink-0 items-center rounded-md">
                    <Logo variant="horizontal" priority onDark={dark} className="hidden xs:block" />
                    <Logo variant="icon" height={30} className="xs:hidden" />
                </Link>

                <div className="ml-auto flex min-w-0 items-stretch">
                    {/* The pages, as editor tabs. */}
                    <ul className={cn("hidden items-stretch border-l lg:flex", dark ? "border-editor-line" : "border-border")}>
                        {NAV_LINKS.map((link) => {
                            const active = isActive(link.href);
                            return (
                                <li key={link.href} className="flex">
                                    <Link
                                        href={link.href}
                                        aria-current={active ? "page" : undefined}
                                        data-active={active || undefined}
                                        className={cn(
                                            "editor-tab flex items-center gap-2 border-r px-3.5 text-sm font-medium transition-colors xl:px-4",
                                            dark ? "border-editor-line" : "border-border",
                                            active
                                                ? dark
                                                    ? "bg-editor-raised text-editor-fg"
                                                    : "bg-card text-foreground"
                                                : dark
                                                  ? "text-editor-muted hover:bg-editor-panel hover:text-editor-fg"
                                                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
                                        )}
                                    >
                                        <FileIcon name={link.file} />
                                        {link.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="flex min-w-0 items-center justify-end gap-2 pl-3">
                        {signedIn && (
                            <>
                                {isStudent && (
                                    <Link
                                        href={dashboardHref}
                                        aria-current={isActive(dashboardHref) ? "page" : undefined}
                                        className={cn(
                                            "hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors xl:inline-flex",
                                            dark
                                                ? "border-editor-line hover:border-editor-gutter hover:bg-editor-panel"
                                                : "border-border hover:border-border-strong hover:bg-surface",
                                            isActive(dashboardHref) && (dark ? "border-violet-400/50" : "border-primary/40 text-primary"),
                                        )}
                                    >
                                        <GraduationCap className="size-4" aria-hidden />
                                        My Learning
                                    </Link>
                                )}

                                {/* Earned XP, always in view on a wide screen. */}
                                {isStudent && totalXp !== undefined && (
                                    <button
                                        type="button"
                                        onClick={() => setXpOpen(true)}
                                        aria-label={`${totalXp} XP earned — view your XP history`}
                                        className={cn(
                                            "hidden h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs font-semibold transition-colors xl:inline-flex",
                                            dark
                                                ? "border-editor-line text-syn-dark-string hover:bg-editor-panel"
                                                : "border-success/30 bg-success/5 text-success-ink hover:bg-success/10",
                                        )}
                                    >
                                        <Zap className="size-3.5" aria-hidden />
                                        <span className="tabular-nums">{totalXp.toLocaleString()} XP</span>
                                    </button>
                                )}

                                <span className={cn("hidden md:inline-flex", dark && "[&_button]:text-editor-fg [&_button:hover]:bg-editor-panel")}>
                                    <NotificationsDropdown unreadCount={unreadCount} />
                                </span>

                                {/* Members only. On the smallest phones it moves into the explorer, to leave room for the CTA. */}
                                <ThemeToggle
                                    className={cn("hidden sm:inline-flex", dark && "text-editor-fg hover:bg-editor-panel hover:text-editor-fg")}
                                />
                            </>
                        )}

                        {/* Always here — signed in or not, at every width. */}
                        <CtaButton kind="enroll" size="sm" />

                        {signedIn && (
                            <span className="hidden md:inline-flex">
                                <ProfileMenu
                                    user={user}
                                    unreadCount={unreadCount}
                                    onOpenSupport={isStudent ? () => setSupportOpen(true) : undefined}
                                    onDark={dark}
                                />
                            </span>
                        )}

                        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
                            <Dialog.Trigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("lg:hidden", dark && "text-editor-fg hover:bg-editor-panel hover:text-editor-fg")}
                                    aria-label="Open the menu"
                                >
                                    <PanelLeft className="size-5" />
                                </Button>
                            </Dialog.Trigger>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 z-50 bg-editor/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
                                <Dialog.Content
                                    aria-describedby={undefined}
                                    className="editor fixed inset-y-0 left-0 z-50 flex w-[min(21rem,88vw)] flex-col border-r border-editor-line shadow-panel outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left motion-reduce:animate-none"
                                    // Focus the sheet itself rather than its first link.
                                    onOpenAutoFocus={(event) => {
                                        event.preventDefault();
                                        (event.currentTarget as HTMLElement).focus();
                                    }}
                                    tabIndex={-1}
                                    // Sign out asks from in here: lib/confirm.ts mounts its
                                    // dialog inside, and Escape answers that dialog first.
                                    data-modal=""
                                    onEscapeKeyDown={(event) => {
                                        if (document.querySelector(".swal2-container")) event.preventDefault();
                                    }}
                                >
                                    <Dialog.Title className="sr-only">Menu</Dialog.Title>

                                    <div className="flex h-12 shrink-0 items-center justify-between border-b border-editor-line bg-editor-panel pl-4 pr-2">
                                        <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-editor-muted">
                                            Menu
                                        </span>
                                        <Dialog.Close asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-editor-muted hover:bg-editor-raised hover:text-editor-fg"
                                                aria-label="Close the menu"
                                            >
                                                <X className="size-5" />
                                            </Button>
                                        </Dialog.Close>
                                    </div>

                                    <div className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
                                        {isAuthenticated && user && (
                                            <div className="mx-2 flex items-center gap-3 rounded-card border border-editor-line bg-editor-panel p-3">
                                                <Link href={dashboardHref} className="flex min-w-0 flex-1 items-center gap-3">
                                                    <Avatar src={user.image} name={user.name} size={40} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-semibold">{user.name}</span>
                                                        {user.email && (
                                                            <span className="block truncate font-mono text-[0.7rem] text-editor-muted">
                                                                {user.email}
                                                            </span>
                                                        )}
                                                    </span>
                                                </Link>
                                                {isStudent && totalXp !== undefined && (
                                                    <button
                                                        type="button"
                                                        // The XP panel is its own dialog: close the menu rather than stack two.
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            setXpOpen(true);
                                                        }}
                                                        aria-label={`${totalXp} XP earned — view your XP history`}
                                                        className="shrink-0 rounded-sm border border-editor-line px-2 py-1 font-mono text-[0.7rem] font-semibold text-syn-string"
                                                    >
                                                        {totalXp.toLocaleString()} XP
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <TreeFolder name="Pages" order={0}>
                                            {NAV_LINKS.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    aria-current={isActive(link.href) ? "page" : undefined}
                                                    className={treeItem(isActive(link.href))}
                                                >
                                                    <FileIcon name={link.file} />
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </TreeFolder>

                                        {isStudent && (
                                            <TreeFolder name="My learning" order={1}>
                                                <Link href="/dashboard" className={treeItem(pathname === "/dashboard")}>
                                                    <GraduationCap className="size-3.5 text-syn-func" aria-hidden /> My Learning
                                                </Link>
                                                <Link href={CONCEPTUAL_HREF} className={treeItem(onConceptual)}>
                                                    <BookOpen className="size-3.5 text-syn-keyword" aria-hidden /> Conceptual Sessions
                                                </Link>
                                                <div className="[&>button]:rounded-sm [&>button]:py-2 [&>button]:pl-7 [&>button]:text-[0.9rem] [&>button]:font-normal [&>button]:text-editor-muted [&>button:hover]:bg-editor-panel [&>button:hover]:text-editor-fg">
                                                    <SupportSessionModal dashboard={dashboard} variant="row" />
                                                </div>
                                            </TreeFolder>
                                        )}

                                        {isAuthenticated && (
                                            <TreeFolder name="Account" order={2}>
                                                <div className="[&>button]:rounded-sm [&>button]:py-2 [&>button]:pl-7 [&>button]:text-[0.9rem] [&>button]:font-normal [&>button]:text-editor-muted [&>button:hover]:bg-editor-panel [&>button:hover]:text-editor-fg">
                                                    <NotificationsDropdown unreadCount={unreadCount} variant="row" />
                                                </div>
                                                <Link href="/dashboard/profile" className={treeItem(false)}>
                                                    <User className="size-3.5 text-syn-number" aria-hidden /> Profile & settings
                                                </Link>
                                                {user && (
                                                    <Link href={devicesFor(user.role)} className={treeItem(pathname === devicesFor(user.role))}>
                                                        <MonitorSmartphone className="size-3.5 text-syn-func" aria-hidden /> My devices
                                                    </Link>
                                                )}
                                            </TreeFolder>
                                        )}

                                        {isAuthenticated && (
                                            <TreeFolder name="Theme" order={3}>
                                                <ThemePicker onEditor className="ml-7 mr-3" />
                                            </TreeFolder>
                                        )}
                                    </div>

                                    <div className="grid shrink-0 gap-2 border-t border-editor-line p-4">
                                        {isAuthenticated ? (
                                            <>
                                                <Button asChild>
                                                    <Link href={dashboardHref}>Open dashboard</Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="text-syn-tag hover:bg-editor-panel"
                                                    onClick={async () => {
                                                        if (await confirmSignOut()) logout.mutate();
                                                    }}
                                                    isLoading={logout.isPending}
                                                >
                                                    <LogOut className="size-4" /> Sign out
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <CtaButton kind="enroll" className="w-full" />
                                                <p className="pt-1 text-center text-sm text-editor-muted">
                                                    No account yet?{" "}
                                                    <Link href="/register" className="font-medium text-syn-keyword hover:underline">
                                                        Sign up free
                                                    </Link>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </Dialog.Content>
                            </Dialog.Portal>
                        </Dialog.Root>
                    </div>
                </div>
            </nav>

            {isStudent && (
                <>
                    {/* Opened from the avatar's menu on wide screens (the explorer has its own). */}
                    <SupportSessionModal dashboard={dashboard} variant="none" open={supportOpen} onOpenChange={setSupportOpen} />
                    <XpHistoryPanel open={xpOpen} onOpenChange={setXpOpen} totalXp={totalXp} />
                </>
            )}
        </header>
    );
}

const treeItem = (active: boolean) =>
    cn(
        "flex items-center gap-2.5 rounded-sm py-2 pl-7 pr-3 text-[0.9rem] transition-colors",
        active ? "bg-violet-500/20 text-editor-fg" : "text-editor-muted hover:bg-editor-panel hover:text-editor-fg",
    );

/** A folder in the explorer; `order` staggers its entrance as the sheet slides in. */
function TreeFolder({ name, order, children }: { name: string; order: number; children: ReactNode }) {
    return (
        <div
            className="animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500 motion-reduce:animate-none"
            style={{ animationDelay: `${100 + order * 70}ms` }}
        >
            <p className="flex items-center gap-1.5 px-2 pb-1 text-[0.72rem] font-semibold uppercase tracking-wider text-editor-muted">
                <ChevronDown className="size-3.5" aria-hidden />
                {name}
            </p>
            <div className="grid gap-px">{children}</div>
        </div>
    );
}
