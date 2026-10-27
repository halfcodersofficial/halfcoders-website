"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ProfileEmptyState } from "@/components/profile/ProfileEmptyState";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { optionalTextField, textField } from "@/lib/validation";
import { studentCourseRequestService } from "@/services/studentProfile";
import type { CourseRequestStatus } from "@/types/profile.types";

const schema = z.object({
    courseName: textField({ label: "Course name", max: 160 }),
    category: optionalTextField({ label: "Category", max: 80 }),
});

const QUERY_KEY = ["student-course-requests"];

/** Each status in words — where a request stands with the team. */
const STATUS_META: Record<CourseRequestStatus, { label: string; className: string }> = {
    PENDING: { label: "Sent", className: "bg-secondary text-muted-foreground" },
    REVIEWED: { label: "Being looked at", className: "bg-primary/10 text-primary" },
    FULFILLED: { label: "Course added", className: "bg-success/10 text-success" },
    DECLINED: { label: "Not planned", className: "bg-destructive/10 text-destructive" },
};

/**
 * Not a real spec in the reference screenshots (the "Option: acc" panel and
 * "No available course!" empty state were unreadable) — a minimal, sensible
 * stand-in: ask for a course by name, see the request's status. No edit/
 * delete — a request is fire-and-forget, and there's no admin-side
 * moderation UI in this pass.
 */
export default function CourseRequestPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => studentCourseRequestService.list(),
    });

    const create = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            studentCourseRequestService.create({
                courseName: values.courseName,
                category: values.category || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Request sent — we'll let you know if the course gets added.");
            form.reset({ courseName: "", category: "" });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send that request.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { courseName: "", category: "" },
        onSubmit: (values) => create.mutate(values),
    });

    const requests = data?.data ?? [];

    return (
        <div className="space-y-6">
            <ProfilePageHeader
                icon={ClipboardList}
                title="Course Request"
                description="Is there a course you'd like to see on Half Coders? Ask for it here."
            />

            <form
                className="overflow-hidden rounded-card border border-border bg-card shadow-card"
                noValidate
                onSubmit={form.handleSubmit}
            >
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-[2fr_1fr] sm:px-6">
                    <FormField form={form} name="courseName" label="Course name" required>
                        <Input placeholder="e.g. Advanced React" />
                    </FormField>
                    <FormField form={form} name="category" label="Category" optional>
                        <Input placeholder="e.g. Web Development" />
                    </FormField>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/40 px-5 py-3 sm:px-6">
                    <p className="text-xs text-muted-foreground">We&apos;ll let you know if the course gets added.</p>
                    <Button type="submit" className="px-5" isLoading={create.isPending}>
                        <Send className="size-4" /> Send request
                    </Button>
                </div>
            </form>

            <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                    Your requests
                    {requests.length > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                            {requests.length}
                        </span>
                    )}
                </h2>
                {isLoading ? (
                    <Skeleton className="h-24 rounded-card" />
                ) : requests.length === 0 ? (
                    <ProfileEmptyState
                        icon={ClipboardList}
                        title="No course requests yet"
                        description="Ask for a course you'd like to see on Half Coders — it shows up here with where it stands."
                    />
                ) : (
                    <ul className="space-y-3">
                        {requests.map((request) => {
                            const meta = STATUS_META[request.status];
                            return (
                                <li
                                    key={request.id}
                                    className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card"
                                >
                                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                        <BookOpen className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold">{request.courseName}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {request.category ? `${request.category} · ` : ""}
                                            Requested {formatDate(request.createdAt)}
                                        </p>
                                    </div>
                                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.className)}>
                                        {meta.label}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
