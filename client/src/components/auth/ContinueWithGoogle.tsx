"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import envConfig from "@/lib/envConfig";

/** The part of Google Identity Services (accounts.google.com/gsi/client) used here. */
interface GoogleCodeClient {
    requestCode(): void;
}

declare global {
    interface Window {
        google?: {
            accounts: {
                oauth2: {
                    initCodeClient(config: {
                        client_id: string;
                        scope: string;
                        ux_mode: "popup";
                        select_account?: boolean;
                        callback: (response: { code?: string; error?: string }) => void;
                        error_callback?: (error: { type: "popup_failed_to_open" | "popup_closed" | "unknown" }) => void;
                    }): GoogleCodeClient;
                };
            };
        };
    }
}

/** Google's "G" in its own colours, as Google's branding asks of a custom sign-in button. */
export function GoogleLogo() {
    return (
        <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

/**
 * "Sign in with Google" — the site's own button, set like the form's. It
 * opens Google's popup to pick an account; Google hands back a one-time code,
 * and `onCode` passes it on for the API to trade for the account. A line
 * under it leads on to the email form. Nothing shows when no Google client is
 * configured.
 */
export default function ContinueWithGoogle({
    label,
    onCode,
    busy = false,
    dividerLabel,
}: {
    /** "Sign in with Google" or "Sign up with Google". */
    label: string;
    onCode: (code: string) => void;
    /** While the API is signing them in. */
    busy?: boolean;
    /** The line between this and the email form, e.g. "or sign in with email". */
    dividerLabel: string;
}) {
    const codeClient = useRef<GoogleCodeClient | null>(null);
    const handler = useRef(onCode);
    const [scriptReady, setScriptReady] = useState(false);
    const [scriptFailed, setScriptFailed] = useState(false);

    useEffect(() => {
        handler.current = onCode;
    }, [onCode]);

    useEffect(() => {
        const oauth2 = window.google?.accounts.oauth2;
        if (!scriptReady || !oauth2) return;
        codeClient.current = oauth2.initCodeClient({
            client_id: envConfig.googleClientId,
            scope: "openid email profile",
            ux_mode: "popup",
            // Always ask which account, so a shared computer doesn't pick the last person's.
            select_account: true,
            callback: ({ code, error }) => {
                if (code) handler.current(code);
                // access_denied: they closed Google's screen themselves.
                else if (error && error !== "access_denied") toast.error("Google didn't sign you in. Please try again.");
            },
            error_callback: ({ type }) => {
                if (type === "popup_failed_to_open") {
                    toast.error("Your browser blocked Google's sign-in window. Allow pop-ups for this site, then try again.");
                }
            },
        });
    }, [scriptReady]);

    if (!envConfig.googleClientId) return null;

    return (
        <div className="space-y-6">
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onReady={() => setScriptReady(true)}
                onError={() => setScriptFailed(true)}
            />

            <div className="space-y-2">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="cmd h-13 w-full gap-3 border-border-strong bg-card text-base font-semibold"
                    disabled={!scriptReady}
                    isLoading={busy}
                    // Keeps focus in the form: blurring its first box would flag
                    // it as skipped ("Full name is required") under Google's popup.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => codeClient.current?.requestCode()}
                >
                    {!busy && <GoogleLogo />}
                    {busy ? "Signing you in…" : label}
                </Button>
                {scriptFailed && (
                    <p className="text-center text-xs text-muted-foreground">
                        Google sign-in couldn&apos;t load. Check your connection or ad blocker and reload — or use your email below.
                    </p>
                )}
            </div>

            <div className="flex items-center gap-3">
                <span aria-hidden className="h-px flex-1 bg-border" />
                <span className="font-mono text-xs text-muted-foreground">{dividerLabel}</span>
                <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
        </div>
    );
}
