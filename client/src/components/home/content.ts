/*
 * Everything the homepage says, in one place. The words and figures are
 * static on purpose — edit them here. Only the reviews read the API
 * (HomeReviews — real reviews only, from Admin → Testimonials), and hide
 * themselves when there are none.
 *
 * Half Coders teaches across coding, engineering and career skills, so the
 * page speaks of all of them — no single course is the subject.
 *
 * The copy is Bangla; button labels stay English (CtaButton, and the few
 * `label` fields below that sit on a button). Code is code — English, as in
 * a real editor — and technical names stay in Latin letters. Only say what
 * Half Coders really does: no job or income promises.
 */

/**
 * The published courses the page links to by name (the career road, the
 * "who it's for" cards, the FAQ). One place for the slugs: when a course is
 * renamed or withdrawn, change it here, or its links go dead.
 */
export const COURSES = {
    codemath: { name: "CodeMath Foundation", slug: "codemath-foundation-essential-math-before-programming" },
    codebee: { name: "CodeBee", slug: "codebee-c-c-data-structures-and-algorithms" },
    portfoliai: { name: "PortfoliAI", slug: "portfoliai-ai-portfolio-website" },
    resumecraft: { name: "ResumeCraft", slug: "resumecraft-ats-friendly-resume" },
    linkedin: { name: "LinkedIn Elevate", slug: "linkedin-elevate-personal-branding" },
    inboxpro: { name: "InboxPro", slug: "inboxpro-professional-email-writing" },
    interviewedge: { name: "InterviewEdge", slug: "interviewedge-interview-preparation" },
} as const;

export type CourseLink = (typeof COURSES)[keyof typeof COURSES];

/** A run of hero copy; `mark` ones are lit in the brand's lavender. */
export type HeroText = { text: string; mark?: boolean }[];

export type HeroFactIcon = "language" | "live" | "mentor" | "certificate";

export const HERO = {
    /**
     * The logos over the headline: programming and engineering only — the
     * languages, web stack and tools of the coding roadmap, roughly in the
     * order a learner meets them (C and C++ first, as in CodeBee). No career
     * or office tools here, even where a course uses them. Keys of
     * TECH_STACK_ICONS (lib/techStackIcons.ts). Each is drawn as a badge in
     * its official colours: `bg` the disc's gradient (light to dark), `fg`
     * the logo on it.
     */
    stack: [
        { key: "c", bg: ["#5C6BC0", "#283593"], fg: "#FFFFFF" },
        { key: "cplusplus", bg: ["#1E78C8", "#00427A"], fg: "#FFFFFF" },
        { key: "python", bg: ["#4B8BC8", "#2B5B84"], fg: "#FFD43B" },
        { key: "html5", bg: ["#F06A3F", "#C13A16"], fg: "#FFFFFF" },
        { key: "css3", bg: ["#8A4FCC", "#4E2577"], fg: "#FFFFFF" },
        { key: "javascript", bg: ["#FBE84A", "#E5C800"], fg: "#1A1A1A" },
        { key: "typescript", bg: ["#4A92E0", "#235A97"], fg: "#FFFFFF" },
        { key: "react", bg: ["#2C313A", "#121419"], fg: "#61DAFB" },
        { key: "nextjs", bg: ["#3A3A3A", "#000000"], fg: "#FFFFFF" },
        { key: "nodejs", bg: ["#78B867", "#3F7A33"], fg: "#FFFFFF" },
        { key: "git", bg: ["#F7704F", "#C93A20"], fg: "#FFFFFF" },
        { key: "github", bg: ["#3A414A", "#0D1117"], fg: "#FFFFFF" },
    ],
    /** What the logo row is, for screen readers. */
    stackLabel: "প্রোগ্রামিং ভাষা ও টুল, যা নিয়ে কাজ করবেন",
    /**
     * The headline, in two lines. `selected` wears the editor's selection
     * highlight; `mark` gets the lavender gradient and the squiggly underline.
     */
    title: { selected: "শিখতে", first: " চান?", lead: "চলুন, শুরু করি", mark: "একসাথে।" },
    description: [
        { text: "কোডিং হোক, ইঞ্জিনিয়ারিংয়ের কঠিন বিষয় কিংবা ক্যারিয়ার প্রস্তুতি—Half Coders-এর সঙ্গে শিখুন " },
        { text: "বাংলায়", mark: true },
        { text: ", " },
        { text: "বাস্তব প্রজেক্টে", mark: true },
        { text: " কাজ করুন এবং নিজের দক্ষতা তৈরি করুন " },
        { text: "অভিজ্ঞ মেন্টরদের", mark: true },
        { text: " গাইডলাইনে।" },
    ] satisfies HeroText,
    /** The card under the buttons: what every course gives — no dates or totals, which change. */
    facts: [
        { icon: "language", label: "ক্লাস হয়", value: "পুরোটা বাংলায়" },
        { icon: "live", label: "লাইভ ক্লাস", value: "রেকর্ডিংসহ" },
        { icon: "mentor", label: "আটকে গেলে", value: "মেন্টরের সাথে 1:1" },
        { icon: "certificate", label: "সার্টিফিকেট", value: "অনলাইনে যাচাই" },
    ] satisfies { icon: HeroFactIcon; label: string; value: string }[],
};

