"use client";

import type { ReactNode } from "react";
import { useConsoleSection } from "@/components/shared/ConsoleShell";
import { Eyebrow } from "@/components/site/code";

/**
 * The `// Catalogue` comment above a console page's title — the public pages'
 * eyebrow, filled in with the sidebar group the page is under (or the
 * console's name for a page at the top). `children` says something more
 * specific instead. Outside a console — a shared page a student also opens —
 * it draws nothing, unless given its own words.
 */
export default function ConsoleEyebrow({ children, className }: { children?: ReactNode; className?: string }) {
    const section = useConsoleSection();
    const text = children ?? (section ? (section.group ?? `${section.console} console`) : null);
    if (!text) return null;
    return <Eyebrow className={className ?? "mb-1.5"}>{text}</Eyebrow>;
}
