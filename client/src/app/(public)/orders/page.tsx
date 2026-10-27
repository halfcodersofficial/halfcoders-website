import { redirect } from "next/navigation";

/**
 * Order history moved under the profile sidebar (`/dashboard/profile/order-
 * history`) alongside the rest of a student's account data. This route stays
 * mounted, purely as a redirect, so old bookmarks and links still resolve.
 */
export default function OrdersRedirectPage() {
    redirect("/dashboard/profile/order-history");
}
