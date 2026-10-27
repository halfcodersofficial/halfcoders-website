import Footer from "@/components/shared/Footer";
import JsonLd from "@/components/shared/JsonLd";
import Navbar from "@/components/shared/Navbar";
import SmoothScroll from "@/components/site/SmoothScroll";
import { SITE_JSON_LD } from "@/lib/seo";

/**
 * Chrome for every page a visitor can reach without signing in, and the
 * student's own pages: the editor's title bar on top, the editor-pane footer
 * at the foot. The learning player and the consoles use their own layouts —
 * they need the full viewport. Every page here also carries the site's
 * structured data (name, logo, contact) for search engines.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col">
            <JsonLd data={SITE_JSON_LD} />
            <SmoothScroll />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}
