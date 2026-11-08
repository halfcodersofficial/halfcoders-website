"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Download, Hash, Info, Landmark, QrCode, Smartphone } from "lucide-react";
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

const bkashSchema = z.object({
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

const bankSchema = z.object({
    paidWith: z
        .string()
        .trim()
        .min(2, "Write which bank or app you paid from")
        .max(60, "Keep it under 60 characters"),
    transactionId: z
        .string()
        .trim()
        .min(1, "The Transaction ID or Reference number is required")
        .transform((value) => value.replace(/\s+/g, ""))
        .pipe(
            z
                .string()
                .regex(/^[A-Za-z0-9][A-Za-z0-9\-/_.]{3,39}$/, "Copy the number exactly as your receipt shows it — letters and numbers, 4 to 40 long"),
        ),
});

/** Where the money comes from: the bKash app, or a bank's (or another wallet's) app scanning the same Bangla QR. */
type Source = "bkash" | "bank";
/** Inside the bKash app: scan the QR, or "Payment" to the number. */
type BkashMethod = "qr" | "number";

type SentIn = { transactionId: string; senderNumber?: string; paidWith?: string; submittedAt?: string };

interface BkashPaymentProps {
    /** What to pay, in whole taka. */
    amount: number;
    /** The order number, given as the payment's reference so the admin can match it. */
    reference: string;
    /** What the student already sent in, if anything — then it's waiting on an admin. */
    submitted: SentIn | null;
    onSubmit: (details: BkashSubmission) => Promise<unknown>;
}

/**
 * Paying the bKash merchant account, by hand, in two pages of one checkout:
 *
 * 1. How to pay. First where the money comes from — the bKash app, or a
 *    bank's app (or another wallet) scanning the same QR, which is a Bangla
 *    QR — then step by step for that one, with the amount and the reference
 *    to type and copy buttons for each. The student agrees to the terms,
 *    pays, and moves on.
 * 2. `?step=confirm` — what the receipt says, for an admin to match against
 *    the merchant statement: the bKash TrxID and the number paid from, or
 *    the bank's / app's reference and which bank or app it was.
 *
 * The choice rides in `?via=bank`, so going back and forth keeps it. Once
 * sent in, it shows what was sent and that it's being checked; the checkout
 * page polls, and opens the course when an admin marks it paid.
 */
export default function BkashPayment({ amount, reference, submitted, onSubmit }: BkashPaymentProps) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const confirming = searchParams.get("step") === "confirm";
    const source: Source = searchParams.get("via") === "bank" ? "bank" : "bkash";

    const linkTo = (step: "pay" | "confirm", via: Source) => {
        const params = new URLSearchParams();
        if (step === "confirm") params.set("step", "confirm");
        if (via === "bank") params.set("via", "bank");
        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
    };

    if (submitted) return <Submitted details={submitted} />;
    if (confirming) {
        return (
            <ConfirmPayment
                amount={amount}
                source={source}
                onSwitch={(via) => router.replace(linkTo("confirm", via), { scroll: false })}
                onBack={() => router.push(linkTo("pay", source), { scroll: false })}
                onSubmit={async (details) => {
                    await onSubmit(details);
                    router.replace(pathname, { scroll: false });
                }}
            />
        );
    }
    return (
        <PaySteps
            amount={amount}
            reference={reference}
            source={source}
            onSource={(via) => router.replace(linkTo("pay", via), { scroll: false })}
            onPaid={() => router.push(linkTo("confirm", source), { scroll: false })}
        />
    );
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

/** A value to type into the app, with a copy button — the number, the amount, the reference. */
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

/** The merchant QR, with a download for whoever is on the same phone. */
function QrFigure() {
    return (
        <figure className="mx-auto w-full max-w-48 sm:mx-0">
            <Image
                src={BKASH.qr}
                alt={`Bangla QR code for the bKash merchant account ${BKASH.display}`}
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
    );
}

const SOURCES: { id: Source; title: string; text: string; icon: typeof Smartphone; tile: string }[] = [
    {
        id: "bkash",
        title: "bKash অ্যাপ থেকে",
        text: "QR স্ক্যান করে, বা মার্চেন্ট নম্বরে Payment করে",
        icon: Smartphone,
        tile: "bg-[#E2136E] text-white",
    },
    {
        id: "bank",
        title: "ব্যাংক বা অন্য অ্যাপ থেকে",
        text: "ব্যাংকের অ্যাপ বা অন্য ওয়ালেট দিয়ে একই QR স্ক্যান করে",
        icon: Landmark,
        tile: "bg-primary text-primary-foreground",
    },
];

function PaySteps({
    amount,
    reference,
    source,
    onSource,
    onPaid,
}: {
    amount: number;
    reference: string;
    source: Source;
    onSource: (source: Source) => void;
    onPaid: () => void;
}) {
    const [method, setMethod] = useState<BkashMethod>("qr");
    const [agreed, setAgreed] = useState(false);
    const taka = String(amount);

    const scanStep = (
        <>
            পাশের QR কোডটা স্ক্যান করুন। এই পেজটা ফোনেই খোলা থাকলে QR-টা ডাউনলোড করে নিন, তারপর স্ক্যানারের গ্যালারি থেকে ছবিটা বেছে দিন।
        </>
    );
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
            <h2 className="text-lg font-bold leading-tight">পেমেন্ট করুন</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                bKash অ্যাপ দিয়ে, অথবা আপনার ব্যাংকের অ্যাপ দিয়ে পেমেন্ট করতে পারবেন। দুইভাবেই টাকা আমাদের bKash মার্চেন্ট অ্যাকাউন্টে জমা হয়।
            </p>

            <fieldset className="mt-5">
                <legend className="text-sm font-semibold">কোথা থেকে পেমেন্ট করবেন?</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {SOURCES.map(({ id, title, text, icon: Icon, tile }) => {
                        const selected = source === id;
                        return (
                            <label
                                key={id}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-card border p-3.5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
                                )}
                            >
                                <input type="radio" name="pay-from" checked={selected} onChange={() => onSource(id)} className="sr-only" />
                                <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tile)}>
                                    <Icon className="size-4.5" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{title}</span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{text}</span>
                                </span>
                                {selected && <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            {source === "bkash" ? (
                <>
                    <div role="tablist" aria-label="bKash-এ পেমেন্টের উপায়" className="mt-6 grid grid-cols-2 border-b border-border">
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
                                <Step index={2}>{scanStep}</Step>
                                <Step index={3}>
                                    নাম দেখে মিলিয়ে নিন: মার্চেন্ট নম্বর <strong lang="en">{BKASH.display}</strong>।
                                </Step>
                                <Step index={4}>{amountStep}</Step>
                                <Step index={5}>{referenceStep}</Step>
                                <Step index={6}>{confirmStep}</Step>
                            </ol>
                            <QrFigure />
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
                </>
            ) : (
                <>
                    <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        <ol>
                            <Step index={1}>
                                ফোনে আপনার <strong>ব্যাংকের অ্যাপ</strong> (বা Nagad-এর মতো অন্য কোনো ওয়ালেট) খুলে QR স্ক্যান করার অপশনে যান।
                                অ্যাপভেদে নাম আলাদা হয়, যেমন <strong lang="en">&quot;Scan QR&quot;</strong>, <strong lang="en">&quot;QR Pay&quot;</strong>{" "}
                                বা <strong lang="en">&quot;Bangla QR&quot;</strong>।
                            </Step>
                            <Step index={2}>{scanStep}</Step>
                            <Step index={3}>{amountStep}</Step>
                            <Step index={4}>
                                Reference, Purpose বা Note লেখার ঘর থাকলে সেখানে আপনার অর্ডার নম্বরটা লিখুন। এমন ঘর না থাকলে এই ধাপটা বাদ দিন।
                                <CopyValue label="the order number" value={reference} />
                            </Step>
                            <Step index={5}>
                                অ্যাপের PIN বা পাসওয়ার্ড দিয়ে পেমেন্ট কনফার্ম করুন। এরপর অ্যাপে একটা রিসিট আসবে, তাতে একটা{" "}
                                <strong>Transaction ID বা Reference নম্বর</strong> থাকবে। রিসিটের একটা স্ক্রিনশট রেখে দিন, পরের ধাপে নম্বরটা লাগবে।
                            </Step>
                        </ol>
                        <QrFigure />
                    </div>
                    <p className="mt-6 flex items-start gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        <span>
                            QR কোডের উপরে <strong lang="en">BANGLA QR</strong> লেখা আছে, তাই Bangla QR সাপোর্ট করে এমন যেকোনো ব্যাংক বা ওয়ালেটের
                            অ্যাপ দিয়ে এটা স্ক্যান করা যায়। আপনার অ্যাপে QR স্ক্যানের অপশন না পেলে উপরে <strong>bKash অ্যাপ থেকে</strong> বেছে নিন।
                        </span>
                    </p>
                </>
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
    source,
    onSwitch,
    onBack,
    onSubmit,
}: {
    amount: number;
    source: Source;
    onSwitch: (source: Source) => void;
    onBack: () => void;
    onSubmit: (details: BkashSubmission) => Promise<void>;
}) {
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

            {source === "bank" ? <BankDetailsForm amount={amount} onSubmit={onSubmit} /> : <BkashDetailsForm amount={amount} onSubmit={onSubmit} />}

            <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">
                {source === "bank" ? "আসলে bKash অ্যাপ থেকে পেমেন্ট করেছেন?" : "ব্যাংক বা অন্য অ্যাপ থেকে পেমেন্ট করেছেন?"}{" "}
                <button
                    type="button"
                    onClick={() => onSwitch(source === "bank" ? "bkash" : "bank")}
                    className="font-medium text-primary hover:underline"
                >
                    {source === "bank" ? "bKash-এর তথ্য দিন" : "সেই তথ্য দিন"}
                </button>
            </p>
        </section>
    );
}

function BkashDetailsForm({ amount, onSubmit }: { amount: number; onSubmit: (details: BkashSubmission) => Promise<void> }) {
    const [sending, setSending] = useState(false);
    const form = useZodForm({
        schema: bkashSchema,
        initialValues: { transactionId: "", senderNumber: "" },
        onSubmit: async (values) => {
            setSending(true);
            try {
                await onSubmit({ method: "bkash", ...values });
            } finally {
                setSending(false);
            }
        },
    });

    return (
        <>
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
        </>
    );
}

function BankDetailsForm({ amount, onSubmit }: { amount: number; onSubmit: (details: BkashSubmission) => Promise<void> }) {
    const [sending, setSending] = useState(false);
    const form = useZodForm({
        schema: bankSchema,
        initialValues: { paidWith: "", transactionId: "" },
        onSubmit: async (values) => {
            setSending(true);
            try {
                await onSubmit({ method: "bank", ...values });
            } finally {
                setSending(false);
            }
        },
    });

    return (
        <>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {formatBDT(amount)} পেমেন্ট করার পর আপনার ব্যাংক বা অ্যাপ যে রিসিট দেখিয়েছে (অথবা SMS পাঠিয়েছে), সেখান থেকে তথ্যগুলো লিখুন।
            </p>
            <form onSubmit={form.handleSubmit} className="mt-5 space-y-4" noValidate>
                <FormField form={form} name="paidWith" label="কোন ব্যাংক বা অ্যাপ থেকে পেমেন্ট করেছেন" required>
                    <Input autoComplete="off" placeholder="যেমন: City Bank, DBBL, Nagad" maxLength={60} />
                </FormField>
                <FormField
                    form={form}
                    name="transactionId"
                    label="Transaction ID বা Reference নম্বর"
                    required
                    hint="রিসিটে এটা Transaction ID, Txn ID, Reference বা Ref No. — যেকোনো একটা নামে থাকে। যেভাবে লেখা আছে, হুবহু সেভাবে লিখুন।"
                >
                    <Input autoComplete="off" placeholder="রিসিট থেকে নম্বরটা লিখুন" className="font-mono" maxLength={40} lang="en" />
                </FormField>
                <Button type="submit" size="lg" variant="brand" className="w-full" isLoading={sending}>
                    জমা দিন
                </Button>
            </form>
        </>
    );
}

function Submitted({ details }: { details: SentIn }) {
    const from = details.paidWith ?? details.senderNumber;
    return (
        <section lang="bn" className="rounded-panel border border-primary/25 bg-primary/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Clock className="size-5" aria-hidden />
                </span>
                <div>
                    <h2 className="text-lg font-bold leading-tight">পেমেন্ট যাচাই হচ্ছে</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        আপনার পেমেন্টের তথ্য পেয়েছি। আমাদের টিম bKash মার্চেন্ট স্টেটমেন্টের সাথে মিলিয়ে কোর্সটা খুলে দেবে — হয়ে গেলেই ইমেইলে
                        জানিয়ে দেব। এই পেজটা নিজে থেকেই আপডেট হয়।
                    </p>
                </div>
            </div>
            <dl className="mt-5 grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-3">
                <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{details.paidWith ? "Transaction / Reference নম্বর" : "Transaction ID"}</dt>
                    <dd className="mt-0.5 break-all font-mono font-semibold" lang="en">
                        {details.transactionId}
                    </dd>
                </div>
                {from && (
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{details.paidWith ? "যে ব্যাংক বা অ্যাপ থেকে" : "যে নম্বর থেকে"}</dt>
                        <dd className={cn("mt-0.5 font-semibold wrap-break-word", !details.paidWith && "font-mono")} lang={details.paidWith ? undefined : "en"}>
                            {from}
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
