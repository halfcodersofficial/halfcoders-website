import { Mail, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { IconType } from "react-icons/lib";
// SiInstagram, SiX (react-icons/si) and FaLinkedin (@/lib/techStackVendorIcons) come back with those pages.
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { BackToTop, BangladeshTime, CopyButton } from "@/components/shared/FooterBits";
import Logo from "@/components/shared/Logo";
import { FileIcon } from "@/components/site/EditorWindow";
import { BKASH, BRAND_NAME, BRAND_TAGLINE, SOCIAL_LINKS, SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONES } from "@/lib/brand";

/* The sitemap, as an editor's file tree: two folders, plain names. */
const TREE: { folder: string; files: { href: string; file: string; label: string }[] }[] = [
    {
        folder: "Explore",
        files: [
            { href: "/home", file: "home.tsx", label: "Home" },
            { href: "/courses", file: "courses/", label: "Courses" },
            { href: "/bundles", file: "bundles/", label: "Course bundles" },
            { href: "/about", file: "about.md", label: "About us" },
            { href: "/contact", file: "contact.sh", label: "Contact" },
        ],
    },
    {
        folder: "Account & tools",
        files: [
            { href: "/certificate", file: "verify-certificate.ts", label: "Verify a certificate" },
            { href: "/register", file: "sign-up.ts", label: "Create an account" },
            { href: "/login", file: "sign-in.ts", label: "Sign in" },
        ],
    },
];

const LEGAL_LINKS = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/refund-policy", label: "Refunds" },
];

const SOCIAL_ICON: Record<(typeof SOCIAL_LINKS)[number]["network"], IconType> = {
    facebook: SiFacebook,
    whatsapp: SiWhatsapp,
    // Uncomment with their links in lib/brand.ts (SOCIAL_LINKS).
    // instagram: SiInstagram,
    // x: SiX,
    // linkedin: FaLinkedin,
};

/**
 * The site's footer: a dark editor pane. On the left the logo, what Half
 * Coders is and the social pages; in the middle the sitemap as a file tree
 * with plain names; on the right how to reach us and how to pay (bKash only,
 * never a PIN or OTP), each in a small editor panel. Under it the small
 * print, and along the foot a violet status bar — the time in Dhaka and the
 * tagline — as at the bottom of an editor.
 */
