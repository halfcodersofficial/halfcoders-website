"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Award,
    Bold,
    Bookmark,
    BookmarkCheck,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Code,
    Copyright,
    Dumbbell,
    ExternalLink,
    FileText,
    Flag,
    Headphones,
    HelpCircle,
    Hourglass,
    Link as LinkIcon,
    List,
    ListTree,
    Lock,
    Megaphone,
    NotebookPen,
    PlayCircle,
    Search,
    Send,
    ThumbsDown,
    ThumbsUp,
    Trophy,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ProgressRing from "@/components/shared/ProgressRing";
import { ClassModeTag } from "@/components/shared/CourseClassification";
import AssignmentPane from "@/components/learn/AssignmentPane";
import LessonQuestions from "@/components/learn/LessonQuestions";
import LessonVideoPlayer from "@/components/learn/LessonVideoPlayer";
import ModuleComplete from "@/components/learn/ModuleComplete";
import PracticePane from "@/components/learn/PracticePane";
import RateCourse from "@/components/learn/RateCourse";
import ReadingLesson from "@/components/learn/ReadingLesson";
import QuizPane from "@/components/shared/QuizPane";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { infoAlert } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { linkify } from "@/lib/linkify";
import { useSession } from "@/hooks/useSession";
import { measureYouTubeDurations } from "@/lib/youtube";
import { cn, formatDateTime, formatDuration, formatHoursMinutes } from "@/lib/utils";
import { leaderboardService, learningService, lessonService, practiceService, progressService } from "@/services";
import type {
    BookmarkedLesson,
    CourseLearning,
    LearningMilestone,
    LearningModule,
    LearningQuiz,
    LearningVideo,
    LessonState,
} from "@/types/domain.types";
import type { LessonMaterial } from "@/types/learning.types";

const COPYRIGHT_TEXT = [
    "এই কোর্সের প্রতিটি ভিডিও, টেক্সট, অ্যাসাইনমেন্ট ও ডাউনলোডযোগ্য ফাইল Half Coders এবং সংশ্লিষ্ট মেন্টরের কপিরাইটকৃত সম্পত্তি। ভর্তি হওয়ার মানে শুধু নিজে দেখা ও শেখার অনুমতি — এই কনটেন্ট কপি, পুনরায় আপলোড, বিক্রি, অন্য কারও সাথে আর্থিক বিনিময়ে বা বিনামূল্যে শেয়ার করা, কিংবা নিজের অ্যাকাউন্টের পাসওয়ার্ড কারও সাথে শেয়ার করা — কোনোটাই অনুমোদিত নয়।",
    "এসব করলে আইনত দণ্ডনীয় অপরাধ হিসেবে গণ্য হবে — অন্তত ৫ বছর থেকে শুরু করে সর্বোচ্চ ১৪ বছরের জেল, সাথে ৫ লাখ থেকে সর্বোচ্চ ৫০ লাখ টাকা পর্যন্ত জরিমানাও গুনতে হতে পারে। থার্ড-পার্টি টুল দিয়ে ভিডিও ডাউনলোড করা বা কনটেন্ট সামাজিক যোগাযোগমাধ্যম বা ফাইল-শেয়ারিং সাইটে পোস্ট করাও পাইরেসি — বাংলাদেশের কপিরাইট আইন ও সাইবার/ডিজিটাল নিরাপত্তা আইনে সমানভাবে দণ্ডনীয়।",
    "সাইবার সিকিউরিটি কেইসে গ্রেফতার করার জন্য কোনো মামলা বা ওয়ারেন্টের প্রয়োজন হয় না — সরাসরি গ্রেফতার করে হাজতে নেওয়া হয়, এবং \"জানতাম না এটা অপরাধ\" — এই অজুহাত গ্রহণযোগ্য নয়। সামান্য কিছু টাকার জন্য দুই নম্বরি করতে গিয়ে কত বছর জেলে থাকতে হবে, সেটা একবার ভালো করে হিসাব করে নিও।",
    "অন্য নামে অ্যাকাউন্ট খুলে, ফেইক ফেসবুক আইডি দিয়ে, বা ইনকগনিটো মোডে ঢুকলে ট্র্যাক করা যাবে না — এমনটা ভাবলে তুমি বোকার স্বর্গে বাস করছো। তোমার আইএসপি, আইপি অ্যাড্রেস, প্রতিটা কল ও মেসেজ, এমনকি ডিলিট করা তথ্যও ফেসবুক-জিমেইল-গুগল সরাসরি সরকারের সাইবার ক্রাইম টিমকে সরবরাহ করে থাকে, আর কোন আইপি বা জায়গা থেকে লগইন হয়েছে তা আমাদের সার্ভারেও রেকর্ড থাকে — একটু চেষ্টা করলেই ২৪ ঘণ্টার মধ্যে ধরে ফেলার সক্ষমতা সাইবার ক্রাইম ডিপার্টমেন্টের আছে। একাধিক অ্যাকাউন্ট, পাসওয়ার্ড শেয়ার বা অস্বাভাবিক লগইন প্যাটার্ন ধরা পড়লেই অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে ফ্ল্যাগ হয়ে যায় — দোষ প্রমাণিত হলে কোনো রিফান্ড ছাড়াই অ্যাকাউন্ট স্থায়ীভাবে বন্ধ করে দেওয়া হয়।",
    "যারা বারবার কোর্স চুরি করে বিক্রি বা বিতরণের চেষ্টা করে, তাদের বিরুদ্ধে দৃষ্টান্তমূলক আইনি ব্যবস্থা নেওয়া হয় এবং প্রয়োজনে সংশ্লিষ্ট কর্তৃপক্ষকে জানানো হয়, যেন অন্য সবাই তা দেখে সতর্ক হয়ে যায় — মেন্টরদের পরিশ্রমের প্রতি সম্মান রেখে এই নিয়ম মেনে চলো। নিজেকে জেলের ভিতরে দেখতে না চাইলে আমাদের কোর্সের ভিডিও ডাউনলোড করে কারও সাথে আর্থিক বিনিময়ে বা বিনামূল্যে শেয়ার করা থেকে বিরত থাকো — একবার তোমার বাবা-মা ও পরিবারের কথা চিন্তা করো।",
];

const COPYRIGHT_CLOSING =
    "একবার ধরা পড়লে বা কেসে জড়িয়ে গেলে, কেউ কিন্তু তোমাকে বাঁচাতে আসবে না — নিজের ও পরিবারের ভালোর জন্যই বিষয়গুলো এড়িয়ে চলো।";

/** The note preview tab — same light markdown a text lesson is written in. */
const renderNotePreview = (markdown: string): string =>
    renderLightMarkdown(markdown, "<p class=\"text-muted-foreground\">Nothing to preview yet.</p>");

/** "github.com" for a resource lesson's card — never throws on an odd link. */
const hostnameOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/**
 * A week's modules, assignments and practice days in the one order the Module
 * Manager gives them. Ties (rows from before that order existed) keep the old
 * grouping: modules, then assignments, then practice days.
 */
const weekRows = (milestone: LearningMilestone, withAssignmentsAndPractice: boolean) =>
    [
        ...milestone.modules.map((entry) => ({ kind: "MODULE" as const, rank: 0, entry })),
        ...(withAssignmentsAndPractice
            ? [
                ...milestone.assignments.map((entry) => ({ kind: "ASSIGNMENT" as const, rank: 1, entry })),
                ...milestone.practiceDays.map((entry) => ({ kind: "PRACTICE" as const, rank: 2, entry })),
            ]
            : []),
    ].sort((a, b) => a.entry.position - b.entry.position || a.rank - b.rank || a.entry.order - b.entry.order);

/** The module's quiz is taken, or it has none. */
const quizDone = (courseModule: LearningModule) => !courseModule.quiz || courseModule.quiz.isCompleted;

/**
 * Every lesson of the module done and its quiz taken — worked out here, so a
 * "Next" shows at once, before the server answers.
 */
const isModuleDone = (courseModule: LearningModule) =>
    courseModule.videos.length > 0 && courseModule.videos.every((video) => video.isCompleted) && quizDone(courseModule);

/** "Quiz: Loop" — without doubling a title staff already started with "Quiz". */
const quizLabel = (title: string) => (/^quiz\b/i.test(title.trim()) ? title : `Quiz: ${title}`);

type AssignmentRow = LearningMilestone["assignments"][number];
type PracticeRow = LearningMilestone["practiceDays"][number];

/**
 * An assignment or a practice day: a week item with lessons of its own, shown
 * and opened like a module — its lessons one at a time. An assignment then has
 * its own page (the brief and submission box). A practice day is done the way
 * a module is: "Next" from its last lesson marks it done. Only a practice day
 * with no lessons keeps its own page, as its one stop.
 */
type WeekGroup = { kind: "ASSIGNMENT"; entry: AssignmentRow } | { kind: "PRACTICE"; entry: PracticeRow };

/** The student's part is done: the day marked done, or the work handed in. */
const groupDone = (group: WeekGroup) => (group.kind === "PRACTICE" ? group.entry.isCompleted : group.entry.isSubmitted);

/**
 * Nothing left to do there: done — or an assignment whose batch has ended,
 * which can't be handed in any more, so it isn't where a returning student
 * picks up.
 */
const groupSettled = (group: WeekGroup) => groupDone(group) || (group.kind === "ASSIGNMENT" && group.entry.isClosed);

/** Whether the group's own page is a stop on the way — not for a practice day with lessons. */
const hasGroupPage = (group: WeekGroup) => group.kind === "ASSIGNMENT" || group.entry.materials.length === 0;

const GROUP_LABEL: Record<WeekGroup["kind"], string> = { ASSIGNMENT: "Assignment", PRACTICE: "Practice day" };

/** The group's own page, as a stop on the way — named for what's done there. */
const groupPageTitle = (group: WeekGroup) => (group.kind === "PRACTICE" ? "What to practise" : "Brief & submission");

type ModuleStep = { kind: "VIDEO"; video: LearningVideo } | { kind: "QUIZ"; quiz: LearningQuiz };

/**
 * A module's lessons with its quiz where staff placed it: after every lesson
 * numbered up to its `position` (a hidden lesson keeps its number, so this
 * holds for what a student sees too) — or after all of them.
 */
const moduleSteps = (courseModule: LearningModule): ModuleStep[] => {
    const steps: ModuleStep[] = courseModule.videos.map((video) => ({ kind: "VIDEO", video }));
    const quiz = courseModule.quiz;
    if (quiz) {
        const at = quiz.position === null ? steps.length : courseModule.videos.filter((video) => video.order <= quiz.position!).length;
        steps.splice(at, 0, { kind: "QUIZ", quiz });
    }
    return steps;
};

/**
 * One place the player can open, in the order a student meets them. A quiz
 * belongs to a module (`courseModule`) or to an assignment (`group`, with
 * `courseModule` null) — only a module's holds back the lessons after it.
 */
type CourseStop =
    | { kind: "VIDEO"; key: string; video: LearningVideo; courseModule: LearningModule; milestone: LearningMilestone }
    | {
        kind: "QUIZ";
        key: string;
        quiz: LearningQuiz;
        courseModule: LearningModule | null;
        group: WeekGroup | null;
        milestone: LearningMilestone;
    }
    | { kind: "FINISH"; key: string; courseModule: LearningModule; milestone: LearningMilestone }
    | { kind: "MATERIAL"; key: string; group: WeekGroup; material: LessonMaterial; index: number; milestone: LearningMilestone }
    | { kind: "GROUP"; key: string; group: WeekGroup; milestone: LearningMilestone };

const stopKey = {
    video: (videoId: string) => `VIDEO:${videoId}`,
    quiz: (quizId: string) => `QUIZ:${quizId}`,
    finish: (moduleId: string) => `FINISH:${moduleId}`,
    material: (groupId: string, materialId: string) => `MATERIAL:${groupId}:${materialId}`,
    group: (groupId: string) => `GROUP:${groupId}`,
};

/**
 * Every stop of the course in order — what Previous and Next walk. Each
 * module's lessons, its quiz among them; then the practice days and
 * assignments that follow it in the week, each its lessons (and an
 * assignment, or a practice day with no lessons, its own page); and only then
 * the module's "complete" screen, so finishing a module means finishing the
 * practice that goes with it first.
 */
const courseStops = (data: CourseLearning): CourseStop[] => {
    const stops: CourseStop[] = [];
    for (const milestone of data.curriculum) {
        let finishing: LearningModule | null = null;
        const closeModule = () => {
            if (finishing && finishing.videos.length > 0) {
                stops.push({ kind: "FINISH", key: stopKey.finish(finishing.id), courseModule: finishing, milestone });
            }
            finishing = null;
        };
        for (const row of weekRows(milestone, true)) {
            if (row.kind === "MODULE") {
                closeModule();
                const courseModule = row.entry;
                for (const step of moduleSteps(courseModule)) {
                    stops.push(
                        step.kind === "VIDEO"
                            ? { kind: "VIDEO", key: stopKey.video(step.video.id), video: step.video, courseModule, milestone }
                            : { kind: "QUIZ", key: stopKey.quiz(step.quiz.id), quiz: step.quiz, courseModule, group: null, milestone },
                    );
                }
                finishing = courseModule;
                continue;
            }
            const group: WeekGroup = row.kind === "PRACTICE" ? { kind: "PRACTICE", entry: row.entry } : { kind: "ASSIGNMENT", entry: row.entry };
            group.entry.materials.forEach((material, index) =>
                stops.push({ kind: "MATERIAL", key: stopKey.material(group.entry.id, material.id), group, material, index, milestone }),
            );
            // An assignment's quiz: after its lessons, before its brief & submission.
            if (group.kind === "ASSIGNMENT" && group.entry.quiz) {
                const quiz = group.entry.quiz;
                stops.push({ kind: "QUIZ", key: stopKey.quiz(quiz.id), quiz, courseModule: null, group, milestone });
            }
            if (hasGroupPage(group)) stops.push({ kind: "GROUP", key: stopKey.group(group.entry.id), group, milestone });
        }
        closeModule();
    }
    return stops;
};

/** A module's quiz — the kind that holds back the lessons after it, on the server too. */
const isModuleQuiz = (stop: CourseStop) => stop.kind === "QUIZ" && stop.courseModule !== null;

