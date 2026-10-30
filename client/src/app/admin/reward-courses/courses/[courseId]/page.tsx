"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Send, Trash2, User, Users, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import CourseMultiPicker from "@/components/admin/promotions/CourseMultiPicker";
import CourseStudentPicker from "@/components/admin/promotions/CourseStudentPicker";
import { PromoActions, PromoSection, PromotionCourseShell } from "@/components/admin/promotions/PromotionParts";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { FormField } from "@/components/ui/form";
import { SafeImage } from "@/components/ui/safe-image";
import { SwitchRow } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { adminService } from "@/services/admin";
import type { AdminRewardCourse, PromotionCourseDetail, PromotionGrant, RewardCoursesGiven } from "@/types/admin.types";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const schema = z
    .object({
        courseIds: z.array(z.string()).min(1, "Pick at least one course to give"),
        audience: z.enum(["ONE", "GROUP", "EVERYONE"]),
        students: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable() })),
    })
    .refine((data) => data.audience === "EVERYONE" || data.students.length > 0, {
        path: ["students"],
        message: "Pick who gets them",
    });

type Values = z.infer<typeof schema>;

const EMPTY: Values = { courseIds: [], audience: "ONE", students: [] };

/** What a give did, in a sentence: who got something new, and who already had it. */
const givenMessage = (result: RewardCoursesGiven) => {
    const parts = [
        result.students > 0 ? `Given to ${plural(result.students, "student")}.` : "Nobody new got anything.",
        result.alreadyHad > 0 ? `${plural(result.alreadyHad, "student")} already had them.` : "",
        result.forEveryone ? "Anyone who gets this course later gets them too." : "",
    ];
    return parts.filter(Boolean).join(" ");
};

const useRefresh = (courseId: string) => {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-course", courseId] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "promotion-courses"] });
    };
};

/**
 * One course's reward courses: the ones given with it (on for everyone, or
 * for picked students), the way to give more, and who has them — each one
 * there can be taken back.
 */
export default function AdminRewardCoursesCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    return (
        <PromotionCourseShell kind="bonus" courseId={courseId} grantAction={(grant) => <TakeBack grant={grant} courseId={courseId} />}>
            {(detail) => (
                <div className="divide-y divide-border">
                    {detail.bonuses.length > 0 && (
                        <PromoSection
                            title="Given with this course"
                            description="Switch one on for everyone and whoever has this course gets it — now, and when they get the course later."
                        >
                            <ul className="space-y-3">
                                {detail.bonuses.map((bonus) => (
                                    <li key={bonus.id}>
                                        <RewardCourseRow bonus={bonus} mainCourseId={detail.course.id} mainTitle={detail.course.title} />
                                    </li>
                                ))}
                            </ul>
                        </PromoSection>
                    )}
                    <GiveForm detail={detail} />
                </div>
            )}
        </PromotionCourseShell>
    );
}

