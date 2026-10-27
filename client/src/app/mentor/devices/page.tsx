import type { Metadata } from "next";
import MyDevices from "@/components/shared/MyDevices";

export const metadata: Metadata = { title: "My devices", robots: { index: false } };

export default function MentorDevicesPage() {
    return (
        <div className="container-page max-w-3xl py-10">
            <MyDevices passwordHref="/mentor/profile" />
        </div>
    );
}
