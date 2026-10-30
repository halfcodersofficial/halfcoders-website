"use client";

import CoursePreview from "@/components/admin/CoursePreview";
import { EditorSteps } from "@/components/admin/EditorSteps";
import PreviewPanel from "@/components/admin/PreviewPanel";
import { StatusPill } from "@/components/admin/StatusPill";
import { CourseClassBadges, deliveryChoices, modeChoices, phaseChoices, pricingChoices } from "@/components/shared/CourseClassification";
import {
    CONTENT_SECTION_FIELDS,
    contentPayloadFrom,
    contentValuesFrom,
    courseContentShape,
    CoursePageContentFields,
    EMPTY_CONTENT_VALUES,
    orNull,
    toLines,
    type ContentSection,
} from "@/components/staff/CoursePageContentFields";
import { fromFaqRows } from "@/components/staff/FaqListEditor";
import { fromFeatureRows } from "@/components/staff/FeatureListEditor";
import { fromIconLineRows } from "@/components/staff/IconLineListEditor";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DateTimeInput } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { batchDateIssues } from "@/lib/courseBatch";
import { COURSE_DELIVERIES, COURSE_MODES, COURSE_PHASES, COURSE_PRICINGS, hasCurriculumTools, hasVenue } from "@/lib/courseClassification";
import { batchFormValues, batchPayload, EMPTY_BATCH_VALUES } from "@/lib/courseBatchForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { UiLanguageProvider } from "@/lib/i18n";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { cn } from "@/lib/utils";
import {
    numericField,
    optionalDateTimeField,
    optionalNumericField,
    optionalTextField,
    textField,
} from "@/lib/validation";
import { adminService } from "@/services/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Clapperboard,
    ExternalLink,
    Eye,
    EyeOff,
    FileUp,
    Layers,
    Lock,
    Megaphone,
    Plus,
    Save,
    UserCog,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"];

// This screen is in Bangla (see `UiLanguageProvider` below); the rest of the
// console is still English, so its words live here rather than in shared maps.
const COURSE_TYPES = [
    { value: "BOOTCAMP", label: "বুটক্যাম্প — রিয়েল-টাইম আউটলাইন" },
    { value: "TRADITIONAL", label: "ট্র্যাডিশনাল — নিজের গতিতে সিলেবাস" },
];

const COURSE_TYPE_LABEL: Record<string, string> = {
    BOOTCAMP: "বুটক্যাম্প",
    TRADITIONAL: "ট্র্যাডিশনাল",
};

const LEVEL_LABEL: Record<string, string> = {
    BEGINNER: "বিগিনার",
    INTERMEDIATE: "ইন্টারমিডিয়েট",
    ADVANCED: "অ্যাডভান্সড",
    ALL_LEVELS: "সব লেভেল",
};

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "খসড়া",
    PUBLISHED: "প্রকাশিত",
    ARCHIVED: "আর্কাইভ করা",
};

const MENTOR_ROLE_LABEL: Record<string, string> = {
    LEAD: "লিড মেন্টর",
    CO_MENTOR: "কো-মেন্টর",
    SUPPORT: "সাপোর্ট মেন্টর",
};

const MAX_PRICE = 10_000_000;

/** What saving a move into each status does, asked before it's done. Into present takes nothing away. */
const PHASE_CHANGE: Partial<Record<(typeof COURSE_PHASES)[number], { title: string; text: string; confirmText: string }>> = {
    UPCOMING: {
        title: "কোর্সটি আসন্ন করবেন?",
        text: "আসন্ন কোর্সে মডিউল ম্যানেজার ও আউটলাইন মেকার বন্ধ থাকে — কোনো মডিউল বা আউটলাইন যোগ করা যাবে না। ক্লাস শুরু হলে কোর্সটি আবার চলমান করে দিন।",
        confirmText: "আসন্ন করুন",
    },
    PREVIOUS: {
        title: "কোর্সটি আগের (রেকর্ডেড) কোর্সে সরাবেন?",
        text: "সামনের ও চলতি সব সাপোর্ট সেশন বাতিল হবে (ভর্তি হওয়া শিক্ষার্থীরা নোটিফিকেশন পাবে), আর নতুন সেশন রাখা যাবে না। ব্যাচের তারিখ ও সাপোর্টের লেখা মুছে যাবে। মডিউল, লেসন আর শিক্ষার্থীদের অ্যাক্সেস যেমন আছে তেমনই থাকবে।",
        confirmText: "আগের কোর্সে সরান",
    },
};

/**
 * A bootcamp's two batches, each an enrolment window and the dates it runs.
 * The Enrol button follows the windows by itself (`lib/courseBatch.ts`); an
 * empty end falls back to the rule the hint states.
 */
const BATCH_GROUPS = [
    {
        legend: "বর্তমান ব্যাচ",
        fields: [
            {
                name: "enrollmentStartsAt",
                label: "ভর্তি শুরু",
                hint: "এর আগে “ভর্তি হন” বাটন বন্ধ থাকে। ফাঁকা রাখলে এখনই ভর্তি চালু।",
            },
            {
                name: "enrollmentEndsAt",
                label: "ভর্তি শেষ",
                hint: "এই সময়ে বাটন নিজে থেকেই বন্ধ হয়। ফাঁকা রাখলে ব্যাচ শুরু হওয়া পর্যন্ত ভর্তি চলে।",
            },
            {
                name: "startsAt",
                label: "ব্যাচ শুরু",
                hint: "কোর্স পেজে এই সময় পর্যন্ত কাউন্টডাউন দেখায়।",
            },
            {
                name: "endsAt",
                label: "ব্যাচ শেষ",
                hint: "এই সময়ে পরের ব্যাচ নিজে থেকেই বর্তমান ব্যাচ হয়ে যায়।",
            },
        ],
    },
    {
        legend: "পরের ব্যাচ",
        fields: [
            {
                name: "nextEnrollmentStartsAt",
                label: "ভর্তি শুরু",
                hint: "বর্তমান ব্যাচ চলার সময়েও হতে পারে, তবে তার ভর্তি শেষের পরে। ফাঁকা রাখলে বর্তমান ব্যাচ শেষ হলে শুরু হয়।",
            },
            {
                name: "nextEnrollmentEndsAt",
                label: "ভর্তি শেষ",
                hint: "ফাঁকা রাখলে পরের ব্যাচ শুরু হওয়া পর্যন্ত ভর্তি চলে।",
            },
            {
                name: "nextStartsAt",
                label: "ব্যাচ শুরু",
                hint: "বর্তমান ব্যাচ শেষের পরে।",
            },
            {
                name: "nextEndsAt",
                label: "ব্যাচ শেষ",
                hint: undefined,
            },
        ],
    },
] as const;

