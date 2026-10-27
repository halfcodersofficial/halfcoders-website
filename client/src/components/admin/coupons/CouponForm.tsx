"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import CourseMultiPicker from "@/components/admin/promotions/CourseMultiPicker";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { SwitchRow } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT, formatDate } from "@/lib/utils";
import { optionalDateTimeField, optionalNumericField, optionalTextField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminCoupon, CouponInput } from "@/types/admin.types";
import { CouponStub, generateCode, offText, perStudentText } from "./couponParts";

const schema = z
    .object({
        code: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9-]{3,32}$/, "Use 3–32 letters, numbers or dashes, e.g. EDEN-25"),
        label: optionalTextField({ label: "Label", max: 80 }),
        description: optionalTextField({ label: "Note", max: 300 }),
        kind: z.enum(["PERCENT", "FIXED"]),
        value: optionalNumericField({ label: "Amount", min: 1 }).refine((value) => value !== "", "How much does it take off?"),
        maxDiscount: optionalNumericField({ label: "Cap", min: 1 }),
        minAmount: optionalNumericField({ label: "Minimum", min: 1 }),
        scope: z.enum(["ALL", "CHOSEN"]),
        courseIds: z.array(z.string()),
        maxRedemptions: optionalNumericField({ label: "Uses", min: 1 }),
        perStudentLimit: optionalNumericField({ label: "Uses per student", min: 1, max: 1000 }),
        startsAt: optionalDateTimeField,
        endsAt: optionalDateTimeField,
        isActive: z.boolean(),
    })
    .refine((data) => data.kind !== "PERCENT" || Number(data.value) <= 100, { path: ["value"], message: "A percentage can't be more than 100" })
    .refine((data) => data.scope === "ALL" || data.courseIds.length > 0, { path: ["courseIds"], message: "Pick at least one course" })
    .refine((data) => !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt), { path: ["endsAt"], message: "It must end after it starts" });

const KINDS = [
    { value: "PERCENT", label: "% off" },
    { value: "FIXED", label: "৳ off" },
] as const;

const SCOPES = [
    { value: "ALL", label: "Every course", description: "Students use it on whichever course they choose.", icon: Sparkles },
    { value: "CHOSEN", label: "Chosen courses", description: "Only on the courses you pick.", icon: BookOpen },
];

/** Shown as an example when the code is for every course and no course is picked to try it on. */
const SAMPLE_PRICE = 5000;

/**
 * Creating or changing a coupon. Left, everything an admin decides — the
 * code and what students see beside it, how much it takes off, which
 * courses, how many uses in all and per student, the dates. Right, the code
 * as students meet it, worked through on a real course, and its rules in a
 * sentence each.
 */