/** What Half Coders teaches, scrolling past under the hero. */
export const TICKER = [
    "Programming",
    "Web Development",
    "Data Structures",
    "Algorithms",
    "Problem Solving",
    "AI Tools",
    "E-commerce",
    "Math for Engineers",
    "Digital Portfolio",
    "Interview Prep",
    "Resume & CV",
    "LinkedIn",
    "Professional Email",
    "Communication",
    "Career Planning",
];

/**
 * Half Coders by the numbers, drawn as one dashboard. The one place on the
 * page with real totals, so keep them true and update them here when they
 * change. The digits stay Latin, like numbers in code.
 *
 * The pictures are worked out from the figures: the students get a dot per
 * `perDot` of them (keep `legend` saying the same number), the courses a stop
 * on the road per course, the success figure a ring filled to it (keep its
 * `note` in step).
 */
export const STATS = {
    eyebrow: "সংখ্যায় Half Coders",
    title: "শুরুটা ছোট, তবে থেমে নেই",
    description: "প্রতিটা সংখ্যা সত্যি, আর প্রতিটা নতুন ব্যাচে বাড়ছে। এখন পর্যন্ত আমরা এখানে:",
    /** The window's tab and its status bar. */
    tab: "এখন পর্যন্ত",
    status: "প্রতিটা নতুন ব্যাচে সংখ্যাগুলো বাড়ছে",
    students: {
        value: 350,
        suffix: "+",
        label: "ভর্তি হওয়া শিক্ষার্থী",
        text: "সবাই শিখছেন বাংলায়, মেন্টর আর ব্যাচের অন্যদের সাথে মিলে।",
        perDot: 10,
        legend: "প্রতিটা বিন্দু = ১০ জন শিক্ষার্থী",
        /** Beside the empty dots left at the end. */
        open: "ফাঁকা বিন্দুগুলো পরের ব্যাচের, একটা হতে পারে আপনার",
    },
    courses: {
        live: 8,
        upcoming: 5,
        label: "কোর্স",
        text: "৮টা কোর্স এখন লাইভ চলছে, আরও ৫টা তৈরি হচ্ছে। একটার পর একটা আসবে।",
        liveLabel: "লাইভ",
        upcomingLabel: "আসছে",
        /** Over the last live course on the road. */
        now: "এখন এখানে",
    },
    success: {
        percent: 95,
        label: "সফল শিক্ষার্থী",
        text: "আটকে গেলে মেন্টর পাশে থাকেন, তাই মাঝপথে হাল ছেড়ে দিতে হয় না।",
        note: "প্রতি ১০০ জনে ৯৫ জন",
    },
};

export type WhyIcon = "roadmap" | "review" | "support" | "motivation" | "proof";

/** A run of the problem/solution headline: `problem` in red, `solution` in green. */
export type WhyTitlePart = { text: string; kind?: "problem" | "solution" };

/**
 * Learning alone against learning here (HomeWhy): each row a problem the
 * learner has, joined by an arrow to what Half Coders does about it.
 */
export const WHY = {
    eyebrow: "কেন Half Coders",
    title: [
        { text: "একা শেখার " },
        { text: "সমস্যা", kind: "problem" },
        { text: ", আর আমাদের " },
        { text: "সমাধান", kind: "solution" },
    ] satisfies WhyTitlePart[],
    description: "ইউটিউবে ভিডিওর তো অভাব নেই। কিন্তু আটকে গেলে পাশে কেউ না থাকলে শেখাটা মাঝপথেই থেমে যায়।",
    problemLabel: "আপনার সমস্যা",
    solutionLabel: "আমাদের সমাধান",
    rows: [
        {
            icon: "roadmap",
            problem: "এরপর কী শিখব, সেটা ভাবতে ভাবতেই সময় চলে যায়",
            solution: "কোন লেসনের পর কোনটা, সব আগে থেকে সাজানো। শুধু পরেরটা ধরলেই হলো",
        },
        {
            icon: "review",
            problem: "ভুল করলেন, কিন্তু কোথায় ভুল, কেউ বলে দেয় না",
            solution: "অ্যাসাইনমেন্ট জমা দিলে মেন্টর নিজে পড়ে দেখেন, লিখে দেন কোথায় ঠিক করতে হবে",
        },
        {
            icon: "support",
            problem: "একটা জায়গায় আটকে সারা রাত পার",
            solution: "সাপোর্ট সেশনে মেন্টরকে স্ক্রিন দেখিয়ে সরাসরি জিজ্ঞেস করুন",
        },
        {
            icon: "motivation",
            problem: "দুই সপ্তাহ পর আর শুরু করার ইচ্ছাই থাকে না",
            solution: "ব্যাচের বাকিরাও শিখছে, স্ট্রিক আর লিডারবোর্ড মনে করিয়ে দেয় আজ বসতে হবে",
        },
        {
            icon: "proof",
            problem: "শেষ করার পর দেখানোর মতো কিছু হাতে থাকে না",
            solution: "পাবেন আইডিসহ সার্টিফিকেট, যেটা যে কেউ অনলাইনে মিলিয়ে দেখতে পারে",
        },
    ] satisfies { icon: WhyIcon; problem: string; solution: string }[],
};

export type DayIcon = "tea" | "work" | "lunch" | "home" | "live" | "support" | "quiz" | "sleep";

