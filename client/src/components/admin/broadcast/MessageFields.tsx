"use client";

import { CornerDownRight } from "lucide-react";
import type { ReactNode } from "react";
import TypePicker from "@/components/admin/broadcast/TypePicker";
import type { MessageDraft } from "@/components/admin/broadcast/composer";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import type { ZodFormApi } from "@/hooks/useZodForm";
import { cn } from "@/lib/utils";

/**
 * The message itself — type, title, text and where it opens — as both
 * broadcast composers ask for it. Under the link sit the paths a message to
 * this audience usually points at, one click each.
 */
export default function MessageFields<T extends MessageDraft>({
    form,
    destinations,
    titlePlaceholder,
    messagePlaceholder,
    messageHint,
    linkHint,
}: {
    form: ZodFormApi<T>;
    destinations: { label: string; path: string }[];
    titlePlaceholder: string;
    messagePlaceholder: string;
    messageHint: ReactNode;
    linkHint: ReactNode;
}) {
    const link = form.values.link;

    return (
        <div className="space-y-5">
            <RequiredLegend />

            <FormField form={form} name="type" label="Type" hint="The tag beside it in the bell.">
                <TypePicker />
            </FormField>

            <FormField form={form} name="title" label="Title" required counterMax={160}>
                <Input placeholder={titlePlaceholder} />
            </FormField>

            <FormField form={form} name="message" label="Message" required counterMax={2000} hint={messageHint}>
                <Textarea rows={5} placeholder={messagePlaceholder} />
            </FormField>

            <div className="space-y-2">
                <FormField form={form} name="link" label="Opens" optional hint={linkHint}>
                    <Input
                        addonStart={<CornerDownRight className="size-4" aria-hidden />}
                        placeholder="/learn/mern-stack-development"
                    />
                </FormField>

                {destinations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="mr-1 text-muted-foreground">Quick pick:</span>
                        {destinations.map((destination) => {
                            const active = link === destination.path;
                            return (
                                <button
                                    key={destination.path}
                                    type="button"
                                    aria-pressed={active}
                                    title={destination.path}
                                    onClick={() => form.setValue("link", (active ? "" : destination.path) as T["link"])}
                                    className={cn(
                                        "rounded-md px-2 py-1 font-medium transition-colors",
                                        active
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                    )}
                                >
                                    {destination.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
