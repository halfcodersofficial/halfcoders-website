import type { Metadata } from "next";
import MyDevices from "@/components/shared/MyDevices";

export const metadata: Metadata = { title: "My devices", robots: { index: false } };

/** A student's devices, in the profile shell (layout.tsx). The password is changed on My Profile. */
export default function StudentDevicesPage() {
    return <MyDevices passwordHref="/dashboard/profile" />;
}