/** A block of an ordinary day, in 24-hour time; `learn` blocks are the Half Coders ones. */
export interface DayBlock {
    kind: "busy" | "learn";
    icon: DayIcon;
    from: number;
    to: number;
    time: string;
    title: string;
    text: string;
}

/**
 * An ordinary day with learning fitted into its gaps (HomeDay), written as a
 * file in the editor: the times down the gutter, the learning as added lines,
 * the rest of the day as comments. A learning block that falls inside a busy
 * one (lunch, in the office day) is drawn nested inside it.
 */
export const DAY = {
    eyebrow: "রুটিনের মধ্যেই",
    title: "সময় নেই? একটু খুঁজলেই পাবেন",
    description: "ক্লাস, অফিস, বাসার কাজ সবই থাকবে। শেখার জন্য আলাদা করে দিন ফাঁকা করতে হবে না, দিনের ফাঁকে ফাঁকে যতটুকু পারেন। ধরুন আপনার একটা সাধারণ দিন:",
    tab: "একটা সাধারণ দিন",
    tracks: { busy: "আপনার কাজ", learn: "Half Coders-এর সময়" },
    /** Beside the legend: what's fixed and what isn't. */
    tip: "লেসন, কুইজ আর অ্যাসাইনমেন্ট যখন খুশি করা যায়। সময় ঠিক করা শুধু লাইভ ক্লাসের, আর সেটা মিস হলেও রেকর্ডিং থাকে।",
    /** The status bar: how many times the day had learning in it (`{n}` is the count, in Bangla digits). */
    status: "সারাদিনে {n} বার শেখা, বাকি সব ঠিক রেখেই",
    blocks: [
        { kind: "learn", icon: "tea", from: 7, to: 7.5, time: "সকাল ৭:০০", title: "চা হাতে একটা লেসন", text: "লেসনগুলো এত ছোট যে চায়ের কাপ শেষ হওয়ার আগেই একটা দেখা হয়ে যায়।" },
        { kind: "busy", icon: "work", from: 9, to: 17, time: "সকাল ৯টা – বিকেল ৫টা", title: "ক্লাস বা অফিস", text: "এই সময়ে শেখার কথা ভাবতেও হবে না।" },
        { kind: "learn", icon: "lunch", from: 13.5, to: 14, time: "দুপুর ১:৩০", title: "লাঞ্চের ফাঁকে বাকিটা", text: "সকালে যেখানে থেমেছিলেন, ফোন খুললেই ঠিক সেখান থেকে শুরু হবে।" },
        { kind: "busy", icon: "home", from: 18, to: 20, time: "সন্ধ্যা ৬টা – রাত ৮টা", title: "বাসায় সবার সাথে", text: "চা-নাস্তা, গল্প, বাচ্চাদের পড়া। এই সময়টা পরিবারের।" },
        { kind: "learn", icon: "live", from: 20, to: 21, time: "রাত ৮:০০", title: "লাইভ ক্লাস", text: "মেন্টর পড়াবেন, আপনি সাথে সাথে প্রশ্ন করবেন। কোনোদিন ধরতে না পারলে পরে রেকর্ডিং দেখে নিবেন।" },
        { kind: "learn", icon: "support", from: 21.5, to: 22, time: "রাত ৯:৩০", title: "কোথাও আটকে গেলে", text: "সাপোর্ট সেশনে নাম লিখে রাখুন। পালা এলে মেন্টর আপনার স্ক্রিন দেখে বুঝিয়ে দেবেন।" },
        { kind: "learn", icon: "quiz", from: 22.5, to: 23, time: "রাত ১০:৩০", title: "ঘুমের আগে দুই মিনিট", text: "ছোট্ট একটা কুইজ দিয়ে দেখে নিন আজকের পড়াটা মাথায় ঢুকল কি না।" },
        { kind: "busy", icon: "sleep", from: 23.5, to: 24, time: "রাত ১১:৩০", title: "এবার ঘুম", text: "আজকের মতো যথেষ্ট। কাল আবার একটু।" },
    ] as DayBlock[],
};

export type InsideIcon = "lessons" | "live" | "review" | "quiz" | "support" | "xp" | "certificate";

