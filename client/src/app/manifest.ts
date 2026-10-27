import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

/**
 * Served at /manifest.webmanifest and linked from every page: the name, colour
 * and icons a phone uses when the site is added to the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: BRAND_NAME,
        short_name: BRAND_SHORT_NAME,
        description: "Coding, engineering and career skills in Bangla — live classes, mentor reviews and verifiable certificates.",
        start_url: "/courses",
        display: "standalone",
        lang: "bn",
        background_color: "#1A0D3D",
        theme_color: "#1A0D3D",
        icons: [
            { src: "/brand/icon/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/brand/favicon/web/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/brand/favicon/web/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
