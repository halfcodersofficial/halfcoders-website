import type { Metadata } from "next";
import MyDevices from "@/components/shared/MyDevices";

export const metadata: Metadata = { title: "My devices", robots: { index: false } };

export default function MentorDevicesPage() {
    return (
        <MyDevices passwordHref="/mentor/profile" />
    );
}
