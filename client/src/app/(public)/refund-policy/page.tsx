import { CalendarClock, Hourglass, MessageSquareReply, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import LegalPage, { LegalClause } from "@/components/site/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: "রিফান্ড ও রিটার্ন নীতি",
    description:
        "Half Coders-এর রিফান্ড নীতি — কোর্স কেনার ৪৮ ঘণ্টার মধ্যে কীভাবে রিফান্ড রিকোয়েস্ট করবেন।",
    path: "/refund-policy",
});

const LAST_UPDATED = "২১ অক্টোবর ২০২৬";

/** The policy's three numbers at a glance — the same figures as the points below, nothing more. */
const FIGURES: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: Hourglass, value: "৪৮ ঘণ্টা", label: "কোর্স কেনার পর রিফান্ড রিকোয়েস্টের সময়" },
    { icon: MessageSquareReply, value: "৩–৭ দিন", label: "রিকোয়েস্টের পর আমাদের রেসপন্স" },
    { icon: CalendarClock, value: "৭–৬৫ দিন", label: "গ্রহণযোগ্য হলে রিফান্ড প্রসেস হতে" },
];

const POINTS: { title: string; text: ReactNode }[] = [
    {
        title: "সময়সীমা ৪৮ ঘণ্টা",
        text: (
            <>
                কোর্স কেনার পর <span className="font-semibold text-foreground">৪৮ ঘণ্টার মধ্যে</span>{" "}
                আপনি রিফান্ড রিকোয়েস্ট করতে পারবেন। এরপরে করা রিফান্ড রিকোয়েস্ট গ্রহণ করা হবে না।
            </>
        ),
    },
    {
        title: "কীভাবে রিকোয়েস্ট করবেন",
        text: (
            <>
                রিফান্ড রিকোয়েস্ট করতে{" "}
                <Link href="/dashboard/profile/order-history" className="font-medium text-primary hover:underline">
                    অর্ডার হিস্ট্রি
                </Link>{" "}
                থেকে অর্ডারটি খুলে “Request a refund” চাপুন, অথবা{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                    {SUPPORT_EMAIL}
                </a>{" "}
                -এ বিস্তারিত লিখে ইমেইল করুন।
            </>
        ),
    },
    {
        title: "আমাদের রেসপন্স",
        text: (
            <>
                রিকোয়েস্ট পাঠানোর পর ৩ থেকে ৭ দিনের মধ্যে আমাদের টিম রেসপন্স করবে এবং প্রয়োজনে আরও কিছু তথ্য
                জানতে চাওয়া হতে পারে।
            </>
        ),
    },
    {
        title: "রিফান্ড প্রসেস",
        text: (
            <>
                রিফান্ড রিকোয়েস্ট গ্রহণযোগ্য হলে, রিফান্ড প্রসেস হতে{" "}
                <span className="font-semibold text-foreground">৭ থেকে ৬৫ দিন</span> পর্যন্ত সময় লাগতে পারে।
            </>
        ),
    },
    {
        title: "৪৮ ঘণ্টা পার হলে",
        text: (
            <>
                যেহেতু Half Coders বুটক্যাম্প-স্টাইলে কাজ করে, তাই কোনো কোর্সে ভর্তি হওয়ার পর আমরা মূলত
                আপনাকে শেখানোর দিকেই মনোযোগ দিই — তাই ৪৮ ঘণ্টা পার হয়ে গেলে আর কোনো রিফান্ড রিকোয়েস্ট
                গ্রহণ করা হয় না।
            </>
        ),
    },
];

const TOC = POINTS.map((point, index) => ({ id: `point-${index + 1}`, label: point.title }));

export default function RefundPolicyPage() {
    return (
        <LegalPage
            doc="refund"
            title="Refund and Return Policy"
            updated={LAST_UPDATED}
            lead="আমাদের রিফান্ড পলিসি খুবই সিম্পল।"
            toc={TOC}
            closing={
                <p>
                    রিফান্ড বা পেমেন্ট নিয়ে কোনো প্রশ্ন থাকলে আমাদের{" "}
                    <Link href="/contact" className="font-medium text-primary hover:underline">
                        Contact page
                    </Link>{" "}
                    থেকে, অথবা{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
                        {SUPPORT_EMAIL}
                    </a>{" "}
                    -এ মেইল করে জানান। এই নীতির অতিরিক্ত শর্তাবলী আমাদের{" "}
                    <Link href="/terms" className="font-medium text-primary hover:underline">
                        Terms and Condition
                    </Link>{" "}
                    Page এ পাওয়া যাবে।
                </p>
            }
        >
            {/* The three numbers, in one hairline-ruled strip. */}
            <div className="mb-12 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3">
                {FIGURES.map(({ icon: Icon, value, label }) => (
                    <div key={value} className="bg-card p-5">
                        <Icon className="size-4 text-syn-func" aria-hidden />
                        <p className="mt-3 font-mono text-2xl font-semibold text-syn-number">{value}</p>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground">{label}</p>
                    </div>
                ))}
            </div>

            <div>
                {POINTS.map((point, index) => (
                    <LegalClause key={point.title} id={`point-${index + 1}`} number={index + 1} title={point.title}>
                        <p>{point.text}</p>
                    </LegalClause>
                ))}
            </div>
        </LegalPage>
    );
}
