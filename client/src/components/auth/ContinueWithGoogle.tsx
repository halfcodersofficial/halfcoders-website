"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import envConfig from "@/lib/envConfig";

/** The parts of Google Identity Services (accounts.google.com/gsi/client) used here. */
interface GoogleIdentityServices {
    initialize(config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        context?: "signin" | "signup" | "use";
        itp_support?: boolean;
    }): void;
    renderButton(
        parent: HTMLElement,
        options: {
            type?: "standard" | "icon";
            theme?: "outline" | "filled_blue" | "filled_black";
            size?: "large" | "medium" | "small";
            text?: "signin_with" | "signup_with" | "continue_with" | "signin";
            shape?: "rectangular" | "pill" | "circle" | "square";
            logo_alignment?: "left" | "center";
            width?: number;
            locale?: string;
        },
    ): void;
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleIdentityServices } };
    }
}

/** Google draws its button between these widths. */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// Google's script is set up once per page load; whichever button is on screen
// receives the credential.
let initialised = false;
let deliver: ((credential: string) => void) | null = null;

const initialise = (gis: GoogleIdentityServices) => {
    if (initialised) return;
    gis.initialize({
        client_id: envConfig.googleClientId,
        callback: ({ credential }) => {
            if (credential) deliver?.(credential);
        },
        ux_mode: "popup",
        auto_select: false,
        context: "use",
        itp_support: true,
    });
    initialised = true;
};

/**
 * "Continue with Google" — Google's own button (it has to be: the ID token
 * only comes from it), sized to the form and matched to the light or dark
 * theme, with a line under it leading on to the email form. Picking an
 * account hands `onCredential` the ID token for the API to check. Nothing at
 * all shows when no Google client is configured.
 */
export default function ContinueWithGoogle({
    onCredential,
    busy = false,
    dividerLabel,
}: {
    onCredential: (credential: string) => void;
    /** While the API is signing them in: the button is covered so it can't be pressed twice. */
    busy?: boolean;
    /** The line between this and the email form, e.g. "or sign in with email". */
    dividerLabel: string;
}) {
    const { resolvedTheme } = useTheme();
    const frame = useRef<HTMLDivElement>(null);
    const slot = useRef<HTMLDivElement>(null);
    const handler = useRef(onCredential);
    const [scriptReady, setScriptReady] = useState(false);
    const [scriptFailed, setScriptFailed] = useState(false);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        handler.current = onCredential;
    }, [onCredential]);

    useEffect(() => {
        const receive = (credential: string) => handler.current(credential);
        deliver = receive;
        return () => {
            if (deliver === receive) deliver = null;
        };
    }, []);

    // Google's button has a fixed width, so it's redrawn when the form's changes.
    useEffect(() => {
        const element = frame.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width)));
            setWidth((current) => (Math.abs(current - next) >= 8 ? next : current));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const gis = window.google?.accounts.id;
        if (!scriptReady || !gis || !slot.current || width === 0) return;
        initialise(gis);
        gis.renderButton(slot.current, {
            type: "standard",
            theme: resolvedTheme === "dark" ? "filled_black" : "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "center",
            width,
            locale: "en",
        });
    }, [scriptReady, resolvedTheme, width]);

    if (!envConfig.googleClientId) return null;

    return (
        <div className="space-y-6">
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onReady={() => setScriptReady(true)}
                onError={() => setScriptFailed(true)}
            />

            {scriptFailed ? (
                <p className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-center text-sm text-muted-foreground">
                    The Google button couldn&apos;t load. Check your connection or any ad blocker, then reload — or use your email below.
                </p>
            ) : (
                <div ref={frame} className="relative min-h-10" aria-busy={busy}>
                    {/* Holds the place until Google's button draws over it. */}
                    <div
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 -translate-x-1/2 animate-pulse rounded-sm bg-secondary"
                        style={{ width: width || "100%" }}
                    />
                    <div ref={slot} className="relative flex min-h-10 justify-center" />
                    {busy && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-sm bg-background/85 text-sm font-medium">
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            Signing you in…
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3">
                <span aria-hidden className="h-px flex-1 bg-border" />
                <span className="font-mono text-xs text-muted-foreground">{dividerLabel}</span>
                <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
        </div>
    );
}