/** A reward course already given with this one: who has it, whether everyone gets it, and removing it. */
function RewardCourseRow({ bonus, mainCourseId, mainTitle }: { bonus: AdminRewardCourse; mainCourseId: string; mainTitle: string }) {
    const refresh = useRefresh(mainCourseId);

    const forEveryone = useMutation({
        mutationFn: (next: boolean) => adminService.setRewardForEveryone(bonus.id, next),
        onSuccess: (result) => {
            toast.success(
                result.forEveryone
                    ? `On for everyone. ${result.students > 0 ? `${plural(result.students, "more student")} got it.` : "Everyone on the course already has it."}`
                    : "Off for everyone. Students who have it keep it; new students won't get it.",
            );
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change that.")),
    });
    const remove = useMutation({
        mutationFn: () => adminService.removeRewardCourse(bonus.id),
        onSuccess: ({ takenBack }) => {
            toast.success(takenBack > 0 ? `Removed, and taken back from ${plural(takenBack, "student")}.` : "Removed.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove it.")),
    });

    return (
        <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
                <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <SafeImage
                        src={bonus.course.thumbnail}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                        fallback={<BookOpen className="size-5 text-muted-foreground" />}
                    />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">{bonus.course.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                        {bonus.holders > 0 ? `${plural(bonus.holders, "student")} ${bonus.holders === 1 ? "has" : "have"} it` : "Nobody has it yet"}
                        {bonus.course.status !== "PUBLISHED" && <span className="font-semibold text-amber-600"> · Not published — nobody new gets it</span>}
                    </span>
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    isLoading={remove.isPending}
                    onClick={async () => {
                        const confirmed = await confirmAction({
                            title: `Remove "${bonus.course.title}"?`,
                            text:
                                bonus.holders > 0
                                    ? `It's taken back from the ${plural(bonus.holders, "student")} who ${bonus.holders === 1 ? "has" : "have"} it with "${mainTitle}". Their progress is kept.`
                                    : `It stops coming with "${mainTitle}".`,
                            confirmText: "Remove",
                        });
                        if (confirmed) remove.mutate();
                    }}
                >
                    <Trash2 /> Remove
                </Button>
            </div>
            <SwitchRow
                checked={bonus.forEveryone}
                disabled={forEveryone.isPending}
                onCheckedChange={(next) => forEveryone.mutate(next)}
                label="Everyone on this course"
                description={
                    bonus.forEveryone
                        ? "On: everyone who has this course has it, and anyone who gets the course later gets it too."
                        : "Off: only the students it was given to."
                }
            />
        </div>
    );
}

/** Giving reward courses: which courses, then to whom — one student, a group, or everyone on the course. */
function GiveForm({ detail }: { detail: PromotionCourseDetail }) {
    const { course } = detail;
    const refresh = useRefresh(course.id);

    const give = useMutation({
        mutationFn: (values: Values) =>
            adminService.giveRewardCourses(course.id, {
                courseIds: values.courseIds,
                audience: values.audience === "EVERYONE" ? "EVERYONE" : "STUDENTS",
                studentIds: values.audience === "EVERYONE" ? undefined : values.students.map((student) => student.id),
            }),
        onSuccess: (result) => {
            toast.success(givenMessage(result));
            form.reset({ ...EMPTY, audience: form.values.audience });
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't give the reward courses.")),
    });

    const form = useZodForm({ schema, initialValues: EMPTY, onSubmit: (values) => give.mutate(values) });
    const { courseIds, audience, students } = form.values;

    // One student means one: switching from a group keeps the first pick.
    useEffect(() => {
        if (audience === "ONE" && students.length > 1) form.setValue("students", students.slice(0, 1));
    }, [audience, students, form]);

    return (
        <form noValidate onSubmit={form.handleSubmit} className="divide-y divide-border">
            <PromoSection
                title={detail.bonuses.length ? "Give more" : "Give a reward course"}
                description="It opens for them straight away, under Reward courses on their dashboard. It has no certificate of its own — the certificate is this course's. If they lose this course (a refund or a cancelled enrolment), it goes too."
            >
                <CourseMultiPicker
                    label="Courses to give"
                    required
                    value={courseIds}
                    onChange={(ids) => form.setValue("courseIds", ids)}
                    exclude={[course.id]}
                    error={form.errorFor("courseIds")}
                    hint="Only a published course can be given. Anyone who already has one keeps it as it is."
                />
            </PromoSection>

            <PromoSection title="Who gets them">
                <FormField form={form} name="audience" label="Who gets them" required>
                    <ChoiceCards
                        columns={3}
                        choices={[
                            { value: "ONE", label: "One student", description: "Pick one student on this course.", icon: User },
                            { value: "GROUP", label: "A group of students", description: "Pick as many as you like.", icon: Users },
                            {
                                value: "EVERYONE",
                                label: "Everyone on this course",
                                description: "Everyone who has it now, and anyone who gets it later.",
                                icon: UsersRound,
                            },
                        ]}
                    />
                </FormField>

                {audience !== "EVERYONE" && (
                    <CourseStudentPicker
                        courseId={course.id}
                        single={audience === "ONE"}
                        value={students}
                        onChange={(next) => form.setValue("students", next)}
                        error={form.errorFor("students")}
                    />
                )}
            </PromoSection>

            <PromoActions>
                <span className="text-sm text-muted-foreground">
                    {audience === "EVERYONE"
                        ? "Everyone on this course, and later buyers."
                        : students.length
                          ? `${plural(students.length, "student")} picked.`
                          : "Nobody picked yet."}
                </span>
                <Button type="submit" isLoading={give.isPending}>
                    <Send /> Give {courseIds.length > 1 ? `${courseIds.length} reward courses` : "reward course"}
                </Button>
            </PromoActions>
        </form>
    );
}

/** "Take back" beside one student's reward course in "Given so far". */
function TakeBack({ grant, courseId }: { grant: PromotionGrant; courseId: string }) {
    const refresh = useRefresh(courseId);
    const takeBack = useMutation({
        mutationFn: () => adminService.takeBackRewardCourse(grant.bonusId!, grant.student.id),
        onSuccess: () => {
            toast.success(`Taken back from ${grant.student.name}.`);
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't take it back.")),
    });

    if (!grant.bonusId) return null;
    return (
        <button
            type="button"
            disabled={takeBack.isPending}
            onClick={async () => {
                const confirmed = await confirmAction({
                    title: `Take "${grant.course.title}" back from ${grant.student.name}?`,
                    text: "They lose access to it straight away. Their progress is kept, if you give it again.",
                    confirmText: "Take back",
                });
                if (confirmed) takeBack.mutate();
            }}
            className="text-[0.6875rem] font-medium text-destructive hover:underline disabled:opacity-50"
        >
            {takeBack.isPending ? "Taking back…" : "Take back"}
        </button>
    );
}
