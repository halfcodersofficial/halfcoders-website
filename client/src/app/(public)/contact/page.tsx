import { ArrowRight, Clock, Globe2, Headphones, Laptop, Mail, MessageCircle, Phone, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiWhatsapp } from "react-icons/si";
import { CopyButton } from "@/components/shared/FooterBits";
import { Eyebrow } from "@/components/site/code";
import SupportStatus from "@/components/site/SupportStatus";
import { Button } from "@/components/ui/button";
import {
    BKASH,
    GOVERNMENT_HOLIDAYS,
    SOCIAL_LINKS,
    SUPPORT_EMAIL,
    SUPPORT_HOLIDAY_NOTE,
    SUPPORT_HOURS,
    SUPPORT_PHONES,
    SUPPORT_SCHEDULE,
    whatsappLink,
} from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

const FACEBOOK = SOCIAL_LINKS.find((social) => social.network === "facebook")!;

export const metadata: Metadata = pageMetadata({
    title: "যোগাযোগ ও সাপোর্ট",
    description: "Half Coders অ্যাকাউন্ট, কোর্স বা পেমেন্ট নিয়ে সাহায্য প্রয়োজন? ইমেইল বা ফোনে আমাদের সাথে যোগাযোগ করুন।",
    path: "/contact",
});

/** How a team with no office works, a line each. */
const REMOTE_FACTS: { icon: LucideIcon; label: string; text: string }[] = [
    { icon: Laptop, label: "ক্লাস আর সাপোর্ট", text: "সবই অনলাইনে, লাইভ ক্লাস আর সাপোর্ট সেশন Google Meet-এ।" },
    { icon: Mail, label: "যোগাযোগ", text: "ইমেইল, ফোন বা আমাদের Facebook পেজে।" },
    { icon: Wallet, label: "পেমেন্ট", text: `শুধু বিকাশ মার্চেন্ট নম্বরে (${BKASH.display}), চেকআউট পেজ থেকে।` },
];

/**
 * Contact and support: the dark editor surface with what to do, and beside
 * it the help desk — email (with a copy button) and the phone numbers (tap
 * to call), the hours, the holiday rule and whether the line is open right
 * now in Bangladesh time (`SupportStatus`). The email, numbers and hours
 * live in `lib/brand.ts`, shared with the footer. Then course help, the
 * fastest route for anyone enrolled; where we are — fully online, no office
 * yet, and so a warning about anyone asking to meet or for cash in our name;
 * and two notes (a payment that hasn't shown up, the Facebook page).
 */
