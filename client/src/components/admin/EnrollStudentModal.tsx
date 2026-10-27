"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import EntityPicker from "@/components/admin/EntityPicker";
import { type PickerOption, searchPublishedCourses, searchStudents } from "@/components/admin/pickers";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";

interface EnrollStudentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Pre-filled when opened from a student's own detail view. */
    initialStudent?: PickerOption | null;
    /** Pre-filled when opened from one course's enrolments. */
    initialCourse?: PickerOption | null;
}

/**
 * Manual enrolment: pick a student, pick a published course, done. The API
 * had this endpoint all along; the console never exposed it, so the only way
 * to give someone access was to create an order and settle it by hand.
 */
export default function EnrollStudentModal({
    open,
    onOpenChange,
    initialStudent = null,
    initialCourse = null,
}: EnrollStudentModalProps) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            title="Enrol a student"
            description="Gives access straight away, with no order. Use it for offline payments, scholarships or a migrated cohort."
        >
            <EnrollForm initialStudent={initialStudent} initialCourse={initialCourse} onClose={() => onOpenChange(false)} />
        </Modal>
    );
}

function EnrollForm({
    initialStudent,
    initialCourse,
    onClose,
}: {
    initialStudent: PickerOption | null;
    initialCourse: PickerOption | null;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [student, setStudent] = useState<PickerOption | null>(initialStudent);
    const [course, setCourse] = useState<PickerOption | null>(initialCourse);
    const [attempted, setAttempted] = useState(false);

    const enrol = useMutation({
        mutationFn: () => adminService.enrollManually(student!.id, course!.id),
        onSuccess: () => {
            toast.success(`${student?.label} now has access to "${course?.label}".`);
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't enrol that student.")),
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAttempted(true);
        if (!student || !course) return;
        enrol.mutate();
    };

    return (
        <form className={modalFormClass} noValidate onSubmit={submit}>
            <ModalBody className="space-y-5">
                <EntityPicker
                    label="Student"
                    required
                    avatar
                    autoFocus={initialStudent === null}
                    placeholder="Search by name, email or phone…"
                    value={student}
                    onChange={setStudent}
                    search={searchStudents}
                    queryKey="students"
                    emptyText="No active students match that."
                    error={attempted && !student ? "Pick a student" : undefined}
                />

                <EntityPicker
                    label="Course"
                    required
                    autoFocus={initialStudent !== null && initialCourse === null}
                    placeholder="Search published courses…"
                    value={course}
                    onChange={setCourse}
                    search={searchPublishedCourses}
                    queryKey="published-courses"
                    emptyText="No published courses match that."
                    hint="Only published courses can be assigned."
                    error={attempted && !course ? "Pick a course" : undefined}
                />
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={enrol.isPending}>
                    <UserPlus /> Enrol student
                </Button>
            </ModalFooter>
        </form>
    );
}