export const INSIDE = {
    eyebrow: "কোর্সের ভেতরে",
    title: "ভর্তি হলে আসলে কী কী পাবেন",
    description: "বাঁ পাশ থেকে একটা একটা করে খুলে দেখুন। যে কোর্সই নিন, এগুলো সবগুলোতেই থাকবে।",
    explorer: "কোর্সে যা পাবেন",
    /** Over the example under each item. */
    example: "উদাহরণ",
    files: [
        {
            id: "lessons",
            file: "lessons/",
            label: "ভিডিও লেসন",
            icon: "lessons",
            title: "ছোট ছোট ভিডিও লেসন",
            text: "লম্বা লেকচার না, ছোট ছোট ভিডিও। আজ কোনটা দেখবেন সেটা নিয়ে ভাবতে হবে না, সাজানোই আছে। আর মাঝপথে বন্ধ করলে পরের বার ঠিক সেখান থেকেই চালু হবে।",
            preview: ["01-introduction.mp4   08:40  ✓", "02-first-steps.mp4    12:05  ✓", "03-practice.mp4       11:52  ▶", "04-next-level.mp4     14:10"],
        },
        {
            id: "live",
            file: "live-classes/",
            label: "লাইভ ক্লাস",
            icon: "live",
            title: "প্রতি সপ্তাহে লাইভ ক্লাস",
            text: "মেন্টর লাইভে করে দেখান, আপনিও সাথে সাথে করবেন। কিছু না বুঝলে তখনই জিজ্ঞেস করে নিন। ক্লাস মিস হয়ে গেলে রেকর্ডিং পরে দেখে নিতে পারবেন।",
            preview: ["সোম  রাত ৯:০০  নতুন টপিক", "বৃহঃ রাত ৯:০০  প্র্যাকটিস ও প্রশ্নোত্তর", "রেকর্ডিং: ক্লাসের পরেই পাবেন"],
        },
        {
            id: "review",
            file: "assignments/",
            label: "অ্যাসাইনমেন্ট ও রিভিউ",
            icon: "review",
            title: "মেন্টর নিজে দেখে দেন",
            text: "অ্যাসাইনমেন্ট জমা দিলে কোনো মেশিন না, মেন্টর নিজে পড়ে নম্বর দেন। কোথায় ভুল আর কীভাবে আরও ভালো হয়, সেটাও লিখে দেন। ঠিক করে আবার জমা দেওয়া যায়।",
            preview: ["- for (int i = 0; i <= n; i++)", "+ for (int i = 0; i < n; i++)", "💬 মেন্টর: লুপটা একবার বেশি চলছিল, < দিলেই ঠিক।"],
        },
        {
            id: "quiz",
            file: "quizzes/",
            label: "কুইজ",
            icon: "quiz",
            title: "মডিউল শেষে কুইজ",
            text: "একটা মডিউল শেষ হলে ছোট্ট একটা কুইজ, পড়াটা আসলেই বুঝলেন কি না দেখার জন্য। ভুল হলে সাথে সাথে বুঝিয়ে দেবে কেন ভুল, আর যতবার ইচ্ছা আবার দিতে পারবেন।",
            preview: ["প্রশ্ন ৩: কোনটা সঠিক?", "  ( ) প্রথমটা    (•) দ্বিতীয়টা", "✓ সঠিক!"],
        },
        {
            id: "support",
            file: "support-queue.sh",
            label: "সাপোর্ট সেশন",
            icon: "support",
            title: "আটকে গেলে সরাসরি সাহায্য",
            text: "সাপোর্ট সেশনে নাম লিখে রাখুন। আপনার পালা এলে Google Meet-এ ঢুকে মেন্টরকে স্ক্রিন দেখান, একসাথে বসে সমস্যাটা মিটিয়ে ফেলুন।",
            preview: ["আপনার নম্বর: #07", "আপনার আগে আছে: ৩ জন", "আনুমানিক অপেক্ষা: ~১৫ মিনিট"],
        },
        {
            id: "xp",
            file: "leaderboard.json",
            label: "XP ও লিডারবোর্ড",
            icon: "xp",
            title: "একটু খেলার মতো",
            text: "মডিউল ২৪ ঘণ্টার মধ্যে শেষ করলে আর অ্যাসাইনমেন্ট সময়মতো জমা দিলে XP জমে। রোজ একটু বসলে স্ট্রিক বাড়ে, আর লিডারবোর্ডে দেখবেন ব্যাচের অন্যদের থেকে কতটা এগিয়ে আছেন।",
            preview: ["র‍্যাঙ্ক: ৪", "XP: 38", "স্ট্রিক: ১২ দিন 🔥"],
        },
        {
            id: "certificate",
            file: "certificate.pdf",
            label: "সার্টিফিকেট",
            icon: "certificate",
            title: "আসল সার্টিফিকেট",
            text: "কোর্স শেষ করলে পাবেন নিজের আইডিসহ সার্টিফিকেট। কেউ সন্দেহ করলে আইডিটা দিয়ে আমাদের সাইটে মিলিয়ে নিতে পারবে। চাইলে PDF নামিয়েও রাখতে পারবেন।",
            preview: ["আইডি: HCC-XX-2026-000125", "অবস্থা: সঠিক ✓", "কোর্স: আপনার কোর্সের নাম"],
        },
    ] satisfies { id: string; file: string; label: string; icon: InsideIcon; title: string; text: string; preview: string[] }[],
};

export type CareerIcon = "foundation" | "dsa" | "fullstack" | "ai" | "portfolio" | "branding" | "interview";

/** A run of the career section's headline: `tag` is drawn as a highlighted <tag>, `mark` in the brand's purple. */
export type CareerTitlePart = { text: string; kind?: "tag" | "mark" };

/**
 * The road from a first line of code to a developer job, in seven steps,
 * told as a zigzag down the page (HomeCareer). It is the direction, not a
 * promise: no job, company or placement is claimed.
 *
 * `courses` are the published courses that help with a step — they may cover
 * part of it, not all, and the section says so. A step with none says that
 * too. Keep the slugs in step with the catalogue: a renamed or withdrawn
 * course here is a dead link. (The IIUC batch of CodeBee is left out: it is
 * the same course for one university.)
 */
