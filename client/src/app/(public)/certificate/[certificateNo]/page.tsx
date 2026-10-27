import { ArrowLeft, Award, BadgeCheck, Download, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import CertificateLookupForm from "@/components/certificate/CertificateLookupForm";
import CopyLinkButton from "@/components/certificate/CopyLinkButton";
import { CopyButton } from "@/components/shared/FooterBits";
import { Button } from "@/components/ui/button";
import envConfig from "@/lib/envConfig";
import { cn, formatDate } from "@/lib/utils";
import type { ApiResponse } from "@/types/api.types";
import type { CertificateVerification } from "@/types/domain.types";

/**
 * Public certificate verification (plan §29). No authentication — anyone
 * holding the number can confirm it, which is the entire point.
 */
const verify = async (certificateNo: string): Promise<CertificateVerification | null> => {
    try {
        const res = await fetch(
            `${envConfig.apiBaseUrl}/certificates/verify/${encodeURIComponent(certificateNo)}`,
            { cache: "no-store" },
        );
        if (!res.ok) return null;
        const body = (await res.json()) as ApiResponse<CertificateVerification>;
        return body.data;
    } catch {
        return null;
    }
};

export async function generateMetadata(
    { params }: { params: Promise<{ certificateNo: string }> },
): Promise<Metadata> {
    const { certificateNo } = await params;
    return {
        title: `Verify certificate ${certificateNo}`,
        description: `Check the authenticity of Half Coders certificate ${certificateNo}.`,
    };
}

/**
 * The top of the page: the dark editor surface, the ID that was checked and
 * the verdict — green for valid, red for anything else.
 */
function Verdict({
    tone,
    certificateNo,
    title,
    children,
}: {
    tone: "valid" | "invalid";
    certificateNo: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <section data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
            <div className="container-page relative py-12 sm:py-16">
                <p className="truncate font-mono text-xs text-editor-muted sm:text-sm">Certificate ID: {certificateNo}</p>
                <p className={cn("mt-4 flex items-center gap-2 text-sm font-semibold", tone === "valid" ? "text-syn-string" : "text-syn-tag")}>
                    {tone === "valid" ? <BadgeCheck className="size-4" aria-hidden /> : <ShieldX className="size-4" aria-hidden />}
                    {tone === "valid" ? "Valid certificate" : "Not a valid certificate"}
                </p>
                <h1 className="mt-4 text-h1 text-balance">{title}</h1>
                <div className="mt-3 max-w-2xl text-editor-muted">{children}</div>
            </div>
        </section>
    );
}

export default async function VerifyCertificatePage(
    { params }: { params: Promise<{ certificateNo: string }> },
) {
    const { certificateNo } = await params;
    const certificate = await verify(certificateNo);

    if (!certificate) {
        return (
            <>
                <Verdict tone="invalid" certificateNo={certificateNo} title="No certificate with this ID">
                    <p>
                        Nothing matches <span className="font-mono text-editor-fg">{certificateNo}</span>. Check the ID for a typo and run it again.
                    </p>
                </Verdict>
                <div className="container-page py-12">
                    <div className="mx-auto max-w-md rounded-card border border-border bg-card p-6 sm:p-7">
                        <CertificateLookupForm initialValue={certificateNo} />
                    </div>
                    <div className="mt-6 text-center">
                        <Button asChild variant="outline">
                            <Link href="/">Back to Half Coders</Link>
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    const isValid = certificate.valid;
    const rows: { key: string; value: ReactNode; tone?: string }[] = [
        { key: "Certificate ID", value: <span className="font-mono">{certificate.certificateNo}</span> },
        { key: "Name", value: certificate.studentName },
        { key: "Course", value: certificate.courseName },
        { key: "Issued by", value: certificate.issuer },
        { key: "Completed", value: formatDate(certificate.completionDate) },
        { key: "Issued", value: formatDate(certificate.issuedAt) },
        ...(certificate.revokedAt ? [{ key: "Revoked", value: formatDate(certificate.revokedAt), tone: "text-destructive-ink" }] : []),
    ];

    return (
        <>
            <Verdict
                tone={isValid ? "valid" : "invalid"}
                certificateNo={certificate.certificateNo}
                title={isValid ? `Valid — earned by ${certificate.studentName}` : "This certificate was revoked"}
            >
                <p>{isValid ? "Issued by Half Coders and checked just now against our records." : "Half Coders no longer recognises it."}</p>
            </Verdict>

            <div className="container-page py-12">
                <div className="mx-auto max-w-3xl">
                    <article className="overflow-hidden rounded-card border border-border bg-card">
                        <p className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold">
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <Award className="size-3.5 text-primary" aria-hidden /> Certificate details
                            </span>
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <CopyButton value={certificate.certificateNo} label="Copy certificate ID" />
                            </span>
                        </p>
                        <dl className="divide-y divide-border">
                            {rows.map((row) => (
                                <div key={row.key} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                                    <dt className="text-sm text-muted-foreground">{row.key}</dt>
                                    <dd className={cn("min-w-0 break-words font-semibold", row.tone ?? "text-foreground")}>{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className={cn("border-t border-border px-5 py-3 text-sm font-semibold", isValid ? "text-success-ink" : "text-destructive-ink")}>
                            {isValid ? "✓ Verified by Half Coders" : "✗ Revoked — not a valid Half Coders certificate"}
                        </p>
                    </article>

                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        {isValid && (
                            <>
                                {/* A plain link, not a fetch: the browser opens the PDF in its
                                    own viewer and keeps the filename. */}
                                <Button asChild size="lg" variant="brand">
                                    <a
                                        href={`${envConfig.apiBaseUrl}/certificates/download/${encodeURIComponent(certificate.certificateNo)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Download className="size-4" /> Download PDF
                                    </a>
                                </Button>
                                <CopyLinkButton />
                            </>
                        )}
                        <Button asChild variant="ghost" size="lg">
                            <Link href="/certificate">
                                <ArrowLeft className="size-4" /> Check another
                            </Link>
                        </Button>
                    </div>

                    <p className="mt-8 text-center text-sm text-muted-foreground">
                        Want one with your name on it?{" "}
                        <Link href="/courses" className="font-medium text-primary hover:underline">
                            See Half Coders courses
                        </Link>
                    </p>
                </div>
            </div>
        </>
    );
}
