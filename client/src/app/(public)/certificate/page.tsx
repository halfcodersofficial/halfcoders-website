import { BadgeCheck, Fingerprint, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import CertificateLookupForm from "@/components/certificate/CertificateLookupForm";
import { Eyebrow } from "@/components/site/code";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: "Verify a certificate",
    description: "Enter the certificate ID printed on a Half Coders certificate to check that it's genuine.",
    path: "/certificate",
});

const FACTS: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Fingerprint, title: "One ID per certificate", text: "Printed on every Half Coders certificate, next to “Certificate ID”." },
    { icon: ShieldCheck, title: "No sign-in needed", text: "Anyone can run a check — an employer, a university, you." },
    { icon: ShieldX, title: "Revoked means revoked", text: "A withdrawn certificate shows up as revoked, with the date." },
];

/**
 * Certificate lookup: the dark editor surface with what the check does and
 * three plain facts; beside them a pane with the ID field and a note on where
 * the ID is printed on a certificate.
 */
export default function CertificateLookupPage() {
    return (
        <section data-nav-tone="dark" className="editor relative overflow-hidden">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

            <div className="container-page relative grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-16 lg:py-20">
                <div>
                    <Eyebrow className="mb-4">Certificate check</Eyebrow>
                    <h1 className="text-h1 text-balance">Is this certificate real?</h1>
                    <p className="mt-4 max-w-lg text-lg leading-relaxed text-editor-muted">
                        Type the ID printed on a Half Coders certificate. We&apos;ll tell you who earned it, for which course, and whether it&apos;s still valid.
                    </p>
                    <ul className="mt-8 space-y-4">
                        {FACTS.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex gap-3.5">
                                <Icon className="mt-0.5 size-4.5 shrink-0 text-syn-func" aria-hidden />
                                <span>
                                    <span className="block font-semibold">{title}</span>
                                    <span className="mt-0.5 block text-sm text-editor-muted">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="overflow-hidden rounded-panel border border-editor-line bg-card text-foreground shadow-panel">
                    <p className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <BadgeCheck className="size-3.5 text-primary" aria-hidden /> Check a certificate
                    </p>
                    <div className="p-5 sm:p-6">
                        <div aria-hidden className="mb-6 rounded-md border border-border bg-surface px-4 py-3 text-sm leading-6">
                            <p className="text-xs text-muted-foreground">Where to find the ID on a certificate:</p>
                            <p className="mt-1">
                                <span className="text-muted-foreground">Certificate ID</span>{" "}
                                <span className="selected-text font-mono font-semibold text-foreground">HCC-CE-2026-000125</span>
                            </p>
                        </div>
                        <CertificateLookupForm />
                    </div>
                </div>
            </div>
        </section>
    );
}