export const CAREER = {
    eyebrow: "ক্যারিয়ারের পথ",
    title: [
        { text: "এই ৭টি ধাপে আপনিও হয়ে উঠুন একজন " },
        { text: "<Software Developer>", kind: "tag" },
        { text: ", তৈরি হোন " },
        { text: "টপ কোম্পানিতে", kind: "mark" },
        { text: " কাজ করার জন্য।" },
    ] satisfies CareerTitlePart[],
    description: "একদম প্রথম লাইন কোড থেকে চাকরির আবেদন পর্যন্ত, পুরো পথটা ধাপে ধাপে। যে ধাপে আছেন, সেখান থেকেই শুরু করুন।",
    /** Over each card's number. English, like the "STEP" in a build log. */
    stepLabel: "STEP",
    coursesLabel: "সংশ্লিষ্ট কোর্স",
    noCourse: "এই ধাপের কোর্স এখনো যোগ হয়নি",
    steps: [
        {
            icon: "foundation",
            title: "প্রোগ্রামিং ও ইঞ্জিনিয়ারিংয়ের ভিত",
            en: "Programming & Engineering Foundation",
            text: "প্রথম লাইন কোড থেকে শুরু। C আর C++ দিয়ে প্রোগ্রামিংয়ের মূল ধারণা, সাথে প্রোগ্রামিংয়ের জন্য দরকারি গণিত আর কম্পিউটার সায়েন্সের বেসিক।",
            tags: ["C", "C++", "Engineering Math", "CS Fundamentals"],
            courses: [
                COURSES.codemath,
                COURSES.codebee,
            ],
        },
        {
            icon: "dsa",
            title: "ডেটা স্ট্রাকচার, অ্যালগরিদম ও প্রবলেম সলভিং",
            en: "Data Structures, Algorithms & Problem Solving",
            text: "কোড লিখতে পারা আর সমস্যা সমাধান করতে পারা এক জিনিস না। ডেটা স্ট্রাকচার আর অ্যালগরিদম শিখে, নিয়মিত প্রবলেম সলভ করে চিন্তাটা ধারালো করা।",
            tags: ["Data Structures", "Algorithms", "Problem Solving", "Logic"],
            courses: [COURSES.codebee],
        },
        {
            icon: "fullstack",
            title: "ফুল-স্ট্যাক ও রিয়েল-ওয়ার্ল্ড প্রজেক্ট",
            en: "Full-Stack & Real-World Projects",
            text: "ফ্রন্টএন্ড, ব্যাকএন্ড আর ডেটাবেস মিলিয়ে পুরো একটা অ্যাপ নিজে বানানো। শুধু উদাহরণ না, মানুষ সত্যিই ব্যবহার করতে পারে এমন প্রজেক্ট।",
            tags: ["Frontend", "Backend", "Database", "REST API"],
            courses: [],
        },
        {
            icon: "ai",
            title: "AI ইন্টিগ্রেশন ও প্রোডাক্ট ডেভেলপমেন্ট",
            en: "AI Integration & Product Development",
            text: "প্রজেক্টে AI জুড়ে দেওয়া, প্রোডাক্টের মতো করে ভাবা, আর শেষে ডিপ্লয় করে সবার জন্য লাইভ করে দেওয়া।",
            tags: ["AI Integration", "Product Thinking", "Deployment"],
            courses: [],
        },
        {
            icon: "portfolio",
            title: "রিজিউমি, পোর্টফোলিও ও GitHub",
            en: "Resume, Portfolio & GitHub",
            text: "যা শিখলেন আর বানালেন, তা গুছিয়ে দেখানো: ATS-ফ্রেন্ডলি রিজিউমি, নিজের পোর্টফোলিও ওয়েবসাইট আর গোছানো GitHub প্রোফাইল।",
            tags: ["ATS Resume", "Portfolio Website", "GitHub Profile"],
            courses: [
                COURSES.resumecraft,
                COURSES.portfoliai,
            ],
        },
        {
            icon: "branding",
            title: "LinkedIn ও পার্সোনাল ব্র্যান্ডিং",
            en: "LinkedIn & Personal Branding",
            text: "রিক্রুটাররা যেখানে খোঁজেন, সেখানে নিজেকে তুলে ধরা: গোছানো LinkedIn প্রোফাইল, নিজের কাজ নিয়ে লেখা, আর পেশাদার ইমেইলে যোগাযোগ।",
            tags: ["LinkedIn", "Personal Branding", "Professional Email"],
            courses: [
                COURSES.linkedin,
                COURSES.inboxpro,
            ],
        },
        {
            icon: "interview",
            title: "ইন্টারভিউ ও ক্যারিয়ার প্রস্তুতি",
            en: "Interview & Career Readiness",
            text: "টেকনিক্যাল ইন্টারভিউয়ের প্রস্তুতি, গুছিয়ে কথা বলা, প্রবলেম সলভিং প্র্যাকটিস, আর দেশে-বিদেশে চাকরির আবেদনের জন্য তৈরি হওয়া।",
            tags: ["Technical Interview", "Communication", "Problem Solving", "Local & Global Jobs"],
            courses: [COURSES.interviewedge],
        },
    ] satisfies {
        icon: CareerIcon;
        title: string;
        en: string;
        text: string;
        tags: string[];
        courses: CourseLink[];
    }[],
    /** Where the road ends: the goal, at the foot of the zigzag. */
    goal: { label: "আপনার লক্ষ্য", title: "Job-ready Software Developer" },
    /** Under it all: what the course names mean, plainly. */
    note: "সংশ্লিষ্ট কোর্সগুলো ধাপের কিছু অংশ শেখায়, সবটা না-ও শেখাতে পারে। কোন কোর্সে ঠিক কী আছে, কোর্সের পাতায় দেখে নিন।",
};

