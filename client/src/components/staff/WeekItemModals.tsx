"use client";

import { useMutation } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { dateTimeField, numericField, optionalDateTimeField, optionalTextField, textField } from "@/lib/validation";
import { curriculumAuthoring } from "@/services/curriculum";
import type { MentorMilestone } from "@/types/mentor.types";

/**
 * The modals that add or edit a week's assignments and practice days in the
 * Module Manager. The week lists them as rows beside its modules; these hold
 * the forms.
 */

type Assignment = MentorMilestone["assignments"][number];
type PracticeDay = MentorMilestone["practiceDays"][number];

const lateTierRow = z.object({
    until: dateTimeField,
    maxMarks: numericField({ label: "Max marks", min: 0, max: 1000 }),
});

/**
 * Late windows are checked in order against the deadline and each other —
 * the same rules the API enforces — so the message lands on the row to fix.
 */
const assignmentSchema = z
    .object({
        title: textField({ label: "Title", min: 3, max: 200 }),
        description: textField({ label: "What the student has to do", min: 10, max: 5000 }),
        instructions: optionalTextField({ label: "Instructions", max: 5000 }),
        totalMarks: numericField({ label: "Total marks", min: 1, max: 1000 }),
        deadline: optionalDateTimeField,
        lateTiers: z.array(lateTierRow).max(10, "Add at most 10 late windows"),
    })
    .superRefine((values, ctx) => {
        if (values.lateTiers.length === 0) return;
        if (!values.deadline) {
            ctx.addIssue({ code: "custom", path: ["deadline"], message: "Set a deadline before adding late windows" });
            return;
        }

        let previousTime = new Date(values.deadline).getTime();
        let previousMarks = Number(values.totalMarks);
        values.lateTiers.forEach((tier, index) => {
            const time = new Date(tier.until).getTime();
            const marks = Number(tier.maxMarks);
            if (!Number.isNaN(time) && time <= previousTime) {
                ctx.addIssue({
                    code: "custom",
                    path: ["lateTiers", index, "until"],
                    message: index === 0 ? "Must end after the deadline" : "Must end after the window above",
                });
            }
            if (!Number.isNaN(marks) && marks >= previousMarks) {
                ctx.addIssue({
                    code: "custom",
                    path: ["lateTiers", index, "maxMarks"],
                    message:
                        index === 0
                            ? `Must be less than the full ${previousMarks}`
                            : `Must be less than ${previousMarks} (the window above)`,
                });
            }
            previousTime = time;
            previousMarks = marks;
        });
    });

type LateTierValues = { until: string; maxMarks: string };

const DAY_MS = 24 * 60 * 60 * 1000;

const toLateTierPayload = (tiers: LateTierValues[]) =>
    tiers.map((tier) => ({ until: localDateTimeToISO(tier.until), maxMarks: Number(tier.maxMarks) }));

