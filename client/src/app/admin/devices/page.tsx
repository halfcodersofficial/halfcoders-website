import type { Metadata } from "next";
import MyDevices from "@/components/shared/MyDevices";

export const metadata: Metadata = { title: "My devices", robots: { index: false } };

export default function AdminDevicesPage() {
    return (
        <div className="max-w-3xl">
            <MyDevices passwordHref="/admin/profile" />
        </div>
    );
}
