"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, Hash, QrCode, Smartphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { CopyButton } from "@/components/shared/FooterBits";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { BKASH } from "@/lib/brand";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import type { BkashSubmission } from "@/services";

/** "+880 1712-345678" / "01712 345678" → "01712345678" — the form the API keeps. */
const normaliseMobile = (value: string) => value.replace(/[\s-]/g, "").replace(/^(?:\+?88)?(?=01)/, "");

const submissionSchema = z.object({
    transactionId: z
        .string()
        .trim()
        .min(1, "Transaction ID is required")
        .transform((value) => value.toUpperCase())
        .pipe(z.string().regex(/^[A-Z0-9]{8,12}$/, "Enter the transaction ID from your bKash message — 10 letters and numbers")),
    senderNumber: z
        .string()
        .trim()
        .min(1, "The bKash number you paid from is required")
        .transform(normaliseMobile)
        .pipe(z.string().regex(/^01[3-9]\d{8}$/, "Enter a Bangladeshi mobile number, e.g. 01712345678")),
});

type Method = "qr" | "number";

interface BkashPaymentProps {
    /** What to pay, in whole taka. */
    amount: number;
    /** The order number, given as the payment's reference so the admin can match it. */
    reference: string;
    /** What the student already sent in, if anything — then it's waiting on an admin. */
    submitted: { transactionId: string; senderNumber?: string; submittedAt?: string } | null;
    onSubmit: (details: BkashSubmission) => Promise<unknown>;
}

/**
 * Paying by bKash, by hand, in two pages of one checkout:
 *
 * 1. How to pay — scan the merchant QR, or "Payment" to the merchant number
 *    in the bKash app — step by step, with the amount and the reference to
 *    type and copy buttons for each. The student agrees to the terms, pays in
 *    their bKash app, and moves on.
 * 2. `?step=confirm` — the transaction ID bKash sent them and the number they
 *    paid from, for an admin to match against the merchant statement.
 *
 * Once sent in, it shows what was sent and that it's being checked; the
 * checkout page polls, and opens the course when an admin marks it paid.
 */
export default function BkashPayment({ amount, reference, submitted, onSubmit }: BkashPaymentProps) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const confirming = searchParams.get("step") === "confirm";

    if (submitted) return <Submitted details={submitted} />;
    if (confirming) {
        return (
            <ConfirmPayment
                amount={amount}
                onBack={() => router.push(pathname, { scroll: false })}
                onSubmit={async (details) => {
                    await onSubmit(details);
                    router.replace(pathname, { scroll: false });
                }}
            />
        );
    }
    return <PaySteps amount={amount} reference={reference} onPaid={() => router.push(`${pathname}?step=confirm`, { scroll: false })} />;
}

function Step({ index, children }: { index: number; children: ReactNode }) {
    return (
        <li className="relative flex gap-3.5 pb-5 last:pb-0">
            <span aria-hidden className="absolute bottom-0 left-3.5 top-8 w-px -translate-x-1/2 bg-border [li:last-child>&]:hidden" />
            <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-primary/30 bg-primary/5 font-mono text-xs font-semibold text-primary">
                {index.toLocaleString("bn-BD")}
            </span>
            <div className="min-w-0 pt-0.5 text-sm leading-relaxed">{children}</div>
        </li>
    );
}

/** A value to type into bKash, with a copy button — the number, the amount, the reference. */
function CopyValue({ label, value, display }: { label: string; value: string; display?: string }) {
    return (
        <span className="mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-md border border-border bg-surface py-1 pl-3 pr-1">
            <span className="min-w-0 truncate font-mono text-base font-semibold tracking-wide" lang="en">
                {display ?? value}
            </span>
            <CopyButton value={value} label={`Copy ${label}`} />
        </span>
    );
}

