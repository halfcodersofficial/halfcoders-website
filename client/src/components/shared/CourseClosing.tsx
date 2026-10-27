import { CalendarDays } from "lucide-react";
import CourseBatchInfo from "@/components/shared/CourseBatchInfo";
import CoursePriceTag from "@/components/shared/CoursePriceTag";
import EnrollButton from "@/components/shared/EnrollButton";
import { Prompt } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import type { BatchSchedule } from "@/lib/courseBatch";
import { featureIcon } from "@/lib/courseFeatureIcons";
import { splitLeadingCount } from "@/lib/leadingCount";
import type { CourseDetail } from "@/types/domain.types";

/**
 * The course page's last word, as a terminal: the enrol command for this
 * course, the ask, the hero's facts as a short list; and beside it — a pane
 * of its own on a wide screen — the price, whether enrolment is open and the
 * button.
 */
export default function CourseClosing({
    course,
    price,
    off,
    schedule,
    renderedAt,
}: {
    course: CourseDetail;
    /** What it costs now — the discount applied. */
    price: number;
    /** The discount as a percentage, or null without one. */
    off: number | null;
    schedule: BatchSchedule;
    renderedAt: number;
}) {
    const facts = course.heroFacts;

    return (
        <EditorWindow tabs={[{ name: "terminal.sh", label: "Terminal", active: true }]}>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="relative px-6 py-9 sm:px-10 lg:py-12">
                    <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
                    <div className="relative">
                        <p aria-hidden lang="en" className="truncate font-mono text-xs sm:text-sm">
                            <Prompt>halfcoders start</Prompt>
                        </p>
                        <h2 className="mt-6 max-w-xl text-balance text-h2">শুরু করার জন্য আজকের দিনটাই ভালো।</h2>
                        <p className="mt-3 max-w-xl leading-relaxed text-editor-muted">
                            <span className="font-semibold text-editor-fg">{course.title}</span> — প্রথম লেসনটা দেখে ফেলুন, তারপর প্রতিদিন একটু করে।
                        </p>

                        {facts.length > 0 && (
                            <ul className="mt-7 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                                {facts.map((fact, index) => {
                                    const { count, rest } = splitLeadingCount(fact.text);
                                    const Icon = featureIcon(fact.icon);
                                    return (
                                        <li key={index} className="flex items-start gap-3 text-[0.9375rem] leading-snug text-editor-fg/90">
                                            {count ? (
                                                <span className="min-w-8 font-mono font-semibold tabular-nums text-syn-number">{count}</span>
                                            ) : (
                                                <Icon className="mt-0.5 size-4 shrink-0 text-syn-func" strokeWidth={2} aria-hidden />
                                            )}
                                            <span>{count ? rest : fact.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-5 border-t border-editor-line bg-card px-6 py-7 text-foreground sm:px-8 lg:border-l lg:border-t-0">
                    <div className="space-y-1.5 border-b border-border pb-5">
                        <p className="line-clamp-2 font-semibold leading-snug">{course.title}</p>
                        {course.duration && (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
                                <span>
                                    চলবে <span className="font-semibold text-foreground">{course.duration}</span>
                                </span>
                            </p>
                        )}
                    </div>
                    <CoursePriceTag price={price} original={course.price} off={off} still />
                    <CourseBatchInfo schedule={schedule} renderedAt={renderedAt} lang="bn" />
                    <EnrollButton
                        courseId={course.id}
                        courseSlug={course.slug}
                        isEnrolled={course.isEnrolled}
                        price={price}
                        schedule={schedule}
                        renderedAt={renderedAt}
                    />
                </div>
            </div>
        </EditorWindow>
    );
}