/**
 * A stop nothing after it gets past until it's done: a lesson not finished,
 * or a module's quiz not taken. A locked module's lessons aren't counted —
 * they can't be done yet.
 */
const isOpenGate = (stop: CourseStop) =>
    (stop.kind === "VIDEO" && !stop.video.isCompleted && !stop.courseModule.isLocked) ||
    (stop.kind === "QUIZ" && isModuleQuiz(stop) && !stop.quiz.isCompleted);

/**
 * Where a returning student picks up: the first lesson or quiz they haven't
 * done — unless a practice day or assignment (or an assignment's quiz)
 * between it and the last one they did is still to do (one just released,
 * say), which comes first. With everything done, the last module's
 * "complete" screen.
 */
const resumeStop = (stops: CourseStop[]): CourseStop | null => {
    const gateAt = stops.findIndex(isOpenGate);
    const end = gateAt < 0 ? stops.length : gateAt;
    const lastDoneAt = stops.slice(0, end).findLastIndex((stop) => stop.kind === "VIDEO" || isModuleQuiz(stop));
    const pending = stops
        .slice(lastDoneAt + 1, end)
        .find(
            (stop) =>
                ((stop.kind === "MATERIAL" || stop.kind === "GROUP") && !groupSettled(stop.group)) ||
                (stop.kind === "QUIZ" && !stop.courseModule && !stop.quiz.isCompleted),
        );
    if (pending) return pending;
    if (gateAt >= 0) return stops[gateAt];
    return stops.findLast((stop) => stop.kind === "FINISH") ?? null;
};

/**
 * A quiz opens once every lesson before it is done — the ones ahead of it in
 * its module, and every earlier one in the course (lessons are finished in
 * order). One already taken stays open for its result; staff previewing the
 * course open anything. The server checks the same.
 */
const quizOpensFor = (data: CourseLearning, stops: CourseStop[], quizId: string) => {
    if (data.isPreview) return true;
    const at = stops.findIndex((stop) => stop.key === stopKey.quiz(quizId));
    const stop = stops[at];
    if (stop?.kind !== "QUIZ") return false;
    if (stop.quiz.isCompleted) return true;
    // An assignment's quiz opens with its assignment, like its lessons.
    if (!stop.courseModule) return true;
    if (stop.courseModule.isLocked) return false;
    return stops.slice(0, at).every((earlier) => earlier.kind !== "VIDEO" || earlier.video.isCompleted);
};

/** The assignment or practice day with this id, wherever it is in the course. */
const findGroup = (data: CourseLearning, groupId: string): { group: WeekGroup; milestone: LearningMilestone } | null => {
    for (const milestone of data.curriculum) {
        const practice = milestone.practiceDays.find((entry) => entry.id === groupId);
        if (practice) return { group: { kind: "PRACTICE", entry: practice }, milestone };
        const assignment = milestone.assignments.find((entry) => entry.id === groupId);
        if (assignment) return { group: { kind: "ASSIGNMENT", entry: assignment }, milestone };
    }
    return null;
};

/**
 * The practice days and assignments that follow a module in its week, up to
 * the next module — the stretch its "complete" screen comes after.
 */
const moduleTrail = (milestone: LearningMilestone, moduleId: string): WeekGroup[] => {
    const trail: WeekGroup[] = [];
    let inside = false;
    for (const row of weekRows(milestone, true)) {
        if (row.kind === "MODULE") {
            if (inside) break;
            inside = row.entry.id === moduleId;
        } else if (inside) {
            trail.push(row.kind === "PRACTICE" ? { kind: "PRACTICE", entry: row.entry } : { kind: "ASSIGNMENT", entry: row.entry });
        }
    }
    return trail;
};

/**
 * What a module's "complete" stop is for — what was just finished: the last
 * practice day or assignment after the module that's done, or (null) the
 * module itself.
 */
const finishedLast = (milestone: LearningMilestone, courseModule: LearningModule): WeekGroup | null =>
    moduleTrail(milestone, courseModule.id).findLast(groupDone) ?? null;

/** A module and the milestone it sits in. */
const findModule = (data: CourseLearning, moduleId: string) => {
    for (const milestone of data.curriculum) {
        const courseModule = milestone.modules.find((m) => m.id === moduleId);
        if (courseModule) return { milestone, courseModule };
    }
    return null;
};

