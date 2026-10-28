import type { Metadata } from "next";
import localFont from "next/font/local";
import SiteListeners from "@/components/shared/SiteListeners";
import DevToolsGuard from "@/providers/DevToolsGuard";
import QueryProvider from "@/providers/QueryProvider";
import ThemeProvider, { ThemedToaster } from "@/providers/ThemeProvider";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { cn } from "@/lib/utils";
import "./globals.css";

/*
 * Self-hosted fonts (src/fonts/, licences beside them): nothing is fetched
 * from Google at build time or in the browser. Latin faces carry the Latin
 * subset, the Bangla faces the Bengali one. The look is a code editor's:
 * Space Grotesk for headings, Geist for reading, JetBrains Mono for every
 * piece of "code" (eyebrows, file names, figures, commands).
 */

/* Latin — preloaded, every page needs them. All three are variable. */
const geist = localFont({
    src: "../fonts/geist-latin.woff2",
    weight: "100 900",
    variable: "--font-geist",
    display: "swap",
});

const spaceGrotesk = localFont({
    src: "../fonts/space-grotesk-latin.woff2",
    weight: "300 700",
    variable: "--font-space-grotesk",
    display: "swap",
});

const jetbrainsMono = localFont({
    src: "../fonts/jetbrains-mono-latin.woff2",
    weight: "100 800",
    variable: "--font-jetbrains-mono",
    display: "swap",
});

/* Bangla. Each sits behind its Latin face in the stack (globals.css) and is
   limited to the Bengali block, so it downloads only on a page that has
   Bangla text and isn't preloaded on the ones that don't. */
const hindSiliguri = localFont({
    src: [
        { path: "../fonts/hind-siliguri-bengali-400.woff2", weight: "400" },
        { path: "../fonts/hind-siliguri-bengali-500.woff2", weight: "500" },
        { path: "../fonts/hind-siliguri-bengali-600.woff2", weight: "600" },
        { path: "../fonts/hind-siliguri-bengali-700.woff2", weight: "700" },
    ],
    variable: "--font-hind-siliguri",
    display: "swap",
    preload: false,
    declarations: [
        {
            prop: "unicode-range",
            value: "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1, U+11DF0-11DF1",
        },
    ],
});

const balooDa = localFont({
    src: "../fonts/baloo-da-2-bengali.woff2",
    weight: "400 800",
    variable: "--font-baloo-da",
    display: "swap",
    preload: false,
    declarations: [
        {
            prop: "unicode-range",
            value: "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1, U+11DF0-11DF1",
        },
    ],
});

export const metadata: Metadata = {
    metadataBase: new URL(envConfig.siteUrl),
    title: {
        default: `${BRAND_NAME} — Learn. Build. Grow Together.`,
        template: `%s | ${BRAND_NAME}`,
    },
    description:
        "A learning community from Bangladesh. Coding, engineering and career skills in Bangla — live classes, mentors who review your work, hands-on assignments and verifiable certificates.",
    applicationName: BRAND_NAME,
    keywords: [
        "Half Coders",
        "HalfCoders",
        "online course Bangladesh",
        "programming course in Bangla",
        "learn coding in Bangla",
        "coding bootcamp Bangladesh",
        "engineering math in Bangla",
        "career skills",
        "বাংলায় প্রোগ্রামিং",
        "প্রোগ্রামিং কোর্স",
        "অনলাইন কোর্স",
        "কোডিং শেখা",
    ],
    authors: [{ name: BRAND_NAME, url: envConfig.siteUrl }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    category: "education",
    // Large previews in Google's results and Discover. A page that sets its
    // own `robots` (noindex) replaces this whole entry.
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    // Proves ownership to Google Search Console. Keep it: removing the tag
    // un-verifies the site.
    verification: { google: "bITo3Vo7BrXpu1iwjmfhlOP7PwF-0HbQQqH0bdnVcAw" },
    // No `url`: a page without its own card (lib/seo.ts) would otherwise
    // share as the site's front page.
    openGraph: {
        title: `${BRAND_NAME} — Learn. Build. Grow Together.`,
        description:
            "Coding, engineering and career skills in Bangla — with mentors who review your work and certificates anyone can verify.",
        siteName: BRAND_NAME,
        locale: "bn_BD",
        type: "website",
        images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
        card: "summary_large_image",
        images: [DEFAULT_SOCIAL_IMAGE],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        // The font variables go on <html>, not <body>: the font stack is
        // declared on <html>, and a variable set lower down never reaches it.
        <html
            lang="en"
            className={cn(geist.variable, spaceGrotesk.variable, jetbrainsMono.variable, hindSiliguri.variable, balooDa.variable)}
            suppressHydrationWarning
        >
            {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add
                attributes to <body> before React hydrates. */}
            <body className="min-h-dvh" suppressHydrationWarning>
                <ThemeProvider>
                    <QueryProvider>
                        <DevToolsGuard />
                        {children}
                        <SiteListeners />
                        <ThemedToaster />
                    </QueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
