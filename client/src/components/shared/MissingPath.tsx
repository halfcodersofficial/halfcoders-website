"use client";

import { usePathname } from "next/navigation";

/**
 * The address that led nowhere, as the shell would report it — so the
 * visitor can spot a typo in it: `$ cd /cuorses` → "No such file or directory".
 */
export default function MissingPath() {
    const pathname = usePathname();
    const path = pathname && pathname !== "/" ? decodeURIComponent(pathname) : "/";
    return (
        <>
            <p className="truncate">
                <span className="text-syn-string">~/halfcoders</span> <span className="text-syn-keyword">$</span> cd {path}
            </p>
            <p className="truncate text-syn-tag">bash: cd: {path}: No such file or directory</p>
        </>
    );
}
