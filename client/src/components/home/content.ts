/*
 * Everything the homepage says, in one place. The page is static on purpose:
 * no course or figure here comes from the API — edit them here. (The one
 * exception is the reviews, HomeReviews: real reviews only, from Admin →
 * Testimonials.)
 *
 * Half Coders teaches across coding, engineering and career skills, so the
 * page speaks of all of them — no single course is the subject.
 *
 * The copy is Bangla; button labels stay English (CtaButton, and the few
 * `label` fields below that sit on a button). Code is code — English, as in
 * a real editor — and technical names stay in Latin letters. Only say what
 * Half Coders really does: no job or income promises.
 */

/** One line of the hero's code window. `parts` are coloured by kind; `indent` is in levels of four spaces. */
export interface CodeLine {
    indent?: number;
    parts: { text: string; kind?: "kw" | "str" | "fn" | "num" | "cmt" | "tag" | "plain" }[];
}

export const HERO = {
    /** The badge over the headline. */
    badge: "নতুনদের জন্য, শেখা শুরু হোক আজ থেকেই",
    /** The headline, in two lines; `mark` gets the editor's squiggly underline. */
    title: { first: "শিখতে চান?", lead: "চলুন, শুরু করি", mark: "একসাথে।" },
    description:
        "কোডিং হোক, ইঞ্জিনিয়ারিংয়ের গণিত হোক বা চাকরির প্রস্তুতি, এখানে সবকিছু শেখানো হয় বাংলায়, একদম সহজ করে। ক্লাসে যত খুশি প্রশ্ন করুন, নিজে হাতে কাজ করুন। অ্যাসাইনমেন্ট জমা দিলে আমাদের মেন্টররা নিজেরাই সেটা দেখে বলে দেবেন কোথায় আরেকটু ভালো করা যায়।",
    /** The ticks under the buttons. */
    checks: ["ক্লাস বাংলায়", "মেন্টর নিজে কাজ দেখেন", "সার্টিফিকেট অনলাইনে মিলিয়ে দেখা যায়"],
    /** The code window beside the headline — decoration. English, like real code; the comments are Bangla. */
    window: {
        file: "hello.cpp",
        other: "notes.md",
        code: [
            { parts: [{ text: "#include ", kind: "kw" }, { text: "<iostream>", kind: "str" }] },
            { parts: [{ text: "using namespace ", kind: "kw" }, { text: "std;" }] },
            { parts: [] },
            { parts: [{ text: "int ", kind: "kw" }, { text: "main", kind: "fn" }, { text: "() {" }] },
            { indent: 1, parts: [{ text: "// প্রথম দিন, প্রথম প্রোগ্রাম", kind: "cmt" }] },
            { indent: 1, parts: [{ text: "cout << " }, { text: "\"Hello, Half Coders!\"", kind: "str" }, { text: " << endl;" }] },
            { parts: [] },
            { indent: 1, parts: [{ text: "for ", kind: "kw" }, { text: "(" }, { text: "int ", kind: "kw" }, { text: "day = " }, { text: "1", kind: "num" }, { text: "; ; day++) {" }] },
            { indent: 2, parts: [{ text: "learn", kind: "fn" }, { text: "(); " }, { text: "build", kind: "fn" }, { text: "(); " }, { text: "// রোজ একটু একটু", kind: "cmt" }] },
            { indent: 1, parts: [{ text: "}" }] },
            { parts: [{ text: "}" }] },
        ] satisfies CodeLine[],
        /** The terminal under the code, typed out line by line. */
        terminal: [
            { kind: "cmd", text: "g++ hello.cpp -o hello && ./hello" },
            { kind: "out", text: "Hello, Half Coders!" },
            { kind: "ok", text: "মেন্টর: বাহ, প্রথমবারেই চলে গেছে! 🎉" },
        ] as const,
        status: { branch: "learning", lang: "Half Coders", position: "Ln 6, Col 42", state: "শেখা চলছে" },
    },
    /** The facts along the foot of the hero: what every course gives, not totals. */
    facts: [
        { value: "বাংলা", label: "পুরোটা বাংলায় বোঝানো হয়" },
        { value: "লাইভ", label: "ক্লাস হয় লাইভে, মিস করলে রেকর্ডিং আছে" },
        { value: "1:1", label: "আটকে গেলে মেন্টরের সাথে আলাদা বসা যায়" },
        { value: "✓", label: "সার্টিফিকেট যে কেউ অনলাইনে মিলিয়ে দেখতে পারে" },
    ],
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

export type TrackIcon = "code" | "engineering" | "build" | "career";

/** The areas Half Coders teaches in, each with the kind of thing you'd learn there. */
export const TRACKS = {
    eyebrow: "কী কী শিখবেন",
    title: "আপনার আগ্রহ যেটাতেই থাকুক",
    description: "কেউ কোড লিখতে চান, কেউ গণিতটা পাকা করতে চান, কেউ আবার চাকরির জন্য তৈরি হতে চান। সবার জন্যই কোর্স আসছে, একটার পর একটা।",
    items: [
        {
            icon: "code",
            title: "কোডিং",
            text: "জীবনে কখনো কোড না লিখলেও সমস্যা নেই। প্রথম প্রোগ্রাম থেকে শুরু করে আস্তে আস্তে ডেটা স্ট্রাকচার আর প্রবলেম সলভিং পর্যন্ত যাবেন।",
            topics: ["প্রোগ্রামিং", "DSA", "প্রবলেম সলভিং", "ওয়েব"],
        },
        {
            icon: "engineering",
            title: "ইঞ্জিনিয়ারিংয়ের গণিত",
            text: "যে গণিত আর লজিক দেখলে অনেকেই ভয় পান, সেগুলোই বুঝিয়ে বলা হবে উদাহরণ দিয়ে, মুখস্থ না করিয়ে।",
            topics: ["গণিত", "লজিক", "এনালিটিক্যাল থিংকিং"],
        },
        {
            icon: "build",
            title: "নিজে কিছু বানানো",
            text: "AI টুল দিয়ে নিজের পোর্টফোলিও সাইট বা একটা অনলাইন দোকান দাঁড় করানো, যেটা বন্ধুদের দেখাতে পারবেন।",
            topics: ["AI টুলস", "ই-কমার্স", "পোর্টফোলিও"],
        },
        {
            icon: "career",
            title: "চাকরির প্রস্তুতি",
            text: "শেখা তো হলো, এবার নিজেকে তুলে ধরার পালা। ইন্টারভিউ, রিজিউমি, LinkedIn প্রোফাইল আর গুছিয়ে ইমেইল লেখা।",
            topics: ["ইন্টারভিউ", "রিজিউমি", "LinkedIn", "ইমেইল"],
        },
    ] satisfies { icon: TrackIcon; title: string; text: string; topics: string[] }[],
    /** Under the tracks. A button, so English. */
    cta: "Browse all courses",
};

/** Learning alone against learning here, set as a before/after diff. */
export const WHY = {
    eyebrow: "কেন Half Coders",
    title: "একা শিখতে গিয়ে যা যা হয়, আর এখানে যা হয়",
    description: "ইউটিউবে ভিডিওর তো অভাব নেই। কিন্তু আটকে গেলে পাশে কেউ না থাকলে শেখাটা মাঝপথেই থেমে যায়।",
    alone: "একা একা শিখলে",
    together: "Half Coders-এ",
    rows: [
        { alone: "এরপর কী শিখব, সেটা ভাবতে ভাবতেই সময় চলে যায়", together: "কোন লেসনের পর কোনটা, সব আগে থেকে সাজানো। শুধু পরেরটা ধরলেই হলো" },
        { alone: "ভুল করলেন, কিন্তু কোথায় ভুল, কেউ বলে দেয় না", together: "অ্যাসাইনমেন্ট জমা দিলে মেন্টর নিজে পড়ে দেখেন, লিখে দেন কোথায় ঠিক করতে হবে" },
        { alone: "একটা জায়গায় আটকে সারা রাত পার", together: "সাপোর্ট সেশনে মেন্টরকে স্ক্রিন দেখিয়ে সরাসরি জিজ্ঞেস করুন" },
        { alone: "দুই সপ্তাহ পর আর শুরু করার ইচ্ছাই থাকে না", together: "ব্যাচের বাকিরাও শিখছে, স্ট্রিক আর লিডারবোর্ড মনে করিয়ে দেয় আজ বসতে হবে" },
        { alone: "শেষ করার পর দেখানোর মতো কিছু হাতে থাকে না", together: "পাবেন আইডিসহ সার্টিফিকেট, যেটা যে কেউ অনলাইনে মিলিয়ে দেখতে পারে" },
    ],
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

export const DAY = {
    eyebrow: "রুটিনের মধ্যেই",
    title: "সময় নেই? একটু খুঁজলেই পাবেন",
    description: "ক্লাস, অফিস, বাসার কাজ সবই থাকবে। শেখার জন্য আলাদা করে দিন ফাঁকা করতে হবে না, দিনের ফাঁকে ফাঁকে যতটুকু পারেন। ধরুন আপনার একটা সাধারণ দিন:",
    tab: "একটা সাধারণ দিন",
    tracks: { busy: "আপনার কাজ", learn: "Half Coders" },
    /** The timeline runs from `start` to `end` o'clock. */
    start: 6,
    end: 24,
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
            preview: ["প্রশ্ন ৩: কোনটা সঠিক?", "  ( ) প্রথমটা    (•) দ্বিতীয়টা", "✓ সঠিক! +20 XP"],
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
            text: "লেসন দেখলে, কুইজ দিলে, অ্যাসাইনমেন্ট করলে XP জমে। রোজ একটু বসলে স্ট্রিক বাড়ে, আর লিডারবোর্ডে দেখবেন ব্যাচের অন্যদের থেকে কতটা এগিয়ে আছেন।",
            preview: ["র‍্যাঙ্ক: ৪", "XP: 1,840", "স্ট্রিক: ১২ দিন 🔥"],
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

export type WorkflowIcon = "enroll" | "live" | "quiz" | "review" | "certificate";

export const WORKFLOW = {
    eyebrow: "কীভাবে শিখবেন",
    title: "ভর্তি থেকে সার্টিফিকেট, মাত্র ৫টা ধাপ",
    description: "ঝামেলার কিছু নেই। এক ধাপ শেষ করবেন, তারপর পরেরটা। এভাবেই একদিন দেখবেন পুরো কোর্স শেষ।",
    /** What you need, as a checklist. */
    needsTitle: "শুরু করতে যা লাগবে",
    needs: [
        { done: true, text: "একটা ফোন বা কম্পিউটার (কোডিং কোর্সে ল্যাপটপ লাগবে)" },
        { done: true, text: "ইন্টারনেট" },
        { done: true, text: "সপ্তাহে কয়েক ঘণ্টা সময়" },
        { done: false, text: "আগে থেকে কিছু জানা? লাগবে না" },
    ],
    /** Under the checklist. */
    needsNote: "এটুকু থাকলেই চলবে, বাকিটা আমরা দেখব।",
    /** Each step, with the little note you'd see once you reach it (`chip`). */
    commits: [
        {
            icon: "enroll",
            message: "কোর্সে ভর্তি",
            text: "পছন্দের কোর্সটা বেছে বিকাশে টাকা পাঠান। আমাদের টিম মিলিয়ে দেখলেই কোর্সটা আপনার ড্যাশবোর্ডে চলে আসবে।",
            chip: "পেমেন্ট মিলেছে, কোর্স খুলে গেছে",
        },
        {
            icon: "live",
            message: "লাইভ ক্লাস আর রেকর্ডিং",
            text: "সপ্তাহে লাইভ ক্লাসে বসুন, প্রশ্ন করুন। কোনোদিন না পারলে রেকর্ডিং দেখে নিলেই হবে।",
            chip: "আজ রাত ৯টায় লাইভ ক্লাস",
        },
        {
            icon: "quiz",
            message: "কুইজ আর প্র্যাকটিস",
            text: "প্রতিটা মডিউলের শেষে কুইজ আর প্র্যাকটিস। এতে নিজেই বুঝবেন পড়াটা কতটা মাথায় ঢুকল।",
            chip: "কুইজে ১০টার মধ্যে ৯টা সঠিক",
        },
        {
            icon: "review",
            message: "মেন্টরের রিভিউ",
            text: "অ্যাসাইনমেন্ট জমা দিন, মেন্টর দেখে বলে দেবেন কোথায় ঠিক করতে হবে। ঠিক করে আবার জমা দিলেই হলো।",
            chip: "মেন্টর: দারুণ হয়েছে!",
        },
        {
            icon: "certificate",
            message: "সার্টিফিকেট",
            text: "সব শেষে হাতে পাবেন আইডিসহ সার্টিফিকেট, যেটা যে কেউ অনলাইনে মিলিয়ে দেখতে পারবে।",
            chip: "সার্টিফিকেট তৈরি, ডাউনলোড করুন",
        },
    ] satisfies { icon: WorkflowIcon; message: string; text: string; chip: string }[],
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

/** Who the courses are for. */
export const AUDIENCE = {
    eyebrow: "কাদের জন্য",
    title: "আপনি কি এদের একজন?",
    description: "বয়স কত বা আগে কী পড়েছেন, তাতে কিছু যায় আসে না। শেখার ইচ্ছাটা থাকলেই চলবে।",
    items: [
        { icon: "student", title: "স্কুল, কলেজ বা ভার্সিটিতে পড়ছেন", text: "ক্লাসে থিওরি তো পড়ছেনই। পাশাপাশি হাতে-কলমে কিছু শিখে রাখুন, পরে খুব কাজে দেবে।" },
        { icon: "engineer", title: "ইঞ্জিনিয়ারিং পড়ছেন", text: "প্রোগ্রামিং, গণিত আর প্রবলেম সলভিং পুরো চার বছর লাগবে। শুরুতেই এগুলো পোক্ত করে নিন।" },
        { icon: "switcher", title: "অন্য পেশা থেকে আসতে চান", text: "আগে অন্য কিছু করতেন? সমস্যা নেই। একদম গোড়া থেকে শুরু হবে, এগোবেন নিজের সময়মতো।" },
        { icon: "jobseeker", title: "চাকরি খুঁজছেন", text: "ইন্টারভিউতে কী বলবেন, রিজিউমি কেমন হবে, LinkedIn কীভাবে সাজাবেন, এসব শিখে নিজেকে গুছিয়ে নিন।" },
    ] satisfies { icon: AudienceIcon; title: string; text: string }[],
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

export const COMMUNITY = {
    eyebrow: "নামের মানে",
    title: "কেউই সব জেনে জন্মায় না",
    description:
        "আমরা কেউই পুরোটা জানি না। অর্ধেক জানি, বাকি অর্ধেক শিখছি, নামটা সেখান থেকেই। আর ওই বাকি অর্ধেকটা একা একা পূরণ হয় না, হয় মেন্টর আর ব্যাচের সবার সাথে মিলে।",
    /** The line of code the section is built around, and the comment over it. */
    comment: "একা অর্ধেক, একসাথে পুরোটা",
    equation: { left: "success", parts: ["you", "mentor", "batch"] },
    /** Under the code, while nothing is pointed at. */
    hint: "যেকোনো একটা বেছে নিয়ে দেখুন",
    cards: [
        { name: "you", title: "আপনি", text: "রোজ একটু করে শেখা, আর আটকে গেলে লজ্জা না পেয়ে প্রশ্ন করা। আপনার কাজ আসলে এটুকুই।" },
        { name: "mentor", title: "মেন্টর", text: "ক্লাস নেন, আপনার কাজ দেখে দেন, আর আটকে গেলে সাপোর্ট সেশনে বসে সমস্যাটা ধরিয়ে দেন।" },
        { name: "batch", title: "ব্যাচ", text: "একই কোর্সে আরও অনেকে আছেন। একসাথে প্র্যাকটিস হয়, লিডারবোর্ডে একটু-আধটু প্রতিযোগিতাও চলে।" },
    ],
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
            a: "কোডিং, ইঞ্জিনিয়ারিংয়ের ভিত আর ক্যারিয়ারের প্রস্তুতি, এই তিন দিকেই কোর্স আসছে একটার পর একটা। এখন কোনগুলো চলছে, কোর্স পেজে গেলেই দেখতে পাবেন।",
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
    ],
    /** Under the list. A button, so English. */
    contact: { href: "/contact", label: "Ask us directly" },
};

export const CTA = {
    command: "halfcoders start",
    output: "চলুন, শুরু করা যাক!",
    title: "তাহলে আজই শুরু করে ফেলুন",
    description: "একটা কোর্স বেছে নিয়ে প্রথম ভিডিওটা দেখে ফেলুন, ব্যস। সব একদিনে শিখতে হবে না, রোজ অল্প অল্প করলেই হবে।",
};
