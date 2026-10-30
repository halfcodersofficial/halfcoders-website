"use client";

import Inbox, { type InboxConfig } from "@/components/shared/inbox/Inbox";

/**
 * The admin's notifications — payments landing, free enrolments, students'
 * course requests, and any announcement that reached them — in the shared
 * staff inbox (`components/shared/inbox/Inbox`), so the admin and mentor
 * consoles read alike.
 */
const ADMIN_INBOX: InboxConfig = {
    title: "Notifications",
    blurb: "payments, course requests and announcements for admins.",
    filters: [
        {
            value: "",
            label: "All",
            params: {},
            empty: {
                title: "Nothing here yet.",
                text: "When a student pays, enrols on a free course or asks for a course Half Coders doesn't run yet, it lands here.",
            },
        },
        {
            value: "UNREAD",
            label: "Unread",
            params: { isRead: "false" },
            counts: "all",
            empty: { title: "All caught up.", text: "Nothing unread — new ones show up here the moment they arrive." },
        },
        {
            value: "PAYMENT",
            label: "Payments",
            params: { type: "PAYMENT" },
            counts: ["PAYMENT"],
            empty: { title: "No payments yet.", text: "Every payment that settles — by gateway or confirmed by an admin — shows here." },
        },
        {
            value: "COURSE",
            label: "Courses",
            params: { type: "COURSE" },
            counts: ["COURSE"],
            empty: { title: "No course activity yet.", text: "Free enrolments and students' course requests show here." },
        },
    ],
    actionFor: ({ link }) =>
        link?.startsWith("/admin/orders") ? "Open the payment" : link?.startsWith("/admin/students") ? "Open their profile" : "Open",
};

export default function AdminInbox() {
    return (
        <Inbox config={ADMIN_INBOX} />
    );
}