const practiceSchema = z.object({
    title: textField({ label: "Title", min: 3, max: 200 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
    instructions: optionalTextField({ label: "Instructions", max: 5000 }),
});

interface AssignmentFormValues {
    [key: string]: unknown;
    title: string;
    description: string;
    instructions: string;
    totalMarks: string;
    deadline: string;
    lateTiers: LateTierValues[];
}

const EMPTY_ASSIGNMENT: AssignmentFormValues = {
    title: "",
    description: "",
    instructions: "",
    totalMarks: "100",
    deadline: "",
    lateTiers: [],
};

interface PracticeFormValues {
    [key: string]: unknown;
    title: string;
    description: string;
    instructions: string;
}

type Milestone = Pick<MentorMilestone, "id" | "title" | "order">;

const assignmentValues = (assignment: Assignment | null): AssignmentFormValues =>
    assignment
        ? {
            title: assignment.title,
            description: assignment.description,
            instructions: assignment.instructions ?? "",
            totalMarks: String(assignment.totalMarks),
            deadline: assignment.deadline ? toLocalDateTimeValue(new Date(assignment.deadline)) : "",
            lateTiers: assignment.lateTiers.map((tier) => ({
                until: toLocalDateTimeValue(new Date(tier.until)),
                maxMarks: String(tier.maxMarks),
            })),
        }
        : EMPTY_ASSIGNMENT;

/**
 * Add or edit one assignment of a week — the brief, marks, deadline and late
 * windows. Its lessons live on its own page (the row's "Lessons" button), the
 * way a module's do.
 */
export function AssignmentModal({
    open,
    onOpenChange,
    milestone,
    milestoneLabel,
    assignment,
    onSaved,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    milestone: Milestone | null;
    milestoneLabel: string;
    /** Set to edit that assignment; null to add one to `milestone`. */
    assignment: Assignment | null;
    onSaved: () => void;
    /** Called with the new assignment's id — to offer its lessons next. */
    onCreated?: (assignmentId: string) => void;
}) {
    const weekName = milestone ? `${milestoneLabel} ${String(milestone.order).padStart(2, "0")}` : milestoneLabel;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            size="lg"
            title={assignment ? "Edit assignment" : `New assignment — ${weekName}`}
            description="Students see the brief and instructions with the assignment's lessons, above their submission box."
        >
            {milestone && (
                <AssignmentEditor
                    key={assignment?.id ?? "new"}
                    milestoneId={milestone.id}
                    assignment={assignment}
                    onDone={() => onOpenChange(false)}
                    onSaved={onSaved}
                    onCreated={onCreated}
                />
            )}
        </Modal>
    );
}

function AssignmentEditor({
    milestoneId,
    assignment,
    onDone,
    onSaved,
    onCreated,
}: {
    milestoneId: string;
    assignment: Assignment | null;
    onDone: () => void;
    onSaved: () => void;
    onCreated?: (assignmentId: string) => void;
}) {
    const save = useMutation({
        mutationFn: async (values: z.output<typeof assignmentSchema>) => {
            const fields = {
                title: values.title,
                description: values.description,
                totalMarks: Number(values.totalMarks),
                lateTiers: toLateTierPayload(values.lateTiers),
            };
            if (assignment) {
                await curriculumAuthoring.updateAssignment(assignment.id, {
                    ...fields,
                    instructions: values.instructions || null,
                    deadline: values.deadline ? localDateTimeToISO(values.deadline) : null,
                });
                return null;
            }
            return curriculumAuthoring.createAssignment({
                ...fields,
                milestoneId,
                instructions: values.instructions || undefined,
                deadline: values.deadline ? localDateTimeToISO(values.deadline) : undefined,
            });
        },
        onSuccess: (created) => {
            onSaved();
            onDone();
            if (created) {
                if (onCreated) onCreated(created.id);
                else toast.success("Assignment added.");
            } else {
                toast.success("Assignment saved.");
            }
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that assignment.")),
    });

    const form = useZodForm({
        schema: assignmentSchema,
        initialValues: assignmentValues(assignment),
        onSubmit: (values) => save.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <RequiredLegend />
                <FormField form={form} name="title" label="Title" required counterMax={200}>
                    <Input autoFocus placeholder="Build a landing page" />
                </FormField>
                <FormField
                    form={form}
                    name="description"
                    label="What the student has to do"
                    required
                    counterMax={5000}
                    hint="This is the brief they're graded against."
                >
                    <Textarea rows={3} />
                </FormField>
                <FormField
                    form={form}
                    name="instructions"
                    label="Instructions"
                    optional
                    counterMax={5000}
                    hint={markdownHint}
                >
                    <Textarea rows={5} placeholder="Step-by-step guidance, submission format, resources…" />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                    <FormField form={form} name="totalMarks" label="Total marks" required>
                        <Input type="number" inputMode="numeric" min={1} max={1000} />
                    </FormField>
                    <FormField
                        form={form}
                        name="deadline"
                        label="Deadline"
                        optional
                        hint="On time means by this — marked out of the full total."
                    >
                        <DateTimeInput />
                    </FormField>
                </div>
                <LateWindowsField form={form} />
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {!save.isPending && (assignment ? <Save /> : <Plus />)}
                    {assignment ? "Save changes" : "Add assignment"}
                </Button>
            </ModalFooter>
        </form>
    );
}

/** The formatting students' pages render in instructions. */
const markdownHint = (
    <>
        Step by step. Supports <span className="font-mono"># Heading</span>,{" "}
        <span className="font-mono">**bold**</span>, <span className="font-mono">`code`</span>,{" "}
        <span className="font-mono">[link](https://…)</span> and <span className="font-mono">- bullet</span> lines.
    </>
);

/** Add or edit one practice day of a week — text instructions only, no lessons. */
export function PracticeDayModal({
    open,
    onOpenChange,
    milestone,
    milestoneLabel,
    practice,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    milestone: Milestone | null;
    milestoneLabel: string;
    /** Set to edit that practice day; null to add one to `milestone`. */
    practice: PracticeDay | null;
    onSaved: () => void;
}) {
    const weekName = milestone ? `${milestoneLabel} ${String(milestone.order).padStart(2, "0")}` : milestoneLabel;

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            title={practice ? "Edit practice day" : `New practice day — ${weekName}`}
            description="A hands-on day with written instructions only — no lessons, nothing to submit or grade. Students follow them and mark the day done."
        >
            {milestone && (
                <PracticeEditor
                    key={practice?.id ?? "new"}
                    milestoneId={milestone.id}
                    practice={practice}
                    onDone={() => onOpenChange(false)}
                    onSaved={onSaved}
                />
            )}
        </Modal>
    );
}

function PracticeEditor({
    milestoneId,
    practice,
    onDone,
    onSaved,
}: {
    milestoneId: string;
    practice: PracticeDay | null;
    onDone: () => void;
    onSaved: () => void;
}) {
    const save = useMutation({
        mutationFn: (values: z.output<typeof practiceSchema>) =>
            practice
                ? curriculumAuthoring.updatePracticeDay(practice.id, {
                    title: values.title,
                    description: values.description || null,
                    instructions: values.instructions || null,
                })
                : curriculumAuthoring.createPracticeDay({
                    milestoneId,
                    title: values.title,
                    description: values.description || undefined,
                    instructions: values.instructions || undefined,
                }),
        onSuccess: () => {
            toast.success(practice ? "Practice day saved." : "Practice day added.");
            onSaved();
            onDone();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that practice day.")),
    });

    const form = useZodForm({
        schema: practiceSchema,
        initialValues: {
            title: practice?.title ?? "",
            description: practice?.description ?? "",
            instructions: practice?.instructions ?? "",
        } satisfies PracticeFormValues,
        onSubmit: (values) => save.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <RequiredLegend />
                <FormField form={form} name="title" label="Title" required counterMax={200}>
                    <Input autoFocus placeholder="Practice day" />
                </FormField>
                <FormField
                    form={form}
                    name="instructions"
                    label="Instructions"
                    optional
                    counterMax={5000}
                    hint={markdownHint}
                >
                    <Textarea rows={8} placeholder="What to practise today, step by step, and how they know they're done…" />
                </FormField>
                <FormField
                    form={form}
                    name="description"
                    label="Short summary"
                    optional
                    counterMax={2000}
                    hint="One or two lines above the instructions."
                >
                    <Textarea rows={2} />
                </FormField>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {!save.isPending && (practice ? <Save /> : <Plus />)}
                    {practice ? "Save changes" : "Add practice day"}
                </Button>
            </ModalFooter>
        </form>
    );
}

/**
 * The late-submission windows after the deadline: each one says "submitted by
 * this time → marked out of this many". Marks only go down window to window,
 * and after the last one submissions close. A new window starts two days
 * after the previous one with a fifth of the total knocked off — the usual
 * shape — and both are editable.
 */
function LateWindowsField({ form }: { form: ZodFormApi<AssignmentFormValues> }) {
    const tiers = form.values.lateTiers;
    const deadline = form.values.deadline;
    const total = Number(form.values.totalMarks) || 100;

    const setTiers = (next: LateTierValues[]) => form.setValue("lateTiers", next);
    const update = (index: number, patch: Partial<LateTierValues>) =>
        setTiers(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

    const addWindow = () => {
        const last = tiers.at(-1);
        const from = new Date(last?.until || deadline);
        const until = Number.isNaN(from.getTime()) ? "" : toLocalDateTimeValue(new Date(from.getTime() + 2 * DAY_MS));
        const previousMarks = last ? Number(last.maxMarks) || 0 : total;
        const maxMarks = String(Math.max(0, previousMarks - Math.round(total * 0.2)));
        setTiers([...tiers, { until, maxMarks }]);
    };

    return (
        <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">
                Late submissions <span className="font-normal text-muted-foreground">(optional)</span>
            </legend>
            <p className="text-xs text-muted-foreground">
                {deadline
                    ? `Work in by the deadline is marked out of ${total}. Add windows after it for late work — each allows fewer marks. After the last window, submissions close.`
                    : "Set a deadline first — late windows run after it. Without any, submissions close at the deadline."}
            </p>

            {tiers.map((tier, index) => {
                const untilKey = `lateTiers.${index}.until`;
                const marksKey = `lateTiers.${index}.maxMarks`;
                const untilError = form.errorFor(untilKey);
                const marksError = form.errorFor(marksKey);

                return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-start">
                        <div className="space-y-1">
                            <label htmlFor={form.idFor(untilKey)} className="text-xs font-medium">
                                Late until
                            </label>
                            <DateTimeInput
                                id={form.idFor(untilKey)}
                                title={`Late window ${index + 1} ends`}
                                value={tier.until}
                                min={(index === 0 ? deadline : tiers[index - 1].until) || undefined}
                                onValueChange={(value) => update(index, { until: value })}
                                onBlur={() => form.touch(untilKey)}
                                aria-invalid={untilError ? true : undefined}
                            />
                            {untilError && <p className="text-xs text-destructive">{untilError}</p>}
                        </div>
                        <div className="space-y-1">
                            <label htmlFor={form.idFor(marksKey)} className="text-xs font-medium">
                                Max marks
                            </label>
                            <Input
                                id={form.idFor(marksKey)}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={total}
                                value={tier.maxMarks}
                                onChange={(event) => update(index, { maxMarks: event.target.value })}
                                onBlur={() => form.touch(marksKey)}
                                aria-invalid={marksError ? true : undefined}
                            />
                            {marksError && <p className="text-xs text-destructive">{marksError}</p>}
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 sm:mt-6"
                            aria-label={`Remove late window ${index + 1}`}
                            onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                        >
                            <Trash2 />
                        </Button>
                    </div>
                );
            })}

            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!deadline || tiers.length >= 10}
                onClick={addWindow}
            >
                <Plus /> Add late window
            </Button>
        </fieldset>
    );
}

