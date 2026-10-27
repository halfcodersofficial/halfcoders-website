"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The console is English. A screen translated to Bangla wraps itself in
 * `UiLanguageProvider lang="bn"`, and the shared controls on it — field
 * chrome, the date picker, the list editors, the image cropper — switch their
 * own built-in words to match. Anything outside a provider stays English, so
 * translating one screen never changes another.
 */
export type UiLanguage = "en" | "bn";

const LanguageContext = createContext<UiLanguage>("en");

export function UiLanguageProvider({ lang, children }: { lang: UiLanguage; children: ReactNode }) {
    return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

export const useUiLanguage = () => useContext(LanguageContext);

/**
 * `t("Add image", "ছবি যোগ করুন")` — the English and the Bangla side by side
 * at the point of use, so a change to one is seen next to the other.
 */
export function useT() {
    const lang = useUiLanguage();
    return <T,>(en: T, bn: T): T => (lang === "bn" ? bn : en);
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "12 / 160" → "১২ / ১৬০". Only for text people read — never for input values. */
export const bnDigits = (value: string | number) =>
    String(value).replace(/[0-9]/g, (digit) => BANGLA_DIGITS[Number(digit)]);

/** Digits in the reader's script: Bangla digits under a Bangla screen, as they are otherwise. */
export function useDigits() {
    const lang = useUiLanguage();
    return (value: string | number) => (lang === "bn" ? bnDigits(value) : String(value));
}

/* ----------------------------------------------------- validation messages */

/**
 * The field names `lib/validation` and the course schemas put into their
 * messages, in Bangla. The rules stay written once, in English; a Bangla
 * screen translates the message as it's shown.
 */
const FIELD_NAMES: Record<string, string> = {
    Title: "শিরোনাম",
    Name: "নাম",
    Price: "দাম",
    "Discounted price": "ছাড়ের দাম",
    "Hiring partners": "নিয়োগকারী প্রতিষ্ঠান",
    "Students placed": "চাকরি পাওয়া শিক্ষার্থী",
    "Average salary hike %": "গড় বেতন বৃদ্ধি %",
    Duration: "চলবে",
    Level: "লেভেল",
    Language: "ভাষা",
    Subtitle: "সাবটাইটেল",
    Description: "বিবরণ",
    Overview: "ওভারভিউ",
    "What students will learn": "শিক্ষার্থীরা যা শিখবে",
    Requirements: "প্রয়োজনীয়তা",
    "Hero facts": "হিরো তথ্য",
    "Assignment info": "অ্যাসাইনমেন্টের তথ্য",
    "Practice info": "প্র্যাকটিসের তথ্য",
    "Support info": "সাপোর্টের তথ্য",
};

const name = (label: string) => FIELD_NAMES[label] ?? label;

/** English message pattern → Bangla, tried in order. */
const MESSAGE_RULES: [RegExp, (...groups: string[]) => string][] = [
    [/^(.+) is required$/, (label) => `${name(label)} দিতে হবে`],
    [/^(.+) must be at least (\d+) characters$/, (label, min) => `${name(label)} অন্তত ${min} অক্ষরের হতে হবে`],
    [/^(.+) must be at most (\d+) characters$/, (label, max) => `${name(label)} সর্বোচ্চ ${max} অক্ষরের হতে পারবে`],
    [/^(.+) must be a number$/, (label) => `${name(label)} একটি সংখ্যা হতে হবে`],
    [/^(.+) must be a whole number$/, (label) => `${name(label)} পূর্ণসংখ্যা হতে হবে`],
    [/^(.+) can't be lower than ([\d,]+)$/, (label, min) => `${name(label)} ${min}-এর কম হতে পারবে না`],
    [/^(.+) can't be higher than ([\d,]+)$/, (label, max) => `${name(label)} ${max}-এর বেশি হতে পারবে না`],
    [/^(.+) can hold at most (\d+) lines$/, (label, max) => `${name(label)}-এ সর্বোচ্চ ${max}টি লাইন রাখা যাবে`],
    [/^Line (\d+) is longer than (\d+) characters$/, (line, max) => `${line} নম্বর লাইন ${max} অক্ষরের বেশি`],
    [/^At most (\d+) images$/, (max) => `সর্বোচ্চ ${max}টি ছবি রাখা যাবে`],
    [/^At most (\d+) features$/, (max) => `সর্বোচ্চ ${max}টি ফিচার রাখা যাবে`],
    [/^At most (\d+) tech stack items$/, (max) => `সর্বোচ্চ ${max}টি টেক স্ট্যাক রাখা যাবে`],
    [/^At most (\d+) questions$/, (max) => `সর্বোচ্চ ${max}টি প্রশ্ন রাখা যাবে`],
    [/^Discounted price must be lower than the regular price$/, () => "ছাড়ের দাম নিয়মিত দামের চেয়ে কম হতে হবে"],
    // Course classification — `lib/courseClassification`.
    [/^Choose the course status$/, () => "কোর্সের অবস্থা বেছে নিন"],
    [/^Choose free or paid$/, () => "ফ্রি না পেইড, বেছে নিন"],
    [/^Choose how the classes are delivered$/, () => "ক্লাস কীভাবে হবে, বেছে নিন"],
    [/^A paid course can't be discounted to ৳0 — mark it free instead$/, () => "পেইড কোর্সের ছাড়ের দাম ৳০ হতে পারে না — কোর্সটি ফ্রি করে দিন"],
    [/^That date and time isn't valid$/, () => "তারিখ ও সময়টি সঠিক নয়"],
    // Bootcamp batches — `batchDateIssues` in lib/courseBatch.
    [/^Set when the batch starts first$/, () => "আগে ব্যাচ শুরুর সময় দিন"],
    [/^The batch must end after it starts$/, () => "ব্যাচ শুরুর পরে শেষ হতে হবে"],
    [/^Enrolment must close after it opens$/, () => "ভর্তি শুরুর পরে ভর্তি শেষ হতে হবে"],
    [/^Enrolment must open before the batch starts, or set when it closes$/, () => "ব্যাচ শুরুর আগে ভর্তি শুরু হতে হবে, নয়তো ভর্তি শেষের সময়ও দিন"],
    [/^Enrolment must close by the time the batch ends$/, () => "ব্যাচ শেষ হওয়ার মধ্যেই ভর্তি শেষ হতে হবে"],
    [/^Set when the present batch ends first — that is when the next batch takes over$/, () => "আগে বর্তমান ব্যাচ শেষের সময় দিন — তখনই পরের ব্যাচ বর্তমান ব্যাচ হয়"],
    [/^Set when the next batch starts$/, () => "পরের ব্যাচ শুরুর সময় দিন"],
    [/^The next batch must start after the present batch ends$/, () => "বর্তমান ব্যাচ শেষ হওয়ার পরে পরের ব্যাচ শুরু হতে হবে"],
    [/^With no opening time, enrolment opens when the present batch ends — close it after that$/, () => "ভর্তি শুরুর সময় না দিলে বর্তমান ব্যাচ শেষ হলেই ভর্তি শুরু হয় — এর পরে ভর্তি শেষ করুন"],
    [/^The next batch's enrolment must open after the present batch's closes$/, () => "বর্তমান ব্যাচের ভর্তি শেষ হওয়ার পরে পরের ব্যাচের ভর্তি শুরু হতে হবে"],
    [/^Choose a JPEG, PNG or WebP image\.$/, () => "JPEG, PNG বা WebP ছবি বেছে নিন।"],
    [/^Image must be (\d+) MB or smaller\.$/, (max) => `ছবিটি ${max} এমবি বা তার ছোট হতে হবে।`],
    [/^Enter a full image URL starting with https:\/\/$/, () => "https:// দিয়ে শুরু হওয়া ছবির পুরো লিংক দিন"],
    [/^Enter a full YouTube URL starting with https:\/\/$/, () => "https:// দিয়ে শুরু হওয়া ইউটিউবের পুরো লিংক দিন"],
    [/^Feature (\d+) needs a title$/, (n) => `${n} নম্বর ফিচারের একটি শিরোনাম দিন`],
    [/^Feature (\d+)'s title is too short$/, (n) => `${n} নম্বর ফিচারের শিরোনাম খুব ছোট`],
    [/^Feature (\d+)'s title is over (\d+) characters$/, (n, max) => `${n} নম্বর ফিচারের শিরোনাম ${max} অক্ষরের বেশি`],
    [/^Feature (\d+)'s description is over (\d+) characters$/, (n, max) => `${n} নম্বর ফিচারের বিবরণ ${max} অক্ষরের বেশি`],
    [/^Tech stack item (\d+) needs a name$/, (n) => `${n} নম্বর টেক স্ট্যাকের একটি নাম দিন`],
    [/^Tech stack item (\d+)'s name is over (\d+) characters$/, (n, max) => `${n} নম্বর টেক স্ট্যাকের নাম ${max} অক্ষরের বেশি`],
    [/^Question (\d+) needs at least (\d+) characters$/, (n, min) => `${n} নম্বর প্রশ্নটি অন্তত ${min} অক্ষরের হতে হবে`],
    [/^Question (\d+) is over (\d+) characters$/, (n, max) => `${n} নম্বর প্রশ্নটি ${max} অক্ষরের বেশি`],
    [/^Question (\d+) needs an answer$/, (n) => `${n} নম্বর প্রশ্নের উত্তর দিন`],
    [/^Answer (\d+) is over (\d+) characters$/, (n, max) => `${n} নম্বর উত্তরটি ${max} অক্ষরের বেশি`],
];

/** A validation message in Bangla, or the original when no rule knows it. */
export function bnMessage(message: string): string {
    for (const [pattern, render] of MESSAGE_RULES) {
        const match = message.match(pattern);
        if (match) return bnDigits(render(...match.slice(1)));
    }
    return message;
}
