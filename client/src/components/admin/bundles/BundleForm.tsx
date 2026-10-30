"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import CourseMultiPicker from "@/components/admin/promotions/CourseMultiPicker";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { SwitchRow } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT } from "@/lib/utils";
import { optionalDateTimeField, optionalNumericField, optionalTextField, textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminBundle, BundleInput } from "@/types/admin.types";
import { isPriced, savingPercent } from "./bundleState";

const schema = z
    .object({
        title: textField({ label: "Name", min: 3, max: 120 }),
        description: optionalTextField({ label: "Description", max: 2000 }),
        courseIds: z.array(z.string()).min(2, "Pick at least two courses"),
        pricing: z.enum(["PERCENT", "FIXED"]),
        value: optionalNumericField({ label: "Amount", min: 1 }).refine((value) => value !== "", "Set the price or the discount"),
        startsAt: optionalDateTimeField,
        endsAt: optionalDateTimeField,
        order: optionalNumericField({ label: "Position", min: 0, max: 1000 }),
        isActive: z.boolean(),
    })
    .refine((data) => data.pricing !== "PERCENT" || Number(data.value) <= 90, { path: ["value"], message: "Up to 90% off" })
    .refine((data) => !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt), {
        path: ["endsAt"],
        message: "It must end after it starts",
    });

const PRICINGS = [
    { value: "PERCENT", label: "% off" },
    { value: "FIXED", label: "৳ fixed" },
] as const;

/**
 * Creating or changing a bundle: its name, its courses in the order students
 * see them, the price (a percentage off the courses' combined sale price, or a
 * fixed sum) and when it sells. A live summary beside the fields does the
 * sums as they change — one by one, the bundle, the saving — and says what
 * would keep it from selling.
 */
