"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Award, BookOpenCheck, ExternalLink, GraduationCap, Mail, MapPin, Phone, ReceiptText, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import ProgressRing from "@/components/shared/ProgressRing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { useRetained } from "@/hooks/useRetained";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import type { AdminEnrollment } from "@/types/admin.types";
import { useEnrollmentActions } from "./useEnrollmentActions";

type Step = { title: string; detail?: ReactNode; at?: string | null; tone: "done" | "current" | "bad" | "muted" };

/** How the enrolment got to where it is, oldest first. */
function enrollmentSteps(enrollment: AdminEnrollment): Step[] {
    const steps: Step[] = [
        {
            title: "Enrolled",
            detail: enrollment.order ? `Paid order ${enrollment.order.orderNumber}` : "Enrolled by an admin",
            at: enrollment.startedAt,
            tone: "done",
        },
    ];

    if (enrollment.status === "COMPLETED") {
        steps.push({ title: "Completed the course", at: enrollment.completedAt, tone: "done" });
    }
    // Issued on completion, or by hand at any point after enrolling.
    if (enrollment.certificate) {
        steps.push({
            title: enrollment.certificate.status === "REVOKED" ? "Certificate revoked" : "Certificate issued",
            detail: enrollment.certificate.certificateNo,
            at: enrollment.certificate.issuedAt,
            tone: enrollment.certificate.status === "REVOKED" ? "bad" : "done",
        });
    }

    switch (enrollment.status) {
        case "ACTIVE":
            steps.push({ title: "Learning", detail: `${enrollment.progress}% through the course`, tone: "current" });
            if (enrollment.expiresAt) steps.push({ title: "Access ends", at: enrollment.expiresAt, tone: "muted" });
            break;
        case "CANCELLED":
            steps.push({ title: "Access removed", detail: "Progress is kept.", at: enrollment.updatedAt, tone: "bad" });
            break;
        case "EXPIRED":
            steps.push({ title: "Access expired", at: enrollment.expiresAt, tone: "muted" });
            break;
    }
    return steps;
}

const STEP_DOT: Record<Step["tone"], string> = {
    done: "bg-success ring-success/20",
    current: "bg-primary ring-primary/20",
    bad: "bg-destructive ring-destructive/20",
    muted: "bg-muted-foreground/60 ring-muted-foreground/15",
};

