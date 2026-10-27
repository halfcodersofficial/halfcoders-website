import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CourseBatchInfo from "@/components/shared/CourseBatchInfo";
import CourseBatchSchedule from "@/components/shared/CourseBatchSchedule";
import CourseChecklist from "@/components/shared/CourseChecklist";
import { CourseClassPills } from "@/components/shared/CourseClassification";
import CourseClosing from "@/components/shared/CourseClosing";
import CourseCountdown from "@/components/shared/CourseCountdown";
import CourseDetails from "@/components/shared/CourseDetails";
import CourseFaq from "@/components/shared/CourseFaq";
import CourseHeroFacts from "@/components/shared/CourseHeroFacts";
import CourseHighlights from "@/components/shared/CourseHighlights";
import CourseOverview from "@/components/shared/CourseOverview";
import CourseRatingSummary from "@/components/shared/CourseRatingSummary";
import CoursePaymentSteps from "@/components/shared/CoursePaymentSteps";
import CoursePriceTag from "@/components/shared/CoursePriceTag";
import CoursePromoCard from "@/components/shared/CoursePromoCard";
import CoursePromotionsPanel from "@/components/shared/CoursePromotionsPanel";
import SavedCouponNote from "@/components/shared/SavedCouponNote";
import CourseSectionNav, { CourseOutline } from "@/components/shared/CourseSectionNav";
import CourseStickyBar from "@/components/shared/CourseStickyBar";
import CourseTechStack from "@/components/shared/CourseTechStack";
import CurriculumDownloadButton from "@/components/shared/CurriculumDownloadButton";
import EnrollButton from "@/components/shared/EnrollButton";
import InstructorCard from "@/components/shared/InstructorCard";
import JsonLd from "@/components/shared/JsonLd";
import TestimonialQuoteCard from "@/components/shared/TestimonialQuoteCard";
import TestimonialVideoCard from "@/components/shared/TestimonialVideoCard";
import { FileIcon } from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import { courseBatches, hasBatchDates, scheduleOf } from "@/lib/courseBatch";
import { courseImagesOf } from "@/lib/courseImages";
import { COURSE_PAGE_TAG } from "@/lib/coursePageCache";
import envConfig from "@/lib/envConfig";
import { emphasiseLatin } from "@/lib/scriptEmphasis";
import { ORGANIZATION_ID, pageMetadata } from "@/lib/seo";
import { cn, discountPercent, effectivePrice } from "@/lib/utils";
import type { ApiResponse } from "@/types/api.types";
import type { CourseDetail, PublicCourseReview, RatingSummary } from "@/types/domain.types";

