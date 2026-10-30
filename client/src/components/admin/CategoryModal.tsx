"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { numericField, optionalTextField, textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminCategory } from "@/types/admin.types";

const schema = z.object({
    title: textField({ label: "Name", min: 2, max: 80 }),
    order: numericField({ label: "Sort order", min: 0, max: 1000 }),
    description: optionalTextField({ label: "Description", max: 500 }),
});

type Values = { title: string; order: string; description: string };

const EMPTY: Values = { title: "", order: "0", description: "" };

interface CategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Set to edit that category; leave null to create one. */
    category?: AdminCategory | null;
}

/**
 * Create or edit a category. The list already holds the whole record, so
 * editing needs no fetch of its own. Renaming regenerates the slug on the
 * server, which moves the category's public URL.
 */
export default function CategoryModal({ open, onOpenChange, category = null }: CategoryModalProps) {
    const close = () => onOpenChange(false);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            title={category ? "Edit category" : "New category"}
            description={
                category
                    ? "Renaming also changes the category's link, so old links to it stop working."
                    : "Shown on the homepage and in the catalogue filters once it has courses."
            }
        >
            {category ? (
                <EditCategoryForm category={category} onClose={close} />
            ) : (
                <CreateCategoryForm onClose={close} />
            )}
        </Modal>
    );
}

const useRefreshCategories = () => {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
        void queryClient.invalidateQueries({ queryKey: ["categories"] });
    };
};

function CreateCategoryForm({ onClose }: { onClose: () => void }) {
    const refresh = useRefreshCategories();

    const create = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.createCategory({
                title: values.title,
                description: values.description || undefined,
                order: Number(values.order),
            }),
        onSuccess: () => {
            toast.success("Category added.");
            refresh();
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add that category.")),
    });

    const form = useZodForm({
        schema,
        initialValues: EMPTY,
        onSubmit: (values) => create.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <RequiredLegend />
                <CategoryFields form={form} autoFocus />
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={create.isPending}>
                    <Plus /> Add category
                </Button>
            </ModalFooter>
        </form>
    );
}

function EditCategoryForm({ category, onClose }: { category: AdminCategory; onClose: () => void }) {
    const refresh = useRefreshCategories();

    const save = useMutation({
        // Description goes as-is: an emptied field has to reach the server as
        // "" to clear it — `undefined` would leave the old text in place.
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.updateCategory(category.id, {
                title: values.title,
                description: values.description,
                order: Number(values.order),
            }),
        onSuccess: () => {
            toast.success("Category saved.");
            refresh();
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save that category.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            title: category.title,
            order: String(category.order),
            description: category.description ?? "",
        },
        onSubmit: (values) => save.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Link</span> /{category.slug}
                    <span className="text-muted-foreground">
                        {" "}· {category._count.courses} {category._count.courses === 1 ? "course" : "courses"}
                    </span>
                </div>

                <RequiredLegend />
                <CategoryFields form={form} />
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending} disabled={!form.isDirty}>
                    <Save /> Save changes
                </Button>
            </ModalFooter>
        </form>
    );
}

function CategoryFields({ form, autoFocus }: { form: ZodFormApi<Values>; autoFocus?: boolean }) {
    return (
        <>
            <FormField form={form} name="title" label="Name" required counterMax={80}>
                <Input placeholder="Web Development" autoComplete="off" autoFocus={autoFocus} />
            </FormField>

            <FormField
                form={form}
                name="order"
                label="Sort order"
                required
                hint="Lower numbers appear first on the homepage."
            >
                <Input type="number" inputMode="numeric" min={0} max={1000} />
            </FormField>

            <FormField form={form} name="description" label="Description" optional counterMax={500}>
                <Input placeholder="Front-end, back-end and full-stack programmes" />
            </FormField>
        </>
    );
}