/**
 * The commercial and catalogue settings are this form's own; everything a
 * student reads on the page comes from `courseContentShape`, shared with the
 * mentor's editor so both consoles enforce the same rules.
 */
const schema = z
    .object({
        title: textField({ label: "Title", min: 3, max: 160 }),
        phase: z.enum(COURSE_PHASES, "Choose the course status"),
        pricing: z.enum(COURSE_PRICINGS, "Choose free or paid"),
        delivery: z.enum(COURSE_DELIVERIES, "Choose how the classes are delivered"),
        mode: z.enum(COURSE_MODES, "অনলাইন, অফলাইন নাকি দুটোই, বেছে নিন"),
        venue: optionalTextField({ label: "Venue", max: 200 }),
        // Both checked below, and only for a paid course — a free one saves at ৳0.
        price: z.string(),
        discountPrice: z.string(),
        duration: optionalTextField({ label: "Duration", max: 60 }),
        certificateCode: z
            .string()
            .trim()
            .regex(/^([A-Z][A-Z0-9]{0,7})?$/, "সর্বোচ্চ ৮টি ইংরেজি বড় হাতের অক্ষর বা সংখ্যা, শুরুতে অক্ষর"),
        level: textField({ label: "Level" }),
        language: optionalTextField({ label: "Language", max: 40 }),
        courseType: z.enum(["BOOTCAMP", "TRADITIONAL"]),
        categoryId: z.string(),
        enrollmentStartsAt: optionalDateTimeField,
        enrollmentEndsAt: optionalDateTimeField,
        startsAt: optionalDateTimeField,
        endsAt: optionalDateTimeField,
        nextEnrollmentStartsAt: optionalDateTimeField,
        nextEnrollmentEndsAt: optionalDateTimeField,
        nextStartsAt: optionalDateTimeField,
        nextEndsAt: optionalDateTimeField,
        isFeatured: z.boolean(),
        isPopular: z.boolean(),
        hiddenFromHomepage: z.boolean(),
        hiddenFromCatalogue: z.boolean(),
        ...courseContentShape,
    })
    .superRefine((data, ctx) => {
        if (data.pricing !== "PAID") return;
        const issue = (path: "price" | "discountPrice", message: string) => ctx.addIssue({ code: "custom", path: [path], message });
        numericField({ label: "Price", min: 1, max: MAX_PRICE })
            .safeParse(data.price)
            .error?.issues.forEach((problem) => issue("price", problem.message));
        optionalNumericField({ label: "Discounted price", min: 0, max: MAX_PRICE })
            .safeParse(data.discountPrice)
            .error?.issues.forEach((problem) => issue("discountPrice", problem.message));
        if (data.discountPrice === "") return;
        if (Number(data.discountPrice) >= Number(data.price)) {
            issue("discountPrice", "Discounted price must be lower than the regular price");
        } else if (Number(data.discountPrice) === 0) {
            issue("discountPrice", "A paid course can't be discounted to ৳0 — mark it free instead");
        }
    })
    // Only a bootcamp has batches, and a previous one no longer does; the API drops them from the rest.
    .superRefine((data, ctx) => {
        if (data.courseType !== "BOOTCAMP" || data.phase === "PREVIOUS") return;
        for (const issue of batchDateIssues(data)) {
            ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
        }
    });

const EMPTY = {
    title: "", price: "", discountPrice: "", duration: "", certificateCode: "", level: "ALL_LEVELS",
    language: "Bangla", courseType: "BOOTCAMP", categoryId: "",
    phase: "PRESENT" as (typeof COURSE_PHASES)[number],
    // "" — not set yet (a seeded draft); the schema asks for a choice.
    pricing: "PAID" as (typeof COURSE_PRICINGS)[number] | "",
    delivery: "HYBRID" as (typeof COURSE_DELIVERIES)[number] | "",
    mode: "ONLINE" as (typeof COURSE_MODES)[number] | "",
    venue: "",
    ...EMPTY_BATCH_VALUES,
    isFeatured: false, isPopular: false, hiddenFromHomepage: false, hiddenFromCatalogue: false,
    ...EMPTY_CONTENT_VALUES,
};

type PageId = "catalogue" | "pricing" | "pitch" | "media" | "highlights" | "lists" | "details" | "mentors";

interface EditorPage {
    id: PageId;
    /** Under its number in the step row. */
    label: string;
    title: string;
    description: string;
    /** The page's own fields. */
    fields?: string[];
    /** The groups of the shared course-page form it shows (with their fields). */
    content?: ContentSection[];
}

/**
 * The editor, a short page at a time, in the order the work usually goes:
 * list it, price it, write the page, staff it. All but Mentors are one form,
 * so edits made across pages save together and Save works from any of them;
 * Mentors saves as it goes, as it always has.
 */
