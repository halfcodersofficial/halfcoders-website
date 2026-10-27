import type { NextConfig } from "next";
import { OPTIMIZED_IMAGE_HOSTS } from "./src/lib/imageHosts";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    // Dev only: Next's "N" button defaults to the bottom-left corner, which
    // is where the admin console keeps the account controls and sign-out.
    devIndicators: { position: "bottom-right" },
    // Standalone tracing keeps the production image small, but it works by
    // symlinking into node_modules — which Windows refuses without Developer
    // Mode, filling a local build with EPERM warnings and emitting no
    // server.js. The Docker build sets this flag (it runs on Linux); local
    // builds stay clean and use `next start`.
    output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
    // Visitors land on the catalogue, so every ongoing and upcoming course is
    // the first thing they see. The homepage lives at /home (the bar's Home
    // link). Temporary (307), so browsers don't cache it.
    async redirects() {
        return [{ source: "/", destination: "/courses", permanent: false }];
    },
    images: {
        // Derived from the same list SafeImage checks against, so a host can
        // never be optimizable here but unknown there (or the reverse).
        remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({
            protocol: "https" as const,
            hostname,
        })),
    },
};

export default nextConfig;
