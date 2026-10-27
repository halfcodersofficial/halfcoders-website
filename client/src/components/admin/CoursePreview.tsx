"use client";

import CourseBatchInfo from "@/components/shared/CourseBatchInfo";
import CourseBatchSchedule from "@/components/shared/CourseBatchSchedule";
import CourseChecklist from "@/components/shared/CourseChecklist";
import { CourseClassPills } from "@/components/shared/CourseClassification";
import CourseDetails from "@/components/shared/CourseDetails";
import CourseFaqList from "@/components/shared/CourseFaq";
import CourseHighlights from "@/components/shared/CourseHighlights";
import CourseOverview from "@/components/shared/CourseOverview";
import CoursePromoCard from "@/components/shared/CoursePromoCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCourseBatches } from "@/hooks/useCourseBatches";
import { formatBatchDate, hasBatchDates } from "@/lib/courseBatch";
import { EMPTY_BATCH_VALUES } from "@/lib/courseBatchForm";
import { featureIcon } from "@/lib/courseFeatureIcons";
import { useT, useUiLanguage } from "@/lib/i18n";
import { discountPercent, effectivePrice, formatBDT, LEVEL_LABEL } from "@/lib/utils";
import { extractYoutubeId } from "@/lib/validation";
import type { AdminCourseDetail } from "@/types/admin.types";
import type { CourseDelivery, CourseMode, CoursePhase, CoursePricing } from "@/types/api.types";
import type { CourseFaq, CourseFeature, CourseIconLine } from "@/types/domain.types";
import {
    CalendarDays,
    Clock,
    Signal,
    Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * The live form state this preview renders, rather than the saved course —
 * a preview of what was already saved would tell an admin nothing they can't
 * get from the public page.
 */
export interface CoursePreviewValues {
    title: string;
    subtitle: string;
    description: string;
    overview: string;
    /** The thumbnail, then the gallery images. */
    images: string[];
    promoVideoUrl: string;
    price: string;
    discountPrice: string;
    duration: string;
    level: string;
    language: string;
    courseType: string;
    phase: CoursePhase;
    pricing: CoursePricing | null;
    delivery: CourseDelivery | null;
    mode: CourseMode | null;
    venue: string;
    /** The batches, each a local "YYYY-MM-DDTHH:mm" from the picker, or "". */
    enrollmentStartsAt: string;
    enrollmentEndsAt: string;
    startsAt: string;
    endsAt: string;
    nextEnrollmentStartsAt: string;
    nextEnrollmentEndsAt: string;
    nextStartsAt: string;
    nextEndsAt: string;
    outcomes: string[];
    requirements: string[];
    heroFacts: CourseIconLine[];
    features: CourseFeature[];
    faqs: CourseFaq[];
    assignmentInfo: string;
    practiceInfo: string;
    supportInfo: string;
    isFeatured: boolean;
}

interface CoursePreviewProps {
    values: CoursePreviewValues;
    /** Supplies what the form doesn't hold: the enrolment and curriculum counts. */
    course: AdminCourseDetail;
    /** Resolved from the selected id, since the form only carries the id. */
    categoryTitle?: string;
}

const Stat = ({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) => (
    <li className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-white/60" /> <span>{children}</span>
    </li>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {children}
    </section>
);

/**
 * On a Bangla screen (lib/i18n) the preview speaks the public page's own
 * Bangla, phrase for phrase, so it still shows exactly what students read.
 */
export default function CoursePreview({ values, course, categoryTitle }: CoursePreviewProps) {
    const t = useT();
    const lang = useUiLanguage();
    // The form keeps numbers as strings; an empty discount means "none", which
    // is the same `null` the API and the public page reason about.
    // A free course is saved at ৳0 whatever the price fields hold.
    const free = values.pricing === "FREE";
    const price = free ? 0 : Number(values.price) || 0;
    const discount = free || values.discountPrice === "" ? null : Number(values.discountPrice);
    const payable = effectivePrice(price, discount);
    const off = discountPercent(price, discount);

    // Live, like the public page: an admin watching the preview sees the
    // button open and close at the times they set. A previous course is saved
    // with no batch dates, so it shows none.
    const schedule = values.phase === "PREVIOUS" ? { ...values, ...EMPTY_BATCH_VALUES } : values;
    const batches = useCourseBatches(schedule);
    const enrollmentClosed = batches !== null && !batches.enrollmentOpen;
    const startsAt = batches?.present.startsAt ?? null;
    const startsInFuture = startsAt !== null && startsAt > new Date();
    const hasPromo = Boolean(values.promoVideoUrl && extractYoutubeId(values.promoVideoUrl));

    // Published-only counts: the page only advertises what a student gets.
    const publishedMilestones = course.milestones.filter((m) => m.isPublished);
    const publishedModules = publishedMilestones.flatMap((m) => m.modules.filter((x) => x.isPublished));
    const publishedLessons = publishedModules.reduce((n, m) => n + m._count.videos, 0);

    return (
        // A container, not the viewport, drives the breakpoints below: this
        // panel's width is set by the editor's layout, so on a wide screen a
        // `lg:` rule would fire while the panel itself is only 400px and the
        // hero would collapse into a squashed mess.
        <div className="@container overflow-hidden rounded-xl border border-border">
            {/* ---- Hero, mirroring the public course page ---------------- */}
            <div className="editor relative p-5">
                <div className="relative grid gap-6 @2xl:grid-cols-[1fr_280px]">
                    <div className="min-w-0 space-y-4">
                        <CourseClassPills
                            phase={values.phase}
                            delivery={values.delivery}
                            pricing={values.pricing}
                            mode={values.mode}
                            venue={values.venue.trim() || null}
                        />

                        <div className="flex flex-wrap gap-2">
                            {startsInFuture && (
                                <span className="rounded-sm bg-destructive px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                                    New batch
                                </span>
                            )}
                            {categoryTitle && (
                                <Badge className="border-white/20 bg-white/10 text-white">{categoryTitle}</Badge>
                            )}
                            <Badge className="border-white/20 bg-white/10 text-white">
                                <Signal className="size-3" />
                                {LEVEL_LABEL[values.level] ?? values.level}
                            </Badge>
                            {values.language && (
                                <Badge className="border-white/20 bg-white/10 text-white">{values.language}</Badge>
                            )}
                            {values.isFeatured && (
                                <Badge className="border-transparent bg-accent text-accent-foreground">{t("Featured", "ফিচার্ড")}</Badge>
                            )}
                        </div>

                        <h2 className="text-balance text-2xl font-bold leading-tight @2xl:text-3xl">
                            {values.title || t("Untitled course", "শিরোনামহীন কোর্স")}
                        </h2>

                        {values.subtitle && (
                            <p className="text-base text-white/85 @2xl:text-lg">{values.subtitle}</p>
                        )}

                        {values.description ? (
                            <p className="line-clamp-3 text-sm leading-relaxed text-white/70">
                                {values.description}
                            </p>
                        ) : (
                            <p className="text-sm italic text-white/60">{t("No description yet.", "এখনো কোনো বিবরণ নেই।")}</p>
                        )}

                        <ul className="grid gap-x-6 gap-y-1.5 text-sm text-white/85 @xl:grid-cols-2">
                            <Stat icon={Users}>
                                {course._count.enrollments > 0
                                    ? t(
                                        `${course._count.enrollments} students enrolled`,
                                        `${course._count.enrollments} জন শিক্ষার্থী ভর্তি হয়েছেন`,
                                    )
                                    : enrollmentClosed
                                        ? t("Enrolment is closed", "ভর্তি বন্ধ")
                                        : t("Enrolment is open", "ভর্তি চলছে")}
                            </Stat>
                            {values.heroFacts.map((fact, index) => (
                                <Stat key={index} icon={featureIcon(fact.icon)}>{fact.text}</Stat>
                            ))}
                            {values.duration && (
                                <Stat icon={CalendarDays}>{t("Course length", "কোর্সের চলবে")} {values.duration}</Stat>
                            )}
                            {startsAt && (
                                <Stat icon={CalendarDays}>
                                    {startsInFuture ? t("Starts", "শুরু হবে") : t("Started", "শুরু হয়েছে")} {formatBatchDate(startsAt)}
                                </Stat>
                            )}
                        </ul>

                        {batches?.enrollmentOpen && batches.closesAt && (
                            <div className="rounded-xl border border-white/15 bg-white/5 p-3 @xl:p-4">
                                <p className="mb-3 text-sm font-bold @xl:text-base">
                                    {t("Enrolment closes in", "ভর্তি শেষ হতে বাকি")}
                                </p>
                                <div className="grid grid-cols-4 gap-2 @xl:gap-3">
                                    {t(["Days", "Hours", "Minutes", "Seconds"], ["দিন", "ঘণ্টা", "মিনিট", "সেকেন্ড"]).map((label) => (
                                        <div key={label} className="rounded-lg bg-white px-1 py-3 text-center text-foreground dark:bg-card">
                                            <p className="text-3xl font-extrabold leading-none @xl:text-4xl">--</p>
                                            <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* The purchase card — where a badly cropped image or an
                        unintended discount actually shows itself. The same
                        slideshow the public page uses. */}
                    <aside className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-panel">
                        <CoursePromoCard
                            title={values.title}
                            images={values.images}
                            promoVideoUrl={hasPromo ? values.promoVideoUrl : null}
                            emptyLabel={t("No thumbnail", "থাম্বনেইল নেই")}
                        />

                        <div className="space-y-4 p-4">
                            <div className="flex flex-wrap items-baseline gap-2">
                                {payable === 0 ? (
                                    <span className="text-3xl font-bold text-success">{t("Free", "ফ্রি")}</span>
                                ) : (
                                    <>
                                        <span className="text-3xl font-bold">{formatBDT(payable)}</span>
                                        {off !== null && (
                                            <>
                                                <span className="text-muted-foreground line-through">
                                                    {formatBDT(price)}
                                                </span>
                                                <Badge variant="destructive">{off}% {t("off", "ছাড়")}</Badge>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            <CourseBatchInfo schedule={schedule} lang={lang} />

                            {/* Inert on purpose: this is a picture of the page,
                                not a working one. */}
                            <Button className="w-full" disabled>
                                {enrollmentClosed
                                    ? batches?.opensAt
                                        ? t("Enrolment opens soon", "ভর্তি শীঘ্রই শুরু হবে")
                                        : t("Enrolment closed", "ভর্তি বন্ধ")
                                    : payable === 0
                                        ? t("Start for free", "ফ্রিতে শুরু করুন")
                                        : t("Enrol in the course", "কোর্সে ভর্তি হোন")}
                            </Button>
                        </div>
                    </aside>
                </div>
            </div>

            {/* ---- Body ------------------------------------------------- */}
            <div className="space-y-8 p-5">
                {values.features.length > 0 && (
                    <Section title={t("How this course is structured", "এই কোর্সে যা যা পাচ্ছেন")}>
                        <CourseHighlights features={values.features} />
                    </Section>
                )}

                {values.outcomes.length > 0 && (
                    <Section title={t("What you'll learn", "যা যা শিখবেন")}>
                        <CourseChecklist items={values.outcomes} mark="tick" />
                    </Section>
                )}

                <Section title={t("Curriculum", "কারিকুলাম")}>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            `${publishedMilestones.length} milestones · ${publishedModules.length} modules · ${publishedLessons} lessons`,
                            `${publishedMilestones.length}টি মাইলস্টোন · ${publishedModules.length}টি মডিউল · ${publishedLessons}টি লেসন`,
                        )}
                    </p>
                    {publishedLessons === 0 && (
                        <p className="mt-3 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                            <Clock className="size-4 shrink-0" />
                            {t(
                                "No published lessons yet — students would see an empty curriculum.",
                                "এখনো কোনো লেসন প্রকাশ করা হয়নি — শিক্ষার্থীরা খালি কারিকুলাম দেখবে।",
                            )}
                        </p>
                    )}
                </Section>

                {values.overview && (
                    <Section title={t("Overview", "ওভারভিউ")}>
                        <CourseOverview overview={values.overview} />
                    </Section>
                )}

                {/* The public page's "Course details". */}
                <Section title={t("Course details", "কোর্স ডিটেইলস")}>
                    <CourseDetails
                        rows={[
                            {
                                id: "about" as const,
                                label: t("About this course", "এই কোর্স সম্পর্কে"),
                                text: values.description || (
                                    <span className="italic">{t("No description yet.", "এখনো কোনো বিবরণ নেই।")}</span>
                                ),
                            },
                            { id: "assignments" as const, label: t("Assignments", "অ্যাসাইনমেন্ট"), text: values.assignmentInfo },
                            // Practice days are bootcamp only.
                            {
                                id: "practice" as const,
                                label: t("Practice days", "প্র্যাকটিস ডে"),
                                text: values.courseType === "BOOTCAMP" ? values.practiceInfo : "",
                            },
                            // A previous course has no support sessions.
                            {
                                id: "support" as const,
                                label: t("Mentor support", "মেন্টর সাপোর্ট"),
                                text: values.phase === "PREVIOUS" ? "" : values.supportInfo,
                            },
                        ].filter((row) => row.text)}
                    />
                </Section>

                {values.requirements.length > 0 && (
                    <Section title={t("What you'll need", "যা যা প্রয়োজন হবে")}>
                        <CourseChecklist items={values.requirements} mark="box" />
                    </Section>
                )}

                {hasBatchDates(batches) && (
                    <Section title={t("Batch schedule", "ব্যাচ ও ভর্তির সময়সূচি")}>
                        <CourseBatchSchedule schedule={schedule} lang={lang} />
                    </Section>
                )}

                {/* Only the course's own questions, as on the page — none, no section. */}
                {values.faqs.length > 0 && (
                    <Section title={t("Frequently asked questions", "সচরাচর জিজ্ঞাসিত প্রশ্ন")}>
                        <CourseFaqList faqs={values.faqs} />
                    </Section>
                )}
            </div>
        </div>
    );
}
