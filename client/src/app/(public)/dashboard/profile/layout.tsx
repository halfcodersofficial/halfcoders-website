import { ProfileShell } from "@/components/profile/ProfileShell";

/**
 * The shell every `/dashboard/profile/*` page shares (components/profile/
 * ProfileShell.tsx). See `dashboard/layout.tsx` for why this subtree gets a
 * sidebar and almost nothing else under `/dashboard` does.
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return <ProfileShell>{children}</ProfileShell>;
}
