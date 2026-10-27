"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gift, Layers, Trophy } from "lucide-react";
import Link from "next/link";
import { catalogueService } from "@/services";
import { cn, formatBDT } from "@/lib/utils";
import type { CoursePromotions, PromoCourse } from "@/types/domain.types";

const bnDate = (value: string) =>
    new Date(value).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
const bnNumber = (value: number) => value.toLocaleString("bn-BD");

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-sm";

function Heading({ icon: Icon, tone, children }: { icon: typeof Gift; tone: string; children: React.ReactNode }) {
    return (
        <p className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-sm", tone)}>
                <Icon className="size-3.5" aria-hidden />
            </span>
            {children}
        </p>
    );
}

/** The courses a promotion gives, each with what it would cost on its own. */
function GivenCourses({ courses }: { courses: PromoCourse[] }) {
    return (
        <ul className="mt-3 space-y-2">
            {courses.map((course) => (
                <li key={course.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/courses/${course.slug}`} className="min-w-0 truncate font-medium hover:text-primary hover:underline">
                        {course.title}
                    </Link>
                    {course.price > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            <s>{formatBDT(course.discountPrice ?? course.price)}</s> <span className="font-semibold text-success-ink">ফ্রি</span>
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** When a reward must be earned by, in words — the student's own date once they've enrolled. */
const rewardWhen = (reward: NonNullable<CoursePromotions["reward"]>) => {
    if (reward.yourDeadline) return `আপনার শেষ সময় ${bnDate(reward.yourDeadline)}`;
    if (reward.withinDays && reward.deadlineAt) return `ভর্তির ${bnNumber(reward.withinDays)} দিনের মধ্যে, ${bnDate(reward.deadlineAt)}-এর আগে`;
    if (reward.withinDays) return `ভর্তির ${bnNumber(reward.withinDays)} দিনের মধ্যে`;
    if (reward.deadlineAt) return `${bnDate(reward.deadlineAt)}-এর মধ্যে`;
    return null;
};

/**
 * What else comes with the course, beside its purchase card: the free courses
 * buying it brings, the courses finishing it in time earns, and the bundles
 * that sell it for less. Asked of the API in the browser, since it depends on
 * who's looking (their own reward deadline, what they already own). Nothing
 * shows while it loads, or when the course has none of these.
 */
export default function CoursePromotionsPanel({ courseId, className }: { courseId: string; className?: string }) {
    const { data } = useQuery({
        queryKey: ["course-promotions", courseId],
        queryFn: () => catalogueService.coursePromotions(courseId),
        staleTime: 60_000,
    });

    if (!data || (!data.offer && !data.reward && data.bundles.length === 0)) return null;
    const { offer, reward, bundles } = data;
    const deadline = reward ? rewardWhen(reward) : null;
    const deadlinePassed = Boolean(reward?.yourDeadline && new Date(reward.yourDeadline) < new Date());

    return (
        <div lang="bn" className={cn("space-y-3", className)}>
            {offer && (
                <section className={cn(CARD, "border-success/30 bg-success/5")} aria-label="এই কোর্সের সাথে ফ্রি">
                    <Heading icon={Gift} tone="bg-success/15 text-success-ink">
                        এই কোর্স কিনলে {bnNumber(offer.courses.length)}টি কোর্স ফ্রি
                    </Heading>
                    <GivenCourses courses={offer.courses} />
                    <p className="mt-3 text-xs text-muted-foreground">
                        পেমেন্ট হয়ে গেলেই কোর্সগুলো আপনার ড্যাশবোর্ডে চলে আসবে।
                        {offer.endsAt && ` অফারটি ${bnDate(offer.endsAt)} পর্যন্ত।`}
                    </p>
                </section>
            )}

            {reward && (
                <section className={CARD} aria-label="সময়মতো শেষ করলে উপহার">
                    <Heading icon={Trophy} tone="bg-warning/15 text-warning-ink">
                        সময়মতো শেষ করলে উপহার
                    </Heading>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {reward.condition === "CERTIFICATE" ? "কোর্সের সার্টিফিকেট অর্জন করুন" : "কোর্সটা পুরোপুরি শেষ করুন"}
                        {deadline ? `, ${deadline}।` : "।"} তাহলে এগুলো পাবেন বিনামূল্যে:
                    </p>
                    <GivenCourses courses={reward.courses} />
                    {reward.earned ? (
                        <p className="mt-3 rounded-md bg-success/10 px-3 py-2 text-xs font-semibold text-success-ink">আপনি উপহারটা পেয়ে গেছেন 🎉</p>
                    ) : (
                        deadlinePassed && (
                            <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">আপনার সময়সীমা পার হয়ে গেছে।</p>
                        )
                    )}
                </section>
            )}

            {bundles.map((bundle) => (
                <Link
                    key={bundle.id}
                    href={`/bundles/${bundle.slug}`}
                    className={cn(CARD, "group block transition-colors hover:border-primary/40")}
                >
                    <Heading icon={Layers} tone="bg-primary/10 text-primary">
                        বান্ডেলে কিনলে সাশ্রয়
                    </Heading>
                    <p className="mt-2 font-semibold leading-snug group-hover:text-primary">{bundle.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{bnNumber(bundle.courses.length)}টি কোর্স একসাথে</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-sm">
                            <span lang="en" className="text-lg font-bold">
                                {formatBDT(bundle.quote.total)}
                            </span>{" "}
                            <s lang="en" className="text-muted-foreground">
                                {formatBDT(bundle.quote.combined)}
                            </s>
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            দেখুন
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                    </div>
                </Link>
            ))}
        </div>
    );
}
