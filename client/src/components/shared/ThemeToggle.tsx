"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** False on the server and while hydrating: the stored theme is only known in the browser. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const CHOICES = [
    { value: "light", label: "Light", icon: Sun, hint: "Light theme" },
    { value: "dark", label: "Dark", icon: Moon, hint: "Dark theme" },
    { value: "system", label: "Auto", icon: Monitor, hint: "Follow your device's setting" },
] as const;

/**
 * One click between light and dark, for a bar with room for an icon only.
 * Both icons are drawn and the `dark:` variant shows the right one, so it is
 * correct from the first paint; only the spoken label waits for the browser.
 */
export default function ThemeToggle({ className }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = useMounted();
    const label = !mounted ? "Change theme" : resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className={className}
        >
            <Moon className="size-5 dark:hidden" aria-hidden />
            <Sun className="hidden size-5 dark:block" aria-hidden />
        </Button>
    );
}

/**
 * Light, Dark or Auto side by side, for a menu with room to spell them out.
 * `onEditor` dresses it for the dark editor surface (the site's phone menu).
 */
export function ThemePicker({ onEditor = false, className }: { onEditor?: boolean; className?: string }) {
    const { theme, setTheme } = useTheme();
    const mounted = useMounted();

    return (
        <div
            role="group"
            aria-label="Theme"
            className={cn(
                "grid grid-cols-3 gap-0.5 rounded-lg border p-0.5",
                onEditor ? "border-editor-line bg-editor-panel" : "border-border bg-card",
                className,
            )}
        >
            {CHOICES.map((choice) => {
                const selected = mounted && theme === choice.value;
                return (
                    <button
                        key={choice.value}
                        type="button"
                        aria-pressed={selected}
                        title={choice.hint}
                        onClick={() => setTheme(choice.value)}
                        className={cn(
                            "flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
                            selected
                                ? onEditor
                                    ? "bg-editor-raised text-editor-fg"
                                    : "bg-secondary text-foreground shadow-sm"
                                : onEditor
                                  ? "text-editor-muted hover:text-editor-fg"
                                  : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <choice.icon className="size-3.5" aria-hidden />
                        {choice.label}
                    </button>
                );
            })}
        </div>
    );
}