/**
 * The support session, acted out as a video call with the learner's screen
 * shared: an illustration of what a session feels like, not a real one (real
 * sessions run on Google Meet). The example is a small coding bug; the code
 * is English.
 */
export const LIVE_SHARE = {
    eyebrow: "সাপোর্ট সেশন",
    title: "আটকে গেছেন? মেন্টরকে স্ক্রিনটা দেখান",
    description: "একটা ভুল খুঁজতে গিয়ে সারা রাত পার করে দেওয়ার অভিজ্ঞতা আমাদের প্রায় সবারই আছে। এখানে সেটা করতে হবে না। মেন্টর আপনার স্ক্রিন দেখে ভুলটা ধরিয়ে দেবেন, আর বুঝিয়ে বলবেন কেন এমন হলো।",
    points: [
        { title: "সাপোর্ট সেশনে নাম লিখুন", text: "কোর্সের ভেতরেই বাটন আছে, একবার চাপলেই হলো।" },
        { title: "পালা এলে Google Meet-এ ঢুকুন", text: "আপনার আগে কতজন আছে, কতক্ষণ লাগতে পারে, সবই দেখা যায়।" },
        { title: "স্ক্রিন শেয়ার করে একসাথে ঠিক করুন", text: "মেন্টর উত্তর বলে দিয়েই চলে যাবেন না, কেন ভুল হলো সেটাও বুঝিয়ে দেবেন।" },
    ],
    call: {
        title: "সাপোর্ট সেশন",
        sharing: "আপনার স্ক্রিন শেয়ার হচ্ছে",
        screen: "আপনার কোড",
        you: "আপনি",
        mentor: "মেন্টর",
        /** The letter in each person's round avatar. */
        initials: { you: "আ", mentor: "ম" },
        /** The line that changes: `head` + `bug` (later `fix`) + `tail`. */
        line: { head: "for (int i = 0; i ", bug: "<=", fix: "<", tail: " n; i++) {" },
        /** What's said, shown as live captions under the shared screen. */
        captions: {
            ask: "লুপটা একবার বেশি ঘুরছে, কেন বুঝতে পারছি না 😕",
            hint: "এখানে <= দিয়েছেন, তাই n বার না ঘুরে n+1 বার ঘুরছে। শুধু < দিয়ে দেখুন।",
            thanks: "ওহ, এই ব্যাপার! এখন ঠিক আছে, ধন্যবাদ 🎉",
        },
        output: { wrong: "৬টা সংখ্যা এলো, অথচ হওয়ার কথা ৫টা", running: "চালানো হচ্ছে…", right: "৫টা সংখ্যা, একদম ঠিক" },
    },
};

export type AudienceIcon = "student" | "engineer" | "switcher" | "jobseeker";

/**
 * Who the courses are for — and, for each, where to start: the published
 * courses that fit them best (from COURSES), as links on the card.
 */
export const AUDIENCE = {
    eyebrow: "কাদের জন্য",
    title: "আপনি কি এদের একজন?",
    description: "বয়স কত বা আগে কী পড়েছেন, তাতে কিছু যায় আসে না। শেখার ইচ্ছাটা থাকলেই চলবে। নিজের সাথে মেলে এমন কার্ডটা দেখুন, কোথা থেকে শুরু করবেন সেটাও বলা আছে।",
    startLabel: "শুরু করতে পারেন",
    items: [
        {
            icon: "student",
            title: "স্কুল, কলেজ বা ভার্সিটিতে পড়ছেন",
            text: "ক্লাসে থিওরি তো পড়ছেনই। পাশাপাশি হাতে-কলমে কিছু শিখে রাখুন, পরে খুব কাজে দেবে।",
            start: [COURSES.codemath, COURSES.codebee],
        },
        {
            icon: "engineer",
            title: "ইঞ্জিনিয়ারিং পড়ছেন",
            text: "প্রোগ্রামিং, গণিত আর প্রবলেম সলভিং পুরো চার বছর লাগবে। শুরুতেই এগুলো পোক্ত করে নিন।",
            start: [COURSES.codebee],
        },
        {
            icon: "switcher",
            title: "অন্য পেশা থেকে আসতে চান",
            text: "আগে অন্য কিছু করতেন? সমস্যা নেই। একদম গোড়া থেকে শুরু হবে, এগোবেন নিজের সময়মতো।",
            start: [COURSES.codemath, COURSES.portfoliai],
        },
        {
            icon: "jobseeker",
            title: "চাকরি খুঁজছেন",
            text: "ইন্টারভিউতে কী বলবেন, রিজিউমি কেমন হবে, LinkedIn কীভাবে সাজাবেন, এসব শিখে নিজেকে গুছিয়ে নিন।",
            start: [COURSES.resumecraft, COURSES.interviewedge, COURSES.linkedin],
        },
    ] satisfies { icon: AudienceIcon; title: string; text: string; start: CourseLink[] }[],
};

