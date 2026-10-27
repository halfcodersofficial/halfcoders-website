import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminUser } from "@/types/admin.types";

/** One row in an `EntityPicker` list. */
export interface PickerOption {
    id: string;
    label: string;
    /** The second line — an email, a price. What tells two similar rows apart. */
    hint?: string;
    image?: string | null;
}

export const studentOption = (
    student: Pick<AdminUser, "id" | "name" | "email" | "image">,
): PickerOption => ({
    id: student.id,
    label: student.name,
    hint: student.email,
    image: student.image,
});

/** Active students, by name, email or phone. Blocked accounts are left out — nothing here should be done to one. */
export const searchStudents = async (term: string): Promise<PickerOption[]> => {
    const { data } = await adminService.students({
        searchTerm: term || undefined,
        status: "ACTIVE",
        limit: 8,
    });
    return data.map(studentOption);
};

const STATUS_HINT = { PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived" } as const;

/** Every course, whatever its status — a testimonial can belong to a batch that has since been archived. */
export const searchCourses = async (term: string): Promise<PickerOption[]> => {
    const { data } = await adminService.courses({ searchTerm: term || undefined, limit: 8 });
    return data.map((course) => ({
        id: course.id,
        label: course.title,
        hint: `${STATUS_HINT[course.status]} · ${course._count.enrollments} enrolled`,
        image: course.thumbnail,
    }));
};

/** Published courses only — the API refuses to enrol anyone on a draft. */
export const searchPublishedCourses = async (term: string): Promise<PickerOption[]> => {
    const { data } = await adminService.courses({
        searchTerm: term || undefined,
        status: "PUBLISHED",
        limit: 8,
    });
    return data.map((course) => ({
        id: course.id,
        label: course.title,
        hint: `${formatBDT(course.discountPrice ?? course.price)} · ${course._count.enrollments} enrolled`,
    }));
};
