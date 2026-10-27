"use client";

import { ShieldCheck } from "lucide-react";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import DevicesLink from "@/components/shared/DevicesLink";

interface AccountCardProps {
    phone: string | null;
    /** Left out, the card shows no email row (e.g. the page header already shows it). */
    email?: string | null;
}

/** The sign-in details — email and mobile — the way to the devices signed in, and the password, changed here. */
export function AccountCard({ email, phone }: AccountCardProps) {
    return (
        <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <header className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-tight tracking-tight">Sign-in & security</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">How you sign in, where you&apos;re signed in, and your password.</p>
                </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-6">
                <dl className="grid gap-3 sm:grid-cols-2">
                    {email !== undefined && (
                        <div className="min-w-0 rounded-md bg-secondary/40 px-4 py-3">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Email</dt>
                            <dd className="mt-1 truncate font-medium">{email ?? "Not added yet"}</dd>
                        </div>
                    )}
                    <div className="min-w-0 rounded-md bg-secondary/40 px-4 py-3">
                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Mobile number</dt>
                        <dd className="mt-1 font-medium tabular-nums">{phone ?? "Not added yet"}</dd>
                    </div>
                </dl>

                <DevicesLink />

                <div>
                    <h3 className="mb-3 text-sm font-semibold">Change password</h3>
                    <ChangePasswordForm />
                </div>
            </div>
        </section>
    );
}
