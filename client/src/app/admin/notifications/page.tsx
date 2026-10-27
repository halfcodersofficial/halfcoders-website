"use client";

import AdminInbox from "@/components/admin/notifications/AdminInbox";

/**
 * The admin's own inbox — distinct from `/admin/broadcast`, which *sends*
 * notifications out. Payments, free enrolments and course requests reach
 * every admin (`notifyAdmins` on the API), alongside any announcement that
 * included them.
 */
export default function AdminNotificationsPage() {
    return <AdminInbox />;
}
