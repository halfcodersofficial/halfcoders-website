"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { CSSProperties, ReactNode } from "react";
import { Toaster } from "sonner";

/**
 * Light or dark, by a `.dark` class on <html> (globals.css re-points every
 * token under it). next-themes writes the class from a blocking script before
 * the first paint, so a dark page never flashes light on load.
 *
 * Light until someone picks otherwise: "Auto" (follow the device) is offered
 * in the theme switch, not forced on everyone whose phone is set to dark.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
        </NextThemesProvider>
    );
}

/**
 * Sonner draws its own surfaces: it's told the theme, and its plain toast is
 * pointed at the site's popover colours (its own are pure white and pure
 * black). A long message — an announcement, say — is cut to three lines; the
 * whole of it is in the bell.
 */
export function ThemedToaster() {
    const { resolvedTheme } = useTheme();
    return (
        <Toaster
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            position="top-center"
            richColors
            closeButton
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                } as CSSProperties
            }
            toastOptions={{ classNames: { description: "line-clamp-3" } }}
        />
    );
}
