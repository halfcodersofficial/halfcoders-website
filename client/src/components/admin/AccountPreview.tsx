"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

/**
 * An admin account as it will appear in this console's list.
 *
 * Unlike a mentor, an admin has no public profile — nothing typed here reaches
 * a student — so the list row *is* the surface, and previewing anything else
 * would be inventing a page that doesn't exist.
 *
 * The temporary password is deliberately absent. The form masks it behind a
 * reveal toggle so it isn't left on screen; repeating it in plaintext here
 * would undo that.
 */
export interface AccountPreviewValues {
    name: string;
    email: string;
    phone: string;
}

export default function AccountPreview({ values }: { values: AccountPreviewValues }) {
    const name = values.name.trim();
    const email = values.email.trim();

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
                <Avatar src={null} name={name || "New admin"} size={40} />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                            {name || <span className="text-muted-foreground">Admin name</span>}
                        </p>
                        <Badge variant="secondary">ADMIN</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                        {email || "name@example.com"} · joined {formatDate(new Date())}
                    </p>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Created as <span className="font-medium">ADMIN</span>, not super admin — they can
                run the console but cannot create admins or change roles.
                {values.phone.trim() !== "" && " The phone number is for contact only; it isn't shown here."}
            </p>
        </div>
    );
}
