/**
 * Where the browser goes for the account screens. Half Coders signs people in
 * itself (`/login`, `/register`, …); the session is an httpOnly cookie the
 * API sets, so there is nothing to store here.
 */

/** A path inside this site to return to after signing in, or null — never another origin. */
export const safeNext = (next: string | null | undefined): string | null => {
    if (!next) return null;
    try {
        const url = new URL(next, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        const path = `${url.pathname}${url.search}${url.hash}`;
        return path.startsWith("/login") || path.startsWith("/register") ? null : path;
    } catch {
        return null;
    }
};

/** How someone came to be signed in — it picks what the hand-off screen says. */
export type SignedInVia = "signin" | "signup" | "reset";

/**
 * The hand-off screen between signing in and `to` (components/auth/
 * RedirectingScreen.tsx): it greets them, then opens `to`. The screen checks
 * `to` against the account's role again, so it needn't be trusted here.
 */
export const redirectingPath = (to: string, via: SignedInVia = "signin"): string => {
    const query = new URLSearchParams({ to });
    if (via !== "signin") query.set("via", via);
    return `/redirecting?${query}`;
};

/** Sends the browser to sign in, coming back to `returnTo` (this page by default) afterwards. */
export const redirectToSignIn = (returnTo: string = window.location.href) => {
    const next = safeNext(returnTo);
    window.location.assign(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
};
