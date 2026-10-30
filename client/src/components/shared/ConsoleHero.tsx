"use client";

import type { ReactNode } from "react";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import EditorWindow from "@/components/site/EditorWindow";
import { useSession } from "@/hooks/useSession";

const dhakaHour = () => Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dhaka" }));

const greeting = () => {
    const hour = dhakaHour();
    return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
};

const today = () =>
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" });

/**
 * The top of a console dashboard, set like the public site's heroes: a dark
 * editor window on graph paper, opened on a "Today" tab, greeting the person
 * by name with the date beside it. `children` runs on inside the window under
 * the greeting (the admin's "needs you" list); `status` fills the violet bar
 * along its foot.
 */
export default function ConsoleHero({
    description,
    actions,
    status,
    children,
    className,
}: {
    description?: ReactNode;
    /** Buttons beside the greeting; dress secondary ones with `HERO_OUTLINE`. */
    actions?: ReactNode;
    status?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    const { user } = useSession();
    const firstName = user?.name.trim().split(/\s+/)[0];

    return (
        <EditorWindow
            tabs={[{ name: "today.md", label: "Today", active: true }]}
            actions={
                <span className="font-mono text-[0.7rem] text-editor-muted" suppressHydrationWarning>
                    {today()}
                </span>
            }
            status={status}
            className={className}
            bodyClassName="relative isolate"
        >
            <span aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10" />
            <div className="flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
                <div className="min-w-0 max-w-2xl">
                    <ConsoleEyebrow className="mb-3" />
                    <h1 className="text-h2 text-balance" suppressHydrationWarning>
                        {greeting()}
                        {firstName && (
                            <>
                                , <span className="text-syn-keyword">{firstName}</span>
                            </>
                        )}
                    </h1>
                    {description && <p className="mt-2 text-editor-muted">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
            {children}
        </EditorWindow>
    );
}

/** A second button on the hero's dark ground, beside a `brand` one: `<Button variant="outline" className={HERO_OUTLINE}>`. */
export const HERO_OUTLINE = "border-editor-line bg-transparent text-editor-fg hover:border-editor-gutter hover:bg-editor-raised";
