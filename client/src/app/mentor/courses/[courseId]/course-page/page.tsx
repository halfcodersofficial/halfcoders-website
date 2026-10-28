"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import CoursePreview from "@/components/admin/CoursePreview";
import PreviewPanel from "@/components/admin/PreviewPanel";
import { CourseReadiness, readinessOf } from "@/components/mentor/course/CourseReadiness";
import { CourseClassBadges } from "@/components/shared/CourseClassification";
import {
    contentPayloadFrom,
    contentValuesFrom,
    courseContentShape,
    CoursePageContentFields,
    EMPTY_CONTENT_VALUES,
    toLines,
} from "@/components/staff/CoursePageContentFields";
import { fromFaqRows } from "@/components/staff/FaqListEditor";
import { fromFeatureRows } from "@/components/staff/FeatureListEditor";
import { fromIconLineRows } from "@/components/staff/IconLineListEditor";
import { Button } from "@/components/ui/button";
import { RequiredLegend } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useZodForm } from "@/hooks/useZodForm";
import { batchFormValues } from "@/lib/courseBatchForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { formatBDT, LEVEL_LABEL } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

const schema = z.object(courseContentShape);

/**
 * The words on the course's public page, which a mentor may edit — beside a
 * live student preview, with a readiness checklist that ticks off as they
 * type.
 *
 * Price, category, level and the publish state are deliberately read-only
 * here. Those are commercial decisions and the API refuses them from a mentor
 * account; showing them as facts rather than fields means nobody types a new
 * price into a form that then silently ignores it.
 */
export default function MentorCoursePageEditor() {
    const { courseId } = useParams<{ courseId: string }>();
    const queryClient = useQueryClient();

    const { data: course, isLoading, isError, error } = useQuery({
        queryKey: ["staff", "course-detail", courseId],
        queryFn: () => curriculumAuthoring.getCourseDetail(courseId),
    });

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) => curriculumAuthoring.updateContent(courseId, contentPayloadFrom(values)),
        onSuccess: () => {
            toast.success("Course page saved.");
            void queryClient.invalidateQueries({ queryKey: ["staff", "course-detail", courseId] });
            void queryClient.invalidateQueries({ queryKey: ["staff", "course", courseId] });
            void refreshCoursePages();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save the course page.")),
    });

    const form = useZodForm({
        schema,
        initialValues: EMPTY_CONTENT_VALUES,
        onSubmit: (values) => save.mutate(values),
    });

    const { reset: resetForm } = form;
    useEffect(() => {
        if (course) resetForm(contentValuesFrom(course));
    }, [course, resetForm]);

    if (isLoading) {
        return (
            <div className="container-page space-y-4 py-8">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        );
    }

    if (isError || !course) {
        return (
            <div className="container-page py-16 text-center">
                <p className="font-medium">Couldn&apos;t load the course page.</p>
                <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again in a moment.")}</p>
            </div>
        );
    }

    const isPublished = course.status === "PUBLISHED";
    // Read from the live form, so a box ticks the moment the edit that earns it is typed.
    const readiness = readinessOf(course, {
        images: form.values.images.length,
        subtitle: form.values.subtitle,
        description: form.values.description,
        outcomes: toLines(form.values.outcomes).length,
        features: fromFeatureRows(form.values.features).length,
        faqs: fromFaqRows(form.values.faqs).length,
    });

    return (
        <div className="container-page max-w-[1700px] space-y-6 py-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Course page</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Everything a student reads before they buy.{" "}
                        {course.pricing === "FREE" ? "Free" : formatBDT(course.discountPrice ?? course.price)}
                        {course.category ? ` · ${course.category.title}` : ""} · {LEVEL_LABEL[course.level] ?? course.level} — price,
                        category, level, status and class format are set by an admin.
                    </p>
                    <CourseClassBadges phase={course.phase} delivery={course.delivery} mode={course.mode} pricing={course.pricing} className="mt-2" />
                </div>
                {isPublished && (
                    <Button asChild variant="brand-outline">
                        <Link href={`/courses/${course.slug}`} target="_blank">
                            View the live page
                        </Link>
                    </Button>
                )}
            </header>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,880px)_minmax(340px,1fr)]">
                <div className="min-w-0 space-y-6">
                    <CourseReadiness items={readiness} published={isPublished} />

                    <section aria-label="Course page content" className="rounded-2xl border border-border bg-card shadow-sm">
                        <form className="space-y-6 p-4 sm:p-6" noValidate onSubmit={form.handleSubmit}>
                            <RequiredLegend />
                            <CoursePageContentFields form={form} courseId={courseId} courseType={course.courseType} phase={course.phase} />

                            <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
                                <p className="text-xs text-muted-foreground">{form.isDirty ? "Unsaved changes." : "Everything is saved."}</p>
                                <Button type="submit" size="lg" isLoading={save.isPending} disabled={!form.isDirty}>
                                    <Save className="size-4" /> Save page
                                </Button>
                            </div>
                        </form>
                    </section>
                </div>

                <PreviewPanel
                    title="Student preview"
                    description={
                        <>
                            Updates as you type, including unsaved edits.{" "}
                            {isPublished ? (
                                <Link href={`/courses/${course.slug}`} target="_blank" className="text-primary underline-offset-4 hover:underline">
                                    View the live page
                                </Link>
                            ) : (
                                "Not published, so it has no public page yet."
                            )}
                        </>
                    }
                >
                    <CoursePreview
                        course={course}
                        categoryTitle={course.category?.title}
                        values={{
                            title: course.title,
                            subtitle: form.values.subtitle,
                            description: form.values.description,
                            overview: form.values.overview,
                            images: form.values.images,
                            promoVideoUrl: form.values.promoVideoUrl,
                            price: String(course.price),
                            discountPrice: course.discountPrice === null ? "" : String(course.discountPrice),
                            duration: course.duration ?? "",
                            level: course.level,
                            language: course.language,
                            courseType: course.courseType,
                            phase: course.phase,
                            pricing: course.pricing,
                            delivery: course.delivery,
                            mode: course.mode,
                            venue: course.venue ?? "",
                            // Admin-set; the mentor console shows them read-only.
                            ...batchFormValues(course),
                            outcomes: toLines(form.values.outcomes),
                            requirements: toLines(form.values.requirements),
                            heroFacts: fromIconLineRows(form.values.heroFacts),
                            features: fromFeatureRows(form.values.features),
                            faqs: fromFaqRows(form.values.faqs),
                            assignmentInfo: form.values.assignmentInfo,
                            practiceInfo: form.values.practiceInfo,
                            supportInfo: form.values.supportInfo,
                            isFeatured: course.isFeatured,
                        }}
                    />
                </PreviewPanel>
            </div>
        </div>
    );
}
