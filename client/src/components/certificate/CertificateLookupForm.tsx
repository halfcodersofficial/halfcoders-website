"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";

// The prefix is an admin setting, so the shape is checked rather than the exact
// text: a prefix, the course's code if it has one, the year of issue, and a
// serial. That still catches the two things people actually paste by mistake —
// a course name, or a whole URL.
const schema = z.object({
    certificateNo: z
        .string()
        .trim()
        .min(1, "Enter the certificate ID printed on the document")
        .regex(/^[A-Za-z0-9]+(-[A-Za-z][A-Za-z0-9]*)?-\d{4}-\d+$/, "Certificate IDs look like HCC-CE-2026-000125"),
});

/** The certificate ID field and its button — on the lookup page, and again on "not found" to try once more. */
export default function CertificateLookupForm({ initialValue = "" }: { initialValue?: string }) {
    const router = useRouter();

    const form = useZodForm({
        schema,
        initialValues: { certificateNo: initialValue },
        onSubmit: ({ certificateNo }) => router.push(`/certificate/${encodeURIComponent(certificateNo.toUpperCase())}`),
    });

    return (
        <form className="space-y-4 text-left" noValidate onSubmit={form.handleSubmit}>
            <FormField form={form} name="certificateNo" label="Certificate ID" required hint="Printed on the certificate, labelled “Certificate ID”.">
                <Input
                    className="h-12 font-mono text-base uppercase tracking-wide"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="HCC-CE-2026-000125"
                />
            </FormField>

            <Button type="submit" variant="brand" className="w-full" size="lg">
                <Search className="size-4" /> Run verify
            </Button>
        </form>
    );
}
