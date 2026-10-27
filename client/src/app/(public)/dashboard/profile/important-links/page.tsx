"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderGit2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { InlineEditRow } from "@/components/profile/InlineEditRow";
import { RepeatableList } from "@/components/profile/RepeatableList";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { optionalTextField, optionalUrlField, textField, urlField } from "@/lib/validation";
import { studentProfileService, studentProjectService } from "@/services/studentProfile";
import type { StudentProject } from "@/types/profile.types";

const linksSchema = z.object({
    cvUrl: optionalUrlField(),
    githubUrl: optionalUrlField(),
    portfolioUrl: optionalUrlField(),
    linkedinUrl: optionalUrlField(),
    profileImageUrl: optionalUrlField(),
});

const projectSchema = z.object({
    title: textField({ label: "Title", max: 160 }),
    description: optionalTextField({ label: "Description", max: 1000 }),
    url: urlField(),
});

const LINKS_QUERY_KEY = ["student-profile", "links"];
const PROJECTS_QUERY_KEY = ["student-projects"];
const OVERVIEW_QUERY_KEY = ["student-profile", "overview"];

/** A view-mode link, or nothing when the field is unset (`ViewField` shows "—" then). */
const openLink = (url: string | null | undefined, label: string) =>
    url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {label}
        </a>
    ) : undefined;