export default function LearnPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    // An assignment takes over the player pane in place of the video — set,
    // it wins; cleared, the last-selected video shows again. Kept as its own
    // piece of state rather than folded into `activeVideoId` so "what was
    // playing before I opened this assignment" survives the detour for free.
    const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
    // Same idea for a module's quiz.
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
    // …and for a module's "complete" screen, the last stop of every module.
    const [activeCompleteModuleId, setActiveCompleteModuleId] = useState<string | null>(null);
    // …and for a practice day's own page.
    const [activePracticeId, setActivePracticeId] = useState<string | null>(null);
    // One lesson of the open assignment or practice day, in the player. Null
    // shows that assignment's or practice day's own page instead.
    const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
    const [openMilestones, setOpenMilestones] = useState<Set<string>>(new Set());
    // Modules open in the sidebar. The one being studied opens by itself (see
    // below); the rest are the student's to open or close.
    const [openModules, setOpenModules] = useState<Set<string>>(new Set());
    const [initialisedFromQuery, setInitialisedFromQuery] = useState(false);

    const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
    // Notes and the copyright notice share one panel under the lesson.
    const [lessonPanel, setLessonPanel] = useState<"notes" | "copyright">("notes");
    const [notesTab, setNotesTab] = useState<"write" | "preview">("write");
    const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [rewardOpen, setRewardOpen] = useState(false);
    // "Next" completions waiting to reach the server, kept in order (see queueComplete).
    const completionQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const pendingCompletionsRef = useRef(0);
    // Lesson running times measured in the browser (see the collector below):
    // which lessons are done, which wait to be saved, and the one background job.
    const reportedDurationsRef = useRef(new Set<string>());
    const pendingDurationsRef = useRef<Array<{ videoId: string; seconds: number }>>([]);
    const durationFlushTimerRef = useRef<number | undefined>(undefined);
    const durationJobRef = useRef({
        queue: [] as string[],
        queued: new Set<string>(),
        lessonsByYoutubeId: new Map<string, string[]>(),
        running: false,
    });
    const isMountedRef = useRef(false);
    const { user } = useSession();
    const [noteDraft, setNoteDraft] = useState("");
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["learning", slug],
        queryFn: () => learningService.course(slug),
    });

    // Flattened once so "next lesson" and lookups don't re-walk the tree.
    const allVideos = useMemo(
        () =>
            data?.curriculum.flatMap((milestone) =>
                milestone.modules.flatMap((courseModule) =>
                    courseModule.videos.map((video) => ({ ...video, isLocked: courseModule.isLocked })),
                ),
            ) ?? [],
        [data],
    );

    // Every stop in order — lessons, quizzes, practice days, assignments and
    // "complete" screens — for Previous / Next.
    const stops = useMemo(() => (data ? courseStops(data) : []), [data]);

    // Lessons open one at a time: every finished lesson, plus the first
    // unfinished one — where the student is in the course. Everything after
    // it stays shut until they get there with "Next"; so does everything
    // after a quiz they haven't taken. Staff previewing the course can open
    // anything.
    const reachableIds = useMemo(() => {
        if (!data || data.isPreview) return null;
        const ids = new Set<string>();
        let reachedCurrent = false;
        for (const stop of stops) {
            if (stop.kind === "VIDEO") {
                if (!reachedCurrent || stop.video.isCompleted) ids.add(stop.video.id);
                if (!stop.video.isCompleted) reachedCurrent = true;
            } else if (isModuleQuiz(stop) && stop.kind === "QUIZ" && !stop.quiz.isCompleted) {
                reachedCurrent = true;
            }
        }
        return ids;
    }, [data, stops]);
    const canOpen = (videoId: string) => !reachableIds || reachableIds.has(videoId);
    /** The first unfinished lesson or untaken quiz — the furthest a student can go. */
    const currentGate = data && !data.isPreview ? (stops.find(isOpenGate) ?? null) : null;
    /** What to do before going further, for a toast or a tooltip. */
    const finishFirstNote = (fallback: string) =>
        currentGate?.kind === "QUIZ"
            ? `Take "${quizLabel(currentGate.quiz.title)}" first — what comes after it opens once it's done.`
            : currentGate?.kind === "VIDEO"
                ? `Finish "${currentGate.video.title}" first — lessons open one at a time.`
                : fallback;

    // A lesson, assignment, practice day or quiz reached via the Course
    // Outline page or a notification link ("?video=<id>" / "?assignment=<id>"
    // / "?practice=<id>" / "?quiz=<id>") wins over the usual "resume where
    // you left off" pick, but only once — after that the student is free to
    // click around without the URL fighting them back.
    useEffect(() => {
        if (!data || initialisedFromQuery) return;
        setInitialisedFromQuery(true);

        const requestedAssignment = searchParams.get("assignment");
        const owningAssignmentMilestone = requestedAssignment
            ? data.curriculum.find((m) => m.assignments.some((a) => a.id === requestedAssignment))
            : null;
        if (requestedAssignment && owningAssignmentMilestone) {
            setActiveAssignmentId(requestedAssignment);
            // Not handed in yet: start at its first lesson, the way Next would
            // reach it. Handed in: its own page, where the mark and feedback are.
            const assignment = owningAssignmentMilestone.assignments.find((a) => a.id === requestedAssignment);
            setActiveMaterialId(assignment && !assignment.isSubmitted ? (assignment.materials[0]?.id ?? null) : null);
            setOpenMilestones(new Set([owningAssignmentMilestone.id]));
            return;
        }

        const requestedPractice = searchParams.get("practice");
        const owningPracticeMilestone = requestedPractice
            ? data.curriculum.find((m) => m.practiceDays.some((p) => p.id === requestedPractice))
            : null;
        if (requestedPractice && owningPracticeMilestone) {
            setActivePracticeId(requestedPractice);
            // A day with lessons starts at its first one — it has no page of its own.
            const practiceDay = owningPracticeMilestone.practiceDays.find((p) => p.id === requestedPractice);
            setActiveMaterialId(practiceDay?.materials[0]?.id ?? null);
            setOpenMilestones(new Set([owningPracticeMilestone.id]));
            return;
        }

        const requestedQuiz = searchParams.get("quiz");
        const owningQuizMilestone = requestedQuiz
            ? data.curriculum.find(
                (m) => m.modules.some((mod) => mod.quiz?.id === requestedQuiz) || m.assignments.some((a) => a.quiz?.id === requestedQuiz),
            )
            : null;
        // A link to a quiz whose lessons aren't all done yet (the "new quiz"
        // notification goes to everyone) lands on the current lesson instead.
        if (requestedQuiz && owningQuizMilestone && !quizOpensFor(data, stops, requestedQuiz)) {
            toast.info("That quiz opens once you finish the lessons before it.");
            return;
        }
        if (requestedQuiz && owningQuizMilestone) {
            setActiveQuizId(requestedQuiz);
            setOpenMilestones(new Set([owningQuizMilestone.id]));
            return;
        }

        const requested = searchParams.get("video");
        const requestedVideo = requested ? allVideos.find((v) => v.id === requested && !v.isLocked) : null;
        // A link to a lesson the student hasn't reached yet lands them on
        // their current lesson instead (the resume pick below).
        if (requestedVideo && reachableIds && !reachableIds.has(requestedVideo.id)) {
            toast.info("That lesson opens once you finish the ones before it.");
            return;
        }
        if (requestedVideo) {
            setActiveVideoId(requestedVideo.id);
            const owningMilestone = data.curriculum.find((m) =>
                m.modules.some((mod) => mod.videos.some((v) => v.id === requestedVideo.id)),
            );
            if (owningMilestone) setOpenMilestones(new Set([owningMilestone.id]));
        }
    }, [data, initialisedFromQuery, searchParams, allVideos, reachableIds, stops]);

    // Open the student's current milestone and pick up where they are, so
    // returning to the page resumes rather than restarts: the first lesson
    // or quiz still to do — or a practice day or assignment before it that's
    // still to do (one released since). With everything done, the last
    // module's "complete" screen — the end of the road so far — not lesson 1.
    useEffect(() => {
        if (
            !data ||
            activeVideoId ||
            activeAssignmentId ||
            activeQuizId ||
            activeCompleteModuleId ||
            activePracticeId ||
            !initialisedFromQuery
        ) {
            return;
        }

        const target = data.isPreview ? null : resumeStop(stops);
        // Anything else keeps the last lesson before it behind it, as a quiz or "complete" screen does.
        const lessonBehind = target ? stops.slice(0, stops.indexOf(target)).findLast((stop) => stop.kind === "VIDEO") : undefined;
        if (target?.kind !== "VIDEO" && lessonBehind?.kind === "VIDEO") setActiveVideoId(lessonBehind.video.id);
        if (target?.kind === "VIDEO") {
            setActiveVideoId(target.video.id);
        } else if (target?.kind === "QUIZ") {
            setActiveQuizId(target.quiz.id);
        } else if (target?.kind === "FINISH") {
            setActiveCompleteModuleId(target.courseModule.id);
        } else if (target?.kind === "MATERIAL" || target?.kind === "GROUP") {
            if (target.group.kind === "PRACTICE") setActivePracticeId(target.group.entry.id);
            else setActiveAssignmentId(target.group.entry.id);
            setActiveMaterialId(target.kind === "MATERIAL" ? target.material.id : null);
        } else if (allVideos[0]) {
            setActiveVideoId(allVideos[0].id);
        }

        const currentMilestone =
            data.curriculum.find((m) => m.id === data.enrollment?.currentMilestoneId) ??
            data.curriculum[0];
        if (currentMilestone) setOpenMilestones(new Set([currentMilestone.id]));
    }, [
        data,
        activeVideoId,
        activeAssignmentId,
        activeQuizId,
        activeCompleteModuleId,
        activePracticeId,
        allVideos,
        stops,
        initialisedFromQuery,
    ]);

    const activeVideo = allVideos.find((video) => video.id === activeVideoId) ?? null;

    // The week and module the playing lesson belongs to, and its place in the course.
    const activeContext = useMemo(() => {
        if (!data || !activeVideoId) return null;
        for (const milestone of data.curriculum) {
            for (const courseModule of milestone.modules) {
                if (courseModule.videos.some((video) => video.id === activeVideoId)) return { milestone, courseModule };
            }
        }
        return null;
    }, [data, activeVideoId]);
    const activeLessonNumber = allVideos.findIndex((video) => video.id === activeVideoId) + 1;

    // The module (and its milestone) holding whatever is open — a lesson, a
    // module's quiz, or its "complete" screen — or the assignment or practice
    // day, which opens in the sidebar the same way.
    const activePlace = useMemo(() => {
        if (!data) return null;
        const groupId = activeAssignmentId ?? activePracticeId;
        if (groupId) {
            const found = findGroup(data, groupId);
            return found ? { moduleId: groupId, milestoneId: found.milestone.id } : null;
        }
        // An assignment's quiz opens its assignment in the list.
        if (activeQuizId && !activeCompleteModuleId) {
            for (const milestone of data.curriculum) {
                const assignment = milestone.assignments.find((a) => a.quiz?.id === activeQuizId);
                if (assignment) return { moduleId: assignment.id, milestoneId: milestone.id };
            }
        }
        for (const milestone of data.curriculum) {
            for (const courseModule of milestone.modules) {
                const holdsIt = activeCompleteModuleId
                    ? courseModule.id === activeCompleteModuleId
                    : activeQuizId
                        ? courseModule.quiz?.id === activeQuizId
                        : courseModule.videos.some((v) => v.id === activeVideoId);
                if (holdsIt) return { moduleId: courseModule.id, milestoneId: milestone.id };
            }
        }
        return null;
    }, [data, activeVideoId, activeQuizId, activeAssignmentId, activePracticeId, activeCompleteModuleId]);
    const activeModuleId = activePlace?.moduleId ?? null;
    const activeMilestoneId = activePlace?.milestoneId ?? null;

    // Moving into another module or milestone (Next, a link, the sidebar)
    // opens it, so the row being studied is never hidden inside a collapsed one.
    useEffect(() => {
        if (!activeModuleId) return;
        setOpenModules((current) => (current.has(activeModuleId) ? current : new Set(current).add(activeModuleId)));
    }, [activeModuleId]);
    useEffect(() => {
        if (!activeMilestoneId) return;
        setOpenMilestones((current) =>
            current.has(activeMilestoneId) ? current : new Set(current).add(activeMilestoneId),
        );
    }, [activeMilestoneId]);

    const completedCount = allVideos.filter((video) => video.isCompleted).length;

    // Lessons are completed in course order — every earlier one first, and
    // every quiz before it taken. This is the earliest unfinished lesson or
    // untaken quiz before the open one, if any (the server enforces the same rule).
    const activeLessonStopIndex = activeVideoId ? stops.findIndex((stop) => stop.key === stopKey.video(activeVideoId)) : -1;
    const blockingStop = activeLessonStopIndex > 0 ? (stops.slice(0, activeLessonStopIndex).find(isOpenGate) ?? null) : null;

    /** Shows a lesson, no questions asked — callers have checked it may open. */
    const openLesson = (videoId: string) => {
        setActiveVideoId(videoId);
        setActiveAssignmentId(null);
        setActivePracticeId(null);
        setActiveMaterialId(null);
        setActiveQuizId(null);
        setActiveCompleteModuleId(null);
        setMobileCurriculumOpen(false);
        // The player is above the fold on desktop but below the sidebar on a
        // phone, so a lesson change has to bring it back into view.
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** Opens a lesson the student has reached; for a later one, says what to finish first. */
    const goTo = (videoId: string) => {
        if (!canOpen(videoId)) {
            toast.info(finishFirstNote("This lesson isn't open yet."));
            return;
        }
        openLesson(videoId);
    };

    // Should the open lesson ever be one the student hasn't reached — a
    // "Next" whose save the server turned down — take them back to their
    // current lesson, or the quiz they still have to take. Not while saves
    // are still on their way: the page already counts those lessons as done.
    useEffect(() => {
        if (!activeVideoId || !reachableIds || reachableIds.has(activeVideoId)) return;
        if (pendingCompletionsRef.current > 0) return;
        const current = stops.find(isOpenGate);
        if (current?.kind === "QUIZ") setActiveQuizId(current.quiz.id);
        else if (current?.kind === "VIDEO" && current.video.id !== activeVideoId) setActiveVideoId(current.video.id);
    }, [activeVideoId, reachableIds, stops]);

    /** An assignment's page (brief and submission), or one of its lessons. */
    const goToAssignment = (assignmentId: string, materialId: string | null = null) => {
        setActiveAssignmentId(assignmentId);
        setActiveMaterialId(materialId);
        setActivePracticeId(null);
        setActiveQuizId(null);
        setActiveCompleteModuleId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * One of a practice day's lessons. Without one named, its first lesson —
     * a day with lessons has no page of its own — or, for a day with none, its page.
     */
    const goToPractice = (practiceDayId: string, materialId: string | null = null) => {
        const firstLesson = data ? findGroup(data, practiceDayId)?.group.entry.materials[0]?.id : undefined;
        setActivePracticeId(practiceDayId);
        setActiveMaterialId(materialId ?? firstLesson ?? null);
        setActiveAssignmentId(null);
        setActiveQuizId(null);
        setActiveCompleteModuleId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** Shows a quiz, no questions asked — callers have checked it may open. */
    const openQuiz = (quizId: string) => {
        setActiveQuizId(quizId);
        setActiveAssignmentId(null);
        setActivePracticeId(null);
        setActiveMaterialId(null);
        setActiveCompleteModuleId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** Opens a quiz whose lessons are done; otherwise says what to finish first. */
    const goToQuiz = (quizId: string) => {
        if (data && !quizOpensFor(data, stops, quizId)) {
            toast.info(
                currentGate?.kind === "VIDEO"
                    ? `Finish "${currentGate.video.title}" and the lessons up to the quiz first.`
                    : "This quiz isn't open yet.",
            );
            return;
        }
        openQuiz(quizId);
    };

    /** A module's "complete" screen, its last stop. Its last lesson stays the one behind it. */
    const goToModuleComplete = (moduleId: string) => {
        const lastLesson = data && findModule(data, moduleId)?.courseModule.videos.at(-1);
        if (lastLesson) setActiveVideoId(lastLesson.id);
        setActiveCompleteModuleId(moduleId);
        setActiveAssignmentId(null);
        setActivePracticeId(null);
        setActiveMaterialId(null);
        setActiveQuizId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** Opens any stop — callers have checked it may open. */
    const openStop = (stop: CourseStop) => {
        switch (stop.kind) {
            case "VIDEO":
                return openLesson(stop.video.id);
            case "QUIZ":
                return openQuiz(stop.quiz.id);
            case "FINISH":
                return goToModuleComplete(stop.courseModule.id);
            case "MATERIAL":
            case "GROUP": {
                const materialId = stop.kind === "MATERIAL" ? stop.material.id : null;
                return stop.group.kind === "PRACTICE"
                    ? goToPractice(stop.group.entry.id, materialId)
                    : goToAssignment(stop.group.entry.id, materialId);
            }
        }
    };

    // Should a "complete" screen ever be open for a module that isn't done —
    // a last lesson whose save the server turned down — show that lesson again.
    useEffect(() => {
        if (!data || !activeCompleteModuleId || pendingCompletionsRef.current > 0) return;
        const place = findModule(data, activeCompleteModuleId);
        if (!place || !isModuleDone(place.courseModule)) setActiveCompleteModuleId(null);
    }, [data, activeCompleteModuleId]);

    // Same for a quiz whose lessons aren't all done after all: back to the lesson.
    useEffect(() => {
        if (!data || !activeQuizId || pendingCompletionsRef.current > 0) return;
        if (!quizOpensFor(data, stops, activeQuizId)) setActiveQuizId(null);
    }, [data, stops, activeQuizId]);

    /** Applies a change to one lesson in the cached course, without waiting on a refetch. */
    const patchLessonInCache = (videoId: string, patch: (video: LearningVideo) => LearningVideo) =>
        queryClient.setQueryData<CourseLearning>(["learning", slug], (current) =>
            current && {
                ...current,
                curriculum: current.curriculum.map((milestone) => ({
                    ...milestone,
                    modules: milestone.modules.map((courseModule) => {
                        if (!courseModule.videos.some((video) => video.id === videoId)) return courseModule;
                        const videos = courseModule.videos.map((video) => (video.id === videoId ? patch(video) : video));
                        return { ...courseModule, videos, completedVideos: videos.filter((video) => video.isCompleted).length };
                    }),
                })),
            },
        );

    const complete = useMutation({
        mutationFn: (videoId: string) => progressService.completeVideo(videoId),
        onSuccess: (result) => {
            void queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] });

            if (result.courseCompleted && result.rewardWith) {
                // A reward course has no certificate of its own.
                toast.success(`Course complete! 🎉 This was a reward with "${result.rewardWith.title}" — your certificate comes from that course.`);
            } else if (result.courseCompleted) {
                toast.success("Course complete! Your certificate is ready to claim. 🎓");
            } else {
                toast.success(`Lesson complete — ${result.courseProgress}% of the course done`);
            }
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save your progress.")),
        onSettled: () => {
            pendingCompletionsRef.current -= 1;
            // Refetch once the last queued completion has landed, so the real
            // numbers replace the optimistic ones (or undo one that failed)
            // without flickering back in between.
            if (pendingCompletionsRef.current === 0) {
                void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
            }
        },
    });

    /**
     * Marks a lesson done. The page shows it at once; the requests run one
     * after another, because the server only completes a lesson whose earlier
     * lessons are already complete — two quick "Next" clicks must reach it in
     * order.
     */
    const queueComplete = (videoId: string) => {
        void queryClient.cancelQueries({ queryKey: ["learning", slug] });
        patchLessonInCache(videoId, (video) => ({ ...video, isCompleted: true }));
        pendingCompletionsRef.current += 1;
        completionQueueRef.current = completionQueueRef.current
            .then(() => complete.mutateAsync(videoId))
            .catch(() => undefined);
    };

    /** Applies a practice day's done state in the cached course, without waiting on a refetch. */
    const patchPracticeInCache = (practiceDayId: string, isCompleted: boolean) =>
        queryClient.setQueryData<CourseLearning>(["learning", slug], (current) =>
            current && {
                ...current,
                curriculum: current.curriculum.map((milestone) => ({
                    ...milestone,
                    practiceDays: milestone.practiceDays.map((day) => (day.id === practiceDayId ? { ...day, isCompleted } : day)),
                })),
            },
        );

    /**
     * Marks a practice day done — "Next" from its last lesson, the way a
     * module's lessons are finished; there's no separate button. Shown at
     * once; the refetch confirms it (or undoes it, if the save failed).
     */
    const completePractice = useMutation({
        mutationFn: (practiceDayId: string) => practiceService.complete(practiceDayId),
        onMutate: (practiceDayId) => {
            void queryClient.cancelQueries({ queryKey: ["learning", slug] });
            patchPracticeInCache(practiceDayId, true);
        },
        onSuccess: () => {
            toast.success("Nice work — practice day done.");
            void queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] });
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't mark the practice day done.")),
        onSettled: () => {
            // A lesson save still on its way refetches the course itself once it lands.
            if (pendingCompletionsRef.current === 0) void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
        },
    });

    /** Sends the measured running times waiting to be saved, in one request. */
    const flushDurations = () => {
        window.clearTimeout(durationFlushTimerRef.current);
        const batch = pendingDurationsRef.current.splice(0, 200);
        if (batch.length === 0) return;
        progressService
            .reportDurations(batch)
            .then((stored) => {
                // Someone else's measurement may have landed first — show what's kept.
                for (const { videoId, duration } of stored) {
                    if (duration > 0) {
                        patchLessonInCache(videoId, (video) =>
                            video.duration === duration
                                ? video
                                : { ...video, duration, durationLabel: formatDuration(duration) },
                        );
                    }
                }
            })
            .catch(() => undefined);
        if (pendingDurationsRef.current.length > 0) flushDurations();
    };

    /**
     * A running time measured in the browser, for a lesson stored without one
     * — once per lesson per visit. The sidebar shows it at once; saving waits
     * a moment to go up with others, so a whole course takes a few requests
     * rather than one per lesson (the API allows 120 a minute).
     */
    const saveDetectedDuration = (videoId: string, seconds: number) => {
        if (reportedDurationsRef.current.has(videoId)) return;
        reportedDurationsRef.current.add(videoId);
        const duration = Math.round(seconds);
        patchLessonInCache(videoId, (video) => ({ ...video, duration, durationLabel: formatDuration(duration) }));
        pendingDurationsRef.current.push({ videoId, seconds });
        window.clearTimeout(durationFlushTimerRef.current);
        if (pendingDurationsRef.current.length >= 25) flushDurations();
        else durationFlushTimerRef.current = window.setTimeout(flushDurations, 1500);
    };

    // The background job below outlives renders, so it reaches these through refs.
    const saveDurationRef = useRef(saveDetectedDuration);
    saveDurationRef.current = saveDetectedDuration;
    const flushDurationsRef = useRef(flushDurations);
    flushDurationsRef.current = flushDurations;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            // Leaving the page: save what was measured so far.
            flushDurationsRef.current();
        };
    }, []);

    // Every lesson's running time as soon as the course opens. Lessons stored
    // without one are measured by one invisible player in the background — a
    // few seconds for a whole course, no video downloaded — and saved for
    // everyone, so it only happens once per lesson. Lessons that open later
    // (a module unlocking) join the queue of the job already running.
    useEffect(() => {
        const job = durationJobRef.current;
        for (const video of allVideos) {
            const youtubeId = video.youtubeVideoId;
            if (video.type !== "VIDEO" || !youtubeId || video.duration > 0) continue;
            if (reportedDurationsRef.current.has(video.id)) continue;
            const lessons = job.lessonsByYoutubeId.get(youtubeId) ?? [];
            if (!lessons.includes(video.id)) job.lessonsByYoutubeId.set(youtubeId, [...lessons, video.id]);
            if (!job.queued.has(youtubeId)) {
                job.queued.add(youtubeId);
                job.queue.push(youtubeId);
            }
        }
        if (job.running || job.queue.length === 0) return;

        job.running = true;
        void measureYouTubeDurations(
            () => job.queue.shift(),
            (youtubeId, seconds) => {
                for (const lessonId of job.lessonsByYoutubeId.get(youtubeId) ?? []) {
                    saveDurationRef.current(lessonId, seconds);
                }
            },
            () => !isMountedRef.current,
        )
            .catch(() => undefined)
            .finally(() => {
                job.running = false;
                flushDurationsRef.current();
            });
    }, [allVideos]);

    // ---- Notes / bookmark / reaction — the active lesson's own state. -----

    const { data: lessonState } = useQuery({
        queryKey: ["lesson-state", activeVideoId],
        queryFn: () => lessonService.state(activeVideoId as string),
        enabled: Boolean(activeVideoId) && !data?.isPreview,
    });

    useEffect(() => {
        setNoteDraft(lessonState?.note ?? "");
        setNotesTab("write");
    }, [lessonState?.note, activeVideoId]);

    const lessonStateKey = ["lesson-state", activeVideoId] as const;
    const invalidateLessonState = () => queryClient.invalidateQueries({ queryKey: lessonStateKey });

    const saveNote = useMutation({
        mutationFn: (content: string) => lessonService.saveNote(activeVideoId as string, content),
        onSuccess: () => {
            toast.success("Note saved.");
            void invalidateLessonState();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save your note.")),
    });

    /** Wraps the current selection in markdown syntax, or inserts a placeholder when nothing's selected. */
    const insertMarkdown = (before: string, after: string, placeholder: string) => {
        const el = noteTextareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = noteDraft.slice(start, end) || placeholder;
        const next = noteDraft.slice(0, start) + before + selected + after + noteDraft.slice(end);
        setNoteDraft(next);

        requestAnimationFrame(() => {
            el.focus();
            el.selectionStart = start + before.length;
            el.selectionEnd = start + before.length + selected.length;
        });
    };

    // Optimistic: a toggle should feel instant, and the invalidate-and-refetch
    // this still triggers is what makes the number of clicks and the number of
    // rows in the database agree once the round trip actually lands.
    const setBookmark = useMutation({
        mutationFn: (bookmarked: boolean) => lessonService.setBookmark(activeVideoId as string, bookmarked),
        onMutate: async (bookmarked) => {
            await queryClient.cancelQueries({ queryKey: lessonStateKey });
            const previous = queryClient.getQueryData<LessonState>(lessonStateKey);
            queryClient.setQueryData<LessonState | undefined>(lessonStateKey, (current) =>
                current ? { ...current, isBookmarked: bookmarked } : current,
            );
            return { previous };
        },
        onSuccess: (result) => {
            toast.success(result.isBookmarked ? "Lesson bookmarked." : "Bookmark removed.");
            if (data) void queryClient.invalidateQueries({ queryKey: ["lesson-bookmarks", data.course.id] });
        },
        onError: (err, _bookmarked, context) => {
            if (context) queryClient.setQueryData(lessonStateKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't update your bookmark."));
        },
        onSettled: () => void invalidateLessonState(),
    });

    const setReaction = useMutation({
        mutationFn: (reaction: "LIKE" | "DISLIKE" | null) =>
            lessonService.setReaction(activeVideoId as string, reaction),
        onMutate: async (nextReaction) => {
            await queryClient.cancelQueries({ queryKey: lessonStateKey });
            const previous = queryClient.getQueryData<LessonState>(lessonStateKey);
            queryClient.setQueryData<LessonState | undefined>(lessonStateKey, (current) =>
                current ? { ...current, reaction: nextReaction } : current,
            );
            return { previous };
        },
        onError: (err, _reaction, context) => {
            if (context) queryClient.setQueryData(lessonStateKey, context.previous);
            toast.error(getApiErrorMessage(err, "Couldn't save your reaction."));
        },
        onSettled: () => void invalidateLessonState(),
    });

    const { data: myRank } = useQuery({
        queryKey: ["leaderboard", "my-rank", data?.course.id],
        queryFn: () => leaderboardService.myRank(data!.course.id),
        enabled: rewardOpen && Boolean(data) && !data?.isPreview,
    });

    // Loaded whenever the course is (not just when the "Bookmarked" tab is
    // open) so every lesson row in the full list can show its own bookmark
    // state and toggle it directly, the way the quick "+" icons work in the
    // reference UI.
    const { data: bookmarks, isLoading: bookmarksLoading } = useQuery({
        queryKey: ["lesson-bookmarks", data?.course.id],
        queryFn: () => lessonService.courseBookmarks(data!.course.id),
        enabled: Boolean(data) && !data?.isPreview,
    });
    const bookmarkedVideoIds = useMemo(
        () => new Set(bookmarks?.map((b) => b.videoId) ?? []),
        [bookmarks],
    );

    // Toggling from a lesson row in the list — distinct from `setBookmark`
    // above, which is scoped to whichever lesson is currently playing.
    const toggleRowBookmark = useMutation({
        mutationFn: ({ videoId, bookmarked }: { videoId: string; bookmarked: boolean }) =>
            lessonService.setBookmark(videoId, bookmarked),
        onSuccess: (result, { videoId }) => {
            toast.success(result.isBookmarked ? "Lesson bookmarked." : "Bookmark removed.");
            if (data) void queryClient.invalidateQueries({ queryKey: ["lesson-bookmarks", data.course.id] });
            if (videoId === activeVideoId) void invalidateLessonState();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update your bookmark.")),
    });

    if (isLoading) {
        return (
            <div className="container mx-auto grid grid-cols-1 gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="space-y-4">
                    <Skeleton className="aspect-video rounded-2xl" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-8 w-2/3" />
                </div>
                <Skeleton className="h-150 rounded-2xl" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="grid min-h-dvh place-items-center px-4">
                <div className="max-w-md text-center">
                    <Lock className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h1 className="text-xl font-bold">Can&apos;t open this course</h1>
                    <p className="mt-2 text-muted-foreground">
                        {getApiErrorMessage(error, "Enrol in this course to access its content.")}
                    </p>
                    <Button asChild className="mt-6">
                        <Link href={`/courses/${slug}`}>View course details</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const toggleMilestone = (id: string) =>
        setOpenMilestones((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleModule = (id: string) =>
        setOpenModules((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // "Expand all" / "Collapse all" covers both levels: milestones and what's
    // inside them — modules, assignments and practice days.
    const allModuleIds = data.curriculum.flatMap((milestone) => [
        ...milestone.modules.map((m) => m.id),
        ...milestone.assignments.map((a) => a.id),
        ...milestone.practiceDays.map((p) => p.id),
    ]);
    const everythingOpen =
        data.curriculum.every((m) => openMilestones.has(m.id)) && allModuleIds.every((id) => openModules.has(id));
    const toggleEverything = () => {
        if (everythingOpen) {
            setOpenMilestones(new Set());
            setOpenModules(new Set());
        } else {
            setOpenMilestones(new Set(data.curriculum.map((m) => m.id)));
            setOpenModules(new Set(allModuleIds));
        }
    };

    const reaction = lessonState?.reaction ?? null;
    const moduleLabel = data.course.moduleLabel || "Module";

    // The open "complete" screen's module, and the assignment or practice day
    // that's open — with the lesson of it in the player, if one is.
    const completePlace = activeCompleteModuleId ? findModule(data, activeCompleteModuleId) : null;
    const activeGroupPlace = findGroup(data, activeAssignmentId ?? activePracticeId ?? "");
    const activeGroup = activeGroupPlace?.group ?? null;
    const activeMaterial = (activeMaterialId && activeGroup?.entry.materials.find((m) => m.id === activeMaterialId)) || null;

    // Where the player is among every stop of the course.
    const activeStopKey = activeGroup
        ? activeMaterial
            ? stopKey.material(activeGroup.entry.id, activeMaterial.id)
            : stopKey.group(activeGroup.entry.id)
        : completePlace
            ? stopKey.finish(completePlace.courseModule.id)
            : activeQuizId
                ? stopKey.quiz(activeQuizId)
                : activeVideoId
                    ? stopKey.video(activeVideoId)
                    : null;
    const activeStopIndex = activeStopKey ? stops.findIndex((stop) => stop.key === activeStopKey) : -1;
    const activeStop = activeStopIndex >= 0 ? stops[activeStopIndex] : null;
    // The lesson area (title, notes, questions) is for a module's lesson only.
    const showsLesson = activeStop?.kind === "VIDEO" && Boolean(activeVideo);

    // A lesson counts as done when the student moves on from it with "Next"
    // (or "Finish" on the last one) — there's no separate complete button.
    const canComplete = Boolean(
        showsLesson && activeVideo && !data.isPreview && !activeVideo.isLocked && !activeVideo.isCompleted && !blockingStop,
    );

    // A module's "complete" screen opens once every lesson of it is done —
    // counting the one "Next" is about to complete — and its quiz is taken.
    const finishOpens = (courseModule: LearningModule) =>
        !data.isPreview &&
        courseModule.videos.length > 0 &&
        courseModule.videos.every((video) => video.isCompleted || (video.id === activeVideoId && canComplete)) &&
        quizDone(courseModule);

    // The open quiz, while the student hasn't taken it: there's no going on
    // past it until they do.
    const quizToTake = !data.isPreview && activeStop?.kind === "QUIZ" && !activeStop.quiz.isCompleted ? activeStop.quiz : null;

    /* Prev/next walk the stops a student can step onto: a locked module's
       lessons are skipped — landing on the padlock screen with no way forward
       reads as the button being broken — and so is a "complete" screen whose
       module isn't done (and every one, going back). */
    const nextStop = (() => {
        if (activeStopIndex < 0) return null;
        for (const stop of stops.slice(activeStopIndex + 1)) {
            if (stop.kind === "VIDEO" && stop.courseModule.isLocked) continue;
            if (stop.kind === "FINISH" && !finishOpens(stop.courseModule)) continue;
            return stop;
        }
        return null;
    })();
    const prevStop = (() => {
        if (activeStopIndex <= 0) return null;
        for (const stop of stops.slice(0, activeStopIndex).reverse()) {
            if (stop.kind === "VIDEO" && stop.courseModule.isLocked) continue;
            if (stop.kind === "FINISH") continue;
            return stop;
        }
        return null;
    })();

    /**
     * A lesson opens once reached, and a quiz once the lessons before it are
     * done; anything else (a practice day, an assignment) whenever.
     */
    const stopOpens = (stop: CourseStop) =>
        stop.kind === "VIDEO" ? canOpen(stop.video.id) : stop.kind === "QUIZ" ? quizOpensFor(data, stops, stop.quiz.id) : true;
    // Finishing this lesson is what opens the next one (a lesson, or a quiz
    // right after it), so "Next" works from the current lesson as well as
    // from any finished one. From a quiz, only once it's taken.
    const nextOpens = Boolean(nextStop && !quizToTake && (stopOpens(nextStop) || canComplete));
    const prevOpens = Boolean(prevStop && stopOpens(prevStop));
    /** Why "Next" is shut, for its tooltip. */
    const nextShutNote = quizToTake ? "Submit this quiz to go on" : finishFirstNote("Finish the lessons before it first");

    // The practice day whose last stop is open and isn't done yet: "Next"
    // from here marks it done, like the last lesson of a module.
    const practiceToFinish = (() => {
        if (data.isPreview || (activeStop?.kind !== "MATERIAL" && activeStop?.kind !== "GROUP")) return null;
        const { group } = activeStop;
        if (group.kind !== "PRACTICE" || group.entry.isCompleted) return null;
        const isLastStop = activeStop.kind === "GROUP" || activeStop.index === group.entry.materials.length - 1;
        return isLastStop ? group.entry : null;
    })();

    /**
     * What "Next" into a "complete" stop finishes: the practice day or
     * assignment open now, or else the module.
     */
    const finishingLabel =
        activeStop?.kind === "MATERIAL" || activeStop?.kind === "GROUP" ? GROUP_LABEL[activeStop.group.kind] : moduleLabel;

    /** What a stop is called on a button or the player's "Up next". */
    const stopTitle = (stop: CourseStop) => {
        switch (stop.kind) {
            case "VIDEO":
                return stop.video.title;
            case "QUIZ":
                return quizLabel(stop.quiz.title);
            case "FINISH":
                return `${finishingLabel} complete`;
            case "MATERIAL":
                return stop.material.title;
            case "GROUP":
                return `${stop.group.entry.title} — ${groupPageTitle(stop.group).toLowerCase()}`;
        }
    };

    /** "Next": counts the open lesson (or practice day) as done, then moves on. */
    const advance = () => {
        if (activeVideo && canComplete) queueComplete(activeVideo.id);
        if (practiceToFinish && !completePractice.isPending) completePractice.mutate(practiceToFinish.id);
        // The page's lesson list doesn't yet show this lesson as done, so open
        // the next stop directly rather than through goTo's check.
        if (nextStop && nextOpens) openStop(nextStop);
    };

    const goBack = () => {
        if (prevStop && prevOpens) openStop(prevStop);
    };

    // The very last thing in the course: its "Next" reads "Finish".
    const nextFinishesCourse = nextStop?.kind === "FINISH" && nextStop === stops.at(-1);

    // The player's own previous / "Up next" buttons, for any stop it plays.
    const playerPrev = prevStop && prevOpens ? { title: stopTitle(prevStop), onSelect: goBack } : null;
    const playerNext =
        nextStop && nextOpens
            ? {
                title: stopTitle(nextStop),
                onSelect: advance,
                label:
                    nextStop.kind === "FINISH"
                        ? `Finish ${finishingLabel.toLowerCase()}`
                        : nextStop.kind === "QUIZ"
                            ? "Take the quiz"
                            : nextStop.kind === "GROUP"
                                ? groupPageTitle(nextStop.group)
                                : undefined,
            }
            : null;

    const openNotes = () => {
        setLessonPanel("notes");
        document.getElementById("lesson-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // A reaction is a one-shot vote, not a toggle — once given it can't be
    // changed to the other option or cleared, so a repeat click just
    // explains why instead of silently doing nothing.
    const handleReaction = (next: "LIKE" | "DISLIKE") => {
        if (reaction) {
            void infoAlert({
                title: "You've already given feedback",
                text: "Your like/dislike on this lesson can't be changed.",
            });
            return;
        }
        setReaction.mutate(next);
    };

    const curriculumProps: CurriculumSidebarProps = {
        data,
        slug,
        activeVideoId,
        goTo,
        activeAssignmentId: activeGroup?.kind === "ASSIGNMENT" ? activeGroup.entry.id : null,
        goToAssignment,
        activePracticeId: activeGroup?.kind === "PRACTICE" ? activeGroup.entry.id : null,
        goToPractice,
        activeMaterialId: activeMaterial?.id ?? null,
        activeQuizId,
        goToQuiz,
        activeCompleteModuleId: completePlace ? activeCompleteModuleId : null,
        goToModuleComplete,
        openMilestones,
        toggleMilestone,
        openModules,
        toggleModule,
        canToggleAll: data.curriculum.length > 1 || allModuleIds.length > 1,
        everythingOpen,
        toggleEverything,
        totalCount: allVideos.length,
        search: sidebarSearch,
        onSearchChange: setSidebarSearch,
        showBookmarksOnly,
        onToggleBookmarksOnly: () => setShowBookmarksOnly((v) => !v),
        bookmarks,
        bookmarksLoading,
        bookmarkedVideoIds,
        onToggleRowBookmark: (videoId, bookmarked) => toggleRowBookmark.mutate({ videoId, bookmarked }),
        canOpenLesson: canOpen,
        canOpenQuiz: (quizId) => quizOpensFor(data, stops, quizId),
    };

    return (
        <div className="min-h-dvh bg-background container mx-auto">
            <header className="sticky top-16 z-40 border-b border-border bg-background/90 backdrop-blur-md">
                <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
                        <BackButton href="/dashboard" label="Dashboard" compact />
                        {/* A rule between the way out and the course, so they read as two things. */}
                        <span aria-hidden className="h-8 w-px shrink-0 bg-border" />
                        {data.enrollment && (
                            <ProgressRing value={data.enrollment.progress} size={40} stroke={3.5} className="shrink-0">
                                {/* "100%" doesn't fit inside the ring — a finished course gets a tick. */}
                                {Math.round(data.enrollment.progress) >= 100 ? (
                                    <Check className="size-4 text-primary" strokeWidth={3} aria-hidden />
                                ) : (
                                    <span className="text-[0.625rem]">{Math.max(0, Math.round(data.enrollment.progress))}%</span>
                                )}
                            </ProgressRing>
                        )}
                        <div className="min-w-0">
                            {/* Two lines on a phone, so the course name isn't cut to a word or two. */}
                            <h1
                                title={data.course.title}
                                className="line-clamp-2 text-sm font-semibold leading-tight sm:line-clamp-1 sm:text-base"
                            >
                                {data.course.title}
                            </h1>
                            <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                                {/* An upcoming course has no modules until its classes start. */}
                                {allVideos.length === 0 ? (
                                    data.course.phase === "UPCOMING" ? (
                                        "Classes haven't started yet — lessons appear here once they do"
                                    ) : (
                                        "No lessons published yet"
                                    )
                                ) : (
                                    <>
                                        {completedCount} of {allVideos.length} lessons
                                        <span className="hidden sm:inline"> complete</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                        {data.isPreview && <Badge variant="warning">Preview mode</Badge>}

                        {/* Quick shortcuts to this lesson's own state — mirrors the
                            labelled row under the video, just always in reach. On a
                            phone that row is a short scroll away, so the room goes
                            to the course name instead. */}
                        {!data.isPreview && showsLesson && activeVideo && !activeVideo.isLocked && (
                            <span className="hidden items-center gap-1 sm:flex sm:gap-2">
                                <Button variant="ghost" size="icon" aria-label="Jump to notes" onClick={openNotes}>
                                    <NotebookPen className="size-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={lessonState?.isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
                                    aria-pressed={lessonState?.isBookmarked ?? false}
                                    onClick={() => setBookmark.mutate(!lessonState?.isBookmarked)}
                                    className={cn(lessonState?.isBookmarked && "text-primary")}
                                >
                                    {lessonState?.isBookmarked ? (
                                        <BookmarkCheck className="size-4" />
                                    ) : (
                                        <Bookmark className="size-4" />
                                    )}
                                </Button>
                            </span>
                        )}

                        {/* The curriculum sidebar lives in a modal below `lg` instead
                            of stacking under the player — a forty-lesson course is a
                            long scroll to reach on a phone otherwise. */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="lg:hidden"
                            aria-label="Course content"
                            onClick={() => setMobileCurriculumOpen(true)}
                        >
                            <ListTree className="size-4" />
                            <span className="hidden sm:inline">Lessons</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* `minmax(0, …)` and `min-w-0`, so a long code line or link in a lesson
                scrolls inside its own box instead of widening the page on a phone. */}
            <div className="grid grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                {/* Player */}
                <div className="min-w-0 space-y-4">
                    {activeGroup && activeMaterial ? (
                        // An assignment's or practice day's lesson, played like a module's.
                        <MaterialPlayer
                            key={activeMaterial.id}
                            material={activeMaterial}
                            subtitle={`${GROUP_LABEL[activeGroup.kind]} · Lesson ${activeGroup.entry.materials.indexOf(activeMaterial) + 1} of ${activeGroup.entry.materials.length}`}
                            coverImage={data.course.thumbnail}
                            prev={playerPrev}
                            next={playerNext}
                            watermark={user?.email}
                        />
                    ) : activeGroup?.kind === "ASSIGNMENT" ? (
                        <AssignmentPane slug={slug} assignmentId={activeGroup.entry.id} />
                    ) : activeGroup?.kind === "PRACTICE" ? (
                        // Only a practice day with no lessons shows its own page.
                        <PracticePane key={activeGroup.entry.id} practice={activeGroup.entry} isPreview={data.isPreview} />
                    ) : completePlace ? (
                        <ModuleComplete
                            key={completePlace.courseModule.id}
                            course={data.course}
                            milestone={completePlace.milestone}
                            courseModule={completePlace.courseModule}
                            finished={finishedLast(completePlace.milestone, completePlace.courseModule)}
                        />
                    ) : activeQuizId ? (
                        <QuizPane key={activeQuizId} quizId={activeQuizId} />
                    ) : activeVideo && !activeVideo.isLocked && activeVideo.type === "TEXT" && activeVideo.content ? (
                        <ReadingLesson key={activeVideo.id} title={activeVideo.title} content={activeVideo.content} />
                    ) : activeVideo && !activeVideo.isLocked && activeVideo.type === "RESOURCE" && activeVideo.resourceUrl ? (
                        <ResourceCard url={activeVideo.resourceUrl} />
                    ) : activeVideo?.youtubeVideoId ? (
                        // Our own controls over a YouTube frame that can't be
                        // clicked into — see LessonVideoPlayer. Keyed per lesson
                        // so each one starts fresh at its play cover.
                        <LessonVideoPlayer
                            key={activeVideo.id}
                            youtubeVideoId={activeVideo.youtubeVideoId}
                            title={activeVideo.title}
                            subtitle={`Lesson ${activeLessonNumber} of ${allVideos.length}${
                                activeVideo.duration > 0 ? ` · ${activeVideo.durationLabel}` : ""
                            }`}
                            coverImage={data.course.thumbnail}
                            prev={playerPrev}
                            next={playerNext}
                            watermark={user?.email}
                            onDuration={
                                activeVideo.duration > 0
                                    ? undefined
                                    : (seconds) => saveDetectedDuration(activeVideo.id, seconds)
                            }
                        />
                    ) : (
                        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-border bg-brand-soft text-center">
                            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-2xl" />
                            <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-accent/15 blur-2xl" />
                            <div className="relative max-w-md space-y-3 px-6">
                                <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-card">
                                    {activeVideo ? <Lock className="size-6" /> : <Hourglass className="size-6" />}
                                </span>
                                <p className="text-lg font-semibold">
                                    {activeVideo
                                        ? "This lesson is locked"
                                        : allVideos.length === 0
                                            ? "Your lessons are on the way"
                                            : "Pick a lesson to start"}
                                </p>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {activeVideo
                                        ? data.sequentialLearning
                                            ? "Finish the earlier modules to unlock it."
                                            : "It isn't open to you yet."
                                        : allVideos.length === 0
                                            ? "The first lessons of this course haven't been published yet. You're enrolled, so they'll be here the moment they are."
                                            : "Choose any open lesson from the course content."}
                                </p>
                                {!activeVideo && allVideos.length === 0 && (
                                    <Button asChild variant="brand-outline" className="rounded-full px-6">
                                        <Link href={`/learn/${slug}/outline`}>
                                            <ListTree className="size-4" /> See the course outline
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* A quiz, or an assignment's or practice day's lesson or page:
                        where it sits, and Previous / Next along the course. A
                        module's "complete" screen gets just the buttons — it says
                        where it is itself. */}
                    {(activeStop?.kind === "QUIZ" ||
                        activeStop?.kind === "MATERIAL" ||
                        activeStop?.kind === "GROUP" ||
                        (activeStop?.kind === "FINISH" && (prevStop || nextStop))) && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-1">
                                {activeStop.kind !== "FINISH" && (
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
                                        <span className="font-semibold uppercase tracking-wider text-primary">
                                            {data.course.milestoneLabel} {String(activeStop.milestone.order).padStart(2, "0")}
                                        </span>
                                        <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                        <span className="truncate">
                                            {activeStop.kind === "QUIZ"
                                                ? (activeStop.courseModule?.title ?? `${GROUP_LABEL.ASSIGNMENT}: ${activeStop.group?.entry.title ?? ""}`)
                                                : `${GROUP_LABEL[activeStop.group.kind]}: ${activeStop.group.entry.title}`}
                                        </span>
                                        <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                        <span className="tabular-nums">
                                            {activeStop.kind === "QUIZ"
                                                ? "Quiz"
                                                : activeStop.kind === "MATERIAL"
                                                    ? `Lesson ${activeStop.index + 1} of ${activeStop.group.entry.materials.length}`
                                                    : groupPageTitle(activeStop.group)}
                                        </span>
                                    </p>
                                    {activeStop.kind === "MATERIAL" && (
                                        <h2 className="mt-1.5 text-balance text-xl font-bold leading-tight tracking-tight wrap-break-word sm:text-2xl">
                                            {activeStop.material.title}
                                        </h2>
                                    )}
                                </div>
                                )}

                                <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto *:flex-1 sm:*:flex-none">
                                    {prevStop && (
                                        <Button
                                            variant="outline"
                                            className="rounded-full pl-4 pr-5"
                                            title={prevOpens ? `Previous: ${stopTitle(prevStop)}` : "Finish the lessons before it first"}
                                            disabled={!prevOpens}
                                            onClick={goBack}
                                        >
                                            <ChevronLeft className="size-4" /> Previous
                                        </Button>
                                    )}
                                    {nextStop ? (
                                        <Button
                                            className="rounded-full pl-5 pr-4"
                                            title={
                                                nextOpens
                                                    ? `Next: ${stopTitle(nextStop)}`
                                                    : practiceToFinish
                                                        ? "Marks this practice day done"
                                                        : nextShutNote
                                            }
                                            // On a practice day's last stop it still marks the day done.
                                            disabled={!nextOpens && !practiceToFinish}
                                            onClick={advance}
                                        >
                                            Next <ChevronRight className="size-4" />
                                        </Button>
                                    ) : (
                                        practiceToFinish && (
                                            // Nothing after it yet: this just marks the day done.
                                            <Button className="rounded-full pl-5 pr-4" onClick={advance} isLoading={completePractice.isPending}>
                                                Finish <Check className="size-4" />
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Why "Next" is shut here, in words — a tooltip never shows on a phone. */}
                            {quizToTake && (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Lock className="size-4 shrink-0 text-primary" aria-hidden />
                                    Submit this quiz to go on — what comes after it opens once it&apos;s done.
                                </p>
                            )}

                            {activeStop.kind === "MATERIAL" && activeStop.material.description && (
                                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground wrap-break-word">
                                    {linkify(activeStop.material.description)}
                                </p>
                            )}
                        </div>
                    )}

                    {showsLesson && activeVideo && (
                        <div className="space-y-3">
                            {/* Previous / Next sit beside the lesson title. "Next"
                                also counts this lesson as done; the last lesson has
                                "Finish" in its place. Both stay in staff preview for
                                browsing — there, nothing is recorded. */}
                            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-1">
                                <div className="min-w-0">
                                    {activeContext && (
                                        <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
                                            <span className="font-semibold uppercase tracking-wider text-primary">
                                                {data.course.milestoneLabel} {String(activeContext.milestone.order).padStart(2, "0")}
                                            </span>
                                            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                            <span className="truncate">{activeContext.courseModule.title}</span>
                                            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                            <span className="tabular-nums">
                                                Lesson {activeLessonNumber} of {allVideos.length}
                                            </span>
                                            {activeVideo.isCompleted && (
                                                <>
                                                    <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                                                        <CheckCircle2 className="size-3.5" aria-hidden /> Completed
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    )}
                                    <h2 className="mt-1.5 text-balance text-xl font-bold leading-tight tracking-tight wrap-break-word sm:text-2xl">
                                        {activeVideo.title}
                                    </h2>
                                </div>

                                {/* On a phone, a full-width pair — big enough to hit with a thumb. */}
                                <div className="flex w-full items-center gap-2 sm:w-auto *:flex-1 sm:*:flex-none">
                                    {/* A matching pair: "Previous" outlined, "Next" filled. */}
                                    {prevStop && (
                                        <Button
                                            variant="outline"
                                            className="rounded-full pl-4 pr-5"
                                            title={`Previous: ${stopTitle(prevStop)}`}
                                            disabled={!prevOpens}
                                            onClick={goBack}
                                        >
                                            <ChevronLeft className="size-4" /> Previous
                                        </Button>
                                    )}

                                    {nextFinishesCourse && !activeVideo.isCompleted ? (
                                        // The course's last lesson: "Finish" counts it and opens the module's "complete" screen.
                                        <Button
                                            className="rounded-full px-5"
                                            title={`Finish: ${moduleLabel} complete`}
                                            onClick={advance}
                                        >
                                            <Check className="size-4" /> Finish
                                        </Button>
                                    ) : nextStop ? (
                                        <Button
                                            className="rounded-full pl-5 pr-4"
                                            title={nextOpens ? `Next: ${stopTitle(nextStop)}` : nextShutNote}
                                            disabled={!nextOpens}
                                            onClick={advance}
                                        >
                                            Next <ChevronRight className="size-4" />
                                        </Button>
                                    ) : (
                                        // The last lesson has no "Next" to complete it on.
                                        !data.isPreview &&
                                        !activeVideo.isLocked &&
                                        !activeVideo.isCompleted && (
                                            <Button
                                                className="rounded-full px-5"
                                                disabled={!canComplete}
                                                onClick={() => queueComplete(activeVideo.id)}
                                            >
                                                <Check className="size-4" /> Finish
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Why moving on won't count this lesson as done yet, and the way to fix it. */}
                            {!data.isPreview &&
                                !activeVideo.isLocked &&
                                !activeVideo.isCompleted &&
                                (blockingStop?.kind === "VIDEO" || blockingStop?.kind === "QUIZ") && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                                    <Lock className="size-4 shrink-0 text-warning-ink" aria-hidden />
                                    {blockingStop.kind === "QUIZ" ? (
                                        <p className="min-w-0 flex-1 text-foreground">
                                            This lesson will only count as complete after you take the quiz before it:{" "}
                                            <span className="font-semibold">&ldquo;{quizLabel(blockingStop.quiz.title)}&rdquo;</span>.
                                        </p>
                                    ) : (
                                        <p className="min-w-0 flex-1 text-foreground">
                                            This lesson will only count as complete after you finish the lessons before it.
                                            Start with <span className="font-semibold">&ldquo;{blockingStop.video.title}&rdquo;</span>.
                                        </p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() =>
                                            blockingStop.kind === "QUIZ" ? goToQuiz(blockingStop.quiz.id) : goTo(blockingStop.video.id)
                                        }
                                    >
                                        {blockingStop.kind === "QUIZ" ? "Take the quiz" : "Go to that lesson"}{" "}
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            )}

                            {activeVideo.description && (
                                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground wrap-break-word">
                                    {linkify(activeVideo.description)}
                                </p>
                            )}

                            {/* Lesson action bar — the Notes / Copyright switch for
                                the panel below, a bookmark and a like/dislike
                                reaction, all real state against this lesson. */}
                            {!data.isPreview && !activeVideo.isLocked && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                                    <div role="tablist" aria-label="Under this lesson" className="flex gap-1 rounded-full bg-secondary p-1">
                                        {(
                                            [
                                                { id: "notes", label: "Notes", icon: NotebookPen },
                                                { id: "copyright", label: "Copyright", icon: Copyright },
                                            ] as const
                                        ).map(({ id, label, icon: Icon }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                role="tab"
                                                id={`lesson-tab-${id}`}
                                                aria-selected={lessonPanel === id}
                                                aria-controls="lesson-panel"
                                                onClick={() => setLessonPanel(id)}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                                                    lessonPanel === id
                                                        ? "bg-card text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                <Icon className={cn("size-4", lessonPanel === id && "text-primary")} />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setBookmark.mutate(!lessonState?.isBookmarked)}
                                        isLoading={setBookmark.isPending}
                                        aria-pressed={lessonState?.isBookmarked ?? false}
                                        className={cn(
                                            "rounded-full",
                                            lessonState?.isBookmarked && "bg-primary/10 text-primary hover:bg-primary/15",
                                        )}
                                    >
                                        {lessonState?.isBookmarked ? (
                                            <BookmarkCheck className="size-4" />
                                        ) : (
                                            <Bookmark className="size-4" />
                                        )}
                                        {lessonState?.isBookmarked ? "Bookmarked" : "Bookmark"}
                                    </Button>

                                    <span className="ml-auto flex items-center gap-1 rounded-full bg-secondary p-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Like this lesson"
                                            aria-pressed={reaction === "LIKE"}
                                            className={cn("size-8 rounded-full", reaction === "LIKE" && "bg-success/15 text-success")}
                                            onClick={() => handleReaction("LIKE")}
                                        >
                                            <ThumbsUp className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Dislike this lesson"
                                            aria-pressed={reaction === "DISLIKE"}
                                            className={cn("size-8 rounded-full", reaction === "DISLIKE" && "bg-destructive/15 text-destructive")}
                                            onClick={() => handleReaction("DISLIKE")}
                                        >
                                            <ThumbsDown className="size-4" />
                                        </Button>
                                    </span>
                                </div>
                            )}

                            {/* The panel the Notes / Copyright tabs switch — the note
                                editor, or the copyright notice in the same spot. */}
                            {!data.isPreview && !activeVideo.isLocked && (
                                <div
                                    id="lesson-panel"
                                    role="tabpanel"
                                    aria-labelledby={`lesson-tab-${lessonPanel}`}
                                    className="scroll-mt-32"
                                >
                                {lessonPanel === "copyright" ? (
                                    <CopyrightPanel slug={slug} />
                                ) : (
                                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                                        <p className="flex items-center gap-2 text-sm font-semibold">
                                            <NotebookPen className="size-4 text-primary" aria-hidden /> Your notes
                                        </p>
                                        <div role="tablist" aria-label="Notes view" className="flex gap-1 rounded-full bg-secondary p-1">
                                            {(["write", "preview"] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={notesTab === tab}
                                                    onClick={() => setNotesTab(tab)}
                                                    className={cn(
                                                        "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                                                        notesTab === tab
                                                            ? "bg-card text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground",
                                                    )}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {notesTab === "write" ? (
                                        <div>
                                            <div className="flex items-center gap-1 border-b border-border bg-secondary/30 px-3 py-1.5">
                                                {[
                                                    { icon: Bold, label: "Bold", before: "**", after: "**", placeholder: "bold text" },
                                                    { icon: Code, label: "Code", before: "`", after: "`", placeholder: "code" },
                                                    { icon: LinkIcon, label: "Link", before: "[", after: "](https://)", placeholder: "link text" },
                                                    { icon: List, label: "Bulleted list", before: "- ", after: "", placeholder: "list item" },
                                                ].map(({ icon: Icon, label, before, after, placeholder }) => (
                                                    <Button
                                                        key={label}
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={label}
                                                        onClick={() => insertMarkdown(before, after, placeholder)}
                                                    >
                                                        <Icon className="size-4" />
                                                    </Button>
                                                ))}
                                            </div>
                                            <textarea
                                                ref={noteTextareaRef}
                                                value={noteDraft}
                                                onChange={(e) => setNoteDraft(e.target.value)}
                                                placeholder="Write your note here with Markdown support…"
                                                rows={8}
                                                maxLength={10_000}
                                                className="w-full resize-none bg-transparent p-4 text-sm leading-relaxed outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="min-h-40 p-4 text-sm leading-relaxed"
                                            // Safe: `renderNotePreview` HTML-escapes the source
                                            // before applying its own markdown replacements.
                                            dangerouslySetInnerHTML={{ __html: renderNotePreview(noteDraft) }}
                                        />
                                    )}

                                    <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-3">
                                        <p className="text-xs text-muted-foreground">
                                            {lessonState?.noteUpdatedAt
                                                ? `Last saved ${formatDateTime(lessonState.noteUpdatedAt)}`
                                                : "Not saved yet"}
                                        </p>
                                        <Button
                                            size="sm"
                                            className="rounded-full px-5"
                                            onClick={() => saveNote.mutate(noteDraft)}
                                            isLoading={saveNote.isPending}
                                        >
                                            Save note
                                        </Button>
                                    </div>
                                </div>
                                )}
                                </div>
                            )}

                            {!data.isPreview && !activeVideo.isLocked && <LessonQuestions videoId={activeVideo.id} />}

                        </div>
                    )}
                </div>

                {/* Curriculum sidebar — desktop only; below `lg` it moves into the
                    modal opened from the header's list button. */}
                <aside className="hidden lg:block lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto lg:scrollbar-thin">
                    <CurriculumSidebar {...curriculumProps} />
                </aside>
            </div>

            <Modal
                open={mobileCurriculumOpen}
                onOpenChange={setMobileCurriculumOpen}
                title="Course content"
                size="lg"
            >
                <ModalBody>
                    <CurriculumSidebar {...curriculumProps} />
                </ModalBody>
            </Modal>

            <Modal open={rewardOpen} onOpenChange={setRewardOpen} title="Your reward">
                <ModalBody className="space-y-4">
                    <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/40 p-4">
                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <Trophy className="size-6" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold leading-none">
                                {(myRank?.totalXp ?? 0).toLocaleString()} XP
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">Earned in this course</p>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Completing this lesson, its module and its milestone all award XP the moment
                        you mark it done — that&apos;s what &quot;Progress saved&quot; means every time
                        you tick a lesson off.
                        {myRank?.rank && (
                            <>
                                {" "}You&apos;re currently ranked <strong>#{myRank.rank}</strong> of{" "}
                                {myRank.totalStudents} students in this course.
                            </>
                        )}
                    </p>

                    <Button asChild variant="outline" className="w-full">
                        <Link href={`/leaderboard/${data.course.id}`}>
                            <Trophy className="size-4" /> View full leaderboard
                        </Link>
                    </Button>
                </ModalBody>
            </Modal>

        </div>
    );
}

/** A link lesson in the player's place: where it goes, and a button that opens it in a new tab. */
function ResourceCard({ url }: { url: string }) {
    return (
        <div className="mx-auto grid w-full max-w-6xl place-items-center rounded-xl border border-border bg-secondary/30 px-6 py-14 text-center">
            <div className="space-y-3">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                    <LinkIcon className="size-6" aria-hidden />
                </span>
                <p className="text-sm text-muted-foreground">
                    Learning resource on <span className="font-medium text-foreground">{hostnameOf(url)}</span>
                </p>
                <Button asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        Open resource <ExternalLink className="size-4" />
                    </a>
                </Button>
            </div>
        </div>
    );
}

/**
 * One lesson of an assignment or a practice day, in the player — the same
 * video player, reading box or link card a module's lesson gets.
 */
function MaterialPlayer({
    material,
    subtitle,
    coverImage,
    prev,
    next,
    watermark,
}: {
    material: LessonMaterial;
    subtitle: string;
    coverImage: string | null;
    prev: { title: string; onSelect: () => void } | null;
    next: { title: string; onSelect: () => void; label?: string } | null;
    watermark?: string;
}) {
    if (material.type === "VIDEO" && material.youtubeVideoId) {
        return (
            <LessonVideoPlayer
                youtubeVideoId={material.youtubeVideoId}
                title={material.title}
                subtitle={subtitle}
                coverImage={coverImage}
                prev={prev}
                next={next}
                watermark={watermark}
            />
        );
    }
    if (material.type === "TEXT" && material.content) return <ReadingLesson title={material.title} content={material.content} />;
    if (material.type === "RESOURCE" && material.resourceUrl) return <ResourceCard url={material.resourceUrl} />;
    return (
        <div className="grid aspect-video place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
            This lesson has nothing to show yet.
        </div>
    );
}

/** The copyright notice, shown in the notes' place when its tab is picked. */
function CopyrightPanel({ slug }: { slug: string }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
                <Copyright className="size-4 text-primary" aria-hidden /> Copyright notice
            </p>

            <div className="space-y-3 p-4 sm:p-5">
                <Image
                    src="/handcarf-B-NIE6dN.svg"
                    alt="Copyright and account-sharing warning"
                    width={247}
                    height={171}
                    unoptimized
                    className="mx-auto h-auto w-36"
                />

                {COPYRIGHT_TEXT.map((paragraph) => (
                    <p
                        key={paragraph.slice(0, 24)}
                        className="rounded-lg border border-border bg-secondary/40 p-3.5 text-sm leading-relaxed text-foreground"
                    >
                        {paragraph}
                    </p>
                ))}

                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-sm font-semibold leading-relaxed text-destructive">
                    {COPYRIGHT_CLOSING}
                </p>
            </div>

            <div className="flex justify-end border-t border-border bg-secondary/30 px-4 py-3">
                <Button asChild variant="outline" size="sm" className="rounded-full px-5">
                    <Link href={`/learn/${slug}/support`}>
                        <Headphones className="size-4" /> Report an issue
                    </Link>
                </Button>
            </div>
        </div>
    );
}

interface CurriculumSidebarProps {
    data: CourseLearning;
    slug: string;
    activeVideoId: string | null;
    goTo: (id: string) => void;
    activeAssignmentId: string | null;
    goToAssignment: (id: string, materialId?: string | null) => void;
    activePracticeId: string | null;
    goToPractice: (id: string, materialId?: string | null) => void;
    /** The open assignment's or practice day's lesson; null while its own page shows. */
    activeMaterialId: string | null;
    activeQuizId: string | null;
    goToQuiz: (id: string) => void;
    /** The module whose "complete" screen is open, if one is. */
    activeCompleteModuleId: string | null;
    goToModuleComplete: (moduleId: string) => void;
    openMilestones: Set<string>;
    toggleMilestone: (id: string) => void;
    /** Modules, assignments and practice days open in the list. */
    openModules: Set<string>;
    toggleModule: (id: string) => void;
    /** Whether "Expand all" means anything — more than one milestone or module. */
    canToggleAll: boolean;
    everythingOpen: boolean;
    toggleEverything: () => void;
    totalCount: number;
    search: string;
    onSearchChange: (value: string) => void;
    showBookmarksOnly: boolean;
    onToggleBookmarksOnly: () => void;
    bookmarks: BookmarkedLesson[] | undefined;
    bookmarksLoading: boolean;
    bookmarkedVideoIds: Set<string>;
    onToggleRowBookmark: (videoId: string, bookmarked: boolean) => void;
    /** False for a lesson past the student's current one — shown shut, not clickable. */
    canOpenLesson: (videoId: string) => boolean;
    /** False for a quiz whose lessons aren't all done — shown shut, not clickable. */
    canOpenQuiz: (quizId: string) => boolean;
}

/**
 * The course-content panel — shared verbatim between the desktop `<aside>`
 * and the mobile modal so the two never drift apart.
 */
function CurriculumSidebar({
    data,
    slug,
    activeVideoId,
    goTo,
    activeAssignmentId,
    goToAssignment,
    activePracticeId,
    goToPractice,
    activeMaterialId,
    activeQuizId,
    goToQuiz,
    activeCompleteModuleId,
    goToModuleComplete,
    openMilestones,
    toggleMilestone,
    openModules,
    toggleModule,
    canToggleAll,
    everythingOpen,
    toggleEverything,
    totalCount,
    search,
    onSearchChange,
    showBookmarksOnly,
    onToggleBookmarksOnly,
    bookmarks,
    bookmarksLoading,
    bookmarkedVideoIds,
    onToggleRowBookmark,
    canOpenLesson,
    canOpenQuiz,
}: CurriculumSidebarProps) {
    const query = search.trim().toLowerCase();

    const visibleCurriculum = query
        ? data.curriculum
            .map((milestone) => ({
                ...milestone,
                modules: milestone.modules
                    .map((courseModule) => ({
                        ...courseModule,
                        videos: courseModule.title.toLowerCase().includes(query)
                            ? courseModule.videos
                            : courseModule.videos.filter((v) => v.title.toLowerCase().includes(query)),
                    }))
                    .filter((courseModule) => courseModule.videos.length > 0),
            }))
            .filter((milestone) => milestone.modules.length > 0)
        : data.curriculum;

    // The course's progress and lesson count are already in the page header,
    // so this card is just the tools for finding a lesson.
    const showFinder = !data.isPreview && totalCount > 0;
    const toggleAllButton = canToggleAll && (
        <button
            type="button"
            onClick={toggleEverything}
            disabled={Boolean(query)}
            className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
            {everythingOpen ? "Collapse all" : "Expand all"}
        </button>
    );

    return (
        <div className="space-y-3">
            {(showFinder || canToggleAll) && (
            <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
                {!showFinder && <div className="flex justify-end">{toggleAllButton}</div>}

                {showFinder && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="relative min-w-0 flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={search}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="Search lessons…"
                                    className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            {toggleAllButton}
                        </div>

                        <div
                            role="group"
                            aria-label="Filter"
                            className="flex gap-1 rounded-full bg-secondary/60 p-1"
                        >
                            <button
                                type="button"
                                onClick={() => showBookmarksOnly && onToggleBookmarksOnly()}
                                className={cn(
                                    "flex-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    !showBookmarksOnly
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                All lessons
                            </button>
                            <button
                                type="button"
                                onClick={() => !showBookmarksOnly && onToggleBookmarksOnly()}
                                className={cn(
                                    "flex-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    showBookmarksOnly
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                Bookmarked
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}

            {showBookmarksOnly ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                    {bookmarksLoading ? (
                        <div className="space-y-2 p-4">
                            <Skeleton className="h-8" />
                            <Skeleton className="h-8" />
                        </div>
                    ) : !bookmarks || bookmarks.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            No bookmarked lessons yet. Use the Bookmark button under any lesson to
                            save it here.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {bookmarks.map((bookmark) => (
                                <li key={bookmark.videoId}>
                                    <button
                                        type="button"
                                        onClick={() => goTo(bookmark.videoId)}
                                        disabled={!canOpenLesson(bookmark.videoId)}
                                        title={
                                            canOpenLesson(bookmark.videoId)
                                                ? undefined
                                                : "Opens once you finish the lessons before it"
                                        }
                                        aria-current={activeVideoId === bookmark.videoId ? "true" : undefined}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                                            activeVideoId === bookmark.videoId && "bg-primary/10 text-primary",
                                        )}
                                    >
                                        {canOpenLesson(bookmark.videoId) ? (
                                            <BookmarkCheck className="size-4 shrink-0" />
                                        ) : (
                                            <Lock className="size-4 shrink-0" />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{bookmark.title}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {bookmark.moduleTitle}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {bookmark.durationLabel !== "0:00" && bookmark.durationLabel}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleCurriculum.length === 0 && (
                        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                            {query ? <>No lessons match &quot;{search}&quot;.</> : "No lessons have been published yet."}
                        </p>
                    )}

                    {visibleCurriculum.map((milestone) => {
                        const isOpen = Boolean(query) || openMilestones.has(milestone.id);
                        const milestoneVideos = milestone.modules.flatMap((m) => m.videos);
                        const milestoneSeconds = milestoneVideos.reduce((sum, v) => sum + v.duration, 0);
                        const milestoneCompleted = milestoneVideos.filter((v) => v.isCompleted).length;

                        return (
                            <div
                                key={milestone.id}
                                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleMilestone(milestone.id)}
                                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50"
                                    aria-expanded={isOpen}
                                >
                                    <ProgressRing value={milestone.progress} size={36} stroke={3.5}>
                                        {milestone.isCompleted ? (
                                            <Check className="size-4 text-primary" strokeWidth={3} />
                                        ) : (
                                            String(milestone.order).padStart(2, "0")
                                        )}
                                    </ProgressRing>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">
                                            {data.course.milestoneLabel} {String(milestone.order).padStart(2, "0")}
                                        </p>
                                        <p className="truncate text-sm font-semibold">{milestone.title}</p>
                                        {milestoneVideos.length > 0 && (
                                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                                {milestoneSeconds > 0 && `${formatHoursMinutes(milestoneSeconds)} · `}
                                                {milestoneCompleted}/
                                                {milestoneVideos.length} done
                                            </p>
                                        )}
                                    </div>
                                    <ChevronDown
                                        className={cn(
                                            "size-4 shrink-0 text-muted-foreground transition-transform",
                                            isOpen && "rotate-180",
                                        )}
                                    />
                                </button>

                                {isOpen && (
                                    <WeekRoute
                                        milestone={milestone}
                                        moduleLabel={data.course.moduleLabel || "Module"}
                                        withAssignmentsAndPractice={!query}
                                        // A search shows every match, so it opens every module.
                                        isModuleOpen={(id) => Boolean(query) || openModules.has(id)}
                                        onToggleModule={query ? undefined : toggleModule}
                                        activeVideoId={
                                            activeAssignmentId || activePracticeId || activeQuizId || activeCompleteModuleId
                                                ? null
                                                : activeVideoId
                                        }
                                        goTo={goTo}
                                        activeAssignmentId={activeAssignmentId}
                                        goToAssignment={goToAssignment}
                                        activePracticeId={activePracticeId}
                                        goToPractice={goToPractice}
                                        activeMaterialId={activeMaterialId}
                                        activeQuizId={activeQuizId}
                                        goToQuiz={goToQuiz}
                                        activeCompleteModuleId={activeCompleteModuleId}
                                        goToModuleComplete={goToModuleComplete}
                                        bookmarkedVideoIds={bookmarkedVideoIds}
                                        onToggleRowBookmark={onToggleRowBookmark}
                                        canOpenLesson={canOpenLesson}
                                        canOpenQuiz={canOpenQuiz}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dated for a bootcamp course; for a traditional one, the undated
                list of what staff published. */}
            <div className="grid gap-2">
                <Button asChild variant="brand-outline" className="w-full rounded-full">
                    <Link href={`/learn/${slug}/outline`}>
                        <Award className="size-4" /> Full course outline
                    </Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href={`/learn/${slug}/announcements`}>
                        <Megaphone className="size-4" /> Announcements
                    </Link>
                </Button>
                {!data.isPreview && <RateCourse courseId={data.course.id} />}
            </div>
        </div>
    );
}

type StopState = "done" | "active" | "locked" | "open";

/** A stop on the week's route: its type icon, a check once done, a lock while locked; the current one pulses. */
function Stop({ state, done, icon: Icon }: { state: StopState; done: boolean; icon: typeof PlayCircle }) {
    return (
        <span
            className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full",
                state === "done" && "bg-primary text-primary-foreground",
                state === "active" && "bg-card text-primary ring-2 ring-primary",
                state === "locked" && "bg-secondary text-muted-foreground",
                state === "open" && "border-2 border-border bg-card text-muted-foreground",
            )}
        >
            {state === "active" && (
                <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full ring-2 ring-primary/40 motion-reduce:animate-none"
                />
            )}
            {state === "locked" ? (
                <Lock className="size-3" />
            ) : done ? (
                <Check className="size-3.5" strokeWidth={3} />
            ) : (
                <Icon className="size-3" />
            )}
        </span>
    );
}

type RouteItem =
    | { kind: "MODULE"; key: string; courseModule: LearningModule; isOpen: boolean }
    | { kind: "VIDEO"; key: string; video: LearningVideo; courseModule: LearningModule }
    | { kind: "QUIZ"; key: string; quiz: LearningQuiz }
    | { kind: "FINISH"; key: string; courseModule: LearningModule }
    // An assignment or practice day: its heading, its lessons, then its own page.
    | { kind: "GROUP"; key: string; group: WeekGroup; isOpen: boolean }
    | { kind: "MATERIAL"; key: string; group: WeekGroup; material: LessonMaterial }
    | { kind: "GROUP_PAGE"; key: string; group: WeekGroup };

const isDone = (item: RouteItem) => {
    switch (item.kind) {
        case "MODULE":
            return item.courseModule.isCompleted && quizDone(item.courseModule);
        case "FINISH":
            return isModuleDone(item.courseModule);
        case "VIDEO":
            return item.video.isCompleted;
        case "QUIZ":
            return item.quiz.isCompleted;
        case "GROUP":
        case "MATERIAL":
        case "GROUP_PAGE":
            return groupDone(item.group);
    }
};

const MATERIAL_ICON = { VIDEO: PlayCircle, TEXT: FileText, RESOURCE: LinkIcon } as const;
const MATERIAL_KIND = { VIDEO: "Video", TEXT: "Read", RESOURCE: "Link" } as const;

/**
 * One week of the course as a route: every lesson, quiz, assignment and
 * practice day a stop on a line, in the Module Manager's order. Modules,
 * assignments and practice days each get a labelled heading that opens to
 * their stops — a module's lessons with its quiz where staff placed it; an
 * assignment's lessons, then its own page; a practice day's lessons (its page
 * only when it has none). A module's
 * "complete" stop comes after the practice days and assignments that follow
 * it. The line fills in the brand colour as stops are done, and the one being
 * studied pulses — so where you are, and how far you've come, is one glance
 * down the sidebar.
 */
function WeekRoute({
    milestone,
    moduleLabel,
    withAssignmentsAndPractice,
    isModuleOpen,
    onToggleModule,
    activeVideoId,
    goTo,
    activeAssignmentId,
    goToAssignment,
    activePracticeId,
    goToPractice,
    activeMaterialId,
    activeQuizId,
    goToQuiz,
    activeCompleteModuleId,
    goToModuleComplete,
    bookmarkedVideoIds,
    onToggleRowBookmark,
    canOpenLesson,
    canOpenQuiz,
}: {
    canOpenLesson: (videoId: string) => boolean;
    canOpenQuiz: (quizId: string) => boolean;
    activeCompleteModuleId: string | null;
    goToModuleComplete: (moduleId: string) => void;
    milestone: LearningMilestone;
    /** The course's word for a module ("Module", "Chapter", …). */
    moduleLabel: string;
    withAssignmentsAndPractice: boolean;
    /** Modules, assignments and practice days alike. */
    isModuleOpen: (id: string) => boolean;
    /** Absent while searching — every module is shown open then. */
    onToggleModule?: (id: string) => void;
    activeVideoId: string | null;
    goTo: (id: string) => void;
    activeAssignmentId: string | null;
    goToAssignment: (id: string, materialId?: string | null) => void;
    activePracticeId: string | null;
    goToPractice: (id: string, materialId?: string | null) => void;
    activeMaterialId: string | null;
    activeQuizId: string | null;
    goToQuiz: (id: string) => void;
    bookmarkedVideoIds: Set<string>;
    onToggleRowBookmark: (videoId: string, bookmarked: boolean) => void;
}) {
    // The week in the order it was arranged in — a search only matches
    // lessons, so it leaves assignments and practice days out.
    const items: RouteItem[] = [];
    // The open module whose "complete" stop is still to place: after the
    // assignments and practice days that follow it, before the next module.
    let finishing: LearningModule | null = null;
    const closeModule = () => {
        if (finishing) items.push({ kind: "FINISH", key: `FINISH:${finishing.id}`, courseModule: finishing });
        finishing = null;
    };
    for (const row of weekRows(milestone, withAssignmentsAndPractice)) {
        if (row.kind === "MODULE") {
            closeModule();
            const courseModule = row.entry;
            const isOpen = isModuleOpen(courseModule.id);
            items.push({ kind: "MODULE", key: `MODULE:${courseModule.id}`, courseModule, isOpen });
            // A collapsed module keeps just its heading on the route.
            if (!isOpen) continue;
            for (const step of moduleSteps(courseModule)) {
                items.push(
                    step.kind === "VIDEO"
                        ? { kind: "VIDEO", key: `VIDEO:${step.video.id}`, video: step.video, courseModule }
                        : { kind: "QUIZ", key: `QUIZ:${step.quiz.id}`, quiz: step.quiz },
                );
            }
            // Not while searching, when only matching lessons show.
            if (withAssignmentsAndPractice && courseModule.videos.length > 0) finishing = courseModule;
            continue;
        }
        const group: WeekGroup = row.kind === "PRACTICE" ? { kind: "PRACTICE", entry: row.entry } : { kind: "ASSIGNMENT", entry: row.entry };
        const isOpen = isModuleOpen(group.entry.id);
        items.push({ kind: "GROUP", key: `GROUP:${group.entry.id}`, group, isOpen });
        if (!isOpen) continue;
        for (const material of group.entry.materials) {
            items.push({ kind: "MATERIAL", key: `MATERIAL:${group.entry.id}:${material.id}`, group, material });
        }
        // An assignment's quiz: after its lessons, before its brief & submission.
        if (group.kind === "ASSIGNMENT" && group.entry.quiz) {
            items.push({ kind: "QUIZ", key: `QUIZ:${group.entry.quiz.id}`, quiz: group.entry.quiz });
        }
        if (hasGroupPage(group)) items.push({ kind: "GROUP_PAGE", key: `GROUP_PAGE:${group.entry.id}`, group });
    }
    closeModule();

    /** Whether this assignment or practice day is the one open in the player. */
    const isActiveGroup = (group: WeekGroup) =>
        group.kind === "PRACTICE" ? activePracticeId === group.entry.id : activeAssignmentId === group.entry.id;
    const openGroup = (group: WeekGroup, materialId: string | null = null) =>
        group.kind === "PRACTICE" ? goToPractice(group.entry.id, materialId) : goToAssignment(group.entry.id, materialId);

    const rowClass =
        "relative flex w-full min-w-0 items-center gap-3 py-2 pl-4 pr-3 text-left text-sm transition-colors hover:bg-secondary/60";
    const activeRow = "bg-primary/[0.06] hover:bg-primary/[0.08]";
    // The accent bar on the row being studied.
    const Marker = () => <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand" />;

    return (
        <ul className="border-t border-border py-2">
            {items.map((item, index) => (
                <li key={item.key} className="relative">
                    {/* The line: in from the stop before, out to the next, each half
                        filled once the stop it leaves is done. */}
                    {index > 0 && (
                        <span
                            aria-hidden
                            className={cn(
                                "absolute left-6.75 top-0 h-1/2 w-0.5",
                                isDone(items[index - 1]) ? "bg-primary" : "bg-border",
                            )}
                        />
                    )}
                    {index < items.length - 1 && (
                        <span
                            aria-hidden
                            className={cn("absolute left-6.75 top-1/2 h-1/2 w-0.5", isDone(item) ? "bg-primary" : "bg-border")}
                        />
                    )}

                    {item.kind === "MODULE" ? (
                        // A module opens with its own labelled block — "MODULE 02"
                        // and its name — so where one module ends and the next
                        // begins reads at a glance, not just the week around them.
                        // Padding (not margin) spaces it, so the route line runs
                        // unbroken through the gap.
                        <div className={cn("px-2 pb-1", index > 0 ? "pt-3" : "pt-1")}>
                            {/* Opaque, so the route line stops at its edges; the
                                7px left padding centres the badge on that line.
                                The whole block is the dropdown toggle for the
                                module's lessons. */}
                            <button
                                type="button"
                                onClick={() => onToggleModule?.(item.courseModule.id)}
                                disabled={!onToggleModule}
                                aria-expanded={item.isOpen}
                                title={
                                    onToggleModule
                                        ? item.isOpen
                                            ? "Hide this module's lessons"
                                            : "Show this module's lessons"
                                        : undefined
                                }
                                className="relative flex w-full items-center gap-3 rounded-xl border border-border bg-secondary py-2 pl-1.75 pr-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:hover:border-border"
                            >
                                <span
                                    className={cn(
                                        "relative z-10 grid size-6 shrink-0 place-items-center rounded-md text-[0.625rem] font-bold tabular-nums",
                                        isDone(item)
                                            ? "bg-primary text-primary-foreground"
                                            : item.courseModule.isLocked
                                                ? "bg-secondary text-muted-foreground"
                                                : "border border-primary/40 bg-card text-primary",
                                    )}
                                >
                                    {isDone(item) ? (
                                        <Check className="size-3.5" strokeWidth={3} />
                                    ) : item.courseModule.isLocked ? (
                                        <Lock className="size-3" />
                                    ) : (
                                        String(item.courseModule.order).padStart(2, "0")
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-wider text-primary">
                                        {moduleLabel} {String(item.courseModule.order).padStart(2, "0")}
                                        {item.courseModule.mode && (
                                            <ClassModeTag
                                                mode={item.courseModule.mode}
                                                className="font-medium normal-case tracking-normal text-muted-foreground [&>svg]:size-3"
                                            />
                                        )}
                                    </span>
                                    <span className="block truncate text-sm font-semibold leading-snug">
                                        {item.courseModule.title}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                                    {item.courseModule.isLocked
                                        ? "Locked"
                                        : `${item.courseModule.completedVideos}/${item.courseModule.totalVideos} done`}
                                </span>
                                {onToggleModule && (
                                    <ChevronDown
                                        aria-hidden
                                        className={cn(
                                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                            item.isOpen && "rotate-180",
                                        )}
                                    />
                                )}
                            </button>
                        </div>
                    ) : item.kind === "VIDEO" ? (
                        (() => {
                            const { video, courseModule } = item;
                            const isActive = activeVideoId === video.id;
                            const isBookmarked = bookmarkedVideoIds.has(video.id);
                            // Shut: its module is locked, or it comes after the
                            // student's current lesson (lessons open one at a time).
                            const notReached = !courseModule.isLocked && !canOpenLesson(video.id);
                            const isShut = courseModule.isLocked || notReached;
                            return (
                                <div
                                    className={cn("relative flex items-center", isActive && "bg-primary/6")}
                                    // On the row, not the disabled button — a disabled button shows no tooltip.
                                    title={notReached ? "Opens once you finish the lessons before it" : undefined}
                                >
                                    {isActive && <Marker />}
                                    <button
                                        type="button"
                                        disabled={isShut}
                                        onClick={() => goTo(video.id)}
                                        aria-current={isActive ? "true" : undefined}
                                        className={cn(
                                            rowClass,
                                            "flex-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                                            isActive && "hover:bg-transparent",
                                        )}
                                    >
                                        <Stop
                                            state={isShut ? "locked" : isActive ? "active" : video.isCompleted ? "done" : "open"}
                                            done={video.isCompleted}
                                            icon={video.type === "TEXT" ? FileText : video.type === "RESOURCE" ? LinkIcon : PlayCircle}
                                        />
                                        <span
                                            className={cn(
                                                "min-w-0 flex-1 truncate",
                                                isActive && "font-semibold text-primary",
                                                video.isCompleted && !isActive && "text-muted-foreground",
                                            )}
                                        >
                                            {video.title}
                                        </span>
                                        {/* Only a video has a running time worth showing. */}
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                            {video.type === "VIDEO"
                                                ? video.duration > 0 && video.durationLabel
                                                : video.type === "TEXT"
                                                    ? "Read"
                                                    : "Link"}
                                        </span>
                                    </button>
                                    {!courseModule.isLocked && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleRowBookmark(video.id, !isBookmarked)}
                                            aria-pressed={isBookmarked}
                                            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
                                            className={cn(
                                                "relative shrink-0 py-2 pl-1 pr-3 text-muted-foreground hover:text-primary",
                                                isBookmarked && "text-primary",
                                            )}
                                        >
                                            {isBookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                                        </button>
                                    )}
                                </div>
                            );
                        })()
                    ) : item.kind === "FINISH" ? (
                        (() => {
                            const done = isModuleDone(item.courseModule);
                            const isActive = activeCompleteModuleId === item.courseModule.id;
                            // Named for what was just finished: the module, a practice day or an assignment.
                            const finished = finishedLast(milestone, item.courseModule);
                            const label = finished ? GROUP_LABEL[finished.kind] : moduleLabel;
                            return (
                                // On the wrapper, not the disabled button — a disabled button shows no tooltip.
                                <div
                                    title={
                                        done
                                            ? undefined
                                            : `Opens once you finish every lesson${item.courseModule.quiz ? " and the quiz" : ""} in this ${moduleLabel.toLowerCase()}`
                                    }
                                >
                                    <button
                                        type="button"
                                        disabled={!done}
                                        onClick={() => goToModuleComplete(item.courseModule.id)}
                                        aria-current={isActive ? "true" : undefined}
                                        className={cn(
                                            rowClass,
                                            "disabled:cursor-not-allowed disabled:hover:bg-transparent",
                                            isActive && activeRow,
                                        )}
                                    >
                                        {isActive && <Marker />}
                                        <Stop state={isActive ? "active" : done ? "done" : "open"} done={done} icon={Flag} />
                                        <span
                                            className={cn(
                                                "min-w-0 flex-1 truncate",
                                                isActive ? "font-semibold text-primary" : !done && "text-muted-foreground",
                                            )}
                                        >
                                            {label} complete
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {done ? "Finished" : "Finish line"}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()
                    ) : item.kind === "QUIZ" ? (
                        // Where staff placed it among the lessons, shut until the
                        // lessons before it are done. The score shows inside the
                        // quiz, not here.
                        (() => {
                            const { quiz } = item;
                            const isActive = activeQuizId === quiz.id;
                            const isShut = !canOpenQuiz(quiz.id);
                            return (
                                // On the wrapper, not the disabled button — a disabled button shows no tooltip.
                                <div title={isShut ? "Opens once you finish the lessons before it" : undefined}>
                                    <button
                                        type="button"
                                        disabled={isShut}
                                        onClick={() => goToQuiz(quiz.id)}
                                        aria-current={isActive ? "true" : undefined}
                                        className={cn(
                                            rowClass,
                                            "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                                            isActive && activeRow,
                                        )}
                                    >
                                        {isActive && <Marker />}
                                        <Stop
                                            state={isShut ? "locked" : isActive ? "active" : quiz.isCompleted ? "done" : "open"}
                                            done={quiz.isCompleted}
                                            icon={HelpCircle}
                                        />
                                        <span
                                            className={cn(
                                                "min-w-0 flex-1 truncate",
                                                isActive && "font-semibold text-primary",
                                                quiz.isCompleted && !isActive && "text-muted-foreground",
                                            )}
                                        >
                                            {quizLabel(quiz.title)}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()
                    ) : item.kind === "GROUP" ? (
                        // An assignment or practice day opens with a labelled block
                        // like a module's — its kind, its name, how it stands —
                        // that opens and closes its lessons.
                        (() => {
                            const { group } = item;
                            const done = groupDone(group);
                            const Icon = group.kind === "PRACTICE" ? Dumbbell : ClipboardCheck;
                            const lessons = group.entry.materials.length;
                            const status =
                                group.kind === "PRACTICE"
                                    ? done
                                        ? "Done"
                                        : lessons > 0
                                            ? `${lessons} lesson${lessons === 1 ? "" : "s"}`
                                            : "To do"
                                    : group.entry.isAccepted
                                        ? "Marked"
                                        : group.entry.isSubmitted
                                            ? "Submitted"
                                            : group.entry.isClosed
                                                ? "Closed"
                                                : lessons > 0
                                                ? `${lessons} lesson${lessons === 1 ? "" : "s"}`
                                                : "To do";
                            return (
                                <div className={cn("px-2 pb-1", index > 0 ? "pt-3" : "pt-1")}>
                                    <button
                                        type="button"
                                        onClick={() => onToggleModule?.(group.entry.id)}
                                        disabled={!onToggleModule}
                                        aria-expanded={item.isOpen}
                                        title={item.isOpen ? "Hide its lessons" : "Show its lessons"}
                                        className={cn(
                                            "relative flex w-full items-center gap-3 rounded-xl border bg-secondary py-2 pl-1.75 pr-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default",
                                            // Also while its quiz is open.
                                            isActiveGroup(group) || (group.kind === "ASSIGNMENT" && activeQuizId !== null && group.entry.quiz?.id === activeQuizId)
                                                ? "border-primary/40"
                                                : "border-border",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "relative z-10 grid size-6 shrink-0 place-items-center rounded-md",
                                                done ? "bg-primary text-primary-foreground" : "border border-primary/40 bg-card text-primary",
                                            )}
                                        >
                                            {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-primary">
                                                {GROUP_LABEL[group.kind]}
                                            </span>
                                            <span className="block truncate text-sm font-semibold leading-snug">{group.entry.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{status}</span>
                                        <ChevronDown
                                            aria-hidden
                                            className={cn(
                                                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                                item.isOpen && "rotate-180",
                                            )}
                                        />
                                    </button>
                                </div>
                            );
                        })()
                    ) : item.kind === "MATERIAL" ? (
                        (() => {
                            const { group, material } = item;
                            const isActive = isActiveGroup(group) && activeMaterialId === material.id;
                            const done = groupDone(group);
                            return (
                                <button
                                    type="button"
                                    onClick={() => openGroup(group, material.id)}
                                    aria-current={isActive ? "true" : undefined}
                                    className={cn(rowClass, isActive && activeRow)}
                                >
                                    {isActive && <Marker />}
                                    <Stop state={isActive ? "active" : done ? "done" : "open"} done={done} icon={MATERIAL_ICON[material.type]} />
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate",
                                            isActive && "font-semibold text-primary",
                                            done && !isActive && "text-muted-foreground",
                                        )}
                                    >
                                        {material.title}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{MATERIAL_KIND[material.type]}</span>
                                </button>
                            );
                        })()
                    ) : (
                        // The group's own page, its last stop: an assignment's brief
                        // and submission box, or what a practice day with no lessons is for.
                        (() => {
                            const { group } = item;
                            const isActive = isActiveGroup(group) && !activeMaterialId;
                            const done = groupDone(group);
                            return (
                                <button
                                    type="button"
                                    onClick={() => openGroup(group)}
                                    aria-current={isActive ? "true" : undefined}
                                    className={cn(rowClass, isActive && activeRow)}
                                >
                                    {isActive && <Marker />}
                                    <Stop
                                        state={isActive ? "active" : done ? "done" : "open"}
                                        done={done}
                                        icon={group.kind === "PRACTICE" ? CheckCircle2 : Send}
                                    />
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate",
                                            isActive ? "font-semibold text-primary" : done && "text-muted-foreground",
                                        )}
                                    >
                                        {groupPageTitle(group)}
                                    </span>
                                    {group.kind === "PRACTICE" ? (
                                        <span className="shrink-0 text-xs text-muted-foreground">{done ? "Done" : "To do"}</span>
                                    ) : group.entry.isAccepted && group.entry.score !== null ? (
                                        <Badge variant="success">{group.entry.score}</Badge>
                                    ) : group.entry.isSubmitted ? (
                                        <Badge variant="secondary">Submitted</Badge>
                                    ) : (
                                        <span className="shrink-0 text-xs text-muted-foreground">To do</span>
                                    )}
                                </button>
                            );
                        })()
                    )}
                </li>
            ))}
        </ul>
    );
}
