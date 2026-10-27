import { ProfileShell } from "@/components/profile/ProfileShell";

/** A student's devices open inside the profile sidebar, where "My devices" is listed. */
export default function DevicesLayout({ children }: { children: React.ReactNode }) {
    return <ProfileShell>{children}</ProfileShell>;
}