export default function ContactPage() {
    return (
        <div lang="bn">
            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

                <div className="container-page relative grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-16">
                    <div>
                        <Eyebrow className="mb-4">যোগাযোগ ও সাপোর্ট</Eyebrow>
                        <h1 className="text-h1 text-balance">কিছু জানার আছে? লিখুন বা কল করুন।</h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-editor-muted">
                            কোর্সে ভর্তি থাকলে সবচেয়ে দ্রুত সাহায্য পাবেন কোর্সের ভেতরের সাপোর্ট সেশনে, মেন্টর সরাসরি দেখবেন।
                        </p>
                        <p className="mt-3 max-w-xl text-lg leading-relaxed text-editor-muted">ভর্তি, পেমেন্ট বা অ্যাকাউন্ট নিয়ে প্রশ্ন হলে এখানেই যোগাযোগ করুন।</p>
                    </div>

                    {/* The help desk: write or call. */}
                    <div className="divide-y divide-editor-line overflow-hidden rounded-panel border border-editor-line bg-editor-panel">
                        <div className="p-5 sm:p-6">
                            <p className="flex items-center gap-2 text-xs font-semibold text-syn-comment">
                                <Mail className="size-3.5" aria-hidden /> ইমেইল
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-editor-muted">যেকোনো প্রশ্নে, যেকোনো দিন। ছুটির দিনেও ইমেইল খোলা থাকে।</p>
                            <div className="mt-3 flex items-center gap-2 text-editor-muted">
                                <a href={`mailto:${SUPPORT_EMAIL}`} className="min-w-0 break-all font-mono font-semibold text-syn-string hover:underline">
                                    {SUPPORT_EMAIL}
                                </a>
                                <CopyButton value={SUPPORT_EMAIL} label="Copy email address" />
                            </div>
                        </div>

                        <div className="p-5 sm:p-6">
                            <p className="flex items-center gap-2 text-xs font-semibold text-syn-comment">
                                <Phone className="size-3.5" aria-hidden /> ফোন
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-editor-muted">{SUPPORT_HOURS}</p>
                            <p className="mt-1 text-xs leading-relaxed text-editor-muted/80">{SUPPORT_HOLIDAY_NOTE}</p>
                            <SupportStatus schedule={SUPPORT_SCHEDULE} holidays={GOVERNMENT_HOLIDAYS} className="mt-3" />
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {/* Both numbers take calls and WhatsApp. */}
                                {SUPPORT_PHONES.map((phone) => (
                                    <li key={phone} className="flex gap-1">
                                        <a
                                            href={`tel:${phone.replace(/-/g, "")}`}
                                            className="inline-flex items-center gap-1.5 rounded-md border border-editor-line px-3 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors hover:border-violet-400 hover:bg-editor-raised"
                                        >
                                            <Phone className="size-3.5 text-editor-muted" aria-hidden />
                                            {phone}
                                        </a>
                                        <a
                                            href={whatsappLink(phone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`WhatsApp ${phone}`}
                                            title="WhatsApp"
                                            className="grid w-9 place-items-center rounded-md border border-editor-line text-syn-string transition-colors hover:border-violet-400 hover:bg-editor-raised"
                                        >
                                            <SiWhatsapp className="size-4" aria-hidden />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container-page space-y-6 py-12 sm:py-16">
                {/* Course help — the fastest route for anyone enrolled. */}
                <section className="flex flex-col gap-6 rounded-card border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
                    <span className="grid size-12 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                        <Headphones className="size-6" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold">কোর্সের ভেতরে আটকে গেছেন?</h2>
                        <p className="mt-1.5 max-w-2xl leading-relaxed text-muted-foreground">
                            কোনো লেসন বা অ্যাসাইনমেন্টে আটকালে সাপোর্ট সেশনে নাম লিখুন। পালা এলে মেন্টরের সাথে ওয়ান-টু-ওয়ান কথা বলবেন।
                        </p>
                    </div>
                    <Button asChild size="lg" variant="brand" className="shrink-0">
                        <Link href="/dashboard" lang="en">
                            Open My Learning <ArrowRight aria-hidden />
                        </Link>
                    </Button>
                </section>

                {/* Where we are: fully online, no office yet. */}
                <section aria-labelledby="contact-where-title" className="grid grid-cols-1 overflow-hidden rounded-card border border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="bg-card p-6 sm:p-8">
                        <p className="flex items-center gap-2 text-xs font-semibold text-syn-comment">
                            <Globe2 className="size-3.5" aria-hidden /> আমরা কোথায়
                        </p>
                        <h2 id="contact-where-title" className="mt-3 text-xl font-semibold">
                            আমরা পুরোপুরি অনলাইনে
                        </h2>
                        <p className="mt-2 leading-relaxed text-muted-foreground">
                            Half Coders-এর এখনো কোনো অফিস নেই। পুরো টিম রিমোটে কাজ করে, আর শেখানো থেকে সাপোর্ট, সবকিছুই হয় অনলাইনে। তাই দেখা করতে কোথাও আসতে হবে না,
                            ইমেইল বা ফোন করলেই চলবে।
                        </p>
                        <p className="mt-5 flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-foreground/85">
                            <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-warning-ink" aria-hidden />
                            <span>
                                Half Coders-এর নাম করে কেউ কোনো অফিসে ডাকলে বা হাতে হাতে টাকা চাইলে, সেটা আমরা না। সন্দেহ হলে আগে আমাদের ইমেইল করে মিলিয়ে নিন।
                            </span>
                        </p>
                    </div>
                    <ul className="divide-y divide-border border-t border-border bg-surface lg:border-l lg:border-t-0">
                        {REMOTE_FACTS.map((fact) => (
                            <li key={fact.label} className="flex items-start gap-4 px-6 py-5 sm:px-8">
                                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/20 bg-card text-primary">
                                    <fact.icon className="size-5" aria-hidden />
                                </span>
                                <div>
                                    <p className="font-semibold">{fact.label}</p>
                                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{fact.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <section className="overflow-hidden rounded-card border border-border bg-card">
                        <p className="flex items-center gap-2 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold text-warning-ink">
                            <Clock className="size-3.5" aria-hidden /> পেমেন্ট
                        </p>
                        <div className="p-5">
                            <h2 className="font-semibold">পেমেন্ট করেছেন, কিন্তু কোর্স খোলেনি?</h2>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Transaction ID জমা দেওয়ার পর আমাদের টিম বিকাশ স্টেটমেন্টের সাথে মিলিয়ে ভর্তি সক্রিয় করে, আর হয়ে গেলেই ইমেইলে জানিয়ে দেয়। অনেকক্ষণ
                                হয়ে গেলেও কোর্সটি ড্যাশবোর্ডে না এলে আপনার অর্ডার নম্বর (দেখতে এমন <span className="font-mono">HC-2026-000124</span>) আর Transaction ID
                                দিয়ে আমাদের ইমেইল করুন, আমরা ঠিক করে দেব।
                            </p>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-card border border-border bg-card">
                        <p className="flex items-center gap-2 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold text-syn-func">
                            <MessageCircle className="size-3.5" aria-hidden /> কমিউনিটি
                        </p>
                        <p className="p-5 text-sm leading-relaxed text-muted-foreground">
                            নতুন ব্যাচ, ইভেন্ট আর আপডেটের খবর আগে পেতে আমাদের{" "}
                            <a href={FACEBOOK.href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                                Facebook পেজ
                            </a>{" "}
                            ফলো করুন। প্রশ্ন থাকলে সেখানে মেসেজও দিতে পারেন।
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
