"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmAction, infoAlert } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";

interface MentorRef {
    id: string;
    name: string;
}

/**
 * Block, reactivate and password reset for a mentor, with their confirmations
 * — shared by the Mentors list and a mentor's detail page so both ask and
 * answer the same way.
 */
export function useMentorActions() {
    const queryClient = useQueryClient();

    const setStatus = useMutation({
        mutationFn: ({ userId, next }: { userId: string; next: string }) => adminService.setUserStatus(userId, next),
        onSuccess: (_result, { next }) => {
            toast.success(next === "BLOCKED" ? "Mentor blocked — they can no longer sign in." : "Mentor reactivated.");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that account.")),
    });

    const sendReset = useMutation({
        mutationFn: (userId: string) => adminService.resetUserPassword(userId),
        onSuccess: (result) => {
            void infoAlert({
                title: "Reset link sent",
                text: `A link to choose a new password has been emailed to ${result.sentTo}. It works once and expires in 24 hours. Their current password keeps working until they use it.`,
            });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send a password reset link.")),
    });

    const block = async (mentor: MentorRef) => {
        if (
            await confirmAction({
                title: `Block ${mentor.name}?`,
                text: "They lose access to the mentor console. Their courses stay assigned to them.",
                confirmText: "Block mentor",
            })
        ) {
            setStatus.mutate({ userId: mentor.id, next: "BLOCKED" });
        }
    };

    const reactivate = (mentor: MentorRef) => setStatus.mutate({ userId: mentor.id, next: "ACTIVE" });

    const resetPassword = async (mentor: MentorRef) => {
        if (
            await confirmAction({
                title: `Send ${mentor.name} a password reset link?`,
                text: "We'll email them a code to choose a new password. You won't see or set the password.",
                confirmText: "Send reset link",
            })
        ) {
            sendReset.mutate(mentor.id);
        }
    };

    return {
        block,
        reactivate,
        resetPassword,
        isChangingStatus: (mentorId: string) => setStatus.isPending && setStatus.variables?.userId === mentorId,
        isResetting: (mentorId: string) => sendReset.isPending && sendReset.variables === mentorId,
    };
}
