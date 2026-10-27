"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";

/**
 * The gate in front of the pre-enrolment curriculum PDF (plan: "two separate
 * curriculum systems" — this covers case A, the guest). A guest who clicks
 * "Curriculum" sees this instead of the file: the backend never hands the PDF
 * to an unauthenticated request either, so this modal is guidance, not the
 * only thing standing between a guest and the download.
 */
export default function CurriculumAuthModal({
    open,
    onOpenChange,
    next,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where `?next=` should send them back to once they're signed in. */
    next: string;
}) {
    const nextParam = encodeURIComponent(next);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title="Sign in required"
            description="Sign in — or create an account for free — to access the full course roadmap."
        >
            <ModalBody>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-5" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold leading-snug">Create an account to download the curriculum</p>
                </div>
            </ModalBody>
            <ModalFooter>
                <Link
                    href={`/login?next=${nextParam}`}
                    className={buttonVariants({ variant: "outline" })}
                    onClick={() => onOpenChange(false)}
                >
                    Sign In
                </Link>
                <Link href={`/register?next=${nextParam}`} className={buttonVariants()} onClick={() => onOpenChange(false)}>
                    Create Account
                </Link>
            </ModalFooter>
        </Modal>
    );
}
