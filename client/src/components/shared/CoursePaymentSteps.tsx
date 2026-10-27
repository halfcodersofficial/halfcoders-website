import { Check, ShieldCheck, Workflow } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import { BKASH } from "@/lib/brand";

interface Step {
    title: string;
    text: string;
}

// The same order as the checkout's own steps (see CheckoutSteps): order, pay, send the TrxID, access.
const PAID_STEPS: Step[] = [
    { title: "চেকআউট শুরু করুন", text: "\"কোর্সে ভর্তি হোন\" চাপুন — একটা অর্ডার নম্বর আর কত টাকা দিতে হবে, দেখতে পাবেন।" },
    {
        title: "বিকাশে পেমেন্ট করুন",
        text: `চেকআউটে দেখানো QR কোড বিকাশ অ্যাপে স্ক্যান করুন, অথবা মার্চেন্ট নম্বর ${BKASH.display}-এ "Payment" অপশনে ঠিক ততটুকু টাকা পাঠান।`,
    },
    {
        title: "Transaction ID জমা দিন",
        text: "বিকাশের মেসেজে আসা Transaction ID আর যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি চেকআউট পেজে দিন।",
    },
    {
        title: "শেখা শুরু করুন",
        text: "আমাদের টিম পেমেন্ট মিলিয়ে দেখলেই আপনার ভর্তি সক্রিয় হবে, আর ইমেইলে জানিয়ে দেব। অর্ডার পেজও নিজে থেকেই আপডেট হবে।",
    },
];

const FREE_STEPS: Step[] = [
    { title: "ফ্রিতে শুরু করুন", text: "\"ফ্রিতে শুরু করুন\" চাপলেই কোর্সটা আপনার ড্যাশবোর্ডে যোগ হয়ে যাবে।" },
    { title: "কোনো পেমেন্ট নেই", text: "এই কোর্সের জন্য কিছুই দিতে হবে না — বিকাশও না।" },
    { title: "শেখা শুরু", text: "লেসন, অ্যাসাইনমেন্ট আর সাপোর্ট সেশন — সব সাথে সাথে খুলে যাবে।" },
]

/**
 * How to pay, on the course page, as a CI pipeline: each step a job in a
 * column of jobs joined by a line, numbered in their real order (check out,
 * pay, send the TrxID, learn), each with a ✓; a paid course's reassurance —
 * nothing is charged automatically, and we never ask for a PIN — as the
 * pipeline's footer note.
 */
export default function CoursePaymentSteps({ free, animate = false }: { free: boolean; animate?: boolean }) {
    const steps = free ? FREE_STEPS : PAID_STEPS;

    const content = (
        <div className="overflow-hidden rounded-card border border-border bg-card">
            <p className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold">
                <span className="flex items-center gap-2 text-muted-foreground">
                    <Workflow className="size-3.5 text-primary" aria-hidden /> ভর্তির ধাপ
                </span>
                <span className="text-syn-string">{steps.length.toLocaleString("bn-BD")}টি ধাপ</span>
            </p>

            <ol className="relative px-5 py-5">
                <span aria-hidden className="absolute bottom-9 left-[2.05rem] top-9 w-px bg-border-strong" />
                {steps.map((step, index) => (
                    <li key={step.title} data-reveal className="relative flex gap-4 py-3">
                        <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 border-success bg-card text-success">
                            <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        </span>
                        <div className="min-w-0 pt-0.5">
                            <h3 className="font-semibold leading-snug">
                                <span aria-hidden className="mr-2 font-mono text-xs text-syn-comment">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                {step.title}
                            </h3>
                            <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{step.text}</p>
                        </div>
                    </li>
                ))}
            </ol>

            {!free && (
                <p className="flex items-start gap-3 border-t border-border bg-surface/60 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    কোনো টাকা স্বয়ংক্রিয়ভাবে কাটা হয় না, আর পেমেন্ট নিশ্চিত না হওয়া পর্যন্ত কোর্স অ্যাক্সেস পাবেন না। আমরা কখনো আপনার বিকাশ PIN বা OTP চাই না।
                </p>
            )}
        </div>
    );

    return animate ? <Reveal>{content}</Reveal> : content;
}
