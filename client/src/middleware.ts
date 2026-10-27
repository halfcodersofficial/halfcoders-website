import { type NextRequest, NextResponse } from "next/server";

/**
 * Maintenance switch: DEPLOYMENT_MODE=staging
 * on the web container shows the maintenance page at every address, with the
 * visitor's own address kept in the bar. It's read here, per request, rather
 * than in a layout, because most visitor pages are built ahead of time and a
 * layout would only see the value from build time. Server-only (no
 * NEXT_PUBLIC_), so flipping it is a container restart, not a rebuild. The
 * Node.js runtime reads the container's environment as it is now.
 */
export function middleware(request: NextRequest) {
    if (process.env.DEPLOYMENT_MODE !== "staging") return NextResponse.next();
    return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
    runtime: "nodejs",
    // Pages only: Next's own files, the page itself and static files (brand
    // images, robots.txt, the sitemap) pass straight through. Extensions are
    // listed, not "anything with a dot", because a course slug can have one.
    matcher: ["/((?!_next/|maintenance$|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|txt|xml|webmanifest)$).*)"],
};
