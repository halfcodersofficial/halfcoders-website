"use client";

import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    Award,
    ChevronDown,
    BadgeCheck,
    Briefcase,
    Check,
    CheckCircle2,
    Circle,
    ClipboardList,
    FileText,
    GraduationCap,
    Info,
    Lightbulb,
    Link2,
    MapPin,
    MonitorSmartphone,
    Receipt,
    RefreshCw,
    UserRound,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProgressRing from "@/components/shared/ProgressRing";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { FileIcon } from "@/components/site/EditorWindow";
import { cn } from "@/lib/utils";
import { studentProfileService } from "@/services/studentProfile";
import type { ProfileSectionFlags } from "@/types/profile.types";
import { ProfileInfoModal } from "./ProfileInfoModal";

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    /** The completion flag this page fills, for the pages the profile score counts. */
    section?: keyof ProfileSectionFlags;
}

/** The profile score's seven sections first, then the rest by what they're about. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
        label: "Your profile",
        items: [
            { href: "/dashboard/profile", label: "My Profile", icon: UserRound, section: "myProfile" },
            { href: "/dashboard/profile/additional-info", label: "Additional Info", icon: Info, section: "additionalInfo" },
            { href: "/dashboard/profile/address", label: "Address", icon: MapPin, section: "address" },
            { href: "/dashboard/profile/education", label: "Education", icon: GraduationCap, section: "education" },
            { href: "/dashboard/profile/important-links", label: "Important Links", icon: Link2, section: "importantLinks" },
            { href: "/dashboard/profile/skill-set", label: "Skill Set", icon: Lightbulb, section: "skillSet" },
            { href: "/dashboard/profile/job-profile", label: "Job Profile", icon: Briefcase, section: "jobProfile" },
        ],
    },
    {
        label: "Career",
        items: [
            { href: "/dashboard/profile/job-experience", label: "Job Experience", icon: FileText },
            { href: "/dashboard/profile/got-hired", label: "Got hired", icon: Award },
        ],
    },
    {
        label: "Learning",
        items: [
            { href: "/dashboard/profile/course-request", label: "Course Request", icon: ClipboardList },
            { href: "/dashboard/profile/order-history", label: "Order History", icon: Receipt },
            { href: "/dashboard/profile/certification", label: "Certification", icon: BadgeCheck },
            { href: "/dashboard/profile/course-updates", label: "Course Updates", icon: RefreshCw },
        ],
    },
    {
        label: "Account",
        items: [{ href: "/dashboard/devices", label: "My devices", icon: MonitorSmartphone }],
    },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const SCORED = ALL_ITEMS.filter((item) => item.section);

const isActivePath = (pathname: string, href: string) =>
    href === "/dashboard/profile" ? pathname === href : pathname.startsWith(href);

/** A section's state on the checklist: ticked once complete, an open circle until then. */
function SectionMark({ done }: { done: boolean }) {
    return done ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Complete" />
    ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Not complete" />
    );
}

/**
 * The left-hand nav for the whole `/dashboard/profile/*` subtree and
 * `/dashboard/devices` (ProfileShell) — a scoped exception to
 * `dashboard/layout.tsx`'s "no sidebar" rule, since this module has 14
 * destinations of its own.
 *
 * It reads as an editor's explorer and a checklist at once: a profile card
 * with the photo in a ring that fills as the profile does, then the pages in
 * folders, each section the score counts ticked once complete,
 * and the first one still open offered as the next step. The "(i)" button
 * opens `ProfileInfoModal`.
 */
export function ProfileSidebar() {
    const pathname = usePathname();
    const { data: overview, isLoading } = useQuery({
        queryKey: ["student-profile", "overview"],
        queryFn: studentProfileService.overview,
    });

    const percent = overview?.completionPercent ?? 0;
    const flags = overview?.sections;
    const doneCount = flags ? SCORED.filter((item) => flags[item.section!]).length : 0;
    const next = flags ? SCORED.find((item) => !flags[item.section!]) : undefined;

    const identity = (compact: boolean) => (
        <div className="relative overflow-hidden rounded-card border border-border bg-card">
            <p className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">
                <FileIcon name="profile.json" /> আমার প্রোফাইল
            </p>
            <ProfileInfoModal />
            <div className={cn("relative", compact ? "flex items-center gap-4 p-4" : "px-5 pb-5 pt-6 text-center")}>
                {isLoading ? (
                    <Skeleton className={cn("rounded-full", compact ? "size-16" : "mx-auto size-28")} />
                ) : (
                    <ProgressRing
                        value={percent}
                        size={compact ? 68 : 116}
                        stroke={compact ? 4 : 5}
                        fillIn
                        className={cn(!compact && "mx-auto")}
                    >
                        <Avatar
                            src={overview?.profile.image ?? null}
                            name={overview?.profile.name ?? "?"}
                            size={compact ? 52 : 92}
                            className="ring-4 ring-card"
                        />
                    </ProgressRing>
                )}
                <div className={cn("min-w-0", compact ? "flex-1" : "mt-3")}>
                    <p className={cn("truncate font-bold tracking-tight", compact ? "" : "text-lg")}>{overview?.profile.name}</p>
                    {overview?.profile.studentId && (
                        <p className="mt-0.5 inline-block rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                            {overview.profile.studentId}
                        </p>
                    )}
                    {!compact && <p className="mt-1 truncate text-xs text-muted-foreground">{overview?.profile.email}</p>}
                </div>
            </div>

            <div className={cn("relative border-t border-border", compact ? "px-4 py-3" : "px-5 py-4")}>
                <p className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                        Profile <span className="text-syn-number">{percent}%</span> complete
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                        {doneCount}/{SCORED.length} sections
                    </span>
                </p>
                {next ? (
                    <Link
                        href={next.href}
                        className="group mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                    >
                        Next: {next.label}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                ) : (
                    flags && <p className="mt-2 text-xs font-semibold text-success">Every section is complete.</p>
                )}
            </div>
        </div>
    );

    return (
        <>
            <aside className="hidden shrink-0 lg:block lg:w-72">
                <div className="sticky top-20 space-y-4">
                    {identity(false)}

                    <nav aria-label="Profile" className="space-y-3 rounded-card border border-border bg-card p-2">
                        {NAV_GROUPS.map((group) => (
                            <div key={group.label}>
                                <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                                    <ChevronDown className="size-3.5" aria-hidden />
                                    {group.label}
                                </p>
                                <ul className="ml-3.5 border-l border-border">
                                    {group.items.map((item) => {
                                        const active = isActivePath(pathname, item.href);
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    aria-current={active ? "page" : undefined}
                                                    className={cn(
                                                        "-ml-px flex items-center gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors",
                                                        active
                                                            ? "border-primary bg-primary/5 font-semibold text-foreground"
                                                            : "border-transparent text-foreground/75 hover:border-border-strong hover:text-foreground",
                                                    )}
                                                >
                                                    <item.icon className="size-4 shrink-0" />
                                                    <span className="flex-1 truncate">{item.label}</span>
                                                    {item.section && flags && <SectionMark done={flags[item.section]} />}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>
            </aside>

            <div className="space-y-4 lg:hidden">
                {identity(true)}

                <nav aria-label="Profile" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
                    {ALL_ITEMS.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        const done = item.section && flags ? flags[item.section] : null;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors",
                                    active
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-card text-foreground/80 hover:border-primary/40",
                                )}
                            >
                                <item.icon className="size-4" />
                                {item.label}
                                {done === true && (
                                    <Check className={cn("size-3.5", active ? "text-primary-foreground" : "text-success")} strokeWidth={3} />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
