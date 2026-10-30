"use client";

import MentorInbox from "@/components/mentor/notifications/MentorInbox";

/**
 * The mentor's own inbox — hand-ins on the courses they teach, their support
 * sessions going live, course changes and the Half Coders team's announcements.
 * Students keep `AnnouncementsView`; the admin console has its own config of
 * the same shared inbox.
 */
export default function MentorNotificationsPage() {
    return (
        <div className="w-full">
            <MentorInbox />
        </div>
    );
}
