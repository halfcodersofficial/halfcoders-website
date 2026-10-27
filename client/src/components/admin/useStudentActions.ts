"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmAction, infoAlert } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";

interface StudentRef {
    id: string;
    name: string;
}

/**
 * Block, reactivate and password reset for a student, with their
 * confirmations — shared by the Students register and a student's detail
 * page so both ask and answer the same way.
 */
export function useStudentActions() {
    const queryClient = useQueryClient();

    const setStatus = useMutation({
        mutationFn: ({ userId, next }: { userId: string; next: string }) => adminService.setUserStatus(userId, next),
        onSuccess: (_result, { next }) => {
            toast.success(next === "BLOCKED" ? "Student blocked — they can no longer sign in." : "Student reactivated.");
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

    const block = async (student: StudentRef) => {
        if (
            await confirmAction({
                title: `Block ${student.name}?`,
                text: "They won't be able to sign in until reactivated. Their progress is kept.",
                confirmText: "Block student",
            })
        ) {
            setStatus.mutate({ userId: student.id, next: "BLOCKED" });
        }
    };

    const reactivate = (student: StudentRef) => setStatus.mutate({ userId: student.id, next: "ACTIVE" });

    const resetPassword = async (student: StudentRef) => {
        if (
            await confirmAction({
                title: `Send ${student.name} a password reset link?`,
                text: "We'll email them a code to choose a new password. You won't see or set the password.",
                confirmText: "Send reset link",
            })
        ) {
            sendReset.mutate(student.id);
        }
    };

    return {
        block,
        reactivate,
        resetPassword,
        isChangingStatus: (studentId: string) => setStatus.isPending && setStatus.variables?.userId === studentId,
        isResetting: (studentId: string) => sendReset.isPending && sendReset.variables === studentId,
    };
}
