"use client";

import { useMutation } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { pricingChoices } from "@/components/shared/CourseClassification";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { useZodForm } from "@/hooks/useZodForm";
import { COURSE_PRICINGS } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { discountPercent, formatBDT } from "@/lib/utils";
import { numericField, optionalNumericField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminCourse } from "@/types/admin.types";

const MAX_PRICE = 10_000_000;

const schema = z
    .object({
        pricing: z.enum(COURSE_PRICINGS, "Choose free or paid"),
        price: z.string(),
        discountPrice: z.string(),
    })
    // The same rules as the course editor's Pricing page — and the API's.
    .superRefine((data, ctx) => {
        if (data.pricing !== "PAID") return;
        const issue = (path: "price" | "discountPrice", message: string) => ctx.addIssue({ code: "custom", path: [path], message });
        numericField({ label: "Price", min: 1, max: MAX_PRICE })
            .safeParse(data.price)
            .error?.issues.forEach((problem) => issue("price", problem.message));
        optionalNumericField({ label: "Discounted price", min: 0, max: MAX_PRICE })
            .safeParse(data.discountPrice)
            .error?.issues.forEach((problem) => issue("discountPrice", problem.message));
        if (data.discountPrice === "") return;
        if (Number(data.discountPrice) >= Number(data.price)) {
            issue("discountPrice", "Discounted price must be lower than the regular price");
        } else if (Number(data.discountPrice) === 0) {
            issue("discountPrice", "A paid course can't be discounted to ৳0 — mark it free instead");
        }
    });

/**
 * Free or paid, the price and its discount — straight from the courses list,
 * without opening the editor. Only the price changes: the course's status,
 * delivery and online/offline stay as they are. Saved, it's live at once on
 * the course card, its page, checkout and any bundle it's in.
 */
export default function CoursePriceDialog({
    course,
    onOpenChange,
    onSaved,
}: {
    course: AdminCourse | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    return (
        <Modal
            open={course !== null}
            onOpenChange={onOpenChange}
            title="Price"
            description={course ? course.title : undefined}
            closeOnOutsideClick={false}
        >
            {course && <PriceForm key={course.id} course={course} onDone={onSaved} onCancel={() => onOpenChange(false)} />}
        </Modal>
    );
}

function PriceForm({ course, onDone, onCancel }: { course: AdminCourse; onDone: () => void; onCancel: () => void }) {
    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.updateCourse(
                course.id,
                values.pricing === "FREE"
                    ? { pricing: "FREE" }
                    : {
                          pricing: "PAID",
                          price: Number(values.price),
                          // `null` takes a discount off; leaving it out would keep the old one.
                          discountPrice: values.discountPrice === "" ? null : Number(values.discountPrice),
                      },
            ),
        onSuccess: (_result, values) => {
            toast.success(values.pricing === "FREE" ? "The course is free now." : "Price saved — it's live everywhere.");
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change the price.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            pricing: (course.pricing ?? "") as (typeof COURSE_PRICINGS)[number] | "",
            price: course.pricing === "PAID" ? String(course.price) : "",
            discountPrice: course.pricing === "PAID" && course.discountPrice !== null ? String(course.discountPrice) : "",
        },
        onSubmit: (values) => save.mutate(values),
    });

    const { pricing, price, discountPrice } = form.values;
    const regular = Number(price) || 0;
    const sale = discountPrice === "" ? null : Number(discountPrice);
    const pays = sale !== null && sale > 0 && sale < regular ? sale : regular;
    const off = sale !== null ? discountPercent(regular, sale) : null;
    const wasFree = course.pricing === "FREE";

    return (
        <form noValidate onSubmit={form.handleSubmit} className={modalFormClass}>
            <ModalBody className="space-y-4">
                <FormField form={form} name="pricing" label="Free or paid" required>
                    <ChoiceCards choices={pricingChoices()} columns={2} />
                </FormField>

                {pricing === "PAID" && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField form={form} name="price" label="Price (৳)" required hint="At least ৳1.">
                                <Input type="number" inputMode="numeric" min={1} max={MAX_PRICE} placeholder="e.g. 4500" autoFocus />
                            </FormField>
                            <FormField form={form} name="discountPrice" label="Discounted price (৳)" optional hint="Lower than the price. Empty for no discount.">
                                <Input type="number" inputMode="numeric" min={1} max={MAX_PRICE} placeholder="No discount" />
                            </FormField>
                        </div>
                        {regular > 0 && (
                            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                                Students pay <span className="font-semibold tabular-nums">{formatBDT(pays)}</span>
                                {off !== null && (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        instead of <s className="tabular-nums">{formatBDT(regular)}</s> ({off}% off)
                                    </span>
                                )}
                                .
                            </p>
                        )}
                    </>
                )}

                <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                        It changes at once on the course card, its page, checkout and any bundle it&apos;s in. Students already enrolled keep their access
                        {wasFree && pricing === "PAID" ? " — nobody who joined free is charged" : ""}, and an unpaid order is paid at the new price
                        {pricing === "FREE" ? " (made free, it opens straight away; a free-course offer on it pauses)" : ""}. Its status, delivery and online/offline
                        don&apos;t change.
                    </span>
                </p>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    Save price
                </Button>
            </ModalFooter>
        </form>
    );
}