function PaySteps({ amount, reference, onPaid }: { amount: number; reference: string; onPaid: () => void }) {
    const [method, setMethod] = useState<Method>("qr");
    const [agreed, setAgreed] = useState(false);
    const taka = String(amount);

    const amountStep = (
        <>
            Amount-এ লিখুন <strong>{formatBDT(amount)}</strong> — ঠিক এই টাকাটাই।
            <CopyValue label="the amount" value={taka} display={formatBDT(amount)} />
        </>
    );
    const referenceStep = (
        <>
            Reference-এ আপনার অর্ডার নম্বরটা লিখুন, যাতে আমরা পেমেন্টটা মিলিয়ে নিতে পারি।
            <CopyValue label="the order number" value={reference} />
        </>
    );
    const confirmStep = (
        <>
            আপনার bKash PIN দিয়ে পেমেন্ট কনফার্ম করুন। bKash যে মেসেজ পাঠাবে, তাতে একটা <strong>Transaction ID (TrxID)</strong>{" "}
            থাকবে — পরের ধাপে সেটা লাগবে।
        </>
    );

    return (
        <section lang="bn" className="rounded-panel border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#E2136E] text-white">
                    <Smartphone className="size-5" aria-hidden />
                </span>
                <div>
                    <h2 className="text-lg font-bold leading-tight">bKash-এ পেমেন্ট করুন</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        দুইভাবে করতে পারবেন: QR স্ক্যান করে, অথবা মার্চেন্ট নম্বরে Payment করে। যেটা সুবিধা, সেটা বেছে নিন।
                    </p>
                </div>
            </div>

            <div role="tablist" aria-label="পেমেন্টের উপায়" className="mt-5 grid grid-cols-2 border-b border-border">
                {(
                    [
                        { id: "qr", label: "QR স্ক্যান করে", icon: QrCode },
                        { id: "number", label: "নম্বরে Payment করে", icon: Hash },
                    ] as const
                ).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={method === id}
                        onClick={() => setMethod(id)}
                        className={cn(
                            "-mb-px flex items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                            method === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon className="size-4" aria-hidden /> {label}
                    </button>
                ))}
            </div>

            {method === "qr" ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <ol>
                        <Step index={1}>
                            ফোনে <strong>bKash অ্যাপ</strong> খুলে <strong lang="en">&quot;Scan QR&quot;</strong>-এ চাপ দিন।
                        </Step>
                        <Step index={2}>
                            পাশের QR কোডটা স্ক্যান করুন। এই পেজটা ফোনেই খোলা থাকলে QR-টা ডাউনলোড করে নিন, তারপর স্ক্যানারের গ্যালারি
                            থেকে ছবিটা বেছে দিন।
                        </Step>
                        <Step index={3}>
                            নাম দেখে মিলিয়ে নিন: মার্চেন্ট নম্বর <strong lang="en">{BKASH.display}</strong>।
                        </Step>
                        <Step index={4}>{amountStep}</Step>
                        <Step index={5}>{referenceStep}</Step>
                        <Step index={6}>{confirmStep}</Step>
                    </ol>
                    <figure className="mx-auto w-full max-w-48 sm:mx-0">
                        <Image
                            src={BKASH.qr}
                            alt={`bKash merchant QR code for ${BKASH.display}`}
                            width={989}
                            height={1383}
                            className="h-auto w-full rounded-md border border-border"
                        />
                        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                            <a href={BKASH.qr} download="halfcoders-bkash-qr.jpeg">
                                <Download className="size-4" aria-hidden /> QR ডাউনলোড করুন
                            </a>
                        </Button>
                    </figure>
                </div>
            ) : (
                <ol className="mt-6">
                    <Step index={1}>
                        ফোনে <strong>bKash অ্যাপ</strong> খুলে <strong lang="en">&quot;Payment&quot;</strong> অপশনে যান। (Send Money না,
                        এটা মার্চেন্ট নম্বর।)
                    </Step>
                    <Step index={2}>
                        মার্চেন্ট নম্বর হিসেবে লিখুন:
                        <CopyValue label="the bKash merchant number" value={BKASH.number} display={BKASH.display} />
                    </Step>
                    <Step index={3}>{amountStep}</Step>
                    <Step index={4}>{referenceStep}</Step>
                    <Step index={5}>{confirmStep}</Step>
                </ol>
            )}

            <div className="mt-6 space-y-4 border-t border-border pt-5">
                <Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)}>
                    <span className="font-normal">
                        আমি{" "}
                        <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
                            শর্তাবলী
                        </Link>{" "}
                        পড়েছি এবং মেনে নিচ্ছি
                    </span>
                </Checkbox>
                <Button size="lg" variant="brand" className="w-full" disabled={!agreed} onClick={onPaid}>
                    পেমেন্ট করেছি — পরের ধাপ <ArrowRight className="size-4" aria-hidden />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                    পেমেন্ট করার পর পরের ধাপে Transaction ID দেবেন। আমরা মিলিয়ে দেখে কোর্সটা খুলে দেব।
                </p>
            </div>
        </section>
    );
}