const PAGES: EditorPage[] = [
    {
        id: "catalogue",
        label: "ক্যাটালগ",
        title: "ক্যাটালগ",
        description: "কোর্সটি তালিকায় কীভাবে দেখাবে: এর নাম, ক্যাটাগরি, লেভেল, কোর্সের অবস্থা, ক্লাস কীভাবে হয় ও কোর্সের ধরন।",
        fields: ["title", "categoryId", "level", "duration", "language", "certificateCode", "phase", "delivery", "mode", "venue", "courseType"],
    },
    {
        id: "pricing",
        label: "মূল্য",
        title: "মূল্য ও প্রচার",
        description: "কোর্সটি ফ্রি না পেইড ও তার দাম, বুটক্যাম্পের ব্যাচ ও ভর্তির সময়, আর কোথায় প্রচার হবে ও দেখাবে।",
        fields: [
            "pricing", "price", "discountPrice",
            "enrollmentStartsAt", "enrollmentEndsAt", "startsAt", "endsAt",
            "nextEnrollmentStartsAt", "nextEnrollmentEndsAt", "nextStartsAt", "nextEndsAt",
            "isFeatured", "isPopular",
            "hiddenFromHomepage", "hiddenFromCatalogue",
        ],
    },
    {
        id: "pitch",
        label: "পরিচিতি",
        title: "পরিচিতি",
        description: "কোর্স পেজের একদম ওপরের হিরো অংশ: কোর্সের মূল প্রতিশ্রুতি আর এতে কী কী আছে।",
        content: ["pitch"],
    },
    {
        id: "media",
        label: "মিডিয়া",
        title: "মিডিয়া",
        description: "কোর্সের ছবি ও পরিচিতি ভিডিও।",
        content: ["media"],
    },
    {
        id: "highlights",
        label: "হাইলাইটস",
        title: "হাইলাইটস",
        description: "এক নজরে কোর্স: ইন্সট্রাক্টরদের নিচের আইকন টাইল ও টেক স্ট্যাকের গ্রিড।",
        content: ["structure", "techStack"],
    },
    {
        id: "lists",
        label: "তালিকা",
        title: "তালিকা",
        description: "শিক্ষার্থীরা কী শিখবে, কী কী লাগবে, আর কোর্সে আর কী থাকছে।",
        content: ["lists"],
    },
    {
        id: "details",
        label: "ডিটেইলস ও প্রশ্নোত্তর",
        title: "ডিটেইলস ও প্রশ্নোত্তর",
        description: "এই কোর্সে অ্যাসাইনমেন্ট, প্র্যাকটিস (শুধু বুটক্যাম্পে) ও সাপোর্ট কীভাবে চলে, আর শিক্ষার্থীদের প্রশ্নোত্তর।",
        content: ["howItWorks", "faq"],
    },
    {
        id: "mentors",
        label: "মেন্টর",
        title: "মেন্টর",
        description:
            "এই কোর্স কারা পড়াবেন। পাবলিক পেজের ইন্সট্রাক্টর তালিকায় তাঁদের দেখা যাবে, আর তাঁরা মেন্টর কনসোল থেকে কোর্সের কনটেন্ট এডিট করতে পারবেন। এখানের পরিবর্তন সঙ্গে সঙ্গে কার্যকর হয়।",
    },
];

const fieldsOf = (page: EditorPage) => [
    ...(page.fields ?? []),
    ...(page.content ?? []).flatMap((section) => CONTENT_SECTION_FIELDS[section]),
];

/** Pages with a required field, which open with the "* required" note. */
const REQUIRED_ON = new Set<PageId>(["catalogue", "pricing", "pitch"]);

/** The Save button sits in the footer, outside the animated page, and reaches the form by id. */
const FORM_ID = "course-editor-form";

export default function CourseEditorPage() {
    return (
        <UiLanguageProvider lang="bn">
            <CourseEditor />
        </UiLanguageProvider>
    );
}