export default function Footer() {
    return (
        <footer className="editor mt-20 border-t border-editor-line">
            <div className="container-page grid grid-cols-1 gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
                <div className="max-w-sm space-y-6">
                    <Link href="/" className="inline-flex max-w-full rounded-md">
                        <Logo variant="horizontal" onDark height={34} />
                    </Link>
                    <p className="text-sm leading-relaxed text-editor-muted">
                        A learning community from Bangladesh. Coding, engineering and career skills, taught in Bangla —
                        with live classes, mentors who review your work, and certificates you earn by doing.
                    </p>
                    <ul className="flex gap-2" aria-label="Half Coders on social media">
                        {SOCIAL_LINKS.map((social) => {
                            const Icon = SOCIAL_ICON[social.network];
                            return (
                                <li key={social.href}>
                                    <a
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={social.label}
                                        // Says which number a WhatsApp icon opens.
                                        title={social.label}
                                        className="grid size-9 place-items-center rounded-md border border-editor-line text-editor-muted transition-colors hover:border-violet-400 hover:text-editor-fg"
                                    >
                                        <Icon className="size-3.5" aria-hidden />
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <nav aria-label="Footer" className="grid grid-cols-2 gap-8 lg:grid-cols-1">
                    {TREE.map((group) => (
                        <div key={group.folder}>
                            <h2 className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-editor-muted">
                                <FileIcon name="folder/" />
                                {group.folder}
                            </h2>
                            <ul className="mt-3 border-l border-editor-line">
                                {group.files.map((item) => (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className="-ml-px flex items-center gap-2 border-l border-transparent py-1.5 pl-4 text-sm text-editor-muted transition-colors hover:border-violet-400 hover:text-editor-fg"
                                        >
                                            <FileIcon name={item.file} />
                                            {item.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="space-y-5">
                    {/* Contact. */}
                    <div className="overflow-hidden rounded-card border border-editor-line">
                        <p className="flex items-center gap-2 border-b border-editor-line bg-editor-panel px-3.5 py-2 text-xs font-semibold text-editor-muted">
                            <FileIcon name="contact.json" /> Contact us
                        </p>
                        <dl className="space-y-2.5 px-4 py-3.5 text-sm">
                            <div className="flex items-center justify-between gap-2">
                                <dt className="sr-only">Email</dt>
                                <dd className="flex min-w-0 items-center gap-2">
                                    <Mail className="size-4 shrink-0 text-syn-func" aria-hidden />
                                    <a href={`mailto:${SUPPORT_EMAIL}`} className="truncate text-editor-fg hover:underline">
                                        {SUPPORT_EMAIL}
                                    </a>
                                </dd>
                                <span className="text-editor-muted">
                                    <CopyButton value={SUPPORT_EMAIL} label="Copy the email address" />
                                </span>
                            </div>
                            <div>
                                <dt className="sr-only">Phone</dt>
                                <dd className="flex items-start gap-2">
                                    <Phone className="mt-0.5 size-4 shrink-0 text-syn-func" aria-hidden />
                                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                                        {/* Both take WhatsApp too: their chats are among the social icons. */}
                                        {SUPPORT_PHONES.map((phone) => (
                                            <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-editor-fg tabular-nums hover:underline">
                                                {phone}
                                            </a>
                                        ))}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="sr-only">Calling hours</dt>
                                <dd lang="bn" className="text-xs leading-relaxed text-editor-muted">
                                    {SUPPORT_HOURS}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* How to pay. */}
                    <div className="overflow-hidden rounded-card border border-editor-line">
                        <p className="flex items-center gap-2 border-b border-editor-line bg-editor-panel px-3.5 py-2 text-xs font-semibold text-editor-muted">
                            <FileIcon name="pay.sh" /> Pay with bKash
                        </p>
                        <div className="space-y-2 px-4 py-3.5 text-sm">
                            <p className="flex items-center justify-between gap-3">
                                <span className="min-w-0 text-editor-muted">
                                    Payment <span className="font-mono font-semibold text-syn-string">{BKASH.display}</span>
                                </span>
                                <span className="text-editor-muted">
                                    <CopyButton value={BKASH.number} label="Copy the bKash merchant number" />
                                </span>
                            </p>
                            <p className="leading-relaxed text-editor-muted">
                                Scan our QR code at checkout, or use bKash &quot;Payment&quot;, then send us the Transaction ID.
                            </p>
                            <p className="flex items-start gap-2 leading-relaxed text-syn-number">
                                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                We never ask for your bKash PIN or OTP.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-editor-line">
                <div className="container-page flex flex-col gap-3 py-5 font-mono text-xs text-editor-muted sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        © {new Date().getFullYear()} {BRAND_NAME}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <ul className="flex flex-wrap gap-x-5 gap-y-2">
                            {LEGAL_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="transition-colors hover:text-editor-fg">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <BackToTop className="hover:text-syn-keyword" />
                    </div>
                </div>
            </div>

            {/* The status bar. */}
            <div className="bg-primary text-primary-foreground">
                <div className="container-page flex h-8 items-center justify-between gap-4 overflow-hidden font-mono text-[0.68rem]">
                    <span className="flex min-w-0 items-center gap-4">
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-1.5 rounded-full bg-green-300" /> Half Coders
                        </span>
                        <span className="hidden sm:inline">Learning in Bangla</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                        <BangladeshTime />
                        <span className="hidden md:inline">{BRAND_TAGLINE}</span>

                    </span>
                </div>
            </div>
        </footer>
    );
}
