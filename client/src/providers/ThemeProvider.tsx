"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";
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

/** Sonner draws its own surfaces, so it's told the theme rather than reading the tokens. */
export function ThemedToaster() {
    const { resolvedTheme } = useTheme();
    return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="top-center" richColors closeButton />;
}
