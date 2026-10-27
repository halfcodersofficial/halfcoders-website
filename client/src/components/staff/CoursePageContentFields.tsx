"use client";

import { z } from "zod";
import { CourseImagesField } from "@/components/staff/CourseImagesField";
import { FaqListEditor, fromFaqRows, MAX_FAQS } from "@/components/staff/FaqListEditor";
import {
    FeatureListEditor,
    type FeatureRow,
    fromFeatureRows,
    MAX_FEATURES,
    toFeatureRows,
} from "@/components/staff/FeatureListEditor";
import {
    fromTechStackRows,
    MAX_TECH_STACK,
    TechStackListEditor,
    toTechStackRows,
    type TechStackRow,
} from "@/components/staff/TechStackListEditor";
import { fromIconLineRows, IconLineListEditor, toIconLineRows } from "@/components/staff/IconLineListEditor";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { ListInput } from "@/components/ui/list-input";
import type { FormValues, ZodFormApi } from "@/hooks/useZodForm";
import { courseImagesOf, MAX_COURSE_IMAGES } from "@/lib/courseImages";
import { useDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { optionalTextField, optionalUrlField, textField } from "@/lib/validation";
import type { AdminCourseDetail, CourseContentInput } from "@/types/admin.types";
import type { CourseFaq, CourseIconLine } from "@/types/domain.types";

/**
 * The words on a course page, as a form.
 *
 * Two consoles edit them — the admin's full course editor and the mentor's
 * course page — and they must agree on every rule, every hint and every field
 * label, or a mentor would be told "at most 30 outcomes" where an admin was
 * told 20. So the schema fragment, the value shape and the field markup live
 * here once, and each console composes its own form around them.
 */

/** An emptied optional field means "clear it", which the API spells `null`. */
export const orNull = (value: string) => value.trim() || null;

/** Turns a `ListInput`'s one-per-line value into the array the API wants. */
export const toLines = (value: string) =>
    value.split("\n").map((line) => line.trim()).filter(Boolean);

/** Shared rules for the one-per-line list fields. */
export const linesField = (label: string, max: number, lineMax: number) =>
    optionalTextField({ label }).superRefine((value, ctx) => {
        const lines = toLines(value);
        if (lines.length > max) {
            ctx.addIssue({ code: "custom", message: `${label} can hold at most ${max} lines` });
        }
        const tooLong = lines.findIndex((line) => line.length > lineMax);
        if (tooLong !== -1) {
            ctx.addIssue({
                code: "custom",
                message: `Line ${tooLong + 1} is longer than ${lineMax} characters`,
            });
        }
    });

/**
 * Row-level problems are reported at the array, naming the row — the field
 * has one error slot, and "Feature 3 needs a title" is more useful there than
 * a red border on an input with no explanation.
 */
const featuresField = z
    .array(z.object({ icon: z.string(), title: z.string(), description: z.string() }))
    .max(MAX_FEATURES, `At most ${MAX_FEATURES} features`)
    .superRefine((rows, ctx) => {
        rows.forEach((row, index) => {
            const title = row.title.trim();
            if (title.length === 0) {
                ctx.addIssue({ code: "custom", message: `Feature ${index + 1} needs a title` });
            } else if (title.length < 2) {
                ctx.addIssue({ code: "custom", message: `Feature ${index + 1}'s title is too short` });
            } else if (title.length > 80) {
                ctx.addIssue({ code: "custom", message: `Feature ${index + 1}'s title is over 80 characters` });
            }
            if (row.description.trim().length > 200) {
                ctx.addIssue({ code: "custom", message: `Feature ${index + 1}'s description is over 200 characters` });
            }
        });
    });

/** Icon-and-text lines. Length is capped by the input; a row left empty is dropped on save. */
const iconLinesField = (label: string, max: number) =>
    z
        .array(z.object({ icon: z.string(), text: z.string() }))
        .max(max, `${label} can hold at most ${max} lines`);

const techStackField = z
    .array(z.object({ icon: z.string(), name: z.string() }))
    .max(MAX_TECH_STACK, `At most ${MAX_TECH_STACK} tech stack items`)
    .superRefine((rows, ctx) => {
        rows.forEach((row, index) => {
            const name = row.name.trim();
            if (name.length === 0) {
                ctx.addIssue({ code: "custom", message: `Tech stack item ${index + 1} needs a name` });
            } else if (name.length > 40) {
                ctx.addIssue({ code: "custom", message: `Tech stack item ${index + 1}'s name is over 40 characters` });
            }
        });
    });

const faqsField = z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(MAX_FAQS, `At most ${MAX_FAQS} questions`)
    .superRefine((rows, ctx) => {
        rows.forEach((row, index) => {
            const question = row.question.trim();
            const answer = row.answer.trim();
            if (question.length < 5) {
                ctx.addIssue({ code: "custom", message: `Question ${index + 1} needs at least 5 characters` });
            } else if (question.length > 200) {
                ctx.addIssue({ code: "custom", message: `Question ${index + 1} is over 200 characters` });
            }
            if (answer.length < 5) {
                ctx.addIssue({ code: "custom", message: `Question ${index + 1} needs an answer` });
            } else if (answer.length > 2000) {
                ctx.addIssue({ code: "custom", message: `Answer ${index + 1} is over 2000 characters` });
            }
        });
    });

/** Mirrors `courseContentZodSchema` on the API. Spread into each console's own `z.object`. */
export const courseContentShape = {
    subtitle: optionalTextField({ label: "Subtitle", max: 255 }),
    description: textField({ label: "Description", min: 20 }),
    overview: optionalTextField({ label: "Overview" }),
    // The thumbnail first, then the gallery — split apart again on save.
    images: z.array(z.string().url()).max(MAX_COURSE_IMAGES, `At most ${MAX_COURSE_IMAGES} images`),
    promoVideoUrl: optionalUrlField("Enter a full YouTube URL starting with https://"),
    outcomes: linesField("What students will learn", 30, 300),
    requirements: linesField("Requirements", 30, 300),
    heroFacts: iconLinesField("Hero facts", 6),
    features: featuresField,
    techStack: techStackField,
    faqs: faqsField,
    assignmentInfo: optionalTextField({ label: "Assignment info", max: 2000 }),
    practiceInfo: optionalTextField({ label: "Practice info", max: 2000 }),
    supportInfo: optionalTextField({ label: "Support info", max: 2000 }),
};

export interface CourseContentValues extends FormValues {
    subtitle: string;
    description: string;
    overview: string;
    /** The thumbnail, then the gallery images, in order. */
    images: string[];
    promoVideoUrl: string;
    outcomes: string;
    requirements: string;
    heroFacts: CourseIconLine[];
    features: FeatureRow[];
    techStack: TechStackRow[];
    faqs: CourseFaq[];
    assignmentInfo: string;
    practiceInfo: string;
    supportInfo: string;
}

export const EMPTY_CONTENT_VALUES: CourseContentValues = {
    subtitle: "", description: "", overview: "",
    images: [], promoVideoUrl: "",
    outcomes: "", requirements: "", heroFacts: [],
    features: [], techStack: [], faqs: [],
    assignmentInfo: "", practiceInfo: "", supportInfo: "",
};

/** The saved course, as form values. */
export const contentValuesFrom = (course: AdminCourseDetail): CourseContentValues => ({
    subtitle: course.subtitle ?? "",
    description: course.description,
    overview: course.overview ?? "",
    images: courseImagesOf(course),
    promoVideoUrl: course.promoVideoUrl ?? "",
    outcomes: course.outcomes.join("\n"),
    requirements: course.requirements.join("\n"),
    heroFacts: toIconLineRows(course.heroFacts),
    features: toFeatureRows(course.features),
    techStack: toTechStackRows(course.techStack),
    faqs: course.faqs ?? [],
    assignmentInfo: course.assignmentInfo ?? "",
    practiceInfo: course.practiceInfo ?? "",
    supportInfo: course.supportInfo ?? "",
});

/**
 * Form values as the API payload. Emptying an optional field has to send
 * `null`, not `undefined` — otherwise clearing a subtitle in the form
 * silently keeps whatever was there before.
 */
export const contentPayloadFrom = (values: CourseContentValues): CourseContentInput => ({
    subtitle: orNull(values.subtitle),
    description: values.description,
    overview: orNull(values.overview),
    thumbnail: values.images[0] ?? null,
    gallery: values.images.slice(1),
    promoVideoUrl: orNull(values.promoVideoUrl),
    outcomes: toLines(values.outcomes),
    requirements: toLines(values.requirements),
    heroFacts: fromIconLineRows(values.heroFacts),
    features: fromFeatureRows(values.features),
    techStack: fromTechStackRows(values.techStack),
    faqs: fromFaqRows(values.faqs),
    assignmentInfo: orNull(values.assignmentInfo),
    practiceInfo: orNull(values.practiceInfo),
    supportInfo: orNull(values.supportInfo),
});

/** The field groups below, in the order the public page shows them. */
export type ContentSection = "pitch" | "media" | "structure" | "techStack" | "lists" | "howItWorks" | "faq";

const ALL_SECTIONS: ContentSection[] = ["pitch", "media", "structure", "techStack", "lists", "howItWorks", "faq"];

/** Which fields each group holds, so an editor that pages through them can send a failed save to the right one. */
export const CONTENT_SECTION_FIELDS: Record<ContentSection, string[]> = {
    pitch: ["subtitle", "description", "heroFacts", "overview"],
    media: ["images", "promoVideoUrl"],
    structure: ["features"],
    techStack: ["techStack"],
    lists: ["outcomes", "requirements"],
    howItWorks: ["assignmentInfo", "practiceInfo", "supportInfo"],
    faq: ["faqs"],
};

/**
 * The field groups, in page order, so the form reads top-to-bottom the way
 * the public page does: the pitch, the media, the tiles, the lists, the FAQ.
 * Each group has a heading because this form is long, and a mentor looking
 * for "where do I change the FAQ" should find it by scanning.
 *
 * `sections` narrows it to some of the groups, for an editor that shows the
 * page one step at a time. A step holding a single group already names it in
 * its own heading, so that group's legend is kept for screen readers only.
 */
export function CoursePageContentFields<TValues extends CourseContentValues>({
    form,
    courseId,
    courseType,
    phase,
    sections = ALL_SECTIONS,
}: {
    form: ZodFormApi<TValues>;
    /** Where the course images upload to. */
    courseId: string;
    /** Practice days are bootcamp only, so a traditional course has no practice field. */
    courseType: string;
    /** A previous course has no support sessions, so it has no support field either. */
    phase?: string;
    sections?: ContentSection[];
}) {
    const t = useT();
    const digits = useDigits();
    const show = (section: ContentSection) => sections.includes(section);
    const hideLegend = sections.length === 1;

    return (
        <>
            {show("pitch") && (
                <Group
                    title={t("The pitch", "পরিচিতি")}
                    hint={t("The hero at the top of the page.", "পেজের একদম ওপরের হিরো অংশ।")}
                    hideLegend={hideLegend}
                >
                    <FormField
                        form={form}
                        name="subtitle"
                        label={t("Subtitle", "সাবটাইটেল")}
                        optional
                        counterMax={255}
                        hint={t("One line under the title — the promise of the course.", "শিরোনামের নিচের এক লাইন — কোর্সের মূল প্রতিশ্রুতি।")}
                    >
                        <Input placeholder={t("Zero to job-ready in six months", "ছয় মাসে শূন্য থেকে চাকরির উপযোগী")} />
                    </FormField>

                    <FormField
                        form={form}
                        name="description"
                        label={t("Description", "বিবরণ")}
                        required
                        hint={t("The first three lines show in the hero; the rest under “Course details”.", "প্রথম তিন লাইন হিরো অংশে দেখায়; বাকিটা “কোর্স ডিটেইলস”-এ।")}
                    >
                        <Textarea rows={5} />
                    </FormField>

                    <FormField
                        form={form}
                        name="heroFacts"
                        label={t("Hero facts", "হিরো তথ্য")}
                        optional
                        hint={t(
                            "The short lines under the description, each with an icon — “50+ video lessons”, “12 modules”.",
                            "বিবরণের নিচের ছোট লাইনগুলো, প্রতিটির সাথে একটি আইকন — “৫০+ ভিডিও লেসন”, “১২টি মডিউল”।",
                        )}
                    >
                        <IconLineListEditor
                            max={6}
                            maxLength={60}
                            itemLabel={t("hero fact", "তথ্য")}
                            addLabel={t("Add fact", "তথ্য যোগ করুন")}
                            placeholder={t("50+ video lessons", "৫০+ ভিডিও লেসন")}
                            emptyText={t("No hero facts yet — the hero shows none.", "এখনো কোনো তথ্য নেই — হিরো অংশে কিছু দেখাবে না।")}
                        />
                    </FormField>

                    <FormField
                        form={form}
                        name="overview"
                        label={t("Overview", "ওভারভিউ")}
                        optional
                        hint={t("A longer read in its own “Overview” section — how it's taught, who it's for. Left empty, the section is hidden.", "কোর্স পেজে আলাদা “ওভারভিউ” অংশে দেখায় — কীভাবে পড়ানো হয়, কাদের জন্য। ফাঁকা রাখলে অংশটি দেখায় না।")}
                    >
                        <Textarea rows={4} />
                    </FormField>
                </Group>
            )}

            {show("media") && (
                <Group
                    title={t("Media", "মিডিয়া")}
                    hint={t("What the purchase card and the hero background show.", "পারচেজ কার্ড ও হিরো ব্যাকগ্রাউন্ডে যা দেখায়।")}
                    hideLegend={hideLegend}
                >
                    <FormField
                        form={form}
                        name="images"
                        label={t("Course images", "কোর্সের ছবি")}
                        hint={t(
                            `Up to ${MAX_COURSE_IMAGES}, each cropped to 16:9. The first is the thumbnail on every card and in the catalogue; the course page's purchase card slides through them all.`,
                            `সর্বোচ্চ ${digits(MAX_COURSE_IMAGES)}টি, প্রতিটি ${digits("16:9")} মাপে কাটা। প্রথমটি প্রতিটি কার্ডে ও ক্যাটালগে থাম্বনেইল হিসেবে দেখায়; কোর্স পেজের পারচেজ কার্ডে সবগুলো একটার পর একটা দেখায়।`,
                        )}
                    >
                        <CourseImagesField courseId={courseId} />
                    </FormField>

                    <FormField
                        form={form}
                        name="promoVideoUrl"
                        label={t("Introduction video", "পরিচিতি ভিডিও")}
                        optional
                        hint={t("A YouTube link. Shows first on the purchase card, before the images.", "একটি ইউটিউব লিংক। পারচেজ কার্ডে ছবিগুলোর আগে, সবার প্রথমে দেখায়।")}
                    >
                        <Input
                            type="url"
                            inputMode="url"
                            spellCheck={false}
                            placeholder="https://youtu.be/…"
                        />
                    </FormField>
                </Group>
            )}

            {show("structure") && (
                <Group
                    title={t("How this course is structured", "কোর্সটি যেভাবে সাজানো")}
                    hint={t("The strip of icon tiles under the instructors — the course at a glance.", "ইন্সট্রাক্টরদের নিচে আইকন টাইলের সারি — এক নজরে পুরো কোর্স।")}
                    hideLegend={hideLegend}
                >
                    <FormField form={form} name="features" label={t("Feature tiles", "ফিচার টাইল")} optional>
                        <FeatureListEditor />
                    </FormField>
                </Group>
            )}

            {show("techStack") && (
                <Group
                    title={t("Tech stack", "টেক স্ট্যাক")}
                    hint={t("The tools and technologies grid on the course page.", "কোর্স পেজে টুল ও টেকনোলজির গ্রিড।")}
                    hideLegend={hideLegend}
                >
                    <FormField form={form} name="techStack" label={t("Tech stack chips", "টেক স্ট্যাক")} optional>
                        <TechStackListEditor />
                    </FormField>
                </Group>
            )}

            {show("lists") && (
                <Group title={t("The lists", "তালিকা")} hideLegend={hideLegend}>
                    <FormField
                        form={form}
                        name="outcomes"
                        label={t("What students will learn", "শিক্ষার্থীরা যা শিখবে")}
                        optional
                        hint={t("Shown as the two-column checklist. Enter adds the next one.", "দুই কলামের চেকলিস্ট হিসেবে দেখায়। এন্টার চাপলে পরেরটি যোগ হয়।")}
                    >
                        <ListInput
                            itemLabel={t("Outcome", "শেখার বিষয়")}
                            addLabel={t("Add outcome", "বিষয় যোগ করুন")}
                            max={30}
                            placeholder={t("Build and deploy a full-stack app", "একটি ফুল-স্ট্যাক অ্যাপ তৈরি ও ডেপ্লয় করা")}
                        />
                    </FormField>

                    <FormField
                        form={form}
                        name="requirements"
                        label={t("What they'll need", "যা যা লাগবে")}
                        optional
                        hint={t("Prerequisites and equipment.", "পূর্বশর্ত ও প্রয়োজনীয় সরঞ্জাম।")}
                    >
                        <ListInput
                            itemLabel={t("Requirement", "প্রয়োজনীয়তা")}
                            addLabel={t("Add requirement", "প্রয়োজনীয়তা যোগ করুন")}
                            max={30}
                            placeholder={t("A laptop with 8 GB of RAM", "৮ জিবি র‍্যামের একটি ল্যাপটপ")}
                        />
                    </FormField>
                </Group>
            )}

            {show("howItWorks") && (
                <Group
                    title={t("How it works", "কীভাবে চলে")}
                    hint={t("Each becomes a row under “Course details”; one left empty is hidden.", "প্রতিটি “কোর্স ডিটেইলস”-এ একটি সারি হয়; ফাঁকা রাখলে সেটি দেখায় না।")}
                    hideLegend={hideLegend}
                >
                    <div className={cn("grid gap-4", courseType === "BOOTCAMP" && "sm:grid-cols-2")}>
                        <FormField form={form} name="assignmentInfo" label={t("Assignments", "অ্যাসাইনমেন্ট")} optional counterMax={2000}>
                            <Textarea rows={3} />
                        </FormField>

                        {courseType === "BOOTCAMP" && (
                            <FormField form={form} name="practiceInfo" label={t("Practice days", "প্র্যাকটিস ডে")} optional counterMax={2000}>
                                <Textarea rows={3} />
                            </FormField>
                        )}
                    </div>

                    {phase !== "PREVIOUS" && (
                        <FormField form={form} name="supportInfo" label={t("Mentor support", "মেন্টর সাপোর্ট")} optional counterMax={2000}>
                            <Textarea rows={3} />
                        </FormField>
                    )}
                </Group>
            )}

            {show("faq") && (
                <Group
                    title={t("Frequently asked questions", "সাধারণ প্রশ্নোত্তর")}
                    hint={t("Only the questions added here show on the course page — none, and the section is hidden.", "শুধু এখানে যোগ করা প্রশ্নগুলোই কোর্স পেজে দেখায় — কোনো প্রশ্ন না থাকলে অংশটি দেখায় না।")}
                    hideLegend={hideLegend}
                >
                    <FormField form={form} name="faqs" label={t("Questions", "প্রশ্ন")} optional>
                        <FaqListEditor />
                    </FormField>
                </Group>
            )}
        </>
    );
}

function Group({
    title,
    hint,
    hideLegend = false,
    children,
}: {
    title: string;
    hint?: string;
    /** Named by the surrounding step's heading already — keep it for screen readers only. */
    hideLegend?: boolean;
    children: React.ReactNode;
}) {
    return (
        <fieldset className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <legend className={cn("float-left mb-3 w-full", hideLegend && "sr-only")}>
                <span className="block font-semibold">{title}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </legend>
            <div className="clear-both space-y-4">{children}</div>
        </fieldset>
    );
}
