import { Ticket } from "lucide-react";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";
import { AdmissionTicketSection } from "@/components/profile/sections/AdmissionTicketSection";

export default function AdmissionTicketProfilePage() {
    return (
        <div className="space-y-6">
            <ProfilePageHeader
                icon={Ticket}
                title="Admission Ticket"
                description="Your ticket for each course you've joined that gives one — save it, or share it with friends."
            />
            <AdmissionTicketSection />
        </div>
    );
}
