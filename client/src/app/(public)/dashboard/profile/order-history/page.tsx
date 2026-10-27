import { Receipt } from "lucide-react";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";
import { OrderHistorySection } from "@/components/profile/sections/OrderHistorySection";

export default function OrderHistoryProfilePage() {
    return (
        <div className="space-y-6">
            <ProfilePageHeader
                icon={Receipt}
                title="Order History"
                description="Every course order you've placed, and its payment status."
            />
            <OrderHistorySection />
        </div>
    );
}