function Timeline({ enrollment }: { enrollment: AdminEnrollment }) {
    const steps = enrollmentSteps(enrollment);
    return (
        <ol className="relative space-y-4">
            {steps.map((step, index) => (
                <li key={step.title} className="relative flex gap-3 pl-0.5">
                    {index < steps.length - 1 && (
                        <span aria-hidden className="absolute left-[0.4375rem] top-4 h-[calc(100%+0.25rem)] w-px bg-border" />
                    )}
                    <span className={cn("relative mt-1 size-3 shrink-0 rounded-full ring-4", STEP_DOT[step.tone])}>
                        {step.tone === "current" && (
                            <span className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{step.title}</p>
                        {step.at && (
                            <time className="block text-xs text-muted-foreground" dateTime={step.at}>
                                {formatDateTime(step.at)}
                            </time>
                        )}
                        {step.detail && <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>}
                    </div>
                </li>
            ))}
        </ol>
    );
}

function Section({ title, icon: Icon, children, action }: { title: string; icon: typeof Mail; children: ReactNode; action?: ReactNode }) {
    return (
        <section className="rounded-card border border-border">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 bg-surface">
                <h3 className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                    <Icon className="size-3.5" /> {title}
                </h3>
                {action}
            </header>
            <div className="p-4">{children}</div>
        </section>
    );
}

/** "Milestone 2 · Module 5 — Pointers", in the course's own words for them; null before they've started. */
export const whereTheyAre = (enrollment: AdminEnrollment) => {
    const current = enrollment.currentModule;
    const milestone = enrollment.currentMilestone;
    const { milestoneLabel, moduleLabel } = enrollment.course;
    if (!current && !milestone) return null;
    return [
        milestone && `${milestoneLabel} ${milestone.order}`,
        current && `${moduleLabel} ${current.order} — ${current.title}`,
    ]
        .filter(Boolean)
        .join(" · ");
};

function EnrollmentDetail({ enrollment, onIssue, isIssuing }: { enrollment: AdminEnrollment; onIssue: () => void; isIssuing: boolean }) {
    const position = whereTheyAre(enrollment);
    const hasAccess = enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED";

    return (
        <ModalBody className="space-y-4">
            {/* How far they are, and where. */}
            <div className="flex flex-wrap items-center gap-5 rounded-card border border-border bg-secondary/30 p-4">
                <ProgressRing value={enrollment.progress} size={84} stroke={7} fillIn>
                    <span className="text-lg font-bold tabular-nums">{enrollment.progress}%</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill kind="enrollment" value={enrollment.status} />
                        {enrollment.certificate?.status === "ISSUED" && (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                                <Award className="size-3" /> Certified
                            </span>
                        )}
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-semibold">{enrollment.course.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{position ?? "Hasn't started a lesson yet"}</span>
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Timeline" icon={BookOpenCheck}>
                    <Timeline enrollment={enrollment} />
                </Section>

                <Section
                    title="Student"
                    icon={GraduationCap}
                    action={
                        <Link
                            href={`/admin/students/${enrollment.student.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                            Open <ExternalLink className="size-3" />
                        </Link>
                    }
                >
                    <div className="flex items-center gap-3">
                        <Avatar src={enrollment.student.image} name={enrollment.student.name} size={44} />
                        <p className="min-w-0 truncate font-semibold">{enrollment.student.name}</p>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                        <li className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <a href={`mailto:${enrollment.student.email}`} className="truncate hover:text-foreground hover:underline">
                                {enrollment.student.email}
                            </a>
                        </li>
                        {enrollment.student.phone && (
                            <li className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="size-3.5 shrink-0" />
                                <a href={`tel:${enrollment.student.phone}`} className="tabular-nums hover:text-foreground hover:underline">
                                    {enrollment.student.phone}
                                </a>
                            </li>
                        )}
                    </ul>
                </Section>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="How they got in" icon={ReceiptText}>
                    {enrollment.order ? (
                        <>
                            <p className="flex items-baseline justify-between gap-3">
                                <span className="font-mono text-xs font-medium">{enrollment.order.orderNumber}</span>
                                <span className="font-bold tabular-nums">{formatBDT(enrollment.order.total)}</span>
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <StatusPill kind="order" value={enrollment.order.status} />
                                <Link
                                    href={`/admin/orders/${enrollment.course.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                    Payments <ExternalLink className="size-3" />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Enrolled by an admin, so there&apos;s no order.</p>
                    )}
                </Section>

                <Section title="Certificate" icon={Award}>
                    {enrollment.certificate ? (
                        <>
                            <p className="flex items-center justify-between gap-3">
                                <span className="font-mono text-xs font-medium">{enrollment.certificate.certificateNo}</span>
                                <StatusPill kind="certificate" value={enrollment.certificate.status} />
                            </p>
                            <p className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                Issued {formatDistanceToNowStrict(new Date(enrollment.certificate.issuedAt), { addSuffix: true })}
                                <Link
                                    href={`/certificate/${enrollment.certificate.certificateNo}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                                >
                                    Verify page <ExternalLink className="size-3" />
                                </Link>
                            </p>
                        </>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-muted-foreground">Not issued yet.</p>
                            {hasAccess && (
                                <Button size="sm" variant="outline" isLoading={isIssuing} onClick={onIssue}>
                                    <Award /> Issue
                                </Button>
                            )}
                        </div>
                    )}
                </Section>
            </div>
        </ModalBody>
    );
}

/**
 * One student's enrolment in full: how far they are and where, how they got
 * in, their certificate, and the timeline. Removing access confirms first;
 * restoring it is one click, since nothing is lost either way.
 */
export function EnrollmentDetailModal({ enrollment, onClose }: { enrollment: AdminEnrollment | null; onClose: () => void }) {
    const shown = useRetained(enrollment);
    const actions = useEnrollmentActions({ onDone: onClose });
    const hasAccess = shown?.status === "ACTIVE" || shown?.status === "COMPLETED";

    return (
        <Modal open={enrollment !== null} onOpenChange={(open) => !open && onClose()} size="lg">
            {shown && (
                <>
                    <ModalHeader>
                        <ModalTitle>{shown.student.name}</ModalTitle>
                        <ModalDescription>Enrolled {formatDateTime(shown.startedAt)}</ModalDescription>
                    </ModalHeader>

                    <EnrollmentDetail enrollment={shown} onIssue={() => actions.issue(shown)} isIssuing={actions.isIssuing} />

                    <ModalFooter>
                        {hasAccess && (
                            <Button
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                                isLoading={actions.isRemoving}
                                onClick={() => actions.remove(shown)}
                            >
                                <XCircle /> Remove access
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose}>
                            Close
                        </Button>
                        {!hasAccess && shown.status === "CANCELLED" && (
                            <Button isLoading={actions.isRestoring} onClick={() => actions.restore(shown)}>
                                <RotateCcw /> Restore access
                            </Button>
                        )}
                    </ModalFooter>
                </>
            )}
        </Modal>
    );
}
