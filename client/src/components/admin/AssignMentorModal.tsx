"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useRetained } from "@/hooks/useRetained";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { adminService } from "@/services/admin";

const ROLE_OPTIONS = [
    { value: "CO_MENTOR", label: "Co-mentor" },
    { value: "LEAD", label: "Lead" },
    { value: "SUPPORT", label: "Support" },
];

interface AssignMentorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The mentor being assigned — `null` while the modal is closed. */
    mentorId: string | null;
}

/**
 * Assign a mentor to a course from the Mentors list, mirroring the "Mentors"
 * tab of the course editor (`admin/courses/[courseId]`) from the other
 * direction — same `assignMentor`/`removeMentor` endpoints, so the two stay
 * in sync without a separate code path.
 */
export default function AssignMentorModal({ open, onOpenChange, mentorId }: AssignMentorModalProps) {
    const shownId = useRetained(mentorId);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Assign to course"
            description="Add or remove the courses this mentor teaches."
        >
            {shownId && <AssignMentorForm mentorId={shownId} onClose={() => onOpenChange(false)} />}
        </Modal>
    );
}

function AssignMentorForm({ mentorId, onClose }: { mentorId: string; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [courseId, setCourseId] = useState("");
    const [role, setRole] = useState("CO_MENTOR");

    const invalidate = () => {
        void refreshCoursePages();
        return queryClient.invalidateQueries({ queryKey: ["admin"] });
    };

    const { data: mentor, isLoading: mentorLoading } = useQuery({
        queryKey: ["admin", "mentor", mentorId],
        queryFn: () => adminService.mentor(mentorId),
    });

    const { data: courseList, isLoading: coursesLoading } = useQuery({
        queryKey: ["admin", "courses", "all"],
        queryFn: () => adminService.courses({ limit: 100 }),
    });

    const assign = useMutation({
        mutationFn: () => adminService.assignMentor(courseId, mentorId, role),
        onSuccess: () => {
            toast.success("Mentor assigned to the course.");
            setCourseId("");
            void invalidate();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't assign that course.")),
    });

    const remove = useMutation({
        mutationFn: (removeCourseId: string) => adminService.removeMentor(removeCourseId, mentorId),
        onSuccess: () => {
            toast.success("Removed from the course.");
            void invalidate();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove that course.")),
    });

    const confirmRemove = async (course: { id: string; title: string }) => {
        if (
            await confirmAction({
                title: `Remove ${mentor?.name ?? "this mentor"} from ${course.title}?`,
                text: "They'll no longer be able to manage this course. You can assign them again at any time.",
                confirmText: "Remove",
            })
        ) {
            remove.mutate(course.id);
        }
    };

    const isLoading = mentorLoading || coursesLoading;
    const assignedIds = new Set((mentor?.mentoredCourses ?? []).map(({ course }) => course.id));
    const availableCourses = (courseList?.data ?? []).filter((course) => !assignedIds.has(course.id));

    return (
        <div className={modalFormClass}>
            <ModalBody className="space-y-6">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            <p className="text-sm font-semibold">Currently teaching</p>
                            {mentor && mentor.mentoredCourses.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                    Not assigned to any course yet.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border rounded-lg border border-border">
                                    {mentor?.mentoredCourses.map(({ course, role: courseRole }) => (
                                        <li key={course.id} className="flex items-center gap-3 px-3 py-2.5">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{course.title}</p>
                                            </div>
                                            <Badge variant="secondary">{courseRole.replace("_", " ")}</Badge>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:bg-destructive/10"
                                                aria-label={`Remove from ${course.title}`}
                                                onClick={() => void confirmRemove(course)}
                                                isLoading={remove.isPending && remove.variables === course.id}
                                            >
                                                <X />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm font-semibold">Assign a new course</p>

                            {availableCourses.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                    Already assigned to every course.
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="course-to-assign">Course</Label>
                                        <Select
                                            id="course-to-assign"
                                            value={courseId}
                                            onChange={(event) => setCourseId(event.target.value)}
                                            placeholder="Choose a course…"
                                        >
                                            {availableCourses.map((course) => (
                                                <option key={course.id} value={course.id}>
                                                    {course.title}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="mentor-role">Role</Label>
                                        <Select id="mentor-role" value={role} onChange={(event) => setRole(event.target.value)}>
                                            {ROLE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </ModalBody>

            <ModalFooter>
                {!isLoading && availableCourses.length > 0 && (
                    <Button
                        type="button"
                        className="min-w-24"
                        disabled={!courseId}
                        isLoading={assign.isPending}
                        onClick={() => assign.mutate()}
                    >
                        <UserPlus /> Assign
                    </Button>
                )}
                <Button type="button" variant="outline" className="min-w-24" onClick={onClose}>
                    Done
                </Button>
            </ModalFooter>
        </div>
    );
}
