"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { certificateService } from "@/services";
import { ProfileEmptyState } from "../ProfileEmptyState";

/**
 * Every certificate this student has earned, with a link to verify it and —
 * unless it was revoked — a PDF download. Extracted from `ProfileSettings.tsx`
 * (which still renders it for mentors/admins, though `isStudent` there is
 * always false for them, so it's effectively dead code on those roles) into
 * its own section so the new "Certification" sidebar page can use it too.
 */
export function CertificationSection() {
    const { data: certificates, isLoading } = useQuery({
        queryKey: ["certificates", "mine"],
        queryFn: () => certificateService.mine({ limit: 20 }),
    });

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-44 rounded-card" />
                <Skeleton className="h-44 rounded-card" />
            </div>
        );
    }

    if (!certificates || certificates.data.length === 0) {
        return (
            <ProfileEmptyState
                icon={Award}
                title="No certificates yet"
                description="Finish a course to earn your first certificate. It will appear here with a number anyone can verify."
                action={
                    <Button asChild variant="brand-outline" className="px-5">
                        <Link href="/dashboard">Go to my courses</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <ul className="grid gap-4 sm:grid-cols-2">
            {certificates.data.map((certificate) => {
                const revoked = certificate.status === "REVOKED";
                return (
                    <li
                        key={certificate.id}
                        className={cn(
                            "relative flex flex-col overflow-hidden rounded-card border border-border bg-card p-5 shadow-card",
                            revoked && "opacity-70",
                        )}
                    >
                        {/* A certificate's inner rule, like the printed one. */}
                        <span aria-hidden className="pointer-events-none absolute inset-2 rounded-md border border-dashed border-primary/20" />
                        <div className="relative flex items-start gap-4">
                            <span
                                className={cn(
                                    "grid size-12 shrink-0 place-items-center rounded-full text-white shadow-md",
                                    revoked ? "bg-muted-foreground" : "bg-primary",
                                )}
                            >
                                <Award className="size-6" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 font-bold leading-snug tracking-tight">{certificate.courseName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Issued {formatDate(certificate.issuedAt)}</p>
                            </div>
                            {revoked && <Badge variant="destructive">Revoked</Badge>}
                        </div>
                        <p className="relative mt-4 rounded-lg bg-secondary/60 px-3 py-2 font-mono text-xs font-semibold tracking-wide text-muted-foreground">
                            {certificate.certificateNo}
                        </p>
                        <div className="relative mt-4 flex gap-2">
                            <Button asChild size="sm" variant="outline">
                                <Link href={`/certificate/${certificate.certificateNo}`}>
                                    Verify <ExternalLink className="size-3" />
                                </Link>
                            </Button>
                            {certificate.status === "ISSUED" && (
                                <Button asChild size="sm" className="px-4">
                                    <a
                                        href={certificateService.downloadUrl(certificate.certificateNo)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Download className="size-3" /> PDF
                                    </a>
                                </Button>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