function CourseEditor() {
    const { courseId } = useParams<{ courseId: string }>();
    const queryClient = useQueryClient();
    const [pageId, setPageId] = useState<PageId>("catalogue");
    // Picks the side a page slides in from; unset for the first one.
    const [direction, setDirection] = useState<"next" | "back" | null>(null);
    const pageIndex = PAGES.findIndex((entry) => entry.id === pageId);
    const editorRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const navigated = useRef(false);

    const goTo = (next: PageId) => {
        if (next === pageId) return;
        setDirection(PAGES.findIndex((entry) => entry.id === next) > pageIndex ? "next" : "back");
        setPageId(next);
        navigated.current = true;
    };

    // A new page opens at its top and takes focus, and the view too if the top
    // of the editor has scrolled away — so keyboard and screen-reader users
    // land on its heading, not on the button they pressed. Not on first load.
    useEffect(() => {
        if (!navigated.current) return;
        bodyRef.current?.scrollTo({ top: 0 });
        headingRef.current?.focus({ preventScroll: true });
        const editor = editorRef.current;
        if (editor && editor.getBoundingClientRect().top < 0) {
            editor.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }, [pageId]);

    const { data: course, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "course", courseId],
        queryFn: () => adminService.course(courseId),
    });

    const { data: categories } = useQuery({
        queryKey: ["admin", "categories"],
        queryFn: adminService.allCategories,
    });

    const { data: mentorList } = useQuery({
        queryKey: ["admin", "mentors", "all"],
        queryFn: () => adminService.mentors({ limit: 100 }),
    });

    const [mentorToAdd, setMentorToAdd] = useState("");

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin"] });
        void queryClient.invalidateQueries({ queryKey: ["staff", "course", courseId] });
        void refreshCoursePages();
    };

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.updateCourse(courseId, {
                title: values.title,
                phase: values.phase,
                pricing: values.pricing,
                delivery: values.delivery,
                mode: values.mode,
                // Only a course with offline classes keeps a venue; the API clears it otherwise too.
                venue: hasVenue(values.mode) ? orNull(values.venue) : null,
                // A free course saves at ৳0 with no discount, whatever the fields held.
                price: values.pricing === "PAID" ? Number(values.price) : 0,
                level: values.level,
                language: values.language || undefined,
                courseType: values.courseType,
                isFeatured: values.isFeatured,
                isPopular: values.isPopular,
                categoryId: values.categoryId || null,
                // `null` clears a discount; `undefined` would leave the old one.
                discountPrice: values.pricing === "PAID" && values.discountPrice !== "" ? Number(values.discountPrice) : null,
                duration: orNull(values.duration),
                certificateCode: orNull(values.certificateCode),
                // Bootcamp only — the API saves a traditional course with no
                // batches and nothing hidden, whatever these say.
                ...batchPayload(values),
                hiddenFromHomepage: values.hiddenFromHomepage,
                hiddenFromCatalogue: values.hiddenFromCatalogue,
                ...contentPayloadFrom(values),
            }),
        onSuccess: () => {
            toast.success("কোর্স সংরক্ষণ করা হয়েছে।");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "কোর্সটি সংরক্ষণ করা যায়নি।")),
    });

    const form = useZodForm({
        schema,
        initialValues: EMPTY,
        onSubmit: async (values) => {
            // A move between statuses takes things away; say what before it does.
            const consequence = course && values.phase !== course.phase ? PHASE_CHANGE[values.phase] : null;
            if (consequence && !(await confirmAction({ ...consequence, cancelText: "বাতিল" }))) return;
            save.mutate(values);
        },
    });

    const { reset: resetForm } = form;
    useEffect(() => {
        if (!course) return;
        resetForm({
            title: course.title,
            phase: course.phase,
            pricing: course.pricing ?? "",
            delivery: course.delivery ?? "",
            mode: course.mode ?? "",
            venue: course.venue ?? "",
            price: course.pricing === "PAID" ? String(course.price) : "",
            discountPrice: course.discountPrice === null ? "" : String(course.discountPrice),
            duration: course.duration ?? "",
            certificateCode: course.certificateCode ?? "",
            level: course.level,
            language: course.language,
            courseType: course.courseType,
            categoryId: course.categoryId ?? "",
            ...batchFormValues(course),
            isFeatured: course.isFeatured,
            isPopular: course.isPopular,
            hiddenFromHomepage: course.hiddenFromHomepage,
            hiddenFromCatalogue: course.hiddenFromCatalogue,
            ...contentValuesFrom(course),
        });
    }, [course, resetForm]);

    /**
     * A problem on another page would be invisible: its fields aren't
     * mounted, so nothing turns red and nothing gets focus. Go to the first
     * page with one, then submit once React has rendered its fields.
     */
    const saveCourse = () => {
        const firstProblem = form.isValid
            ? undefined
            : PAGES.find((entry) => fieldsOf(entry).some((name) => name in form.errors));
        if (firstProblem && firstProblem.id !== pageId) {
            goTo(firstProblem.id);
            setTimeout(() => form.submit(), 0);
            return;
        }
        form.submit();
    };

    const handleSave = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        saveCourse();
    };

    const setStatus = useMutation({
        mutationFn: (next: string) => adminService.setCourseStatus(courseId, next),
        onSuccess: (_result, next) => {
            toast.success(
                next === "PUBLISHED"
                    ? "কোর্স প্রকাশিত হয়েছে — এখন এটি ক্যাটালগে লাইভ।"
                    : "কোর্স আর্কাইভ করা হয়েছে। ভর্তি হওয়া শিক্ষার্থীরা আগের মতোই অ্যাক্সেস পাবে।",
            );
            refresh();
        },
        // The API refuses to publish a course with no milestones and says so.
        onError: (err) => toast.error(getApiErrorMessage(err, "স্ট্যাটাস বদলানো যায়নি।")),
    });

    const addMentor = useMutation({
        mutationFn: () => adminService.assignMentor(courseId, mentorToAdd, "CO_MENTOR"),
        onSuccess: () => {
            toast.success("মেন্টর যুক্ত করা হয়েছে।");
            setMentorToAdd("");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "মেন্টর যুক্ত করা যায়নি।")),
    });

    const removeMentor = useMutation({
        mutationFn: (mentorId: string) => adminService.removeMentor(courseId, mentorId),
        onSuccess: () => {
            toast.success("মেন্টর সরানো হয়েছে।");
            refresh();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "মেন্টর সরানো যায়নি।")),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-96" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (isError || !course) {
        return (
            <div className="grid min-h-[50dvh] place-items-center text-center">
                <div>
                    <p className="font-medium">কোর্সটি খোলা যাচ্ছে না</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "হয়তো এটি মুছে ফেলা হয়েছে।")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href="/admin/courses">কোর্সের তালিকায় ফিরুন</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const assignedIds = new Set(course.mentors.map((m) => m.mentor.id));
    const availableMentors = (mentorList?.data ?? []).filter((m) => !assignedIds.has(m.id));

    const isPublished = course.status === "PUBLISHED";

    /** The bootcamp "Unpublish" — the same Archive status as the header's button. */
    const unpublish = async () => {
        if (
            await confirmAction({
                title: `"${course.title}" অপ্রকাশ করবেন?`,
                text: "কোর্স পেজ বন্ধ হবে, কোথাও দেখাবে না, আর নতুন কেউ ভর্তি হতে পারবে না। ভর্তি হওয়া শিক্ষার্থীরা ড্যাশবোর্ড থেকে আগের মতোই কোর্স, লেসন, প্রগ্রেস ও সার্টিফিকেট পাবে। পরে আবার প্রকাশ করা যায়।",
                confirmText: "অপ্রকাশ করুন",
                cancelText: "বাতিল",
            })
        ) {
            setStatus.mutate("ARCHIVED");
        }
    };

    const page = PAGES[pageIndex];
    const previous = PAGES[pageIndex - 1];
    const next = PAGES[pageIndex + 1];

    // Marked on the step row once a save has been attempted and failed.
    const errorPages = new Set<PageId>(
        form.isSubmitted
            ? PAGES.filter((entry) => fieldsOf(entry).some((name) => name in form.errors)).map((entry) => entry.id)
            : [],
    );

    return (
        // From `xl` the editor fills the window below the page header: the form
        // and its preview are two equal panes, each scrolling on its own, so
        // neither outgrows the other and Save never scrolls away. `main` is
        // padded 2rem top and bottom at that width, hence the 4rem, and sits
        // between the console's title and status bars (`--console-chrome`).
        <div className="max-w-[1700px] space-y-5 xl:flex xl:h-[calc(100dvh-4rem-var(--console-chrome,0px))] xl:flex-col">
            <header className="flex flex-wrap items-start gap-x-3 gap-y-4">
                <div className="basis-full">
                    <BackButton href="/admin/courses" label="সব কোর্স" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-2xl font-bold">{course.title}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <StatusPill kind="course" value={course.status} label={STATUS_LABEL[course.status]} />
                        <CourseClassBadges phase={course.phase} delivery={course.delivery} mode={course.mode} pricing={course.pricing} lang="bn" />
                        <Badge variant={course.courseType === "BOOTCAMP" ? "default" : "secondary"}>
                            {COURSE_TYPE_LABEL[course.courseType] ?? course.courseType}
                        </Badge>
                        <span>/{course.slug}</span>
                        {isPublished && (
                            <Link
                                href={`/courses/${course.slug}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                                লাইভ পেজ দেখুন <ExternalLink className="size-3" />
                            </Link>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link href={`/admin/courses/${courseId}/pre-enrollment`}>
                            <FileUp /> ভর্তির আগের আউটলাইন
                        </Link>
                    </Button>
                    {/* Closed while the course is upcoming — the pages say so too, and the API refuses. */}
                    {hasCurriculumTools(course.phase) ? (
                        <>
                            <Button asChild variant="outline">
                                <Link href={`/admin/courses/${courseId}/outline`}>
                                    <CalendarDays /> আউটলাইন মেকার
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={`/admin/courses/${courseId}/modules`}>
                                    <Layers /> মডিউল ম্যানেজার
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" disabled title="আসন্ন কোর্সে আউটলাইন মেকার বন্ধ — চলমান করলে খুলবে।">
                                <Lock /> আউটলাইন মেকার
                            </Button>
                            <Button variant="outline" disabled title="আসন্ন কোর্সে মডিউল ম্যানেজার বন্ধ — চলমান করলে খুলবে।">
                                <Lock /> মডিউল ম্যানেজার
                            </Button>
                        </>
                    )}
                    <Button asChild variant="outline">
                        <Link href={`/admin/courses/${courseId}/conceptual`}>
                            <Clapperboard /> কনসেপচুয়াল সেশন
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/admin/courses/${courseId}/announcements`}>
                            <Megaphone /> ঘোষণা
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/admin/courses/${courseId}/students`}>
                            <Users /> শিক্ষার্থী
                        </Link>
                    </Button>
                    {isPublished ? (
                        <Button
                            variant="outline"
                            isLoading={setStatus.isPending}
                            onClick={async () => {
                                if (
                                    await confirmAction({
                                        title: `"${course.title}" ক্যাটালগ থেকে সরাবেন?`,
                                        text: "ভর্তি হওয়া শিক্ষার্থীরা আগের মতোই অ্যাক্সেস পাবে। আবার প্রকাশ না করা পর্যন্ত নতুন শিক্ষার্থীরা এটি খুঁজে পাবে না বা কিনতে পারবে না।",
                                        confirmText: "কোর্স আর্কাইভ করুন",
                                        cancelText: "বাতিল",
                                    })
                                ) {
                                    setStatus.mutate("ARCHIVED");
                                }
                            }}
                        >
                            <EyeOff /> আর্কাইভ
                        </Button>
                    ) : (
                        <Button isLoading={setStatus.isPending} onClick={() => setStatus.mutate("PUBLISHED")}>
                            <Eye /> প্রকাশ করুন
                        </Button>
                    )}
                </div>
            </header>

            {/* The editor and the student preview sit side by side, the same
                size, once there is room for both; below that the preview
                stacks underneath. */}
            <div className="grid items-start gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch">
                <div ref={editorRef} className="min-w-0 scroll-mt-4 xl:min-h-0">
                    <Card className="flex flex-col rounded-card shadow-card xl:h-full">
                        <div className="border-b border-border px-4 pb-4 pt-5 sm:px-6">
                            <EditorSteps
                                label="কোর্স এডিটরের ধাপ"
                                steps={PAGES.map((entry) => ({
                                    id: entry.id,
                                    label: entry.label,
                                    hasError: errorPages.has(entry.id),
                                }))}
                                active={pageId}
                                onChange={(id) => goTo(id as PageId)}
                            />
                        </div>

                        {/* The pane's scrolling part. Clipped sideways so a page
                            sliding in doesn't flash a scrollbar. Positioned, so
                            the form's visually hidden (absolute) labels and
                            radios scroll inside it — without, they escape to the
                            window and stretch the whole page, leaving a blank
                            band under the console once it scrolls. */}
                        <div ref={bodyRef} className="relative overflow-x-clip p-4 sm:p-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                            <div key={pageId} className={cn(direction && `step-enter-${direction}`)}>
                                <header className="mb-6 space-y-1">
                                    {/* The step row already names the page and where it
                                        falls; the heading stays for screen readers, and
                                        as the focus target a new page lands on. */}
                                    <h2 ref={headingRef} tabIndex={-1} className="sr-only">
                                        {page.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">{page.description}</p>
                                    {page.content && (
                                        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                                            <UserCog className="size-3.5 shrink-0" aria-hidden />
                                            এই কোর্সে যুক্ত মেন্টররাও তাঁদের কনসোল থেকে এই পেজটি এডিট করতে পারবেন।
                                        </p>
                                    )}
                                </header>

                                {page.id === "mentors" ? (
                                    <div className="space-y-5">
                                        {course.mentors.length === 0 ? (
                                            <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                                এখনো কোনো মেন্টর যুক্ত করা হয়নি। শিক্ষার্থীরা এই কোর্সে কোনো ইন্সট্রাক্টর দেখতে পাবে না।
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-border rounded-md border border-border">
                                                {course.mentors.map(({ mentor, role }) => (
                                                    <li key={mentor.id} className="flex items-center gap-3 px-3 py-3">
                                                        <Avatar src={mentor.image} name={mentor.name} size={36} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium">{mentor.name}</p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {mentor.mentorProfile?.designation ?? MENTOR_ROLE_LABEL[role] ?? role.replace("_", " ")}
                                                            </p>
                                                        </div>
                                                        <Badge variant="secondary">{MENTOR_ROLE_LABEL[role] ?? role.replace("_", " ")}</Badge>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            aria-label={`${mentor.name}-কে সরান`}
                                                            onClick={() => removeMentor.mutate(mentor.id)}
                                                        >
                                                            <X />
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {availableMentors.length > 0 ? (
                                            <div className="space-y-1.5">
                                                <Label htmlFor="mentor-to-add">মেন্টর যুক্ত করুন</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Select
                                                        id="mentor-to-add"
                                                        value={mentorToAdd}
                                                        onChange={(event) => setMentorToAdd(event.target.value)}
                                                        placeholder="একজন মেন্টর বেছে নিন…"
                                                        className="min-w-56 flex-1"
                                                    >
                                                        {availableMentors.map((mentor) => (
                                                            <option key={mentor.id} value={mentor.id}>
                                                                {mentor.name}
                                                                {mentor.mentorProfile?.designation
                                                                    ? ` — ${mentor.mentorProfile.designation}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                    <Button
                                                        disabled={!mentorToAdd}
                                                        onClick={() => addMentor.mutate()}
                                                        isLoading={addMentor.isPending}
                                                    >
                                                        <Plus /> যুক্ত করুন
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                সব মেন্টর অ্যাকাউন্ট ইতিমধ্যে যুক্ত আছে।{" "}
                                                <Link href="/admin/mentors" className="text-primary hover:underline">
                                                    নতুন একটি তৈরি করুন
                                                </Link>
                                                ।
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <form id={FORM_ID} className="space-y-6" noValidate onSubmit={handleSave}>
                                        {REQUIRED_ON.has(page.id) && <RequiredLegend />}

                                        {page.id === "catalogue" && (
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <FormField
                                                    form={form}
                                                    name="title"
                                                    label="শিরোনাম"
                                                    required
                                                    counterMax={160}
                                                    className="sm:col-span-2"
                                                    // Renaming regenerates the slug server-side.
                                                    hint="শিরোনাম বদলালে পাবলিক লিংকও বদলে যায়।"
                                                >
                                                    <Input />
                                                </FormField>

                                                <FormField form={form} name="categoryId" label="ক্যাটাগরি" optional>
                                                    <Select placeholder="কোনো ক্যাটাগরি নেই">
                                                        {categories?.map((category) => (
                                                            <option key={category.id} value={category.id}>{category.title}</option>
                                                        ))}
                                                    </Select>
                                                </FormField>

                                                <FormField form={form} name="level" label="লেভেল" required>
                                                    <Select>
                                                        {LEVELS.map((level) => (
                                                            <option key={level} value={level}>{LEVEL_LABEL[level]}</option>
                                                        ))}
                                                    </Select>
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="duration"
                                                    label="চলবে"
                                                    optional
                                                    counterMax={60}
                                                    hint="সার্টিফিকেটের Training Duration-এ এটাই বসে, তাই ইংরেজিতে লিখুন। বাংলায় লিখলে সার্টিফিকেটে লাইনটা থাকবে না।"
                                                >
                                                    <Input placeholder="24 Hours" />
                                                </FormField>

                                                <FormField form={form} name="language" label="ভাষা" optional counterMax={40}>
                                                    <Input placeholder="বাংলা" />
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="certificateCode"
                                                    label="সার্টিফিকেট কোড"
                                                    optional
                                                    className="sm:col-span-2"
                                                    hint="সার্টিফিকেট আইডিতে প্রিফিক্সের পরে বসে, যেমন CE দিলে HCC-CE-2026-000125। নতুন সার্টিফিকেট থেকে কাজ করবে, আগেরগুলোর আইডি বদলাবে না।"
                                                >
                                                    <Input
                                                        className="max-w-48 font-mono uppercase"
                                                        autoCapitalize="characters"
                                                        spellCheck={false}
                                                        maxLength={8}
                                                        placeholder="CE"
                                                        value={form.values.certificateCode}
                                                        onChange={(event) => form.setValue("certificateCode", event.target.value.toUpperCase())}
                                                    />
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="courseType"
                                                    label="কোর্সের ধরন"
                                                    required
                                                    hint="বুটক্যাম্পে তারিখসহ আউটলাইন ও নির্ধারিত সময়ে রিলিজ থাকে। ট্র্যাডিশনাল নিজের গতিতে চলে: কোনো তারিখ বা শিডিউল নেই, শুধু প্রকাশ বা অপ্রকাশ — ট্র্যাডিশনালে বদলালে বাকি থাকা সব রিলিজ শিডিউল মুছে যায়।"
                                                >
                                                    <Select>
                                                        {COURSE_TYPES.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="phase"
                                                    label="কোর্সের অবস্থা"
                                                    required
                                                    className="sm:col-span-2"
                                                    hint={
                                                        form.values.phase === "UPCOMING" && course.phase !== "UPCOMING" && course._count.milestones > 0
                                                            ? "এই কোর্সে মডিউল আছে, তাই এটি আসন্ন করা যাবে না। আগে মডিউল ম্যানেজার ও আউটলাইন খালি করুন।"
                                                            : "ক্যাটালগে আগে চলমান, তারপর আসন্ন, শেষে আগের কোর্সগুলো দেখায়। যেকোনো সময় বদলানো যায়।"
                                                    }
                                                >
                                                    <ChoiceCards choices={phaseChoices("bn")} />
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="delivery"
                                                    label="ক্লাস যেভাবে হবে"
                                                    required
                                                    className="sm:col-span-2"
                                                    hint="কোর্স কার্ডে ও কোর্স পেজে দেখায়।"
                                                >
                                                    <ChoiceCards choices={deliveryChoices("bn")} columns={3} />
                                                </FormField>

                                                <FormField
                                                    form={form}
                                                    name="mode"
                                                    label="ডেলিভারি মোড"
                                                    required
                                                    className="sm:col-span-2"
                                                    hint={
                                                        course.mode === "BOTH" && form.values.mode !== "BOTH"
                                                            ? "সেভ করলে মডিউল আর আউটলাইনে আলাদা করে দেওয়া অনলাইন/অফলাইন মুছে যাবে।"
                                                            : "অনলাইন, সরাসরি কোনো জায়গায়, নাকি দুটোই। দুটো হলে প্রতিটা মডিউলে আলাদা করে বলে দেওয়া যায়। ক্যাটালগে শিক্ষার্থীরা এটা দিয়ে কোর্স খুঁজতে পারে।"
                                                    }
                                                >
                                                    <ChoiceCards choices={modeChoices("bn")} columns={3} />
                                                </FormField>

                                                {hasVenue(form.values.mode) && (
                                                    <FormField
                                                        form={form}
                                                        name="venue"
                                                        label="ক্লাসের জায়গা"
                                                        optional
                                                        counterMax={200}
                                                        className="sm:col-span-2"
                                                        hint="কোর্স পেজে দেখায়।"
                                                    >
                                                        <Input placeholder="যেমন: Half Coders অফিস, বনানী, ঢাকা" />
                                                    </FormField>
                                                )}
                                            </div>
                                        )}

                                        {page.id === "pricing" && (
                                            <>
                                                <fieldset className="space-y-4">
                                                    <legend className="float-left mb-3 w-full font-semibold">মূল্য</legend>
                                                    <FormField
                                                        form={form}
                                                        name="pricing"
                                                        label="ফ্রি না পেইড"
                                                        required
                                                        className="clear-both"
                                                        hint="যেকোনো সময় বদলানো যায়, প্রকাশের পরেও। যারা আগে থেকে ভর্তি আছে, তাদের অ্যাক্সেস যেমন আছে তেমনই থাকবে। আর কারও বাকি থাকা অর্ডার পরিশোধ হবে নতুন দামেই।"
                                                    >
                                                        <ChoiceCards choices={pricingChoices("bn")} columns={2} />
                                                    </FormField>
                                                    {form.values.pricing === "PAID" && (
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <FormField form={form} name="price" label="দাম (৳)" required hint="কমপক্ষে ৳১।">
                                                                <Input type="number" inputMode="numeric" min={1} max={MAX_PRICE} />
                                                            </FormField>

                                                            <FormField
                                                                form={form}
                                                                name="discountPrice"
                                                                label="ছাড়ের দাম (৳)"
                                                                optional
                                                                hint="নিয়মিত দামের চেয়ে কম হতে হবে। ফাঁকা রাখলে ছাড় উঠে যায়।"
                                                            >
                                                                <Input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    min={0}
                                                                    max={MAX_PRICE}
                                                                    placeholder="ছাড় না থাকলে ফাঁকা রাখুন"
                                                                />
                                                            </FormField>
                                                        </div>
                                                    )}
                                                </fieldset>

                                                {/* A previous course's run is over: no batch, so enrolment simply stays open while it's published. */}
                                                {form.values.courseType === "BOOTCAMP" && form.values.phase === "PREVIOUS" && (
                                                    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                                                        আগের কোর্সের কোনো ব্যাচ থাকে না, তাই এখানে ব্যাচের তারিখ নেই — সংরক্ষণ করলে আগের তারিখগুলো মুছে যায়। প্রকাশিত থাকলে যে কেউ যেকোনো সময় রেকর্ডেড কোর্স হিসেবে ভর্তি হতে পারবে।
                                                    </p>
                                                )}

                                                {form.values.courseType === "BOOTCAMP" && form.values.phase !== "PREVIOUS" && (
                                                    <fieldset className="space-y-4 border-t border-border pt-5">
                                                        <legend className="float-left mb-3 w-full">
                                                            <span className="block font-semibold">ব্যাচ ও ভর্তির সময়</span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                “ভর্তি হন” বাটন শুধু ভর্তির সময়ের মধ্যে চালু থাকে — আগে ও পরে নিজে থেকেই বন্ধ, হাতে কিছু করতে হয় না। বর্তমান ব্যাচ শেষ হলে পরের ব্যাচ নিজে থেকেই বর্তমান ব্যাচ হয়ে যায়।
                                                            </span>
                                                        </legend>
                                                        <div className="clear-both space-y-5">
                                                            {BATCH_GROUPS.map((group) => (
                                                                <fieldset key={group.legend} className="space-y-3">
                                                                    <legend className="text-sm font-medium text-muted-foreground">
                                                                        {group.legend}
                                                                    </legend>
                                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                                        {group.fields.map((field) => (
                                                                            <FormField
                                                                                key={field.name}
                                                                                form={form}
                                                                                name={field.name}
                                                                                label={field.label}
                                                                                optional
                                                                                hint={field.hint}
                                                                            >
                                                                                <DateTimeInput />
                                                                            </FormField>
                                                                        ))}
                                                                    </div>
                                                                </fieldset>
                                                            ))}
                                                        </div>
                                                    </fieldset>
                                                )}

                                                <fieldset className="space-y-4 border-t border-border pt-5">
                                                    <legend className="float-left mb-3 w-full font-semibold">প্রচার</legend>
                                                    {/* Standalone toggles: the checkbox is its own
                                                        label, so a FormField would give each two. */}
                                                    <div className="clear-both flex flex-wrap gap-x-8">
                                                        <Checkbox
                                                            checked={form.values.isFeatured}
                                                            onChange={(event) => form.setValue("isFeatured", event.target.checked)}
                                                        >
                                                            হোমপেজে ফিচার্ড করুন
                                                        </Checkbox>
                                                        <Checkbox
                                                            checked={form.values.isPopular}
                                                            onChange={(event) => form.setValue("isPopular", event.target.checked)}
                                                        >
                                                            &ldquo;এখন জনপ্রিয়&rdquo; অংশে দেখান
                                                        </Checkbox>
                                                    </div>
                                                </fieldset>

                                                {/* Bootcamp only: a finished batch's course leaves
                                                    discovery; a new batch is a new course. Separate
                                                    from enrolment, which only the dates above decide. */}
                                                {form.values.courseType === "BOOTCAMP" && (
                                                    <fieldset className="space-y-4 border-t border-border pt-5">
                                                        <legend className="float-left mb-3 w-full">
                                                            <span className="block font-semibold">দৃশ্যমানতা</span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                ব্যাচ শেষ হলে পুরোনো ব্যাচের কোর্সটি সরিয়ে দিন। ভর্তি হওয়া শিক্ষার্থীরা ড্যাশবোর্ড থেকে আগের মতোই কোর্স, লেসন, প্রগ্রেস ও সার্টিফিকেট পাবে।
                                                            </span>
                                                        </legend>
                                                        <div className="clear-both space-y-4">
                                                            <div className="space-y-1.5">
                                                                <div className="flex flex-wrap gap-x-8 gap-y-2">
                                                                    <Checkbox
                                                                        checked={form.values.hiddenFromHomepage}
                                                                        onChange={(event) => form.setValue("hiddenFromHomepage", event.target.checked)}
                                                                    >
                                                                        হোমপেজ থেকে লুকান
                                                                    </Checkbox>
                                                                    <Checkbox
                                                                        checked={form.values.hiddenFromCatalogue}
                                                                        onChange={(event) => form.setValue("hiddenFromCatalogue", event.target.checked)}
                                                                    >
                                                                        &ldquo;সব কোর্স&rdquo; পেজ থেকে লুকান
                                                                    </Checkbox>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    লুকালে ভর্তি বন্ধ হয় না — তা ঠিক করে ওপরের ভর্তির সময়। কোর্সের পেজও লিংক দিয়ে খোলা যায়।
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                                                                <div className="min-w-0 flex-1 text-sm">
                                                                    <p className="font-medium">
                                                                        {isPublished ? "প্রকাশিত" : "প্রকাশিত নয়"}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {isPublished
                                                                            ? "অপ্রকাশ করলে কোর্সটি আর্কাইভে যায়: পেজ বন্ধ হয় আর নতুন কেউ ভর্তি হতে পারে না। সঙ্গে সঙ্গে কার্যকর হয়।"
                                                                            : "কোর্স পেজ বন্ধ, কোথাও দেখায় না, নতুন কেউ ভর্তি হতে পারে না।"}
                                                                    </p>
                                                                </div>
                                                                {isPublished ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        isLoading={setStatus.isPending}
                                                                        onClick={unpublish}
                                                                    >
                                                                        <EyeOff /> অপ্রকাশ করুন
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        isLoading={setStatus.isPending}
                                                                        onClick={() => setStatus.mutate("PUBLISHED")}
                                                                    >
                                                                        <Eye /> প্রকাশ করুন
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </fieldset>
                                                )}
                                            </>
                                        )}

                                        {page.content && (
                                            <CoursePageContentFields
                                                form={form}
                                                courseId={courseId}
                                                courseType={form.values.courseType}
                                                phase={form.values.phase}
                                                sections={page.content}
                                            />
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Outside the sliding page so it stays put: pinned to the
                            pane's foot beside the preview, and sticky when the
                            panes stack, so Save is in reach from anywhere. */}
                        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-card border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
                            <p className="text-xs text-muted-foreground">
                                {form.isDirty ? "সংরক্ষণ না করা পরিবর্তন আছে।" : "সব সংরক্ষিত।"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {previous && (
                                    <Button type="button" variant="ghost" onClick={() => goTo(previous.id)}>
                                        <ArrowLeft /> আগের ধাপ
                                    </Button>
                                )}
                                {next && (
                                    <Button type="button" variant="outline" onClick={() => goTo(next.id)}>
                                        <span>
                                            পরের ধাপ<span className="hidden sm:inline">: {next.label}</span>
                                        </span>
                                        <ArrowRight />
                                    </Button>
                                )}
                                {page.id === "mentors" ? (
                                    // No form on this page; unsaved edits from the others still save from here.
                                    <Button
                                        type="button"
                                        onClick={saveCourse}
                                        isLoading={save.isPending}
                                        disabled={!form.isDirty}
                                    >
                                        <Save /> কোর্স সংরক্ষণ করুন
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        form={FORM_ID}
                                        isLoading={save.isPending}
                                        disabled={!form.isDirty}
                                    >
                                        <Save /> কোর্স সংরক্ষণ করুন
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* A draft is invisible on /courses/[slug] — the public endpoint
                    filters to PUBLISHED — so without this there is no way to see
                    how a course reads before publishing it. It renders the live
                    form values, not the saved course, so a new image or a
                    discount shows itself before it is saved. */}
                <PreviewPanel
                    fill
                    title="শিক্ষার্থীর প্রিভিউ"
                    description={
                        <>
                            লেখার সাথে সাথে আপডেট হয়, সংরক্ষণ না করা পরিবর্তনসহ।{" "}
                            {isPublished ? (
                                <Link
                                    href={`/courses/${course.slug}`}
                                    target="_blank"
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    লাইভ পেজ দেখুন
                                </Link>
                            ) : (
                                "প্রকাশিত নয়, তাই এখনো কোনো পাবলিক পেজ নেই।"
                            )}
                        </>
                    }
                >
                    <CoursePreview
                        course={course}
                        categoryTitle={
                            categories?.find((c) => c.id === form.values.categoryId)?.title
                        }
                        values={{
                            title: form.values.title,
                            subtitle: form.values.subtitle,
                            description: form.values.description,
                            overview: form.values.overview,
                            images: form.values.images,
                            promoVideoUrl: form.values.promoVideoUrl,
                            price: form.values.price,
                            discountPrice: form.values.discountPrice,
                            duration: form.values.duration,
                            level: form.values.level,
                            language: form.values.language,
                            courseType: form.values.courseType,
                            phase: form.values.phase,
                            pricing: form.values.pricing || null,
                            delivery: form.values.delivery || null,
                            mode: form.values.mode || null,
                            venue: form.values.venue,
                            enrollmentStartsAt: form.values.enrollmentStartsAt,
                            enrollmentEndsAt: form.values.enrollmentEndsAt,
                            startsAt: form.values.startsAt,
                            endsAt: form.values.endsAt,
                            nextEnrollmentStartsAt: form.values.nextEnrollmentStartsAt,
                            nextEnrollmentEndsAt: form.values.nextEnrollmentEndsAt,
                            nextStartsAt: form.values.nextStartsAt,
                            nextEndsAt: form.values.nextEndsAt,
                            // Split the same way saving does, so the preview
                            // lists exactly what the API stores.
                            outcomes: toLines(form.values.outcomes),
                            requirements: toLines(form.values.requirements),
                            heroFacts: fromIconLineRows(form.values.heroFacts),
                            features: fromFeatureRows(form.values.features),
                            faqs: fromFaqRows(form.values.faqs),
                            assignmentInfo: form.values.assignmentInfo,
                            practiceInfo: form.values.practiceInfo,
                            supportInfo: form.values.supportInfo,
                            isFeatured: form.values.isFeatured,
                        }}
                    />
                </PreviewPanel>
            </div>
        </div>
    );
}
