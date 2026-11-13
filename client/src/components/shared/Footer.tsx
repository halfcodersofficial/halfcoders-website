import { Clock, Mail, Phone, Wallet, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons/lib";
// SiInstagram, SiX (react-icons/si) and FaLinkedin (@/lib/techStackVendorIcons) come back with those pages.
import { SiFacebook, SiGithub, SiWhatsapp, SiYoutube } from "react-icons/si";
import { BackToTop, BangladeshTime, CopyButton } from "@/components/shared/FooterBits";
import Logo from "@/components/shared/Logo";
import { FileIcon } from "@/components/site/EditorWindow";
import SupportStatus from "@/components/site/SupportStatus";
import {
    BRAND_NAME,
    BRAND_TAGLINE,
    GOVERNMENT_HOLIDAYS,
    SOCIAL_LINKS,
    SUPPORT_EMAIL,
    SUPPORT_HOURS,
    SUPPORT_PHONES,
    SUPPORT_SCHEDULE,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

/* The sitemap, as an editor's file tree: two folders side by side, plain names. */
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
    youtube: SiYoutube,
    github: SiGithub,
    whatsapp: SiWhatsapp,
    // Uncomment with their links in lib/brand.ts (SOCIAL_LINKS).
    // instagram: SiInstagram,
    // x: SiX,
    // linkedin: FaLinkedin,
};

/**
 * The site's footer: a dark editor pane on faint graph paper. Along the top
 * the logo, what Half Coders is and the social pages, with the sitemap beside
 * them as two folders of a file tree. Under that, how to reach us as one
 * editor panel split into cells — email (with a copy button), the phone
 * numbers (tap to call), the calling hours with whether the line is open
 * right now, and that we take bKash, shown by its logo. Then the small print,
 * and along the foot a violet status bar — the time in Dhaka and the
 * tagline — as at the bottom of an editor.
 */
export default function Footer() {
    return (
        <footer className="editor relative mt-20 overflow-hidden border-t border-editor-line">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-60" />
            <div aria-hidden className="pointer-events-none absolute -left-40 -top-56 size-120 rounded-full bg-violet-600/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/60 to-transparent" />

            <div className="container-page relative py-14 sm:py-16">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-12">
                    <div className="col-span-2 max-w-md space-y-6 lg:col-span-1">
                        <Link href="/" className="inline-flex max-w-full rounded-md">
                            <Logo variant="horizontal" onDark height={34} />
                        </Link>
                        <p className="text-sm leading-relaxed text-editor-muted">
                            A learning community from Bangladesh. Coding, engineering and career skills, taught in Bangla —
                            with live classes, mentors who review your work, and certificates you earn by doing.
                        </p>
                        <ul className="flex flex-wrap gap-2" aria-label="Half Coders on social media">
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
                                            className="grid size-10 place-items-center rounded-md border border-editor-line bg-editor-panel/60 text-editor-muted transition-[color,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-violet-400 hover:text-editor-fg motion-reduce:hover:translate-y-0"
                                        >
                                            <Icon className="size-4" aria-hidden />
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {TREE.map((group) => {
                        const headingId = `footer-${group.folder.toLowerCase().replace(/[^a-z]+/g, "-")}`;
                        return (
                            <nav key={group.folder} aria-labelledby={headingId}>
                                <h2 id={headingId} className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-editor-muted">
                                    <FileIcon name="folder/" />
                                    {group.folder}
                                </h2>
                                <ul className="mt-4 border-l border-editor-line">
                                    {group.files.map((item) => (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className="-ml-px flex items-start gap-2 border-l border-transparent py-1.5 pl-3 text-sm text-editor-muted transition-[color,border-color,padding] duration-200 hover:border-violet-400 hover:pl-4 hover:text-editor-fg sm:pl-4 sm:hover:pl-5 motion-reduce:transition-colors"
                                            >
                                                <FileIcon name={item.file} className="mt-[3px]" />
                                                {item.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        );
                    })}
                </div>

                {/* How to reach us, and how to pay: one panel, a cell each. */}
                <section aria-labelledby="footer-contact" className="mt-12 overflow-hidden rounded-panel border border-editor-line sm:mt-14">
                    <h2
                        id="footer-contact"
                        className="flex items-center gap-2 border-b border-editor-line bg-editor-panel px-4 py-2.5 text-xs font-semibold text-editor-muted"
                    >
                        <FileIcon name="contact.json" /> Contact us
                    </h2>
                    {/* The hairlines between the cells are the grid's gap showing the line colour through, exact however they wrap. */}
                    <div className="grid grid-cols-1 gap-px bg-editor-line sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
                        <Cell icon={Mail} tone="func" label="Email" action={<CopyButton value={SUPPORT_EMAIL} label="Copy the email address" />}>
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-editor-fg [overflow-wrap:anywhere] hover:underline">
                                {SUPPORT_EMAIL}
                            </a>
                        </Cell>

                        <Cell icon={Phone} tone="string" label="Phone">
                            <span className="flex flex-wrap gap-x-4 gap-y-1">
                                {/* The ones that take WhatsApp have their chat among the social icons. */}
                                {SUPPORT_PHONES.map((phone) => (
                                    <a
                                        key={phone.number}
                                        href={`tel:${phone.number.replace(/[^\d+]/g, "")}`}
                                        className="font-medium text-editor-fg tabular-nums hover:underline"
                                    >
                                        {phone.number}
                                    </a>
                                ))}
                            </span>
                        </Cell>

                        <Cell icon={Clock} tone="number" label="Calling hours">
                            <p lang="bn" className="text-editor-fg">
                                {SUPPORT_HOURS}
                            </p>
                            {/* Whether the line is open right now; empty (and so hidden) until the browser has worked it out. */}
                            <div lang="bn" className="mt-2.5 empty:hidden">
                                <SupportStatus schedule={SUPPORT_SCHEDULE} holidays={GOVERNMENT_HOLIDAYS} />
                            </div>
                        </Cell>

                        <Cell icon={Wallet} tone="tag" label="Pay with bKash">
                            <span className="inline-flex rounded-md bg-white px-3 py-1.5 shadow-[0_8px_20px_-10px_rgb(226_19_110/0.6)]">
                                <Image src="/payments/bkash-logo.png" alt="bKash" width={376} height={180} className="h-8 w-auto" />
                            </span>
                        </Cell>
                    </div>
                </section>
            </div>

            <div className="relative border-t border-editor-line">
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
            <div className="relative bg-primary text-primary-foreground">
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

/* Each cell's icon tile in its own syntax colour. */
const CELL_TONE = {
    func: "border-syn-func/30 bg-syn-func/10 text-syn-func",
    string: "border-syn-string/30 bg-syn-string/10 text-syn-string",
    number: "border-syn-number/30 bg-syn-number/10 text-syn-number",
    tag: "border-syn-tag/30 bg-syn-tag/10 text-syn-tag",
} as const;

/**
 * One cell of the contact panel: a small icon tile and a plain label on the
 * first line (and an action at its end, like a copy button), the value under
 * them on the cell's full width, so a long email address still fits.
 */
function Cell({
    icon: Icon,
    tone,
    label,
    action,
    children,
}: {
    icon: LucideIcon;
    tone: keyof typeof CELL_TONE;
    label: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="bg-editor p-5 transition-colors duration-200 hover:bg-editor-panel/70 sm:p-6">
            <div className="flex min-h-7 items-center justify-between gap-3">
                <p className="flex items-center gap-2.5 text-xs font-semibold text-editor-muted">
                    <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-md border", CELL_TONE[tone])}>
                        <Icon className="size-3.5" />
                    </span>
                    {label}
                </p>
                {action && <span className="text-editor-muted">{action}</span>}
            </div>
            <div className="mt-3.5 text-[0.95rem] leading-relaxed">{children}</div>
        </div>
    );
}
