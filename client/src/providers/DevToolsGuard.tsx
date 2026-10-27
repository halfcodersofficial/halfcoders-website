"use client";

import { useEffect } from "react";
import { cleanupDevToolsProtection, initDevToolsProtection } from "@/lib/security/devtoolsProtection";

/** Mounted once in the root layout; does nothing unless the build turned protection on. */
export default function DevToolsGuard() {
    useEffect(() => {
        initDevToolsProtection();
        return () => cleanupDevToolsProtection();
    }, []);

    return null;
}
