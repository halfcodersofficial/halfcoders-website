"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";
import type { AdminEnrollment } from "@/types/admin.types";

/**
 * Removing and restoring access, and issuing a certificate by hand — each
 * behind its confirmation. Shared by the student rows and the enrolment detail.
 */
export function useEnrollmentActions({ onDone }: { onDone?: () => void } = {}) {
    const queryClient = useQueryClient();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => adminService.cancelEnrollment(id),
        onSuccess: () => {
            toast.success("Access removed. Their progress is kept.");
            refresh();
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't cancel that enrolment.")),
    });

    const reactivateMutation = useMutation({
        mutationFn: (id: string) => adminService.reactivateEnrollment(id),
        onSuccess: () => {
            toast.success("Access restored.");
            refresh();
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't reactivate that enrolment.")),
    });

    const issueMutation = useMutation({
        mutationFn: (id: string) => adminService.issueCertificate(id, "Issued manually by admin."),
        onSuccess: () => {
            toast.success("Certificate issued — the student has been notified.");
            refresh();
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't issue that certificate.")),
    });

    return {
        remove: async (enrollment: AdminEnrollment) => {
            if (
                await confirmAction({
                    title: `Remove ${enrollment.student.name}'s access?`,
                    text: `They can no longer open "${enrollment.course.title}". Progress is kept and access can be restored later.`,
                    confirmText: "Remove access",
                })
            ) {
                cancelMutation.mutate(enrollment.id);
            }
        },
        restore: (enrollment: AdminEnrollment) => reactivateMutation.mutate(enrollment.id),
        issue: async (enrollment: AdminEnrollment) => {
            if (
                await confirmAction({
                    title: `Issue a certificate to ${enrollment.student.name}?`,
                    text: `For "${enrollment.course.title}". This skips the eligibility check and notifies the student.`,
                    confirmText: "Issue certificate",
                    tone: "default",
                })
            ) {
                issueMutation.mutate(enrollment.id);
            }
        },
        isRemoving: cancelMutation.isPending,
        isRestoring: reactivateMutation.isPending,
        isIssuing: issueMutation.isPending,
    };
}
