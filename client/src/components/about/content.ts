/*
 * Every word on the About page, in one place so it's easy to edit. The page
 * is Bangla (its wrapper says `lang="bn"`); button labels, names and code
 * stay English. Only things Half Coders really does, and no job promises.
 * Everything here is static: the page calls no API.
 *
 * PHOTOS: the gallery's and the timeline's are real (Cloudinary), but for the
 * timeline's last, still-ahead stop. Every `unsplash(…)` image is still a
 * stand-in (free to use), there until more real photos arrive. Swap the URL for a path under `public/` (or a Cloudinary link) and
 * nothing else needs to change. The team's portraits are real (Cloudinary),
 * square, in the Half Coders frame; a member with `photo: null` shows their
 * initials instead.
 */

/** An Unsplash photo at a sensible size; the id is the part after `photo-` in its URL. */
const unsplash = (id: string, width = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`;

export const HERO = {
    title: "Half Coders",
    /** The headline: `lead`, then `mark` with a marker line drawn under it. */
    headline: { lead: "আটকে গেলে এবার", mark: "পাশে কেউ আছে" },
    /** Shields-style badges: label | value. */
    badges: [
        { label: "ভাষা", value: "বাংলা", tone: "string" },
        { label: "লেভেল", value: "একদম শুরু থেকে", tone: "keyword" },
        { label: "রিভিউ", value: "মেন্টর নিজে করেন", tone: "func" },
        { label: "সার্টিফিকেট", value: "যাচাই করা যায়", tone: "number" },
    ] as const,
    body: "ইউটিউবে ভিডিওর তো অভাব নেই, আমরাও ওখান থেকেই শিখেছি। ঝামেলা হয় যখন কোথাও আটকে যাই আর জিজ্ঞেস করার মতো কেউ থাকে না। Half Coders-এ কোর্সগুলো ধাপে ধাপে সাজানো, আর আপনার প্রতিটা অ্যাসাইনমেন্ট একজন মেন্টর নিজে বসে দেখেন।",
    /** Three photos laid out like prints on a table, the middle one larger, each with a caption on its border. */
    photos: [
        { image: unsplash("1523240795612-9a054b0db644", 700), alt: "বইয়ের তাকের সামনে কয়েকজন হাসতে হাসতে ল্যাপটপে কাজ করছেন", caption: "একটা বাগ, তিনটা মাথা" },
        { image: unsplash("1522071820081-009f0129c71c", 1100), alt: "ল্যাপটপ নিয়ে একসাথে বসে কয়েকজন কাজ করছেন", caption: "রাতের লাইভ ক্লাস" },
        { image: unsplash("1571260899304-425eee4c7efc", 700), alt: "খাতা হাতে কয়েকজন শিক্ষার্থী ক্লাসে", caption: "ক্লাস শেষে একটু আড্ডা" },
    ],
    /** Over the middle photo: a live badge, and updates arriving one after another. */
    live: "লাইভ ক্লাস চলছে",
    updates: ["রাত ৯টার লাইভ ক্লাস শুরু হয়ে গেছে", "মেন্টর আপনার অ্যাসাইনমেন্টে কমেন্ট দিয়েছেন", "একটা সার্টিফিকেট এইমাত্র যাচাই হলো", "সাপোর্ট সেশনে আপনার পালা এসেছে"],
    /** The sticky note stuck beside the photos. */
    note: { label: "মেন্টরের কমেন্ট", text: "লুপটা এবার ঠিক আছে 👍 ভ্যারিয়েবলের নামগুলো আরেকটু বুঝিয়ে দিলে আরও ভালো হতো।" },
};

export type GoalIcon = "foundation" | "practice" | "ai";

export const GOAL = {
    title: "কোর্স শেষে আপনার হাতে যা থাকবে",
    description: "সার্টিফিকেট তো পাবেনই। তবে আমরা বেশি খুশি হব যদি এই তিনটা জিনিস সাথে করে নিয়ে যান।",
    items: [
        {
            icon: "foundation",
            title: "শক্ত ভিত",
            text: "মুখস্থ করে বেশিদূর যাওয়া যায় না। ভেতরের ব্যাপারগুলো একবার বুঝে গেলে নতুন কোনো ভাষা বা টুল এলেও আর ভয় লাগে না, নিজেই ধরে ফেলবেন।",
            points: ["প্রোগ্রামিংয়ের গোড়ার কথা", "গণিত আর লজিক", "বড় সমস্যা ভেঙে ছোট করা"],
        },
        {
            icon: "practice",
            title: "নিজের হাতে বানানো কাজ",
            text: "প্রতি মডিউলেই কিছু একটা বানাতে হবে। কোর্স শেষে বন্ধুকে বা ইন্টারভিউতে দেখানোর মতো কিছু একটা হাতে থাকবে।",
            points: ["অ্যাসাইনমেন্ট আর প্রজেক্ট", "মেন্টরের কমেন্ট", "নিজের পোর্টফোলিও"],
        },
        {
            icon: "ai",
            title: "AI দিয়ে কাজ করা",
            text: "AI দিয়ে অনেক কাজ দ্রুত হয়, এটা সত্যি। কিন্তু ও ভুলও করে, আর সেই ভুল ধরতে পারাটাই আসল কাজ। দুটোই শিখবেন।",
            points: ["AI টুল দিয়ে বানানো", "AI-এর ভুল ধরা", "শেষ সিদ্ধান্ত নিজের"],
        },
    ] satisfies { icon: GoalIcon; title: string; text: string; points: string[] }[],
};

/** The long read, with a contents list beside it that follows along. */
export const JOURNEY = {
    contents: "এই অংশে",
    why: {
        id: "why",
        nav: "কেন শুরু করলাম",
        title: "শুরুটা যেভাবে",
        paragraphs: [
            "আমরা নিজেরাও ইউটিউব দেখে দেখে শিখেছি। প্রথম কয়েকটা দিন বেশ ভালো যায়। তারপর একদিন কোনো একটা এরর আসে, গুগল করেও কিছু বুঝি না, আর পুরো রাত ওটার পেছনেই চলে যায়। এমন কয়েকবার হলে আর বসতেই ইচ্ছা করে না।",
            "আমাদের মনে হয়েছে, বেশিরভাগ মানুষ কম চেষ্টা করে বলে ছেড়ে দেয় না। ছেড়ে দেয় কারণ জিজ্ঞেস করার মতো কেউ থাকে না। তাই এমন একটা জায়গা বানালাম যেখানে কী শিখবেন সেটা সাজানো থাকে, অ্যাসাইনমেন্ট একজন মানুষ দেখে দেন, আর আটকে গেলে সরাসরি কারো সাথে বসা যায়।",
            "আর নামটা? আমরা কেউই সব জানি না, সবাই অর্ধেক অর্ধেক জানি। বাকিটা একসাথে শিখে নিই। এজন্যই Half Coders।",
        ],
        quote: "আমাদের শুধু একজন দরকার ছিল, যাকে জিজ্ঞেস করা যায়।",
        /** The mission and vision. */
        aims: [
            { key: "আমাদের লক্ষ্য", value: "ঢাকায় থাকুন বা কোনো উপজেলায়, ল্যাপটপ আর নেট থাকলেই যেন গুছিয়ে শিখতে পারেন, আর দরকার হলে একজন মেন্টরকে পাশে পান।" },
            { key: "আমাদের স্বপ্ন", value: "কেউ যেন Half Coders-এর সার্টিফিকেট দেখে বলে, \"ও, এরা তো আসলেই কাজ শিখিয়ে ছাড়ে।\"" },
        ],
    },
    who: {
        id: "who",
        nav: "কাদের জন্য",
        title: "কারা কারা শিখতে আসেন",
        text: "নিচের কোনো একটার সাথে নিজেকে মেলাতে পারলেই হবে। বয়স কত বা আগে কী পড়েছেন, সেটা কোনো ব্যাপার না।",
        items: [
            { title: "একদম নতুন, কখনো কোড লেখেননি", text: "বিগিনার কোর্সগুলো একদম গোড়া থেকে শুরু হয়। আগে থেকে কিছু জানতে হবে না।" },
            { title: "স্কুল, কলেজ বা ভার্সিটিতে পড়ছেন", text: "ক্লাসে যা পড়ছেন তার পাশাপাশি হাতে-কলমে কিছু করে রাখুন, পরে কাজে লাগবেই।" },
            { title: "অন্য পেশা থেকে আসতে চান", text: "অফিস শেষে রাতে বা শুক্রবারে বসলেও চলবে, ক্লাসের রেকর্ডিং তো থাকছেই।" },
            { title: "চাকরির জন্য তৈরি হচ্ছেন", text: "ইন্টারভিউতে কী জিজ্ঞেস করে, রিজিউমি কীভাবে লিখবেন, নিজের কাজ কীভাবে দেখাবেন, এসব নিয়েও কাজ হয়।" },
        ],
    },
    beyond: {
        id: "beyond",
        nav: "শুধু কোড জানলে হয় না",
        title: "শুধু কোড জানলে হয় না",
        paragraphs: [
            "চাকরিতে গিয়ে প্রথমেই যেটা টের পাবেন, কোড লেখার চেয়ে অন্যের লেখা কোড পড়তে হয় বেশি। তার ওপর আছে বড় একটা কাজকে ভাগ ভাগ করে নেওয়া, আর নিজে যা করলেন সেটা টিমকে বুঝিয়ে বলা।",
            "এগুলো সাধারণত কেউ আলাদা করে শেখায় না, তাই আমরা কোর্সের ভেতরেই রেখে দিয়েছি। সাথে গণিত আর লজিক আছে, AI দিয়ে কাজ আছে, আর নিজেকে তুলে ধরার কিছু টিপসও আছে।",
        ],
        skills: ["বড় কাজ ভেঙে ছোট করা", "অন্যের কোড পড়া", "নিজের কাজ বুঝিয়ে বলা", "AI দিয়ে কাজ", "নিজেকে তুলে ধরা"],
    },
    path: {
        id: "path",
        nav: "শেখার পথ",
        title: "শেখার পথটা মোটামুটি এরকম",
        steps: [
            { title: "শিখুন", text: "ছোট ছোট ভিডিও দেখবেন, লাইভ ক্লাসে বসবেন, কুইজ দেবেন। কোথাও খটকা লাগলে সাথে সাথে জিজ্ঞেস করে নিন।" },
            { title: "বানান", text: "প্রতি মডিউলে একটা করে অ্যাসাইনমেন্ট বা প্রজেক্ট। জমা দিলে মেন্টর দেখে বলে দেবেন কোথায় কী ঠিক করতে হবে।" },
            { title: "তৈরি হোন", text: "শেষে নিজের কাজগুলো গুছিয়ে নেবেন, রিজিউমি ঠিক করবেন, ইন্টারভিউয়ের জন্য একটু প্র্যাকটিস করবেন। আর হাতে থাকবে আইডিসহ সার্টিফিকেট।" },
        ],
    },
    inside: {
        id: "inside",
        nav: "যা যা পাবেন",
        title: "Half Coders-এ যা যা পাবেন",
        items: [
            "ধাপে ধাপে সাজানো ভিডিও লেসন",
            "প্রতি সপ্তাহে লাইভ ক্লাস, সাথে রেকর্ডিং",
            "মডিউল শেষে কুইজ আর প্র্যাকটিস",
            "প্রতিটা অ্যাসাইনমেন্টে মেন্টরের কমেন্ট",
            "আটকে গেলে ১:১ সাপোর্ট সেশন",
            "XP, স্ট্রিক আর লিডারবোর্ড",
            "AI দিয়ে কাজ করা শেখা",
            "রিজিউমি আর ইন্টারভিউয়ের প্রস্তুতি",
            "আইডিসহ সার্টিফিকেট, যেটা যাচাই করা যায়",
        ],
    },
};

/**
 * The journey, a stage per slide: a heading and a short paragraph, over a real
 * photo (the Inter Junior Programming Contest 2026 with Commuverse, its
 * prize-giving day, and the C/C++ course outline shown that day). The photos
 * set the scene; they don't have to show what the paragraph says.
 *
 * The C/C++ facts are from that outline's timeline slide — keep them in step
 * with the course if it changes.
 */
export const GALLERY = {
    title: "আমাদের কয়েকটা ছবি",
    description: "ছোট একটা ভাবনা থেকে শুরু, আজ একসাথে শেখার একটা জায়গা। কীভাবে এতদূর এলাম, ধাপে ধাপে বলি।",
    /** A button, so English. Scrolls to the team. */
    cta: "Meet the team",
    /** `title` is also each photo's alt text. `whole`: a screenshot, shown uncropped on the dark editor ground. */
    slides: [
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/22.jpg",
            title: "Half Coders-এর শুরু",
            text: "প্রোগ্রামিং শেখাটা যেন সবার নাগালে আসে, এই ভাবনা থেকেই Half Coders-এর যাত্রা। নিজেরা ইউটিউব দেখে শিখতে গিয়ে বারবার আটকেছি, জিজ্ঞেস করার মতো কাউকে পাইনি। শুরুর সেই বাধাগুলো পার করতে সাহায্য করাই ছিল প্রথম লক্ষ্য।",
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/11.jpg",
            title: "গোছানো কোর্স, একদম গোড়া থেকে",
            text: "প্রথম কোর্স C/C++। প্রোগ্রামিংয়ের একদম শুরু থেকে C++ দিয়ে DSA পর্যন্ত। লেসন, কোডিং প্র্যাকটিস, অ্যাসাইনমেন্ট আর প্রজেক্ট দিয়ে বেসিক থেকে হাতে-কলমে কাজ পর্যন্ত। সময়মতো শেষ করলে Basic Data Structures কোর্সটা ফ্রি।",
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/55.jpg",
            title: "পাশে একজন মেন্টর",
            text: "একা ভিডিও দেখে শেখার সবচেয়ে বড় সমস্যা, আটকে গেলে কেউ থাকে না। তাই প্রতিটা অ্যাসাইনমেন্ট একজন মেন্টর নিজে দেখে কমেন্ট দেন, আর দরকার হলে ১:১ সাপোর্ট সেশনে সরাসরি বসা যায়।",
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114862/731865188_122176185464614654_8407571315678559086_n.jpg",
            title: "সবকিছু এক জায়গায়",
            text: "ভিডিও এক জায়গায়, প্রশ্ন আরেক জায়গায়, অ্যাসাইনমেন্ট অন্য কোথাও, শেখার মাঝে এই ঝামেলাটা আমরা চাইনি। তাই প্ল্যাটফর্মটা নিজেরাই বানালাম: লেসন, কুইজ, অ্যাসাইনমেন্ট জমা, সাপোর্ট সেশন আর সার্টিফিকেট যাচাই, সব এক জায়গায়।",
            whole: true,
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/730771610_122176185374614654_4268448359798346898_n.jpg",
            title: "কমিউনিটি বড় হচ্ছে",
            text: "যত মানুষ যুক্ত হচ্ছেন, একসাথে শেখাটা তত জরুরি হয়ে উঠছে। একে অন্যকে সাহায্য করা, নিয়মিত লেগে থাকা আর মিলে সমস্যার সমাধান করা, এভাবেই এমন একটা জায়গা তৈরি হচ্ছে যেখানে কেউ একা শেখে না।",
            whole: true,
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/44.jpg",
            title: "AI-এর যুগের জন্য শেখা",
            text: "জেনারেটিভ AI আর AI কোডিং টুল সফটওয়্যার বানানোর ধরনটাই বদলে দিচ্ছে। তাই প্রোগ্রামিংয়ের ভিত, প্রবলেম সলভিং আর নিজের বিচারবুদ্ধির সাথে AI দিয়ে কাজ করাও শেখাই, যাতে AI-এর ভুলটাও ধরতে পারেন।",
        },
        {
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793114861/33.jpg",
            title: "Half Coders আজ",
            text: "প্রথম কোর্সের প্রথম ব্যাচ চলছে, কনটেস্টের পুরস্কার আর সার্টিফিকেট তুলে দেওয়া হয়েছে, আর আরও সাতটা কোর্সের কাজ চলছে। লক্ষ্য একটাই: যা শিখছেন আর ইন্ডাস্ট্রিতে যা লাগে, তার মাঝের দূরত্বটা কমিয়ে আনা।",
        },
    ] as { image: string; title: string; text: string; whole?: boolean }[],
};

/**
 * The road so far, and the next stretch. `tag` is the label on each stop:
 * put real years or months in once they're settled.
 */
export const TIMELINE = {
    title: "এখন পর্যন্ত আমাদের গল্প",
    description: "খুব বেশিদিন হয়নি শুরু করেছি। এর মধ্যে যা যা হলো, আর সামনে কী করতে চাই, সংক্ষেপে বলি।",
    /** `whole`: a screenshot, shown uncropped on the dark editor ground, since its shape isn't the frame's. */
    items: [
        {
            tag: "শুরু",
            title: "একটা টিম",
            text: "নিজেরা শিখতে গিয়ে যতবার আটকেছি, ততবার মনে হয়েছে একজন কাউকে যদি জিজ্ঞেস করা যেত। ওখান থেকেই শুরু।",
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793118219/124.jpg",
        },
        {
            tag: "তৈরি",
            title: "প্ল্যাটফর্মটা নিজেদের হাতে বানানো",
            text: "ভিডিও লেসন, কুইজ, অ্যাসাইনমেন্ট জমা, মেন্টরের রিভিউ, ১:১ সাপোর্ট সেশন আর আইডিসহ সার্টিফিকেট। আলাদা আলাদা অ্যাপ জোড়া না দিয়ে পুরোটা নিজেরাই বানিয়েছি।",
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793119148/1ee1fa4b-cb5d-45fb-ad8c-5038faecb232.png",
            whole: true,
        },
        {
            tag: "কনটেস্ট",
            title: "প্রথম প্রোগ্রামিং কনটেস্ট",
            text: "Commuverse-এর সাথে মিলে HackerRank-এ করলাম Inter Junior Programming Contest 2026। পরে ক্লাসরুমে বসে বিজয়ীদের হাতে পুরস্কার আর সার্টিফিকেট তুলে দিলাম।",
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793118219/121.jpg",
        },
        {
            tag: "প্রথম কোর্স",
            title: "C/C++ দিয়ে প্রথম কোর্স",
            text: "প্রোগ্রামিংয়ের একদম গোড়া থেকে C++ দিয়ে DSA পর্যন্ত। প্রথম ব্যাচ চলছে, আর মেন্টররা প্রতিটা অ্যাসাইনমেন্ট নিজে পড়ে কমেন্ট দিচ্ছেন।",
            image: "https://res.cloudinary.com/psabkoto/image/upload/v1793118219/122.jpg",
        },
        {
            tag: "সামনে",
            title: "আরও কোর্স আসছে",
            text: "কোডিং, ইঞ্জিনিয়ারিংয়ের গণিত, AI দিয়ে বানানো আর চাকরির প্রস্তুতি নিয়ে কাজ চলছে। কোর্স শেষ হলেও কাজ খোঁজা আর ইন্টারভিউতে পাশে থাকতে চাই।",
            image: unsplash("1556761175-b413da4baf72", 900),
            /** Not done yet: drawn as a stop still ahead. */
            upcoming: true,
        },
    ] as { tag: string; title: string; text: string; image: string; whole?: boolean; upcoming?: boolean }[],
};

export const PRINCIPLES = {
    heading: "আমরা যেভাবে কাজ করি",
    description: "কোর্স বা মেন্টর যেই হোক, এই ছয়টা জিনিস কোথাও বদলায় না।",
    items: [
        { title: "আগে হাতে-কলমে", text: "যা শিখবেন, সাথে সাথে নিজে করে দেখবেন। শুধু ভিডিও দেখে সাইকেল চালানো শেখা যায় না, কোডিংও না।" },
        { title: "প্রশ্ন করা লজ্জার কিছু না", text: "যত ছোট প্রশ্নই হোক, করে ফেলুন। আমরা সবাই একসময় ঠিক ওই প্রশ্নটাই করেছিলাম।" },
        { title: "অ্যাসাইনমেন্ট দেখেন মানুষ", text: "কোনো মেশিন নম্বর দেয় না। মেন্টর নিজে পড়েন, নম্বর দেন, আর কোথায় ঠিক করতে হবে লিখে দেন।" },
        { title: "নিজের গতিতে, তবে রোজ একটু", text: "রেকর্ডিং সবসময় থাকে, তাই তাড়াহুড়োর কিছু নেই। শুধু রোজ একটু করে বসার অভ্যাসটা রাখুন।" },
        { title: "সার্টিফিকেট যাচাই করা যায়", text: "প্রতিটা সার্টিফিকেটের আলাদা আইডি আছে। কেউ সন্দেহ করলে আমাদের সাইটে আইডি দিয়ে মিলিয়ে নিতে পারবে।" },
        { title: "যা পারি, তাই বলি", text: "চাকরি পাইয়ে দেব, এমন কথা আমরা দিই না। ভালো করে শেখাব আর পাশে থাকব, এটুকু কথা দিতে পারি।" },
    ],
};

/** One person on the team. */
export interface TeamMember {
    name: string;
    /** The full title, in English as on a business card. */
    role: string;
    /** Also teaches: shown as a Mentor badge beside the title. */
    mentor?: boolean;
    /** The short form, shown as a tag. */
    short: string;
    /** A path under `public/` or a full URL; null shows the placeholder figure. */
    photo: string | null;
}

export const TEAM = {
    title: "Half Coders-এ যাঁরা",
    description: "পর্দার পেছনের মানুষগুলো। কোর্স বানানো থেকে শুরু করে আপনার ইমেইলের উত্তর দেওয়া পর্যন্ত, সবকিছুর পেছনে এঁরাই।",
    members: [
        { name: "Tariq M Nasim", role: "Chief Executive Officer", short: "CEO", mentor: true, photo: "https://res.cloudinary.com/psabkoto/image/upload/v1793171973/Tariq_M_Nasim.png" },
        { name: "Md Habibur Rahman", role: "Chief Product Officer", short: "CPO", mentor: true, photo: "https://res.cloudinary.com/psabkoto/image/upload/v1793171972/Habibur_Rahman.jpg" },
        { name: "Mohammad Yusuf", role: "Chief Operating Officer", short: "COO", mentor: true, photo: "https://res.cloudinary.com/psabkoto/image/upload/v1793171973/Mohammad_Yusuf.jpg" },
        { name: "Antick Chandra Kuri", role: "Chief Marketing Officer", short: "CMO", mentor: true, photo: "https://res.cloudinary.com/psabkoto/image/upload/v1793171973/Antick_Chandra_Kuri.png" },
        { name: "Imran Pasha", role: "Chief Technology Officer", short: "CTO", mentor: true, photo: "https://res.cloudinary.com/psabkoto/image/upload/v1793171972/Imran_Pasha.jpg" },
    ] satisfies TeamMember[] as TeamMember[],
};

/** One card among the reviews. */
export interface AboutReview {
    name: string;
    /** A path under `public/` or a full URL; null shows their initials. */
    photo: string | null;
    /** "ব্যাচ ৫" — shown as a tag beside the name. */
    batch: string | null;
    role: string | null;
    /** 1–5 stars. */
    rating: number;
    quote: string;
    /** A stand-in, not a real learner: shown in development only, never in production. Delete the line when you put a real review in its place. */
    sample?: boolean;
}

export const REVIEWS = {
    heading: "শিক্ষার্থীরা যা বলছেন",
    description: "যাঁরা এখানে শিখছেন, তাঁদের কয়েকজনের কথা।",
    /**
     * PLACEHOLDERS: made-up names and illustrated avatars
     * (public/reviews/placeholder-*.svg, no real faces), each marked `sample`
     * — shown in development only, left out of a production build. Replace
     * each with a real learner's review (with their permission) and delete
     * its `sample: true`.
     */
    items: [
        {
            name: "রাফি আহমেদ",
            photo: "/reviews/placeholder-1.svg",
            batch: "ব্যাচ ১",
            role: "CSE, ১ম বর্ষ",
            rating: 5,
            quote: "প্রথম অ্যাসাইনমেন্টে মেন্টর ৮-৯টা কমেন্ট দিয়েছিলেন, ভেরিয়েবলের নাম থেকে ইনডেন্টেশন পর্যন্ত। একটু খারাপই লেগেছিল। পরের দুইটায় কমেন্ট কমতে কমতে এখন প্রায় নেই।",
            sample: true,
        },
        {
            name: "নুসরাত জাহান",
            photo: "/reviews/placeholder-2.svg",
            batch: "ব্যাচ ১",
            role: "EEE, ২য় বর্ষ",
            rating: 5,
            quote: "C-তে পয়েন্টার আর অ্যারের পার্থক্যটা কিছুতেই মাথায় ঢুকছিল না। সাপোর্ট সেশন বুক করলাম, মেন্টর খাতায় মেমরির ঘর এঁকে দেখালেন। এখন segmentation fault দেখলে আর ঘাবড়াই না।",
            sample: true,
        },
        {
            name: "তানভীর হাসান",
            photo: "/reviews/placeholder-3.svg",
            batch: "ব্যাচ ১",
            role: "ব্যাংকে চাকরি করেন",
            rating: 4,
            quote: "অফিস শেষে সব লাইভ ক্লাস ধরতে পারি না, রাতে রেকর্ডিং দেখে নিই। প্রশ্ন করলে উত্তর ঠিকই পাই। শুধু প্র্যাকটিস প্রবলেম আরেকটু বেশি হলে ভালো হতো।",
            sample: true,
        },
        {
            name: "সাদিয়া ইসলাম",
            photo: "/reviews/placeholder-4.svg",
            batch: "ব্যাচ ১",
            role: "এইচএসসি পরীক্ষার্থী",
            rating: 5,
            quote: "আগে কখনো কোড লিখিনি, প্রথম সপ্তাহে printf আর scanf নিয়েই হিমশিম খেয়েছি। এখন লুপ দিয়ে নিজে নিজে প্যাটার্ন প্রিন্ট করতে পারি। স্ট্রিকটা ভাঙতে দিই না, হাহা।",
            sample: true,
        },
        {
            name: "মেহেদী হাসান",
            photo: "/reviews/placeholder-5.svg",
            batch: "ব্যাচ ১",
            role: "ফ্রিল্যান্স গ্রাফিক ডিজাইনার",
            rating: 4,
            quote: "ইউটিউবে কয়েকবার শুরু করে মাঝপথে ছেড়ে দিয়েছি। এখানে প্রতি সপ্তাহে কী করতে হবে ঠিক করা, আর অ্যাসাইনমেন্টের ডেডলাইন থাকায় ফাঁকি দেওয়ার উপায় নেই। কয়েকটা কুইজ অবশ্য বেশ কঠিন লেগেছে।",
            sample: true,
        },
        {
            name: "ফারহানা আক্তার",
            photo: "/reviews/placeholder-6.svg",
            batch: "ব্যাচ ১",
            role: "ডিপ্লোমা, কম্পিউটার টেকনোলজি",
            rating: 5,
            quote: "কুইজে ভুল করলে সাথে সাথে ব্যাখ্যা দেখায়, কেন ভুল হলো। C++ for DSA অংশে এসে বুঝলাম শুরুর বেসিকগুলো কেন এত জোর দিয়ে করানো হয়েছিল।",
            sample: true,
        },
    ] satisfies AboutReview[] as AboutReview[],
};

/** Questions about Half Coders itself, answered as a chat, with a way to ask anything else. */
export const FAQ = {
    title: "আমাদের নিয়ে কিছু প্রশ্ন",
    description: "যেটা জানতে চান, সেটায় চাপ দিন।",
    /** The chat window the answers arrive in. */
    chat: { title: "Half Coders সাপোর্ট", status: "সাধারণত এক দিনের মধ্যে উত্তর দিই", you: "আপনি", us: "HC" },
    support: {
        text: "আপনার প্রশ্নটা এখানে নেই?",
        /** A button, so English. */
        cta: "Contact us",
        href: "/contact",
    },
    items: [
        {
            q: "Half Coders আসলে কী?",
            a: "বাংলাদেশের একটা অনলাইন শেখার জায়গা। কোডিং, ইঞ্জিনিয়ারিংয়ের গণিত, AI দিয়ে কাজ আর চাকরির প্রস্তুতি শেখাই, বাংলায়। আর প্রতিটা অ্যাসাইনমেন্ট একজন মেন্টর নিজে দেখেন।",
        },
        {
            q: "আগে কিছু না জানলেও কি শুরু করা যাবে?",
            a: "হ্যাঁ, যাবে। বিগিনার কোর্সগুলো একদম গোড়া থেকে শুরু হয়। শুধু রোজ একটু সময় দিতে হবে, ব্যস।",
        },
        {
            q: "কম্পিউটার সায়েন্সে না পড়লেও পারব?",
            a: "অবশ্যই পারবেন। কোর্সগুলো বানানোর সময় আমরা এমন মানুষদের কথাই বেশি মাথায় রেখেছি, যাঁরা অন্য বিষয়ে পড়েন বা অন্য কাজ করেন।",
        },
        {
            q: "মেন্টররা কী করেন?",
            a: "লাইভ ক্লাস নেন, আপনার অ্যাসাইনমেন্ট পড়ে কমেন্ট দেন, আর আটকে গেলে সাপোর্ট সেশনে বসে সমস্যাটা মিটিয়ে দেন। কোন কোর্সে কে আছেন, কোর্সের পেজেই লেখা থাকে।",
        },
        {
            q: "AI নিয়ে কী শেখানো হয়?",
            a: "AI টুল দিয়ে কীভাবে কাজ দ্রুত করা যায়, যেমন একটা ওয়েবসাইট বা ছোট একটা অনলাইন দোকান দাঁড় করানো। আর AI কখন ভুল বলছে, সেটা ধরতে শেখা।",
        },
        {
            q: "চাকরির নিশ্চয়তা দেন?",
            a: "না, সত্যি বলতে এই কথা আমরা দিই না। আমরা ভালো করে শেখাব আর পাশে থাকব। বাকিটা আপনার চেষ্টা।",
        },
        {
            q: "আটকে গেলে সাহায্য পাব কীভাবে?",
            a: "কোর্সের ভেতর থেকে সাপোর্ট সেশনে নাম লিখে রাখুন। পালা এলে Google Meet-এ ঢুকে মেন্টরকে স্ক্রিন দেখান, একসাথে ঠিক করে ফেলবেন।",
        },
    ],
};

/** The close: a letter from the team. */
export const CLOSING = {
    title: "শেষে দুটো কথা",
    greeting: "প্রিয় ভবিষ্যতের Half Coder,",
    paragraphs: [
        "সত্যি কথা বলি, প্রথম কয়েক সপ্তাহ একটু কঠিন লাগবে। প্রোগ্রাম চলবে না, এরর আসবে, অ্যাসাইনমেন্টে কমেন্টের পর কমেন্ট আসবে। কোনো একদিন হয়তো মনে হবে, এসব আমার দ্বারা হবে না।",
        "আমাদের সবারই এমন দিন গেছে, এখনো যায়। পার্থক্য হলো, এখানে ওই দিনগুলোতে আপনাকে একা বসে থাকতে হবে না। একটু জিজ্ঞেস করলেই কেউ না কেউ পাশে এসে বসবে।",
        "তাই বেশি না ভেবে আজ প্রথম লেসনটা দেখে ফেলুন। বাকিটা আস্তে আস্তে হয়ে যাবে।",
    ],
    signoff: "ভালো থাকবেন,",
    team: "Half Coders টিম",
    postscript: "পুনশ্চ: প্রশ্ন করতে লজ্জা পাবেন না। যত বোকা প্রশ্নই মনে হোক, আমরা হাসব না, কথা দিলাম 🙂",
    /** Around the stamp in the letter's corner. */
    stamp: "HALF CODERS • LEARN TOGETHER •",
};
