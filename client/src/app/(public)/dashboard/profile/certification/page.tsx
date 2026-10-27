import { BadgeCheck } from "lucide-react";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";
import { CertificationSection } from "@/components/profile/sections/CertificationSection";

export default function CertificationProfilePage() {
    return (
        <div className="space-y-6">
            <ProfilePageHeader
                icon={BadgeCheck}
                title="Certification"
                description="Every certificate you've earned on Half Coders — each one can be verified by its number."
            />
            <CertificationSection />
        </div>
    );
}
