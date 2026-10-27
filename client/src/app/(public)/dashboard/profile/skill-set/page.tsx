"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { InlineEditRow } from "@/components/profile/InlineEditRow";
import { RepeatableList } from "@/components/profile/RepeatableList";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { optionalTextField, optionalUrlField, textField } from "@/lib/validation";
import { studentSkillService } from "@/services/studentProfile";
import type { StudentSkill } from "@/types/profile.types";

const skillSchema = z.object({
    name: textField({ label: "Skill name", max: 80 }),
    yearsOfExperience: optionalTextField({ label: "Year of experience", max: 20 }),
    projectLink: optionalUrlField(),
});

const SKILLS_QUERY_KEY = ["student-skills"];
/** The field is free text: "2" reads as "2 years' experience", "5+" as "5+ years' experience", anything else as typed. */
const experienceLabel = (value: string) => {
    const match = /^(\d+(?:\.\d+)?)(\+?)$/.exec(value.trim());
    if (!match) return value;
    return `${match[1]}${match[2]} ${match[1] === "1" && !match[2] ? "year's" : "years'"} experience`;
};
const OVERVIEW_QUERY_KEY = ["student-profile", "overview"];

export default function SkillSetPage() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: SKILLS_QUERY_KEY,
        queryFn: () => studentSkillService.list(),
    });
    const skills = data?.data ?? [];

    const addForm = useZodForm({
        schema: skillSchema,
        initialValues: { name: "", yearsOfExperience: "", projectLink: "" },
        onSubmit: () => {},
    });

    const createSkill = useMutation({
        mutationFn: (values: z.output<typeof skillSchema>) =>
            studentSkillService.create({
                name: values.name,
                yearsOfExperience: values.yearsOfExperience || undefined,
                projectLink: values.projectLink || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
            toast.success("Skill added.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add the skill.")),
    });

    return (
        <RepeatableList
            title="Skill Set"
            icon={Lightbulb}
            addLabel="Add Skill"
            isLoading={isLoading}
            isEmpty={skills.length === 0}
            emptyIcon={Lightbulb}
            emptyTitle="No skills added yet"
            emptyDescription="Add the skills you want employers to see."
            onStartAdd={() => addForm.reset({ name: "", yearsOfExperience: "", projectLink: "" })}
            onCancelAdd={() => addForm.reset()}
            onSubmitAdd={async () => {
                addForm.submit();
                if (!addForm.isValid) throw new Error("Please fix the highlighted fields.");
                return createSkill.mutateAsync(skillSchema.parse(addForm.values));
            }}
            isSavingAdd={createSkill.isPending}
            renderAddForm={
                <div className="space-y-4">
                    <FormField form={addForm} name="name" label="Skill name" required counterMax={80}>
                        <Input placeholder="e.g. React" />
                    </FormField>
                    <FormField
                        form={addForm}
                        name="yearsOfExperience"
                        label="Year of experience"
                        optional
                        counterMax={20}
                    >
                        <Input placeholder="e.g. 2" />
                    </FormField>
                    <FormField form={addForm} name="projectLink" label="Project link" optional>
                        <Input placeholder="https://..." />
                    </FormField>
                </div>
            }
        >
            {skills.map((skill, index) => (
                <SkillRow key={skill.id} skill={skill} index={index} />
            ))}
        </RepeatableList>
    );
}

function SkillRow({ skill, index }: { skill: StudentSkill; index: number }) {
    const queryClient = useQueryClient();

    const form = useZodForm({
        schema: skillSchema,
        initialValues: {
            name: skill.name,
            yearsOfExperience: skill.yearsOfExperience ?? "",
            projectLink: skill.projectLink ?? "",
        },
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            name: skill.name,
            yearsOfExperience: skill.yearsOfExperience ?? "",
            projectLink: skill.projectLink ?? "",
        });

    const update = useMutation({
        mutationFn: (values: z.output<typeof skillSchema>) =>
            studentSkillService.update(skill.id, {
                name: values.name,
                yearsOfExperience: values.yearsOfExperience || undefined,
                projectLink: values.projectLink || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
            toast.success("Skill updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update the skill.")),
    });

    const remove = useMutation({
        mutationFn: () => studentSkillService.remove(skill.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
            toast.success("Skill removed.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the skill.")),
    });

    return (
        <InlineEditRow
            onEdit={seed}
            onCancel={() => form.reset()}
            onSave={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return update.mutateAsync(skillSchema.parse(form.values));
            }}
            onDelete={() => remove.mutateAsync()}
            deleteConfirm={{ title: "Remove this skill?" }}
            isSaving={update.isPending}
            isDeleting={remove.isPending}
            renderView={
                <div className="flex items-start gap-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-bold tabular-nums text-primary">
                        {index + 1}
                    </span>
                    <div className="min-w-0">
                        <p className="font-semibold leading-snug">{skill.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-muted-foreground">
                                {skill.yearsOfExperience ? experienceLabel(skill.yearsOfExperience) : "Experience not added"}
                            </span>
                            {skill.projectLink && (
                                <a
                                    href={skill.projectLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary hover:bg-primary/15"
                                >
                                    <ExternalLink className="size-3 shrink-0" />
                                    <span className="truncate">Project</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            }
            renderEdit={
                <div className="space-y-4">
                    <FormField form={form} name="name" label="Skill name" required counterMax={80}>
                        <Input />
                    </FormField>
                    <FormField
                        form={form}
                        name="yearsOfExperience"
                        label="Year of experience"
                        optional
                        counterMax={20}
                    >
                        <Input />
                    </FormField>
                    <FormField form={form} name="projectLink" label="Project link" optional>
                        <Input />
                    </FormField>
                </div>
            }
        />
    );
}
