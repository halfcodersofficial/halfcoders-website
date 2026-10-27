import { FileCode2, FileJson, FileText, Folder, Hash, Terminal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const FILE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
    tsx: { icon: FileCode2, className: "text-syn-func" },
    ts: { icon: FileCode2, className: "text-syn-func" },
    cpp: { icon: FileCode2, className: "text-syn-tag" },
    c: { icon: FileCode2, className: "text-syn-tag" },
    md: { icon: FileText, className: "text-syn-keyword" },
    json: { icon: FileJson, className: "text-syn-number" },
    sh: { icon: Terminal, className: "text-syn-string" },
    css: { icon: Hash, className: "text-syn-func" },
    dir: { icon: Folder, className: "text-syn-number" },
    txt: { icon: FileText, className: "text-syn-comment" },
};

const kindOf = (name: string) => (name.endsWith("/") ? "dir" : (name.split(".").pop() ?? "txt").toLowerCase());

/** The coloured glyph an editor shows beside a file name, picked by its extension ("about.md", "courses/"). */
export function FileIcon({ name, className }: { name: string; className?: string }) {
    const { icon: Icon, className: tone } = FILE_ICON[kindOf(name)] ?? FILE_ICON.txt;
    return <Icon aria-hidden className={cn("size-3.5 shrink-0", tone, className)} />;
}

export interface EditorTab {
    /** Picks the tab's icon by its extension ("x.md", "folder/"); shown as the text too unless `label` is given. */
    name: string;
    /** What the tab says, in plain words — prefer this: the file name is only decoration. */
    label?: string;
    active?: boolean;
}

interface EditorWindowProps {
    /** File tabs across the top; the active one is marked like a focused editor tab. */
    tabs?: EditorTab[];
    /** `dark`: the fixed editor surface (`.editor`); `light`: a pane on the page. */
    tone?: "dark" | "light";
    /** Right end of the tab strip — a small action or a note. */
    actions?: ReactNode;
    /** A status bar along the foot (violet, mono): branch, position, a state. */
    status?: ReactNode;
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}

/**
 * A window of the editor the site is dressed as: a strip of file tabs, the
 * body, an optional status bar. Used wherever a block should read as "a file"
 * — the hero's code, the course page's purchase panel, a FAQ, a CTA.
 */
export default function EditorWindow({
    tabs,
    tone = "dark",
    actions,
    status,
    className,
    bodyClassName,
    children,
}: EditorWindowProps) {
    const dark = tone === "dark";

    return (
        <div
            className={cn(
                // A column, so a window stretched by its grid row grows its body and keeps the status bar at the foot.
                "flex flex-col overflow-hidden rounded-panel border",
                dark ? "editor border-editor-line shadow-panel" : "border-border bg-card",
                className,
            )}
        >
            {(tabs || actions) && (
                <div
                    className={cn(
                        "flex min-h-9 items-stretch justify-between gap-2 border-b",
                        dark ? "border-editor-line bg-editor-panel" : "border-border bg-surface",
                    )}
                >
                    <ul className="no-scrollbar flex min-w-0 overflow-x-auto" aria-hidden>
                        {tabs?.map((tab) => (
                            <li
                                key={tab.name}
                                data-active={tab.active || undefined}
                                className={cn(
                                    "editor-tab flex shrink-0 items-center gap-2 border-r px-3.5 font-mono text-[0.72rem]",
                                    dark ? "border-editor-line" : "border-border",
                                    tab.active
                                        ? dark
                                            ? "bg-editor text-editor-fg"
                                            : "bg-card text-foreground"
                                        : dark
                                          ? "text-editor-muted"
                                          : "text-muted-foreground",
                                )}
                            >
                                <FileIcon name={tab.name} />
                                <span className={cn(tab.label && "font-sans text-[0.78rem] font-medium")}>{tab.label ?? tab.name}</span>
                            </li>
                        ))}
                    </ul>
                    {actions && <div className="flex shrink-0 items-center pr-3">{actions}</div>}
                </div>
            )}

            <div className={cn("flex-1", bodyClassName)}>{children}</div>

            {status && (
                <div className="flex h-7 items-center justify-between gap-3 overflow-hidden bg-primary px-3 font-mono text-[0.68rem] text-primary-foreground">
                    {status}
                </div>
            )}
        </div>
    );
}
