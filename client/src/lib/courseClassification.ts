import { Blend, CirclePlay, Gift, Globe, MapPin, MonitorPlay, Radio, Tag, type LucideIcon } from "lucide-react";
import type { ClassMode, CourseDelivery, CourseMode, CoursePhase, CoursePricing } from "@/types/api.types";

/**
 * The things an admin decides about every course — where it is in its life,
 * free or paid, how its classes are delivered, and whether it's online,
 * offline or both — with the words each
 * surface shows for them. The catalogue and the course page speak to students
 * (English on the cards, Bangla on the page); the consoles speak to staff.
 * One table, so a course reads the same everywhere.
 *
 * What a phase rules out is the API's to enforce (server
 * `utils/coursePhase.ts`); the helpers at the bottom only decide what to show.
 */

/** The catalogue's order: running courses first, then the ones to come, then the finished ones. */
export const COURSE_PHASES = ["PRESENT", "UPCOMING", "PREVIOUS"] as const satisfies readonly CoursePhase[];
export const COURSE_PRICINGS = ["FREE", "PAID"] as const satisfies readonly CoursePricing[];
export const COURSE_DELIVERIES = ["LIVE", "RECORDED", "HYBRID"] as const satisfies readonly CourseDelivery[];
export const COURSE_MODES = ["ONLINE", "OFFLINE", "BOTH"] as const satisfies readonly CourseMode[];
/** Where one class happens — what a module or outline item on a both course is marked with. */
export const CLASS_MODES = ["ONLINE", "OFFLINE"] as const satisfies readonly ClassMode[];

interface PhaseMeta {
    /** Staff's name for it, as the requirements put it. */
    admin: string;
    adminBn: string;
    /** What it means for the course, in the consoles. */
    hint: string;
    hintBn: string;
    /** On a course card. */
    card: string;
    /** On the course page, and as the catalogue section's title. */
    bn: string;
    section: string;
    /** Under the catalogue section's title. */
    sectionBlurb: string;
    /** The marker's colour. Present is the one that pulses. */
    dot: string;
    text: string;
    badge: "success" | "default" | "secondary";
}

export const PHASE_META: Record<CoursePhase, PhaseMeta> = {
    PRESENT: {
        admin: "Present",
        adminBn: "চলমান",
        hint: "Running now. Every course tool works as usual.",
        hintBn: "এখন চলছে। কোর্সের সব টুল আগের মতোই চালু।",
        card: "Ongoing",
        bn: "চলমান কোর্স",
        section: "চলমান কোর্স",
        sectionBlurb: "যেসব কোর্সের ক্লাস এখন চলছে",
        dot: "bg-success",
        text: "text-success-ink",
        badge: "success",
    },
    UPCOMING: {
        admin: "Upcoming",
        adminBn: "আসন্ন",
        hint: "Hasn't started. No Module Manager or Outline Maker until it's moved to Present.",
        hintBn: "এখনো শুরু হয়নি। চলমান না করা পর্যন্ত মডিউল ম্যানেজার ও আউটলাইন মেকার বন্ধ থাকে।",
        card: "Upcoming",
        bn: "আসন্ন কোর্স",
        section: "আসন্ন কোর্স",
        sectionBlurb: "যেগুলো শিগগিরই শুরু হবে",
        dot: "bg-primary",
        text: "text-primary-ink",
        badge: "default",
    },
    PREVIOUS: {
        admin: "Previous (recorded)",
        adminBn: "আগের (রেকর্ডেড)",
        hint: "Finished, sold as recorded classes. No support sessions and no batch dates.",
        hintBn: "শেষ হয়ে গেছে, রেকর্ডেড ক্লাস হিসেবে চলবে। কোনো সাপোর্ট সেশন বা ব্যাচের তারিখ নেই।",
        card: "Previous",
        bn: "আগের রেকর্ডেড কোর্স",
        section: "আগের রেকর্ডেড কোর্স",
        sectionBlurb: "আগে হয়ে যাওয়া কোর্স, এখন রেকর্ডিং দেখে নিজের সময়ে শিখুন",
        dot: "bg-muted-foreground",
        text: "text-muted-foreground",
        badge: "secondary",
    },
};