export default function CouponForm({ coupon, onDone, onCancel }: { coupon: AdminCoupon | null; onDone: (saved: AdminCoupon) => void; onCancel: () => void }) {
    const courses = useQuery({
        queryKey: ["admin", "courses", "picker"],
        queryFn: () => adminService.courses({ limit: 100, sortBy: "title", sortOrder: "asc" }),
        staleTime: 60_000,
    });
    // Orders keep the code they were bought with, so it can't be renamed once any carries it.
    const locked = coupon !== null && coupon.used + coupon.held + coupon.refunded > 0;

    const save = useMutation({
        mutationFn: (values: z.infer<typeof schema>) => {
            const payload: CouponInput = {
                code: values.code.toUpperCase(),
                label: values.label || null,
                description: values.description || null,
                kind: values.kind,
                value: Number(values.value),
                maxDiscount: values.kind === "PERCENT" && values.maxDiscount ? Number(values.maxDiscount) : null,
                minAmount: values.minAmount ? Number(values.minAmount) : null,
                allCourses: values.scope === "ALL",
                courseIds: values.scope === "ALL" ? [] : values.courseIds,
                maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : null,
                perStudentLimit: values.perStudentLimit ? Number(values.perStudentLimit) : null,
                startsAt: values.startsAt ? localDateTimeToISO(values.startsAt) : null,
                endsAt: values.endsAt ? localDateTimeToISO(values.endsAt) : null,
                isActive: values.isActive,
            };
            if (locked) delete (payload as Partial<CouponInput>).code;
            return coupon ? adminService.updateCoupon(coupon.id, payload) : adminService.createCoupon(payload);
        },
        onSuccess: (saved) => {
            toast.success(coupon ? "Saved." : `${saved.code} is ready to hand out.`);
            onDone(saved);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the coupon.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            code: coupon?.code ?? "",
            label: coupon?.label ?? "",
            description: coupon?.description ?? "",
            kind: coupon?.kind ?? ("PERCENT" as "PERCENT" | "FIXED"),
            value: coupon ? String(coupon.value) : "",
            maxDiscount: coupon?.maxDiscount ? String(coupon.maxDiscount) : "",
            minAmount: coupon?.minAmount ? String(coupon.minAmount) : "",
            scope: (coupon && !coupon.allCourses ? "CHOSEN" : "ALL") as "ALL" | "CHOSEN",
            courseIds: coupon?.courses.map((course) => course.id) ?? [],
            maxRedemptions: coupon?.maxRedemptions ? String(coupon.maxRedemptions) : "",
            perStudentLimit: coupon ? (coupon.perStudentLimit ? String(coupon.perStudentLimit) : "") : "1",
            startsAt: coupon?.startsAt ? toLocalDateTimeValue(new Date(coupon.startsAt)) : "",
            endsAt: coupon?.endsAt ? toLocalDateTimeValue(new Date(coupon.endsAt)) : "",
            isActive: coupon?.isActive ?? true,
        },
        onSubmit: (values) => save.mutate(values),
    });
    const values = form.values;
    const allCourses = values.scope === "ALL";
    const amount = Number(values.value) || 0;
    const cap = values.kind === "PERCENT" && values.maxDiscount ? Number(values.maxDiscount) : null;
    const minimum = values.minAmount ? Number(values.minAmount) : null;

    // The sums on a real course: the first one chosen, or an example price for an every-course code.
    const sample = !allCourses ? courses.data?.data.find((course) => course.id === values.courseIds[0]) : undefined;
    const salePrice = sample ? (sample.discountPrice ?? sample.price) : SAMPLE_PRICE;
    const off = amount <= 0 ? 0 : Math.min(values.kind === "PERCENT" ? Math.min(Math.round((salePrice * Math.min(amount, 100)) / 100), cap ?? Infinity) : amount, salePrice);
    const belowMinimum = minimum !== null && salePrice < minimum;

    const rules = [
        allCourses ? "On any course the student picks." : `On ${values.courseIds.length || "the"} chosen course${values.courseIds.length === 1 ? "" : "s"} only.`,
        values.maxRedemptions ? `${Number(values.maxRedemptions).toLocaleString("en-US")} uses in all, then it's used up.` : "No limit on uses in all.",
        `${perStudentText(values.perStudentLimit ? Number(values.perStudentLimit) : null)}.`,
        minimum !== null ? `Courses of ${formatBDT(minimum)} or more.` : null,
        values.startsAt || values.endsAt
            ? `${values.startsAt ? `From ${formatDate(new Date(values.startsAt))}` : "From now"}${values.endsAt ? ` until ${formatDate(new Date(values.endsAt))}` : ", no end date"}.`
            : "Any time, until you switch it off.",
    ].filter((rule): rule is string => rule !== null);

    return (
        <form noValidate onSubmit={form.handleSubmit} className={modalFormClass}>
            <ModalBody>
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
                    <div className="@container min-w-0 space-y-6">
                        <RequiredLegend />

                        <section className="space-y-4">
                            <div className="grid gap-4 @lg:grid-cols-2">
                                <FormField
                                    form={form}
                                    name="code"
                                    label="Code"
                                    required
                                    hint={locked ? "Orders carry this code, so it can't be renamed." : "What students type. Case doesn't matter."}
                                    labelAction={
                                        !locked && (
                                            <button
                                                type="button"
                                                onClick={() => form.setValue("code", generateCode(values.label))}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                            >
                                                <Shuffle className="size-3.5" aria-hidden /> Make one up
                                            </button>
                                        )
                                    }
                                >
                                    <Input className="font-mono uppercase" placeholder="EDEN-25" autoComplete="off" disabled={locked} />
                                </FormField>
                                <FormField form={form} name="label" label="Label students see" optional counterMax={80} hint="Beside the code at checkout.">
                                    <Input placeholder="e.g. Eden Mohila College programme" />
                                </FormField>
                            </div>

                            <FormField
                                form={form}
                                name="value"
                                label={values.kind === "PERCENT" ? "Discount" : "Taka off"}
                                required
                                hint={values.kind === "PERCENT" ? "Off the course's sale price." : "Off the course's sale price — never more than the price itself."}
                                labelAction={
                                    <div role="radiogroup" aria-label="Takes off" className="flex rounded-lg bg-secondary p-0.5">
                                        {KINDS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={values.kind === option.value}
                                                onClick={() => {
                                                    if (values.kind === option.value) return;
                                                    form.setValue("kind", option.value);
                                                    // 20 means 20% or ৳20 — never carry one over as the other.
                                                    form.setValue("value", "");
                                                }}
                                                className={cn(
                                                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    values.kind === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
                                    max={values.kind === "PERCENT" ? 100 : undefined}
                                    placeholder={values.kind === "PERCENT" ? "25" : "500"}
                                    addonStart={values.kind === "FIXED" ? "৳" : undefined}
                                    addonEnd={values.kind === "PERCENT" ? "% off" : undefined}
                                />
                            </FormField>

                            <div className="grid gap-4 @lg:grid-cols-2">
                                {values.kind === "PERCENT" && (
                                    <FormField form={form} name="maxDiscount" label="At most" optional hint="Caps the discount on a dear course.">
                                        <Input type="number" inputMode="numeric" min={1} placeholder="No cap" addonStart="৳" />
                                    </FormField>
                                )}
                                <FormField form={form} name="minAmount" label="Courses from" optional hint="The sale price it needs, at least.">
                                    <Input type="number" inputMode="numeric" min={1} placeholder="Any price" addonStart="৳" />
                                </FormField>
                            </div>
                        </section>

                        <section className="space-y-3 border-t border-border pt-5">
                            <FormField form={form} name="scope" label="Works on" required>
                                <ChoiceCards choices={SCOPES} columns={2} />
                            </FormField>
                            {!allCourses && (
                                <CourseMultiPicker
                                    label="Courses"
                                    hideLabel
                                    required
                                    value={values.courseIds}
                                    onChange={(ids) => form.setValue("courseIds", ids)}
                                    error={form.errorFor("courseIds")}
                                    hint="A course that isn't published can't be bought, so the code waits until it is."
                                />
                            )}
                        </section>

                        <section className="space-y-4 border-t border-border pt-5">
                            <div className="grid gap-4 @lg:grid-cols-2">
                                <FormField form={form} name="maxRedemptions" label="Uses in all" optional hint="Paid orders, all students together. Empty: no limit.">
                                    <Input type="number" inputMode="numeric" min={1} placeholder="No limit" />
                                </FormField>
                                <FormField form={form} name="perStudentLimit" label="Uses per student" optional hint="On different courses. Empty: no limit.">
                                    <Input type="number" inputMode="numeric" min={1} max={1000} placeholder="No limit" />
                                </FormField>
                            </div>
                            <div className="grid gap-4 @lg:grid-cols-2">
                                <FormField form={form} name="startsAt" label="Opens" optional hint="Empty: from now.">
                                    <DateTimeInput />
                                </FormField>
                                <FormField form={form} name="endsAt" label="Closes" optional hint="Empty: no end date.">
                                    <DateTimeInput />
                                </FormField>
                            </div>
                        </section>

                        <section className="space-y-4 border-t border-border pt-5">
                            <SwitchRow
                                checked={values.isActive}
                                onCheckedChange={(next) => form.setValue("isActive", next)}
                                label="Students can use it"
                                description={values.isActive ? "On: it works inside its dates." : "Off: nobody can apply it."}
                            />
                            <FormField form={form} name="description" label="Note for admins" optional counterMax={300}>
                                <Input placeholder="e.g. Handed out at the Eden Mohila College seminar, 25 Oct" />
                            </FormField>
                        </section>
                    </div>

                    <aside className="space-y-4 @3xl:sticky @3xl:top-0 @3xl:self-start" aria-label="Preview">
                        <div>
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">What students get</p>
                            <div className="mt-2 flex overflow-hidden rounded-xl border border-border">
                                <CouponStub coupon={{ kind: values.kind, value: amount || 0, maxDiscount: cap }} className="w-24 px-2 [&>p:first-child]:text-2xl" />
                                <div className="min-w-0 flex-1 border-l-2 border-dashed border-border-strong p-3">
                                    <p className={cn("truncate font-mono font-bold tracking-wide", !values.code && "text-muted-foreground")}>
                                        {values.code.toUpperCase() || "YOUR-CODE"}
                                    </p>
                                    {values.label && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{values.label}</p>}
                                    <p className="mt-1 text-xs font-medium text-success-ink">{amount ? offText({ kind: values.kind, value: amount, maxDiscount: cap }) : "—"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-surface/70 p-3.5">
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                {sample ? "On the first chosen course" : "On a course of ৳5,000"}
                            </p>
                            {sample && <p className="mt-1 truncate text-xs font-medium" title={sample.title}>{sample.title}</p>}
                            <dl className="mt-2.5 space-y-1 text-sm">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Price</dt>
                                    <dd className="tabular-nums">{formatBDT(salePrice)}</dd>
                                </div>
                                <div className="flex justify-between gap-3 text-success-ink">
                                    <dt>Code</dt>
                                    <dd className="tabular-nums">{belowMinimum ? "—" : `−${formatBDT(off)}`}</dd>
                                </div>
                                <div className="flex justify-between gap-3 border-t border-dashed border-border-strong pt-1.5 font-semibold">
                                    <dt>They pay</dt>
                                    <dd className="tabular-nums">{formatBDT(belowMinimum ? salePrice : salePrice - off)}</dd>
                                </div>
                            </dl>
                            {belowMinimum && <p className="mt-2 text-xs text-warning-ink">Below the minimum — the code won&apos;t apply here.</p>}
                            {!belowMinimum && off > 0 && off === salePrice && <p className="mt-2 text-xs text-muted-foreground">Covers it all: they&apos;re enrolled the moment they apply it.</p>}
                        </div>

                        <div>
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">The rules</p>
                            <ul className="mt-2 space-y-1.5 text-xs">
                                {rules.map((rule) => (
                                    <li key={rule} className="flex gap-2">
                                        <Check className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
                                        <span>{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {coupon ? "Save changes" : "Create coupon"}
                </Button>
            </ModalFooter>
        </form>
    );
}