/** The certificate, and how anyone checks one. */
export const CERTIFICATE = {
    eyebrow: "সার্টিফিকেট",
    title: "সার্টিফিকেট আসল কি না, যে কেউ দেখে নিতে পারবে",
    description: "প্রতিটা সার্টিফিকেটে আলাদা একটা আইডি থাকে, আর থাকে তার নিজের একটা পেজ। ইন্টারভিউতে কেউ জানতে চাইলে আইডিটা দিয়ে দিন, কয়েক সেকেন্ডেই মিলিয়ে নেবে।",
    points: ["প্রতিটার আলাদা আইডি, অনলাইনে যাচাই করা যায়", "PDF নামিয়ে রাখা যায়, লিংক দিয়ে শেয়ারও করা যায়", "সিভি আর LinkedIn-এ সহজেই যোগ করতে পারবেন"],
    /** The example certificate, drawn in English like the real ones. */
    sample: {
        badge: "নমুনা",
        name: "Your Name",
        course: "Your Course Name",
        id: "HCC-XX-2026-000125",
        date: "10 September 2026",
        signedBy: "Course Mentor",
        /** Around the round seal. */
        seal: "VERIFIED • HALF CODERS • VERIFIED • HALF CODERS •",
    },
    /** The check under the sample, as it runs. */
    check: { label: "সার্টিফিকেট যাচাই", checking: "মিলিয়ে দেখা হচ্ছে…", valid: "সঠিক সার্টিফিকেট" },
    /** A button, so English. */
    cta: "Verify a certificate",
};

export const REVIEWS = {
    eyebrow: "রিভিউ",
    title: "যাঁরা শিখছেন, তাঁরা কী বলছেন",
    description: "আমাদের কথা তো অনেক শুনলেন। এবার শুনুন যাঁরা এখানে শিখছেন, তাঁদের মুখে।",
};