function ConfirmPayment({
    amount,
    onBack,
    onSubmit,
}: {
    amount: number;
    onBack: () => void;
    onSubmit: (details: BkashSubmission) => Promise<void>;
}) {
    const [sending, setSending] = useState(false);
    const form = useZodForm({
        schema: submissionSchema,
        initialValues: { transactionId: "", senderNumber: "" },
        onSubmit: async (values) => {
            setSending(true);
            try {
                await onSubmit(values);
            } finally {
                setSending(false);
            }
        },
    });

    return (
        <section lang="bn" className="rounded-panel border border-border bg-card p-5 shadow-card sm:p-6">
            <button
                type="button"
                onClick={onBack}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" aria-hidden /> পেমেন্টের ধাপগুলো আবার দেখুন
            </button>
            <h2 className="text-lg font-bold leading-tight">পেমেন্টের তথ্য দিন</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {formatBDT(amount)} পেমেন্ট করার পর bKash যে মেসেজ পাঠিয়েছে, সেখান থেকে Transaction ID (TrxID) আর যে নম্বর থেকে
                পেমেন্ট করেছেন সেটা লিখুন।
            </p>

            <form onSubmit={form.handleSubmit} className="mt-5 space-y-4" noValidate>
                <FormField form={form} name="transactionId" label="Transaction ID (TrxID)" required hint="bKash-এর মেসেজে থাকে, যেমন BFH4K9L2QX">
                    <Input autoComplete="off" placeholder="BFH4K9L2QX" className="font-mono uppercase" maxLength={12} lang="en" />
                </FormField>
                <FormField form={form} name="senderNumber" label="যে bKash নম্বর থেকে পেমেন্ট করেছেন" required>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="01712345678" lang="en" />
                </FormField>
                <Button type="submit" size="lg" variant="brand" className="w-full" isLoading={sending}>
                    জমা দিন
                </Button>
            </form>
        </section>
    );
}

function Submitted({ details }: { details: { transactionId: string; senderNumber?: string; submittedAt?: string } }) {
    return (
        <section lang="bn" className="rounded-panel border border-primary/25 bg-primary/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Clock className="size-5" aria-hidden />
                </span>
                <div>
                    <h2 className="text-lg font-bold leading-tight">পেমেন্ট যাচাই হচ্ছে</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        আপনার পেমেন্টের তথ্য পেয়েছি। আমাদের টিম bKash স্টেটমেন্টের সাথে মিলিয়ে কোর্সটা খুলে দেবে — হয়ে গেলেই ইমেইলে
                        জানিয়ে দেব। এই পেজটা নিজে থেকেই আপডেট হয়।
                    </p>
                </div>
            </div>
            <dl className="mt-5 grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-3">
                <div>
                    <dt className="text-xs text-muted-foreground">Transaction ID</dt>
                    <dd className="mt-0.5 font-mono font-semibold" lang="en">
                        {details.transactionId}
                    </dd>
                </div>
                {details.senderNumber && (
                    <div>
                        <dt className="text-xs text-muted-foreground">যে নম্বর থেকে</dt>
                        <dd className="mt-0.5 font-mono font-semibold" lang="en">
                            {details.senderNumber}
                        </dd>
                    </div>
                )}
                {details.submittedAt && (
                    <div>
                        <dt className="text-xs text-muted-foreground">জমা দিয়েছেন</dt>
                        <dd className="mt-0.5 font-semibold">{formatDateTime(details.submittedAt)}</dd>
                    </div>
                )}
            </dl>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                ভুল তথ্য দিয়ে থাকলে বা অনেকক্ষণ হয়ে গেলে অর্ডার নম্বরসহ সাপোর্টে যোগাযোগ করুন।
            </p>
        </section>
    );
}
