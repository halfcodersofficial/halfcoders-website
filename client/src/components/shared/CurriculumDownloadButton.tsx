"use client";

import { FileText } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import CurriculumAuthModal from "@/components/shared/CurriculumAuthModal";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { getApiErrorMessage } from "@/lib/httpClient";
import { catalogueService } from "@/services";

/**
 * The one control for the pre-enrolment roadmap PDF — course listing and the
 * course detail page both render this rather than each wiring up their own
 * copy of the auth check, the download, and the error toast.
 *
 * Case A (guest) vs case B (signed in) lives here: the session check happens
 * client-side before ever asking the API, so a guest sees the create-account
 * prompt instead of a request that would just 401. The backend enforces the
 * same rule independently either way.
 */
export default function CurriculumDownloadButton({
    slug,
    label = "Curriculum",
    variant = "outline",
    size,
    className,
}: {
    slug: string;
    label?: string;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
}) {
    const pathname = usePathname();
    const { isAuthenticated, isLoading: isSessionLoading } = useSession();
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleClick = async () => {
        if (isSessionLoading) return;

        if (!isAuthenticated) {
            setAuthModalOpen(true);
            return;
        }

        setIsDownloading(true);
        try {
            const { blob, fileName } = await catalogueService.downloadCurriculumPdf(slug);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't download the curriculum."));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                className={className}
                onClick={handleClick}
                isLoading={isDownloading}
            >
                <FileText className="size-4" />
                {label}
            </Button>

            <CurriculumAuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} next={pathname} />
        </>
    );
}