export const FAQ = {
    eyebrow: "প্রশ্নোত্তর",
    title: "যে প্রশ্নগুলো প্রায় সবাই করেন",
    description: "এখানে উত্তর না পেলে সরাসরি আমাদের লিখুন। সাধারণত এক দিনের মধ্যেই জবাব দিই।",
    file: "প্রশ্নোত্তর",
    search: { label: "প্রশ্ন খুঁজুন", placeholder: "লিখে খুঁজুন, যেমন: পেমেন্ট", clear: "মুছে ফেলুন" },
    /** Quick searches, beside the heading. */
    quickTitle: "অনেকে যা খোঁজেন",
    quick: ["পেমেন্ট", "সার্টিফিকেট", "ফোন", "আটকে গেলে"],
    /** When a search finds nothing. Searches read each item's question, answer and `keys`. */
    empty: "এটা নিয়ে এখনো কিছু লেখা নেই। সরাসরি জিজ্ঞেস করুন, আমরা উত্তর দেব।",
    items: [
        {
            q: "একদম নতুন, কিছুই জানি না। পারব তো?",
            keys: "নতুন বিগিনার beginner শুরু",
            a: "পারবেন। বিগিনার কোর্সগুলো একেবারে শূন্য থেকে শুরু হয়, আগে কিছু জানার দরকার নেই। শুধু নিয়মিত একটু সময় দিতে হবে।",
        },
        {
            q: "কোন কোন বিষয়ের কোর্স আছে?",
            keys: "কোর্স course বিষয় কোডিং ক্যারিয়ার",
            a: "এখন চলছে তিন দিকের কোর্স: প্রোগ্রামিং আর ইঞ্জিনিয়ারিংয়ের ভিত (C, C++, DSA, প্রোগ্রামিংয়ের গণিত), নিজে কিছু বানানো (AI দিয়ে পোর্টফোলিও সাইট), আর চাকরির প্রস্তুতি (রিজিউমি, LinkedIn, পেশাদার ইমেইল, ইন্টারভিউ)। নতুন কোর্স যোগ হলে কোর্স পেজে সবার আগে দেখতে পাবেন।",
        },
        {
            q: "কোন কোর্স দিয়ে শুরু করব?",
            keys: "শুরু start কোন কোর্স প্রথম beginner",
            a: `একদম নতুন হলে ${COURSES.codemath.name} বা ${COURSES.codebee.name} দিয়ে শুরু করুন। চাকরির জন্য তৈরি হচ্ছেন? ${COURSES.resumecraft.name} আর ${COURSES.interviewedge.name} কাজে দেবে। পেজের "ক্যারিয়ারের পথ" অংশে কোন ধাপে কোন কোর্স, সেটা দেওয়া আছে।`,
        },
        {
            q: "ভর্তি হব কীভাবে, কী কী লাগবে?",
            keys: "ভর্তি enroll রেজিস্ট্রেশন লাগবে কম্পিউটার ইন্টারনেট",
            a: "পছন্দের কোর্সের পাতায় গিয়ে ভর্তি হোন, বিকাশে টাকা পাঠিয়ে Transaction ID দিন। আমাদের টিম মিলিয়ে দেখলেই কোর্সটা আপনার ড্যাশবোর্ডে চলে আসবে। লাগবে শুধু ইন্টারনেট, সপ্তাহে কয়েক ঘণ্টা সময়, আর কোডিং কোর্স হলে একটা ল্যাপটপ বা ডেস্কটপ।",
        },
        {
            q: "ক্লাসগুলো কীভাবে হয়?",
            keys: "ক্লাস class লাইভ ভিডিও মডিউল",
            a: "প্রতিটা কোর্স কয়েকটা মডিউলে ভাগ করা। মডিউলে থাকে ছোট ছোট ভিডিও আর লাইভ ক্লাস, শেষে একটা কুইজ আর অ্যাসাইনমেন্ট। কতদূর এগোলেন, সেটা নিজে থেকেই সেভ হয়ে থাকে।",
        },
        {
            q: "আটকে গেলে কী করব?",
            keys: "সাপোর্ট support সাহায্য help মেন্টর",
            a: "সাপোর্ট সেশনে নাম লিখে রাখুন। পালা এলে Google Meet-এ মেন্টরের সাথে কথা বলবেন, স্ক্রিন শেয়ার করে সমস্যাটা দেখিয়ে দিতে পারবেন।",
        },
        {
            q: "ক্লাস কি বাংলায় হয়?",
            keys: "ভাষা language ইংরেজি english বাংলা",
            a: "হ্যাঁ, পুরোটাই বাংলায়। তবে টেকনিক্যাল শব্দগুলো ইংরেজিতেই বলা হয়, কারণ চাকরিতে গিয়ে আপনি ওগুলো ইংরেজিতেই শুনবেন।",
        },
        {
            q: "শুধু ফোন দিয়ে হবে?",
            keys: "ফোন মোবাইল mobile ল্যাপটপ laptop কম্পিউটার",
            a: "ভিডিও দেখা, কুইজ দেওয়া, লাইভ ক্লাসে ঢোকা, এগুলো ফোনেই হয়ে যায়। কিন্তু কোডিং কোর্সে প্র্যাকটিস করতে ল্যাপটপ বা ডেস্কটপ লাগবেই।",
        },
        {
            q: "টাকা কীভাবে দেব?",
            keys: "পেমেন্ট payment বিকাশ bkash টাকা দাম",
            a: "বিকাশে। চেকআউটে একটা QR কোড আর আমাদের মার্চেন্ট নম্বর (01329 453 598) পাবেন। QR স্ক্যান করুন, অথবা \"Payment\" অপশনে গিয়ে টাকা পাঠান। তারপর Transaction ID-টা জমা দিন, আমাদের টিম মিলিয়ে দেখে কোর্স খুলে দেবে।",
        },
        {
            q: "টাকা পাঠিয়েছি, তবুও কোর্স খুলছে না কেন?",
            keys: "পেমেন্ট payment বিকাশ bkash কোর্স খুলছে না",
            a: "Transaction ID মিলিয়ে দেখতে একটু সময় লাগে, হয়ে গেলেই ইমেইলে জানিয়ে দেব। অনেকক্ষণ পার হয়ে গেলে অর্ডার নম্বর আর Transaction ID দিয়ে আমাদের একটা ইমেইল করুন, আমরা দেখে নেব।",
        },
        {
            q: "সার্টিফিকেট পাব?",
            keys: "সার্টিফিকেট certificate যাচাই",
            a: "পাবেন। সব লেসন শেষ করে অ্যাসাইনমেন্টগুলো মেন্টর অ্যাপ্রুভ করলেই সার্টিফিকেট নিতে পারবেন। প্রতিটার আলাদা আইডি থাকে, অনলাইনে যাচাই করা যায়, PDF-ও নামিয়ে রাখা যায়।",
        },
        {
            q: "কোর্স শেষে চাকরির নিশ্চয়তা আছে?",
            keys: "চাকরি job প্লেসমেন্ট placement গ্যারান্টি নিশ্চয়তা",
            a: "না, সৎভাবে কেউই সেটা দিতে পারে না। আমরা যা করি: হাতে-কলমে শেখাই, আপনার কাজ নিজে দেখে দিই, আর রিজিউমি, LinkedIn আর ইন্টারভিউয়ের প্রস্তুতিতে সাহায্য করি। বাকিটা আপনার পরিশ্রম।",
        },
    ],
    /** Under the list. A button, so English. */
    contact: { href: "/contact", label: "Ask us directly" },
};

/**
 * The closing call to action (HomeCta): the ask and the two ways in on the
 * left; on the right a terminal that "starts" Half Coders and prints what
 * every course gives, line by line.
 */
export const CTA = {
    eyebrow: "শুরু করুন",
    title: "তাহলে আজই শুরু করে ফেলুন",
    description: "একটা কোর্স বেছে নিয়ে প্রথম ভিডিওটা দেখে ফেলুন, ব্যস। সব একদিনে শিখতে হবে না, রোজ অল্প অল্প করলেই হবে।",
    /** The terminal's command — decoration; the lines under it are the real information. */
    command: "halfcoders start",
    /** Printed under the command: what every course gives. Plain Bangla, ticked. */
    gives: ["ক্লাস পুরোটা বাংলায়", "লাইভ ক্লাস, মিস করলে রেকর্ডিং", "অ্যাসাইনমেন্টে মেন্টরের রিভিউ", "আটকে গেলে সাপোর্ট সেশন", "অনলাইনে যাচাইযোগ্য সার্টিফিকেট"],
    output: "চলুন, শুরু করা যাক!",
};