interface DeliveryMeta {
    label: string;
    /** Short form, where space is tight. */
    short: string;
    bn: string;
    hint: string;
    hintBn: string;
    icon: LucideIcon;
}

export const DELIVERY_META: Record<CourseDelivery, DeliveryMeta> = {
    LIVE: {
        label: "Live classes",
        short: "Live",
        bn: "লাইভ ক্লাস",
        hint: "Every class is held live.",
        hintBn: "সব ক্লাস লাইভ হয়।",
        icon: Radio,
    },
    RECORDED: {
        label: "Recorded classes",
        short: "Recorded",
        bn: "রেকর্ডেড ক্লাস",
        hint: "Every class is a recording.",
        hintBn: "সব ক্লাস রেকর্ড করা।",
        icon: CirclePlay,
    },
    HYBRID: {
        label: "Live + recorded",
        short: "Live + recorded",
        bn: "লাইভ + রেকর্ডেড ক্লাস",
        hint: "Live classes, plus recorded lessons.",
        hintBn: "লাইভ ক্লাসের সাথে রেকর্ডেড লেসনও থাকে।",
        icon: MonitorPlay,
    },
};

/** Where the course happens — a fourth fact, apart from how its classes are delivered. */
export const MODE_META: Record<CourseMode, DeliveryMeta> = {
    ONLINE: {
        label: "Online",
        short: "Online",
        bn: "অনলাইন কোর্স",
        hint: "Taken online, from anywhere.",
        hintBn: "অনলাইনে, যেকোনো জায়গা থেকে করা যায়।",
        icon: Globe,
    },
    OFFLINE: {
        label: "Offline",
        short: "Offline",
        bn: "অফলাইন কোর্স",
        hint: "Held in person, at a venue.",
        hintBn: "সরাসরি, নির্দিষ্ট জায়গায় ক্লাস হয়।",
        icon: MapPin,
    },
    BOTH: {
        label: "Online + offline",
        short: "Online + offline",
        bn: "অনলাইন + অফলাইন কোর্স",
        hint: "Some classes online, some in person. Each module says which.",
        hintBn: "কিছু ক্লাস অনলাইনে, কিছু সরাসরি। কোন ক্লাস কোথায়, তা প্রতিটা মডিউলে লেখা থাকে।",
        icon: Blend,
    },
};

export const PRICING_META: Record<CoursePricing, { label: string; bn: string; hint: string; hintBn: string; icon: LucideIcon }> = {
    FREE: {
        label: "Free",
        bn: "ফ্রি কোর্স",
        hint: "Anyone can enrol at no cost.",
        hintBn: "যে কেউ বিনা খরচে ভর্তি হতে পারে।",
        icon: Gift,
    },
    PAID: {
        label: "Paid",
        bn: "পেইড কোর্স",
        hint: "Students pay the price you set, at least ৳1.",
        hintBn: "শিক্ষার্থীরা আপনার ঠিক করা দাম দেয়, কমপক্ষে ৳১।",
        icon: Tag,
    },
};

/** Narrows a URL value to a member, or nothing — so a stale link can't break a filter. */
export const asMember = <T extends string>(members: readonly T[], value: string | null | undefined): T | undefined =>
    members.find((member) => member === value);

/** An upcoming course has no modules and no running outline yet. */
export const hasCurriculumTools = (phase: CoursePhase | undefined) => phase !== "UPCOMING";

/** A previous course has no support sessions. */
export const hasSupport = (phase: CoursePhase | undefined) => phase !== "PREVIOUS";

/** A course with any class in person may name its venue. Takes a form's raw value too. */
export const hasVenue = (mode: string | null | undefined) => mode === "OFFLINE" || mode === "BOTH";

/**
 * Only a course that runs both marks its modules and outline items online or
 * offline; on any other course they follow the course (the API refuses a mark).
 */
export const marksClassMode = (mode: CourseMode | null | undefined) => mode === "BOTH";