/** The hero's entrance on load: CSS, so it runs from the first paint, with no script to wait for or flash. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

const getCourse = async (slug: string): Promise<CourseDetail | null> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}/courses/${slug}`, {
            next: { revalidate: 120, tags: [COURSE_PAGE_TAG] },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as ApiResponse<CourseDetail>;
        return body.data;
    } catch {
        return null;
    }
};

/** The course's published student reviews — none until an admin publishes one. */
const getReviews = async (slug: string): Promise<{ summary: RatingSummary; reviews: PublicCourseReview[] } | null> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}/course-reviews/public/${slug}`, {
            next: { revalidate: 120, tags: [COURSE_PAGE_TAG] },
        });
        if (!res.ok) return null;
        return ((await res.json()) as ApiResponse<{ summary: RatingSummary; reviews: PublicCourseReview[] }>).data;
    } catch {
        return null;
    }
};

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
    const { slug } = await params;
    const course = await getCourse(slug);

    if (!course) return { title: "Course not found" };

    return {
        ...pageMetadata({
            title: course.title,
            description: course.subtitle ?? course.description.slice(0, 160),
            path: `/courses/${course.slug}`,
            image: course.thumbnail ?? DEFAULT_SOCIAL_IMAGE,
        }),
        // A finished batch hidden from /courses is out of discovery, search
        // results included; its link still works for whoever has it.
        ...(course.hiddenFromCatalogue && { robots: { index: false } }),
    };
}

export default async function CourseDetailPage(
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const [course, ratings] = await Promise.all([getCourse(slug), getReviews(slug)]);

    if (!course) notFound();
    // Students' own words, only those an admin published — and only those with words.
    const studentReviews = (ratings?.reviews ?? []).filter((review) => review.comment);
    const hasRatings = (ratings?.summary.count ?? 0) > 0;

    const free = course.pricing === "FREE";
    const price = free ? 0 : effectivePrice(course.price, course.discountPrice);
    const off = free ? null : discountPercent(course.price, course.discountPrice);
    // Only what the admin or a mentor wrote — there are no platform-wide questions.
    const faqs = course.faqs ?? [];
    // Practice days are bootcamp only; a traditional course's page never mentions them.
    const practiceInfo = course.courseType === "BOOTCAMP" ? course.practiceInfo : null;
    // Nor does a previous course mention support sessions, which it doesn't have.
    const supportInfo = course.phase === "PREVIOUS" ? null : course.supportInfo;
    // Bootcamp only; a traditional course has no batch, so no start date or countdown either.
    // The enrol controls get the dates and re-check them live — this page is
    // cached, so whether enrolment is open can't be settled here.
    const renderedAt = Date.now();
    const schedule = scheduleOf(course);
    const batches = courseBatches(course.courseType, course, new Date(renderedAt));
    const startsAt = batches?.present.startsAt ?? null;
    const hasSchedule = hasBatchDates(batches);

    const videoTestimonials = course.testimonials.filter((t) => t.videoUrl);
    const writtenTestimonials = course.testimonials.filter((t) => !t.videoUrl);

    /* Sections in the order the page renders them — the sticky rail only shows
       an entry when the matching section actually appears on the page. */
    const sections = [
        ...(course.mentors.length > 0 ? [{ id: "instructors", label: "মেন্টর" }] : []),
        ...(course.features.length > 0 ? [{ id: "highlights", label: "ফিচার" }] : []),
        ...(course.outcomes.length > 0 ? [{ id: "outcomes", label: "আউটকাম" }] : []),
        ...(course.testimonials.length > 0 || hasRatings ? [{ id: "reviews", label: "রিভিউ" }] : []),
        ...(course.overview ? [{ id: "overview", label: "সারকথা" }] : []),
        { id: "details", label: "কীভাবে চলে" },
        ...(course.requirements.length > 0 ? [{ id: "requirements", label: "যা লাগবে" }] : []),
        ...(hasSchedule ? [{ id: "schedule", label: "তারিখ" }] : []),
        { id: "payment", label: "ভর্তি" },
        ...(faqs.length > 0 ? [{ id: "faq", label: "প্রশ্ন" }] : []),
    ];

    /* Course structured data. Search engines render this as a rich result with
        the provider, price and star rating attached, which is the difference
       between a plain blue link and a card in the results. */
    const courseUrl = `${envConfig.siteUrl}/courses/${course.slug}`;
    const average = ratings?.summary.average;
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title,
        description: course.subtitle ?? course.description.slice(0, 300),
        url: courseUrl,
        provider: {
            "@type": "EducationalOrganization",
            "@id": ORGANIZATION_ID,
            name: BRAND_NAME,
            url: envConfig.siteUrl,
        },
        image: course.thumbnail ?? `${envConfig.siteUrl}${DEFAULT_SOCIAL_IMAGE.url}`,
        inLanguage: course.language,
        offers: {
            "@type": "Offer",
            price,
            priceCurrency: "BDT",
            category: free ? "Free" : "Paid",
            url: courseUrl,
        },
        // Published reviews only, the same ones the page shows.
        ...(hasRatings && average != null
            ? {
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: Math.round(average * 10) / 10,
                    ratingCount: ratings?.summary.count,
                    bestRating: 5,
                    worstRating: 1,
                },
            }
            : {}),
        ...(course.mentors.length > 0
            ? {
                instructor: course.mentors.map(({ mentor }) => ({
                    "@type": "Person",
                    name: mentor.name,
                })),
            }
            : {}),
        ...(startsAt
            ? {
                hasCourseInstance: {
                    "@type": "CourseInstance",
                    courseMode: course.mode === "OFFLINE" ? "onsite" : course.mode === "BOTH" ? "blended" : "online",
                    startDate: startsAt.toISOString(),
                    ...(batches?.present.endsAt && { endDate: batches.present.endsAt.toISOString() }),
                },
            }
            : {}),
    };

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
    };

    // The header's trail, so results show "Half Coders › Courses › …" in place of the bare address.
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${envConfig.siteUrl}/home` },
            { "@type": "ListItem", position: 2, name: "Courses", item: `${envConfig.siteUrl}/courses` },
            { "@type": "ListItem", position: 3, name: course.title },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {faqs.length > 0 && <JsonLd data={faqJsonLd} />}

            {/* ---- The header: the course open as a file, on the dark editor surface.
                Its path along the top, then the course's tags, title, summary and
                facts on the left, the promo media on the right. */}
            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <div className="relative border-b border-editor-line bg-editor-panel">
                    <nav aria-label="Breadcrumb" className="container-page flex items-center gap-1.5 overflow-hidden py-2 text-xs text-editor-muted">
                        <Link href="/home" className="shrink-0 hover:text-editor-fg">
                            Home
                        </Link>
                        <span aria-hidden>/</span>
                        <Link href="/courses" className="shrink-0 hover:text-editor-fg">
                            Courses
                        </Link>
                        <span aria-hidden>/</span>
                        <span aria-current="page" className="flex min-w-0 items-center gap-1.5 text-editor-fg">
                            <FileIcon name="course.md" />
                            <span className="truncate">{course.title}</span>
                        </span>
                    </nav>
                </div>

                <div className="container-page relative grid grid-cols-1 gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-12 lg:py-14">
                    <div className="min-w-0 space-y-5">
                        <CourseClassPills
                            phase={course.phase}
                            delivery={course.delivery}
                            pricing={course.pricing}
                            mode={course.mode}
                            venue={course.venue}
                            className={RISE}
                        />
                        <h1 className={cn(RISE, "text-h1 text-balance")}>{course.title}</h1>
                        {/* The subtitle is the summary. Without one, the description
                            stands in; with one, the description is in full under
                            "কীভাবে চলে" and would only repeat it here. */}
                        {course.subtitle ? (
                            <p className={cn(RISE, "delay-150 max-w-2xl text-lg leading-relaxed text-editor-muted")}>
                                {emphasiseLatin(course.subtitle, "text-editor-fg")}
                            </p>
                        ) : (
                            <p className={cn(RISE, "delay-150 line-clamp-3 max-w-2xl leading-relaxed text-editor-muted")}>{course.description}</p>
                        )}
                        <CourseHeroFacts facts={course.heroFacts} duration={course.duration} delayMs={200} onDark />
                        <CourseCountdown schedule={schedule} renderedAt={renderedAt} onDark />
                    </div>

                    <div className={cn(RISE, "delay-150 overflow-hidden rounded-panel border border-editor-line bg-editor-panel shadow-panel")}>
                        <CoursePromoCard title={course.title} images={courseImagesOf(course)} promoVideoUrl={course.promoVideoUrl} priority />
                    </div>
                </div>
            </header>

            {/* ---- The workspace: the outline (wide screens), the sections, and the
                enrol panel, sticky beside them so it stays in view while the page
                is read. On a phone: the enrol panel first, then the sections. */}
            <div className="container-page grid grid-cols-1 gap-8 pb-14 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 lg:pt-10 xl:grid-cols-[11rem_minmax(0,1fr)_22rem]">
                <aside className="hidden xl:block">
                    <CourseOutline sections={sections} />
                </aside>

                <aside className="order-1 lg:sticky lg:top-24 lg:order-0 lg:col-start-2 lg:row-start-1 lg:self-start xl:col-start-3">
                    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                        <p className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <FileIcon name="enroll.ts" /> ভর্তি
                            </span>
                            <span className="font-medium text-success-ink">বাংলায় ক্লাস</span>
                        </p>
                        <div className="space-y-4 px-5 pb-5 pt-5">
                            <CoursePriceTag price={price} original={course.price} off={off} />
                            <SavedCouponNote courseId={course.id} price={price} isEnrolled={course.isEnrolled} />
                            <CourseBatchInfo schedule={schedule} renderedAt={renderedAt} lang="bn" />
                        </div>
                        <div className="space-y-2.5 border-t border-border px-5 pb-5 pt-5">
                            <EnrollButton
                                courseId={course.id}
                                courseSlug={course.slug}
                                isEnrolled={course.isEnrolled}
                                price={price}
                                schedule={schedule}
                                renderedAt={renderedAt}
                            />
                            <CurriculumDownloadButton
                                slug={course.slug}
                                label="সিলেবাস ডাউনলোড (PDF)"
                                variant="outline"
                                size="lg"
                                className="w-full"
                            />
                            <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
                                <span>ভর্তির আগে কিছু জানার আছে?</span>
                                <Link href="/contact" className="group inline-flex items-center gap-1 font-semibold text-primary">
                                    মেসেজ করুন
                                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* What else comes with it: free courses, a reward for finishing in time, bundles. */}
                    <CoursePromotionsPanel courseId={course.id} className="mt-4" />
                </aside>

                <div className="order-2 min-w-0 lg:order-0 lg:col-start-1 lg:row-start-1 xl:col-start-2">
                    <CourseSectionNav sections={sections} className="xl:hidden" />

                    <div className="space-y-14 pt-8 xl:pt-0">
                        {course.mentors.length > 0 && (
                            <section id="instructors" className="scroll-anchor">
                                <SectionTitle>{course.mentors.length === 1 ? "মেন্টর" : "মেন্টররা"}</SectionTitle>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    {course.mentors.map(({ mentor, role }) => (
                                        <InstructorCard key={mentor.id} mentor={mentor} role={role} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {course.features.length > 0 && (
                            <section id="highlights" className="scroll-anchor">
                                <SectionTitle>এই কোর্সে যা পাচ্ছেন</SectionTitle>
                                <CourseHighlights features={course.features} animate />
                            </section>
                        )}

                        {course.techStack.length > 0 && (
                            <section id="techstack" className="scroll-anchor">
                                <SectionTitle>টুলস ও টেকনোলজি</SectionTitle>
                                <CourseTechStack items={course.techStack} />
                            </section>
                        )}

                        {course.outcomes.length > 0 && (
                            <section id="outcomes" className="scroll-anchor">
                                <SectionTitle>কোর্স শেষে যা পারবেন</SectionTitle>
                                <CourseChecklist items={course.outcomes} mark="tick" animate />
                            </section>
                        )}

                        {(course.testimonials.length > 0 || hasRatings) && (
                            <section id="reviews" className="scroll-anchor space-y-8">
                                <SectionTitle>শিক্ষার্থীদের রিভিউ</SectionTitle>
                                {hasRatings && ratings && <CourseRatingSummary summary={ratings.summary} />}
                                {videoTestimonials.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-muted-foreground">ভিডিও রিভিউ</h3>
                                        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
                                            {videoTestimonials.map((testimonial) => (
                                                <TestimonialVideoCard
                                                    key={testimonial.id}
                                                    videoUrl={testimonial.videoUrl!}
                                                    name={testimonial.name}
                                                    designation={testimonial.designation}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(writtenTestimonials.length > 0 || studentReviews.length > 0) && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {writtenTestimonials.map((testimonial) => (
                                            <TestimonialQuoteCard
                                                key={testimonial.id}
                                                variant="course"
                                                name={testimonial.name}
                                                designation={testimonial.designation}
                                                avatar={testimonial.avatar}
                                                quote={testimonial.quote}
                                                rating={testimonial.rating}
                                            />
                                        ))}
                                        {studentReviews.map((review) => (
                                            <TestimonialQuoteCard
                                                key={review.id}
                                                variant="course"
                                                name={review.student.name}
                                                designation="এই কোর্সের শিক্ষার্থী"
                                                avatar={review.student.image}
                                                quote={review.comment!}
                                                rating={review.rating}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {course.overview && (
                            <section id="overview" className="scroll-anchor">
                                <SectionTitle>কোর্সের সারকথা</SectionTitle>
                                <CourseOverview overview={course.overview} animate />
                            </section>
                        )}

                        <section id="details" className="scroll-anchor">
                            <SectionTitle>কোর্সটা কীভাবে চলে</SectionTitle>
                            <CourseDetails
                                animate
                                rows={[
                                    { id: "about", label: "এই কোর্স সম্পর্কে", text: course.description },
                                    ...(course.assignmentInfo ? [{ id: "assignments" as const, label: "অ্যাসাইনমেন্ট", text: course.assignmentInfo }] : []),
                                    ...(practiceInfo ? [{ id: "practice" as const, label: "প্র্যাকটিস ডে", text: practiceInfo }] : []),
                                    ...(supportInfo ? [{ id: "support" as const, label: "মেন্টর সাপোর্ট", text: supportInfo }] : []),
                                ]}
                            />
                        </section>

                        {course.requirements.length > 0 && (
                            <section id="requirements" className="scroll-anchor">
                                <SectionTitle>শুরুর আগে যা লাগবে</SectionTitle>
                                <CourseChecklist items={course.requirements} mark="box" animate />
                            </section>
                        )}

                        {hasSchedule && (
                            <section id="schedule" className="scroll-anchor">
                                <SectionTitle>ব্যাচের তারিখ</SectionTitle>
                                <CourseBatchSchedule schedule={schedule} renderedAt={renderedAt} lang="bn" animate />
                            </section>
                        )}

                        <section id="payment" className="scroll-anchor">
                            <SectionTitle>কীভাবে ভর্তি হবেন</SectionTitle>
                            <CoursePaymentSteps free={price === 0} animate />
                        </section>

                        {faqs.length > 0 && (
                            <section id="faq" className="scroll-anchor">
                                <SectionTitle>প্রশ্ন ও উত্তর</SectionTitle>
                                <CourseFaq faqs={faqs} animate />
                                {/* Not answered above: one more question, asked of a person. */}
                                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-dashed border-border-strong px-5 py-4">
                                    <MessageCircleQuestion className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                                    <p className="min-w-0 flex-1 basis-48 text-sm leading-relaxed text-muted-foreground">
                                        <span className="font-semibold text-foreground">অন্য কিছু জানতে চান?</span> সাধারণত এক দিনের মধ্যেই উত্তর দিই।
                                    </p>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/contact">
                                            যোগাযোগ করুন <ArrowRight aria-hidden />
                                        </Link>
                                    </Button>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>

            {/* ---- Closing: a terminal with the enrol command, the ask, and the price pane. */}
            <section className="container-page">
                <CourseClosing course={course} price={price} off={off} schedule={schedule} renderedAt={renderedAt} />
            </section>

            <CourseStickyBar
                courseId={course.id}
                courseSlug={course.slug}
                courseTitle={course.title}
                isEnrolled={course.isEnrolled}
                price={course.price}
                discountPrice={course.discountPrice}
                schedule={schedule}
                renderedAt={renderedAt}
            />

            {/* Clears the fixed mobile bar so the footer is never covered. */}
            <div className="h-28 lg:hidden" aria-hidden />
        </>
    );
}

/** A section's heading: a short violet bar, the title, a hairline under. */
function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-6 flex items-center gap-3 border-b border-border pb-3">
            <span aria-hidden className="h-6 w-1 shrink-0 rounded-full bg-primary" />
            <h2 className="text-balance text-2xl font-bold sm:text-[1.75rem]">{children}</h2>
        </div>
    );
}
