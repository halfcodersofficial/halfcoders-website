"use client";

import { useSession } from "@/hooks/useSession";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";

/**
 * Mounted once in the root layout so a live notification lands wherever the
 * user happens to be — not just on the notifications page or a console with
 * its own layout. Renders nothing; it only opens the socket.
 */
export default function NotificationListener() {
    const { isAuthenticated } = useSession();
    useNotificationSocket(isAuthenticated);
    return null;
}
