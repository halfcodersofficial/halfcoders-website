"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, Save, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import CourseMultiPicker from "@/components/admin/promotions/CourseMultiPicker";
import { PromoActions, PromoSection, PromotionCourseShell, PromotionDeal } from "@/components/admin/promotions/PromotionParts";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { SwitchRow } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT } from "@/lib/utils";
import { optionalDateTimeField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { PromotionCourseDetail } from "@/types/admin.types";

const schema = z
    .object({
        courseIds: z.array(z.string()).min(1, "Pick at least one free course"),
        isActive: z.boolean(),
        startsAt: optionalDateTimeField,
        endsAt: optionalDateTimeField,
    })
    .refine((data) => !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt), {
        path: ["endsAt"],
        message: "It must end after it starts",
    });

/** One paid course's "buy this, get these free". */
export default function AdminOfferCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    return <PromotionCourseShell kind="offer" courseId={courseId}>{(detail) => <OfferForm detail={detail} />}</PromotionCourseShell>;
}

function OfferForm({ detail }: { detail: PromotionCourseDetail }) {
    const queryClient = useQueryClient();
    const { course, offer } = detail;
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-course", course.id] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-courses"] });
    };

    const save = useMutation({
        mutationFn: (values: z.infer<typeof schema>) =>
            adminService.saveOffer(course.id, {
                courseIds: values.courseIds,
                isActive: values.isActive,
                startsAt: values.startsAt ? localDateTimeToISO(values.startsAt) : null,
                endsAt: values.endsAt ? localDateTimeToISO(values.endsAt) : null,
            }),
        onSuccess: () => {
            toast.success(offer ? "Offer saved." : "Offer set up.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the offer.")),
    });
    const remove = useMutation({
        mutationFn: () => adminService.deleteOffer(course.id),
        onSuccess: () => {
            toast.success("Offer removed.");
            form.reset({ courseIds: [], isActive: true, startsAt: "", endsAt: "" });
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the offer.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            courseIds: offer?.freeCourses.map((item) => item.courseId) ?? [],
            isActive: offer?.isActive ?? true,
            startsAt: offer?.startsAt ? toLocalDateTimeValue(new Date(offer.startsAt)) : "",
            endsAt: offer?.endsAt ? toLocalDateTimeValue(new Date(offer.endsAt)) : "",
        },
        onSubmit: (values) => save.mutate(values),
    });

    const removeButton = (
        <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            isLoading={remove.isPending}
            onClick={async () => {
                if (await confirmAction({ title: "Remove this offer?", text: "Courses it already gave stay with the students who got them.", confirmText: "Remove" })) {
                    remove.mutate();
                }
            }}
        >
            <Trash2 /> Remove offer
        </Button>
    );

    // Made free (or not classified yet): an offer would give paid courses away for nothing, so it stands paused.
    if (course.pricing !== "PAID") {
        return (
            <div className="divide-y divide-border">
                <div className="flex gap-3 px-5 py-6 sm:px-6">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-warning/10 text-warning-ink">
                        <PauseCircle className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-semibold">{offer ? "This offer is paused" : "Only a paid course can have an offer"}</h2>
                        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                            {offer
                                ? "This course isn't paid any more, so nobody earns the free courses and the course page doesn't mention them. Make the course paid again and it picks up where it was, or remove it."
                                : "Make this course paid in the course editor first, then come back to choose the courses that come free with it."}
                        </p>
                    </div>
                </div>
                {offer && <PromoActions>{removeButton}</PromoActions>}
            </div>
        );
    }

    const { courseIds, isActive } = form.values;

    return (
        <form noValidate onSubmit={form.handleSubmit} className="divide-y divide-border">
            <PromotionDeal
                kind="offer"
                course={course}
                courseIds={courseIds}
                lead="Buy this course"
                terms={`For ${formatBDT(course.discountPrice ?? course.price)}`}
            />

            <PromoSection
                title="Free courses"
                description="When an order for this course is paid — online, by an admin, or with a coupon — the buyer is enrolled in each of these too. A refund takes them back."
            >
                <CourseMultiPicker
                    label="Free courses"
                    hideLabel
                    required
                    value={courseIds}
                    onChange={(ids) => form.setValue("courseIds", ids)}
                    exclude={[course.id]}
                    error={form.errorFor("courseIds")}
                    hint="Shown on this course's page and at checkout, in this order. A course that isn't published is skipped; anyone who already has one keeps it as it is."
                />
            </PromoSection>

            <PromoSection title="When" description="Leave both empty to run it until you switch it off.">
                <div className="grid gap-4 @lg:grid-cols-2">
                    <FormField form={form} name="startsAt" label="Starts" optional hint="Purchases before this earn nothing.">
                        <DateTimeInput />
                    </FormField>
                    <FormField form={form} name="endsAt" label="Ends" optional hint="Purchases after this earn nothing.">
                        <DateTimeInput />
                    </FormField>
                </div>
            </PromoSection>

            <PromoSection title="Status">
                <SwitchRow
                    checked={isActive}
                    onCheckedChange={(next) => form.setValue("isActive", next)}
                    label="Run this offer"
                    description={
                        isActive
                            ? "On: paid purchases inside its dates earn the free courses."
                            : "Off: purchases earn nothing, and the course page says nothing about it."
                    }
                />
            </PromoSection>

            <PromoActions>
                {offer ? removeButton : <span />}
                <Button type="submit" isLoading={save.isPending}>
                    <Save /> {offer ? "Save offer" : "Set up offer"}
                </Button>
            </PromoActions>
        </form>
    );
}