export default function BundleForm({ bundle, onDone, onCancel }: { bundle: AdminBundle | null; onDone: () => void; onCancel: () => void }) {
    const courses = useQuery({
        queryKey: ["admin", "courses", "picker"],
        queryFn: () => adminService.courses({ limit: 100, sortBy: "title", sortOrder: "asc" }),
        staleTime: 60_000,
    });
    const save = useMutation({
        mutationFn: (values: z.infer<typeof schema>) => {
            const payload: BundleInput = {
                title: values.title,
                description: values.description || null,
                thumbnail: bundle?.thumbnail ?? null,
                pricing: values.pricing,
                price: values.pricing === "FIXED" ? Number(values.value) : null,
                discountPercent: values.pricing === "PERCENT" ? Number(values.value) : null,
                isActive: values.isActive,
                startsAt: values.startsAt ? localDateTimeToISO(values.startsAt) : null,
                endsAt: values.endsAt ? localDateTimeToISO(values.endsAt) : null,
                order: values.order ? Number(values.order) : 0,
                courseIds: values.courseIds,
            };
            return bundle ? adminService.updateBundle(bundle.id, payload) : adminService.createBundle(payload);
        },
        onSuccess: (saved) => {
            toast.success(bundle ? "Saved." : `${saved.title} is ready.`);
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the bundle.")),
    });
    const form = useZodForm({
        schema,
        initialValues: {
            title: bundle?.title ?? "",
            description: bundle?.description ?? "",
            courseIds: bundle?.items.map((item) => item.courseId) ?? [],
            pricing: bundle?.pricing ?? ("PERCENT" as "PERCENT" | "FIXED"),
            value: bundle && isPriced(bundle) ? String(bundle.pricing === "FIXED" ? bundle.price : bundle.discountPercent) : "",
            startsAt: bundle?.startsAt ? toLocalDateTimeValue(new Date(bundle.startsAt)) : "",
            endsAt: bundle?.endsAt ? toLocalDateTimeValue(new Date(bundle.endsAt)) : "",
            order: bundle ? String(bundle.order) : "",
            isActive: bundle?.isActive ?? false,
        },
        onSubmit: (values) => save.mutate(values),
    });
    const { pricing, value, courseIds, title, isActive } = form.values;

    // What the picked courses cost one by one, and what the bundle comes to.
    const picked = courseIds.map((id) => courses.data?.data.find((entry) => entry.id === id)).filter((course) => course !== undefined);
    const combined = picked.reduce((sum, course) => sum + (course.discountPrice ?? course.price), 0);
    const amount = Number(value) || 0;
    const bundlePrice = pricing === "FIXED" ? amount : Math.round((combined * (100 - amount)) / 100);
    const saving = combined - bundlePrice;
    const drafts = picked.filter((course) => course.status !== "PUBLISHED");

    return (
        <form noValidate onSubmit={form.handleSubmit} className={modalFormClass}>
            <ModalBody>
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
                    <div className="@container min-w-0 space-y-5">
                        <RequiredLegend />

                        <FormField form={form} name="title" label="Name" required counterMax={120}>
                            <Input placeholder="e.g. Career Starter Pack" autoComplete="off" />
                        </FormField>
                        <FormField form={form} name="description" label="What it's for" optional counterMax={2000}>
                            <Textarea rows={3} placeholder="One or two lines for the bundle's page." />
                        </FormField>

                        <CourseMultiPicker
                            label="Courses"
                            required
                            value={courseIds}
                            onChange={(ids) => form.setValue("courseIds", ids)}
                            error={form.errorFor("courseIds")}
                            hint="In the order students see them. Only published courses can be bought, so a bundle with a draft in it stays hidden."
                        />

                        <FormField
                            form={form}
                            name="value"
                            label={pricing === "PERCENT" ? "Discount" : "Bundle price"}
                            required
                            hint={
                                pricing === "PERCENT"
                                    ? "Off the courses' combined sale price, up to 90%. Follows their prices as they change."
                                    : "What the whole bundle costs, whatever the courses cost alone."
                            }
                            labelAction={
                                <div role="radiogroup" aria-label="Priced as" className="flex rounded-md bg-secondary p-0.5">
                                    {PRICINGS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={pricing === option.value}
                                            onClick={() => {
                                                if (pricing === option.value) return;
                                                form.setValue("pricing", option.value);
                                                // 20 means 20% or ৳20 — never carry one over as the other.
                                                form.setValue("value", "");
                                            }}
                                            className={cn(
                                                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                pricing === option.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            }
                        >
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={pricing === "PERCENT" ? 90 : undefined}
                                placeholder={pricing === "PERCENT" ? "20" : "4500"}
                                addonStart={pricing === "FIXED" ? "৳" : undefined}
                                addonEnd={pricing === "PERCENT" ? "% off" : undefined}
                            />
                        </FormField>

                        <div className="grid gap-4 @md:grid-cols-2">
                            <FormField form={form} name="startsAt" label="Opens" optional hint="Empty: on sale as soon as it's on.">
                                <DateTimeInput />
                            </FormField>
                            <FormField form={form} name="endsAt" label="Closes" optional hint="Empty: no end date.">
                                <DateTimeInput />
                            </FormField>
                        </div>

                        <div className="grid gap-4 @md:grid-cols-[minmax(0,1fr)_8.5rem]">
                            <SwitchRow
                                className="@md:mt-5"
                                checked={isActive}
                                onCheckedChange={(next) => form.setValue("isActive", next)}
                                label="Sell this bundle"
                                description={isActive ? "On: on sale inside its window." : "Off: hidden, and nobody can buy it."}
                            />
                            <FormField form={form} name="order" label="Position" optional hint="Smaller first.">
                                <Input type="number" inputMode="numeric" min={0} placeholder="0" />
                            </FormField>
                        </div>
                    </div>

                    <aside className="@3xl:sticky @3xl:top-0 @3xl:self-start" aria-label="Summary">
                        <div className="rounded-card border border-border bg-surface/70 p-4">
                            <p className="text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">What students pay</p>
                            <p className={cn("mt-1 font-semibold leading-snug", !title.trim() && "text-muted-foreground")}>{title.trim() || "Your bundle"}</p>

                            {picked.length === 0 ? (
                                <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                                    Pick two or more courses to see the sums.
                                </p>
                            ) : (
                                <ol className="mt-3 space-y-1.5 text-xs">
                                    {picked.map((course, index) => (
                                        <li key={course.id} className="flex items-baseline gap-2">
                                            <span className="w-3 shrink-0 font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                                            <span className="min-w-0 flex-1 truncate" title={course.title}>
                                                {course.title}
                                            </span>
                                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                                {(course.discountPrice ?? course.price) > 0 ? formatBDT(course.discountPrice ?? course.price) : "Free"}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            <dl className="mt-4 space-y-1.5 border-t border-dashed border-border-strong pt-3 text-sm">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">One by one</dt>
                                    <dd className="tabular-nums">{formatBDT(combined)}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Bundle</dt>
                                    <dd className="font-semibold tabular-nums">{amount > 0 ? formatBDT(bundlePrice) : "—"}</dd>
                                </div>
                                {amount > 0 && picked.length >= 2 && (
                                    <div
                                        className={cn(
                                            "mt-2 flex justify-between gap-3 rounded-md px-2.5 py-1.5 font-semibold",
                                            saving > 0 ? "bg-success/10 text-success-ink" : "bg-destructive/10 text-destructive-ink",
                                        )}
                                    >
                                        <dt>{saving > 0 ? "They save" : "No saving"}</dt>
                                        <dd className="tabular-nums">{saving > 0 ? `${formatBDT(saving)} · ${savingPercent(combined, bundlePrice)}%` : formatBDT(saving)}</dd>
                                    </div>
                                )}
                            </dl>

                            {drafts.length > 0 && (
                                <p className="mt-3 flex gap-2 text-xs text-warning-ink">
                                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                                    <span>
                                        {drafts.length === 1 ? "One course isn't" : `${drafts.length} courses aren't`} published, so the bundle stays hidden until{" "}
                                        {drafts.length === 1 ? "it is" : "they are"}.
                                    </span>
                                </p>
                            )}
                        </div>
                    </aside>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {bundle ? "Save changes" : "Create bundle"}
                </Button>
            </ModalFooter>
        </form>
    );
}
