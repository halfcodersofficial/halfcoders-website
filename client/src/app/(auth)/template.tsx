"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Where the reader came from. Module scope on purpose: a template remounts on
 * every navigation, so a ref inside it would forget, and the direction of a
 * move is only knowable from the screen before it.
 */
let previousPath: string | null = null;

/**
 * Entrance animation for each credential screen.
 *
 * A `template` remounts its subtree on every navigation, which is exactly
 * what makes a CSS entrance animation replay — a `layout` would keep the old
 * DOM and nothing would move. The slide follows the toggle: Sign In sits on
 * the left and Sign Up on the right, so going to Sign Up arrives from the
 * right and coming back arrives from the left. Anything else (a password
 * reset, a first visit) just fades in.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Read before the effect updates it, so both of Strict Mode's renders see
    // the same "from" and agree on the direction.
    const from = previousPath;

    useEffect(() => {
        previousPath = pathname;
    }, [pathname]);

    let animation = "auth-enter-fade";
    if (from && from !== pathname) {
        if (pathname === "/register" && from === "/login") animation = "auth-enter-right";
        else if (pathname === "/login" && from === "/register") animation = "auth-enter-left";
    }

    return (
        <div key={pathname} className={animation}>
            {children}
        </div>
    );
}
