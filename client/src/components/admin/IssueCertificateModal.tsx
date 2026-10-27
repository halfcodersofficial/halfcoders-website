"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import EntityPicker from "@/components/admin/EntityPicker";
import { type PickerOption, searchStudents } from "@/components/admin/pickers";
import { StatusPill } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { adminService } from "@/services/admin";

interface IssueCertificateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Issue a certificate by hand: find the student, tick the course, go. The
 * old form asked for an enrolment ID copied from another screen — the one
 * flow in the console that needed a second tab open.
 */
export default function IssueCertificateModal({ open, onOpenChange }: IssueCertificateModalProps) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            title="Issue a certificate"
            description="For a student who earned it another way — an offline assessment, a migrated cohort. This skips the usual eligibility check."
        >
            <IssueForm onClose={() => onOpenChange(false)} />
        </Modal>
    );
}

function IssueForm({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [student, setStudent] = useState<PickerOption | null>(null);
    const [enrollmentId, setEnrollmentId] = useState("");
    const [reason, setReason] = useState("");
    const [attempted, setAttempted] = useState(false);

    const detail = useQuery({
        queryKey: ["admin", "student", student?.id],
        queryFn: () => adminService.student(student!.id),
        enabled: student !== null,
    });

    const issue = useMutation({
        mutationFn: () =>
            adminService.issueCertificate(enrollmentId, reason.trim() || "Issued manually by admin."),
        onSuccess: () => {
            toast.success("Certificate issued — the student has been notified.");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't issue that certificate.")),
    });

    const enrollments = detail.data?.enrollments ?? [];
    const eligible = enrollments.filter((enrollment) => enrollment.certificate === null);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAttempted(true);
        if (!student || !enrollmentId) return;
        issue.mutate();
    };

    return (
        <form className={modalFormClass} noValidate onSubmit={submit}>
            <ModalBody className="space-y-5">
                <EntityPicker
                    label="Student"
                    required
                    avatar
                    autoFocus
                    placeholder="Search by name, email or phone…"
                    value={student}
                    onChange={(next) => {
                        setStudent(next);
                        setEnrollmentId("");
                    }}
                    search={searchStudents}
                    queryKey="students"
                    emptyText="No active students match that."
                    error={attempted && !student ? "Pick a student" : undefined}
                />

                {student && (
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm font-medium">
                            Course
                            <span className="ml-0.5 text-destructive" aria-hidden>
                                *
                            </span>
                        </legend>

                        {detail.isLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-16" />
                                <Skeleton className="h-16" />
                            </div>
                        ) : enrollments.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                {student.label} isn&apos;t enrolled in any course. Enrol them first, from the
                                Enrolments screen.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {enrollments.map((enrollment) => {
                                    const issued = enrollment.certificate !== null;
                                    const checked = enrollmentId === enrollment.id;

                                    return (
                                        <label
                                            key={enrollment.id}
                                            className={cn(
                                                "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                                                issued
                                                    ? "cursor-not-allowed opacity-60"
                                                    : "cursor-pointer",
                                                checked
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border",
                                                !issued && !checked && "hover:border-primary/40",
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="enrollment"
                                                value={enrollment.id}
                                                checked={checked}
                                                disabled={issued}
                                                onChange={() => setEnrollmentId(enrollment.id)}
                                                className="mt-0.5 size-4 shrink-0 accent-primary"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">{enrollment.course.title}</span>
                                                    <StatusPill kind="enrollment" value={enrollment.status} />
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {enrollment.progress}% complete · enrolled{" "}
                                                    {formatDate(enrollment.createdAt)}
                                                    {issued && ` · already holds ${enrollment.certificate?.certificateNo}`}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {attempted && !enrollmentId && eligible.length > 0 && (
                            <FieldError>Choose the course the certificate is for</FieldError>
                        )}
                    </fieldset>
                )}

                <div className="space-y-1.5">
                    <Label htmlFor="issue-reason">
                        Reason <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        id="issue-reason"
                        rows={2}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={500}
                        placeholder="Passed the offline assessment on 12 March."
                    />
                    <p className="text-xs text-muted-foreground">Kept in the audit log; the student doesn&apos;t see it.</p>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={issue.isPending} disabled={student !== null && eligible.length === 0}>
                    <Award /> Issue certificate
                </Button>
            </ModalFooter>
        </form>
    );
}
