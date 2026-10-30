"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarClock, CircleCheckBig, Save, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import CourseMultiPicker from "@/components/admin/promotions/CourseMultiPicker";
import { CONDITION_TEXT, deadlineText, PromoActions, PromoSection, PromotionCourseShell, PromotionDeal } from "@/components/admin/promotions/PromotionParts";
import { Button } from "@/components/ui/button";
import { ChoiceCards, type Choice } from "@/components/ui/choice-cards";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatDate } from "@/lib/utils";
import { optionalDateTimeField, optionalNumericField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { PromotionCourseDetail } from "@/types/admin.types";

const CONDITIONS: Choice[] = [
    {
        value: "COURSE_COMPLETE",
        label: "Finish the course",
        description: "Every lesson done — 100% progress.",
        icon: CircleCheckBig,
    },
    {
        value: "CERTIFICATE",
        label: "Earn the certificate",
        description: "100%, and every assignment accepted. Counted when the certificate is issued.",
        icon: Award,
    },
];

const schema = z.object({
    courseIds: z.array(z.string()).min(1, "Pick at least one reward course"),
    condition: z.enum(["COURSE_COMPLETE", "CERTIFICATE"]),
    withinDays: optionalNumericField({ label: "Days", min: 1, max: 730 }),
    deadlineAt: optionalDateTimeField,
    isActive: z.boolean(),
});

/** One course's reward for finishing it in time. */
export default function AdminRewardCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    return <PromotionCourseShell kind="reward" courseId={courseId}>{(detail) => <RewardForm detail={detail} />}</PromotionCourseShell>;
}

function RewardForm({ detail }: { detail: PromotionCourseDetail }) {
    const queryClient = useQueryClient();
    const { course, reward } = detail;
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-course", course.id] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-courses"] });
    };

    const save = useMutation({
        mutationFn: (values: z.infer<typeof schema>) =>
            adminService.saveReward(course.id, {
                courseIds: values.courseIds,
                condition: values.condition,
                withinDays: values.withinDays ? Number(values.withinDays) : null,
                deadlineAt: values.deadlineAt ? localDateTimeToISO(values.deadlineAt) : null,
                isActive: values.isActive,
            }),
        onSuccess: () => {
            toast.success(reward ? "Reward saved." : "Reward set up.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the reward.")),
    });
    const remove = useMutation({
        mutationFn: () => adminService.deleteReward(course.id),
        onSuccess: () => {
            toast.success("Reward removed.");
            form.reset({ courseIds: [], condition: "COURSE_COMPLETE", withinDays: "", deadlineAt: "", isActive: true });
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the reward.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            courseIds: reward?.rewardCourses.map((item) => item.courseId) ?? [],
            condition: reward?.condition ?? ("COURSE_COMPLETE" as "COURSE_COMPLETE" | "CERTIFICATE"),
            withinDays: reward?.withinDays ? String(reward.withinDays) : "",
            deadlineAt: reward?.deadlineAt ? toLocalDateTimeValue(new Date(reward.deadlineAt)) : "",
            isActive: reward?.isActive ?? true,
        },
        onSubmit: (values) => save.mutate(values),
    });

    // The rule in a sentence, and what it means for someone enrolling today.
    const days = Number(form.values.withinDays) || null;
    const date = form.values.deadlineAt ? new Date(form.values.deadlineAt).toISOString() : null;
    const todayBy = days ? new Date(Date.now() + days * 86_400_000) : null;
    const enrollingToday =
        todayBy && date ? (new Date(date) < todayBy ? new Date(date) : todayBy) : (todayBy ?? (date ? new Date(date) : null));

    const { courseIds, condition, isActive } = form.values;

    return (
        <form noValidate onSubmit={form.handleSubmit} className="divide-y divide-border">
            <PromotionDeal
                kind="reward"
                course={course}
                courseIds={courseIds}
                lead={CONDITION_TEXT[condition]}
                terms={deadlineText({ withinDays: days, deadlineAt: date })}
            />

            <PromoSection
                title="Reward courses"
                description="A student who meets the condition in time is enrolled in each of these — once, automatically. Students see it on this course's page, with their own deadline once they've enrolled."
            >
                <CourseMultiPicker
                    label="Reward courses"
                    hideLabel
                    required
                    value={courseIds}
                    onChange={(ids) => form.setValue("courseIds", ids)}
                    exclude={[course.id]}
                    error={form.errorFor("courseIds")}
                    hint="A course that isn't published is skipped. A student who already has one keeps it as it is."
                />
            </PromoSection>

            <PromoSection title="To earn it">
                <FormField form={form} name="condition" label="Condition" required>
                    <ChoiceCards choices={CONDITIONS} columns={2} />
                </FormField>
            </PromoSection>

            <PromoSection title="Deadline" description="Either, both — the earlier one counts — or neither.">
                <div className="grid gap-4 @lg:grid-cols-2">
                    <FormField form={form} name="withinDays" label="Within days of enrolling" optional hint="Each student's own clock.">
                        <Input type="number" inputMode="numeric" min={1} max={730} placeholder="e.g. 30" addonEnd="days" />
                    </FormField>
                    <FormField form={form} name="deadlineAt" label="And by" optional hint="One date for everyone.">
                        <DateTimeInput />
                    </FormField>
                </div>
                <p className="flex items-start gap-2 rounded-md border border-border bg-surface/70 px-3 py-2.5 text-sm">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                        <span className="font-medium">{deadlineText({ withinDays: days, deadlineAt: date })}</span>
                        <span className="text-muted-foreground">
                            {enrollingToday ? ` — someone enrolling today has until ${formatDate(enrollingToday)}.` : ", so finishing at any time earns it."}
                        </span>
                    </span>
                </p>
            </PromoSection>

            <PromoSection title="Status">
                <SwitchRow
                    checked={isActive}
                    onCheckedChange={(next) => form.setValue("isActive", next)}
                    label="Give this reward"
                    description={isActive ? "On: students who qualify are given the courses." : "Off: nobody earns it, and the course page says nothing about it."}
                />
            </PromoSection>

            <PromoActions>
                {reward ? (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        isLoading={remove.isPending}
                        onClick={async () => {
                            if (await confirmAction({ title: "Remove this reward?", text: "Courses it already gave stay with the students who earned them.", confirmText: "Remove" })) {
                                remove.mutate();
                            }
                        }}
                    >
                        <Trash2 /> Remove reward
                    </Button>
                ) : (
                    <span />
                )}
                <Button type="submit" isLoading={save.isPending}>
                    <Save /> {reward ? "Save reward" : "Set up reward"}
                </Button>
            </PromoActions>
        </form>
    );
}