export default function ImportantLinksPage() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: LINKS_QUERY_KEY,
        queryFn: studentProfileService.links,
    });

    const saveLinks = useMutation({
        mutationFn: (values: z.output<typeof linksSchema>) =>
            studentProfileService.updateLinks({
                cvUrl: values.cvUrl || undefined,
                githubUrl: values.githubUrl || undefined,
                portfolioUrl: values.portfolioUrl || undefined,
                linkedinUrl: values.linkedinUrl || undefined,
                profileImageUrl: values.profileImageUrl || undefined,
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData(LINKS_QUERY_KEY, updated);
            queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
            toast.success("Important links updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your links.")),
    });

    const form = useZodForm({
        schema: linksSchema,
        initialValues: {
            cvUrl: "",
            githubUrl: "",
            portfolioUrl: "",
            linkedinUrl: "",
            profileImageUrl: "",
        },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            cvUrl: data?.cvUrl ?? "",
            githubUrl: data?.githubUrl ?? "",
            portfolioUrl: data?.portfolioUrl ?? "",
            linkedinUrl: data?.linkedinUrl ?? "",
            profileImageUrl: data?.profileImageUrl ?? "",
        });

    const projectsQuery = useQuery({
        queryKey: PROJECTS_QUERY_KEY,
        queryFn: () => studentProjectService.list(),
    });
    const projects = projectsQuery.data?.data ?? [];

    const addForm = useZodForm({
        schema: projectSchema,
        initialValues: { title: "", description: "", url: "" },
        onSubmit: () => {},
    });

    const createProject = useMutation({
        mutationFn: (values: z.output<typeof projectSchema>) =>
            studentProjectService.create({
                title: values.title,
                description: values.description || undefined,
                url: values.url,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
            toast.success("Project added.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add the project.")),
    });

    return (
        <div className="space-y-6">
            <SectionPanel
                title="Important Links"
                icon={Link2}
                empty={
                    data && Object.values(data).some(Boolean)
                        ? undefined
                        : { title: "No links added yet", description: "Add your CV, GitHub, portfolio and LinkedIn so they're all in one place." }
                }
                isLoading={isLoading}
                isSaving={saveLinks.isPending}
                onEdit={seed}
                onCancel={() => form.reset()}
                onSave={async () => {
                    form.submit();
                    if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                    return saveLinks.mutateAsync(linksSchema.parse(form.values));
                }}
                renderView={
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <ViewField label="CV link (Google Drive)" value={openLink(data?.cvUrl, "Open CV Link")} />
                        <ViewField label="Github Profile" value={openLink(data?.githubUrl, "Open Github Profile")} />
                        <ViewField
                            label="Portfolio link"
                            value={openLink(data?.portfolioUrl, "Open Portfolio Link")}
                        />
                        <ViewField
                            label="LinkedIn Profile link"
                            value={openLink(data?.linkedinUrl, "Open LinkedIn Profile")}
                        />
                        <ViewField
                            label="Good professional Profile image link"
                            value={openLink(data?.profileImageUrl, "Open Professional Image")}
                        />
                    </dl>
                }
                renderEdit={
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField form={form} name="cvUrl" label="CV link (Google Drive)" optional>
                            <Input placeholder="https://drive.google.com/..." />
                        </FormField>
                        <FormField form={form} name="githubUrl" label="Github Profile" optional>
                            <Input placeholder="https://github.com/..." />
                        </FormField>
                        <FormField form={form} name="portfolioUrl" label="Portfolio link" optional>
                            <Input placeholder="https://..." />
                        </FormField>
                        <FormField form={form} name="linkedinUrl" label="LinkedIn Profile link" optional>
                            <Input placeholder="https://linkedin.com/in/..." />
                        </FormField>
                        <FormField
                            form={form}
                            name="profileImageUrl"
                            label="Good professional Profile image link"
                            optional
                        >
                            <Input placeholder="https://..." />
                        </FormField>
                    </div>
                }
            />

            <RepeatableList
                title="Projects"
                icon={FolderGit2}
                addLabel="Add Project Link"
                isLoading={projectsQuery.isLoading}
                isEmpty={projects.length === 0}
                emptyIcon={FolderGit2}
                emptyTitle="No projects added yet"
                emptyDescription="Add a link to something you've built."
                onStartAdd={() => addForm.reset({ title: "", description: "", url: "" })}
                onCancelAdd={() => addForm.reset()}
                onSubmitAdd={async () => {
                    addForm.submit();
                    if (!addForm.isValid) throw new Error("Please fix the highlighted fields.");
                    return createProject.mutateAsync(projectSchema.parse(addForm.values));
                }}
                isSavingAdd={createProject.isPending}
                renderAddForm={
                    <div className="space-y-4">
                        <FormField form={addForm} name="title" label="Title" required counterMax={160}>
                            <Input placeholder="Project title" />
                        </FormField>
                        <FormField
                            form={addForm}
                            name="description"
                            label="Description"
                            optional
                            counterMax={1000}
                        >
                            <Textarea placeholder="What did you build?" />
                        </FormField>
                        <FormField form={addForm} name="url" label="Project link" required>
                            <Input placeholder="https://..." />
                        </FormField>
                    </div>
                }
            >
                {projects.map((project) => (
                    <ProjectRow key={project.id} project={project} />
                ))}
            </RepeatableList>
        </div>
    );
}

function ProjectRow({ project }: { project: StudentProject }) {
    const queryClient = useQueryClient();

    const form = useZodForm({
        schema: projectSchema,
        initialValues: {
            title: project.title,
            description: project.description ?? "",
            url: project.url,
        },
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            title: project.title,
            description: project.description ?? "",
            url: project.url,
        });

    const update = useMutation({
        mutationFn: (values: z.output<typeof projectSchema>) =>
            studentProjectService.update(project.id, {
                title: values.title,
                description: values.description || undefined,
                url: values.url,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
            toast.success("Project updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update the project.")),
    });

    const remove = useMutation({
        mutationFn: () => studentProjectService.remove(project.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
            toast.success("Project removed.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the project.")),
    });

    return (
        <InlineEditRow
            onEdit={seed}
            onCancel={() => form.reset()}
            onSave={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return update.mutateAsync(projectSchema.parse(form.values));
            }}
            onDelete={() => remove.mutateAsync()}
            deleteConfirm={{ title: "Remove this project?" }}
            isSaving={update.isPending}
            isDeleting={remove.isPending}
            renderView={
                <div className="flex items-start gap-3.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <FolderGit2 className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{project.title}</p>
                        {project.description && (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{project.description}</p>
                        )}
                        <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">{project.url.replace(/^https?:\/\//, "")}</span>
                        </a>
                    </div>
                </div>
            }
            renderEdit={
                <div className="space-y-4">
                    <FormField form={form} name="title" label="Title" required counterMax={160}>
                        <Input />
                    </FormField>
                    <FormField form={form} name="description" label="Description" optional counterMax={1000}>
                        <Textarea />
                    </FormField>
                    <FormField form={form} name="url" label="Project link" required>
                        <Input />
                    </FormField>
                </div>
            }
        />
    );
}
