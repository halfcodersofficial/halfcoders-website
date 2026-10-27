import {
    Award,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Code2,
    Dumbbell,
    FileText,
    Headphones,
    Infinity as InfinityIcon,
    Layers,
    ListChecks,
    MessageCircle,
    PlayCircle,
    Radio,
    Smartphone,
    Target,
    Users,
    type LucideIcon,
} from "lucide-react";

/**
 * The icons a course page can draw: the "How this course is structured"
 * tiles and the hero facts.
 *
 * Mirrors `COURSE_FEATURE_ICONS` on the API: the server stores the *key*, and
 * this map turns it into a bundled icon. A closed list on both sides is what
 * lets an admin pick from a dropdown, the preview render the same glyph the
 * public page will, and nothing user-typed ever reach an `<img src>`.
 */
export const COURSE_FEATURE_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
    video: { icon: PlayCircle, label: "Video lessons" },
    live: { icon: Radio, label: "Live classes" },
    file: { icon: FileText, label: "Notes & PDFs" },
    quiz: { icon: ListChecks, label: "Quizzes / mock tests" },
    assignment: { icon: ClipboardCheck, label: "Assignments" },
    practice: { icon: Dumbbell, label: "Practice" },
    support: { icon: Headphones, label: "1:1 support" },
    community: { icon: Users, label: "Community" },
    certificate: { icon: Award, label: "Certificate" },
    book: { icon: BookOpen, label: "Book / reading" },
    calendar: { icon: CalendarDays, label: "Schedule" },
    code: { icon: Code2, label: "Coding" },
    chat: { icon: MessageCircle, label: "Q&A" },
    target: { icon: Target, label: "Goal / outcome" },
    clock: { icon: Clock, label: "Duration" },
    infinity: { icon: InfinityIcon, label: "Lifetime access" },
    check: { icon: CheckCircle2, label: "Check mark" },
    mobile: { icon: Smartphone, label: "Desktop & mobile" },
    layers: { icon: Layers, label: "Modules" },
};

/** The picker's names on a Bangla screen. */
export const COURSE_FEATURE_ICON_NAMES_BN: Record<string, string> = {
    video: "ভিডিও লেসন",
    live: "লাইভ ক্লাস",
    file: "নোট ও পিডিএফ",
    quiz: "কুইজ / মক টেস্ট",
    assignment: "অ্যাসাইনমেন্ট",
    practice: "প্র্যাকটিস",
    support: "১:১ সাপোর্ট",
    community: "কমিউনিটি",
    certificate: "সার্টিফিকেট",
    book: "বই / পড়া",
    calendar: "সময়সূচি",
    code: "কোডিং",
    chat: "প্রশ্নোত্তর",
    target: "লক্ষ্য / ফলাফল",
    clock: "চলবে",
    infinity: "আজীবন অ্যাক্সেস",
    check: "টিক চিহ্ন",
    mobile: "ডেস্কটপ ও মোবাইল",
    layers: "মডিউল",
};

export const COURSE_FEATURE_ICON_KEYS = Object.keys(COURSE_FEATURE_ICONS);

/** Falls back to the video glyph for a key this build doesn't know. */
export const featureIcon = (key: string): LucideIcon =>
    COURSE_FEATURE_ICONS[key]?.icon ?? PlayCircle;
