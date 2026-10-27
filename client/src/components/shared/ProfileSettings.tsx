"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { ProfilePhotoField } from "@/components/profile/ProfilePhotoField";
import StaffPass from "@/components/profile/StaffPass";
import DevicesLink from "@/components/shared/DevicesLink";
import InstructorCard from "@/components/shared/InstructorCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { cn, formatDate } from "@/lib/utils";
import { certificateService } from "@/services";

/** Load-in for the sections beside the pass; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

function Section({
    title,
    description,
    className,
    children,
}: {
    title: string;
    description?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn(RISE, "space-y-4", className)}>
            <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            {children}
        </section>
    );
}

/**
 * Account details — every role's own copy of "who am I signed in as". Each
 * role reaches this through its own route (`/mentor/profile`,
 * `/admin/profile`, …) so the console it renders inside always matches the
 * signed-in account, but the settings themselves are identical, so they live
 * here once.
 *
 * The signed-in person as a staff pass, and beside it: their photo, a
 * mentor's instructor card exactly as students see it on course pages, and
 * the sign-in details, and their password, changed here.
 */
export default function ProfileSettings() {
    // The layout admits any signed-in account and redirects the rest, so this
    // component only has to care which kind of account it is looking at.
    const { user, isLoading, isStudent } = useSession();
    // Certificates are earned by finishing a course, so only a student has any
    // — asking on a mentor's or admin's behalf just collects a 403.
    const { data: certificates } = useQuery({
        queryKey: ["certificates", "mine"],
        queryFn: () => certificateService.mine({ limit: 20 }),
        enabled: isStudent,
    });

    if (isLoading || !user) {
        return (
            <div className="grid gap-10 lg:grid-cols-[20rem_1fr]">
                <Skeleton className="h-120 rounded-panel" />
                <div className="space-y-6">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-48 rounded-card" />
                    <Skeleton className="h-40 rounded-card" />
                </div>
            </div>
        );
    }

    return (
        <div className="grid items-start gap-10 lg:grid-cols-[20rem_1fr] lg:gap-12">
            <div className="lg:sticky lg:top-6">
                <StaffPass user={user} />
            </div>

            <div className="min-w-0 space-y-10 lg:pt-8">
                <Section
                    title="Profile photo"
                    description={
                        user.mentorProfile
                            ? "Shown on your account and on every course you teach."
                            : "Shown on your account and wherever your name appears."
                    }
                >
                    <div className="max-w-md rounded-card border border-border bg-card p-5">
                        <ProfilePhotoField src={user.image} name={user.name} />
                    </div>
                </Section>

                {user.mentorProfile && (
                    <Section
                        title="How students see you"
                        description="This is your card on every course you teach. Your designation, experience, expertise and bio are kept up to date by a Half Coders admin — ask them for any change."
                        className="delay-150"
                    >
                        <InstructorCard
                            mentor={{
                                id: user.id,
                                name: user.name,
                                image: user.image,
                                bio: user.bio,
                                mentorProfile: user.mentorProfile,
                            }}
                        />
                    </Section>
                )}

                {isStudent && (
                    <Section title="My certificates" className="delay-150">
                        {!certificates || certificates.data.length === 0 ? (
                            <p className="flex items-center gap-2 rounded-card border border-dashed border-border p-5 text-sm text-muted-foreground">
                                <Award className="size-4" aria-hidden />
                                Finish a course to earn your first certificate.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border rounded-card border border-border bg-card">
                                {certificates.data.map((certificate) => (
                                    <li
                                        key={certificate.id}
                                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{certificate.courseName}</p>
                                            <p className="font-mono text-xs text-muted-foreground">
                                                {certificate.certificateNo} · {formatDate(certificate.issuedAt)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {certificate.status === "REVOKED" && (
                                                <Badge variant="destructive">Revoked</Badge>
                                            )}
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/certificate/${certificate.certificateNo}`}>
                                                    View <ExternalLink className="size-3" />
                                                </Link>
                                            </Button>
                                            {certificate.status === "ISSUED" && (
                                                <Button asChild size="sm">
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
                                ))}
                            </ul>
                        )}
                    </Section>
                )}

                <Section
                    title="Sign-in & security"
                    description="Where you're signed in, and your password. Changing it signs your other devices out."
                    className="delay-300"
                >
                    <div className="max-w-md space-y-4">
                        <DevicesLink />
                        <div className="rounded-card border border-border bg-card p-5">
                            <ChangePasswordForm />
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}
