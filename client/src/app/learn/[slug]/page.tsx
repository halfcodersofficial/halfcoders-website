"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
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
    Clock,
    Code,
    Copyright,
    Dumbbell,
    ExternalLink,
    FileText,
    Headphones,
    HelpCircle,
    Hourglass,
    Link as LinkIcon,
    List,
    ListTree,
    Lock,
    Megaphone,
    MessageSquare,
    NotebookPen,
    PlayCircle,
    RotateCcw,
    Search,
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
import LessonQuestions from "@/components/learn/LessonQuestions";
import RateCourse from "@/components/learn/RateCourse";
import SubmissionFiles, { attachedFrom, type AttachedFile } from "@/components/learn/SubmissionFiles";
import QuizPane from "@/components/shared/QuizPane";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { infoAlert } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { cn, formatDateTime, formatHoursMinutes } from "@/lib/utils";
import {
    assignmentService,
    leaderboardService,
    learningService,
    lessonService,
    progressService,
} from "@/services";
import type {
    BookmarkedLesson,
    CourseLearning,
    LearningMilestone,
    LearningModule,
    LearningVideo,
    LessonState,
} from "@/types/domain.types";
import type { SubmissionStatus } from "@/types/api.types";

const SUBMISSION_STATUS_META: Record<
    SubmissionStatus,
    { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
> = {
    SUBMITTED: { label: "Submitted — awaiting review", variant: "secondary" },
    UNDER_REVIEW: { label: "Under review", variant: "warning" },
    ACCEPTED: { label: "Accepted", variant: "success" },
    NEEDS_REVISION: { label: "Changes requested", variant: "warning" },
    REJECTED: { label: "Not accepted", variant: "destructive" },
};

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
    const [openMilestones, setOpenMilestones] = useState<Set<string>>(new Set());
    const [initialisedFromQuery, setInitialisedFromQuery] = useState(false);
    // Gates the very first play — the embed sits under an opaque overlay
    // until this flips, so the paused thumbnail's own clickable title and
    // "Watch on YouTube" link (YouTube's chrome, not ours) can't be reached.
    const [videoStarted, setVideoStarted] = useState(false);

    const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
    const [notesTab, setNotesTab] = useState<"write" | "preview">("write");
    const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [rewardOpen, setRewardOpen] = useState(false);
    const [copyrightOpen, setCopyrightOpen] = useState(false);
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

    // A lesson, assignment or quiz reached via the Course Outline page or a
    // notification link ("?video=<id>" / "?assignment=<id>" / "?quiz=<id>")
    // wins over the usual "resume where you left off" pick, but only once —
    // after that the student is free to click around without the URL
    // fighting them back.
    useEffect(() => {
        if (!data || initialisedFromQuery) return;
        setInitialisedFromQuery(true);

        const requestedAssignment = searchParams.get("assignment");
        const owningAssignmentMilestone = requestedAssignment
            ? data.curriculum.find((m) => m.assignments.some((a) => a.id === requestedAssignment))
            : null;
        if (requestedAssignment && owningAssignmentMilestone) {
            setActiveAssignmentId(requestedAssignment);
            setOpenMilestones(new Set([owningAssignmentMilestone.id]));
            return;
        }

        const requestedQuiz = searchParams.get("quiz");
        const owningQuizMilestone = requestedQuiz
            ? data.curriculum.find((m) => m.modules.some((mod) => mod.quiz?.id === requestedQuiz))
            : null;
        if (requestedQuiz && owningQuizMilestone) {
            setActiveQuizId(requestedQuiz);
            setOpenMilestones(new Set([owningQuizMilestone.id]));
            return;
        }

        const requested = searchParams.get("video");
        const requestedVideo = requested ? allVideos.find((v) => v.id === requested && !v.isLocked) : null;
        if (requestedVideo) {
            setActiveVideoId(requestedVideo.id);
            const owningMilestone = data.curriculum.find((m) =>
                m.modules.some((mod) => mod.videos.some((v) => v.id === requestedVideo.id)),
            );
            if (owningMilestone) setOpenMilestones(new Set([owningMilestone.id]));
        }
    }, [data, initialisedFromQuery, searchParams, allVideos]);

    // Open the student's current milestone and start on the first unwatched
    // lesson, so returning to the page resumes rather than restarts.
    useEffect(() => {
        if (!data || activeVideoId || activeAssignmentId || activeQuizId || !initialisedFromQuery) return;

        const firstUnwatched = allVideos.find((video) => !video.isCompleted && !video.isLocked);
        const target = firstUnwatched ?? allVideos[0];
        if (target) setActiveVideoId(target.id);

        const currentMilestone =
            data.curriculum.find((m) => m.id === data.enrollment?.currentMilestoneId) ??
            data.curriculum[0];
        if (currentMilestone) setOpenMilestones(new Set([currentMilestone.id]));
    }, [data, activeVideoId, activeAssignmentId, activeQuizId, allVideos, initialisedFromQuery]);

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

    /* Prev/next walk the *unlocked* lessons only. Stepping onto a locked one
       would land the student on the padlock screen with no way forward, which
       reads as the button being broken rather than the content being gated. */
    const playable = allVideos.filter((video) => !video.isLocked);
    const activeIndex = playable.findIndex((video) => video.id === activeVideoId);
    const prevVideo = activeIndex > 0 ? playable[activeIndex - 1] : null;
    const nextVideo =
        activeIndex >= 0 && activeIndex < playable.length - 1 ? playable[activeIndex + 1] : null;
    const completedCount = allVideos.filter((video) => video.isCompleted).length;

    const goTo = (videoId: string) => {
        setActiveVideoId(videoId);
        setActiveAssignmentId(null);
        setActiveQuizId(null);
        setMobileCurriculumOpen(false);
        // The player is above the fold on desktop but below the sidebar on a
        // phone, so a lesson change has to bring it back into view.
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goToAssignment = (assignmentId: string) => {
        setActiveAssignmentId(assignmentId);
        setActiveQuizId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goToQuiz = (quizId: string) => {
        setActiveQuizId(quizId);
        setActiveAssignmentId(null);
        setMobileCurriculumOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const complete = useMutation({
        mutationFn: (videoId: string) => progressService.completeVideo(videoId),
        onSuccess: (result) => {
            void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] });

            if (result.courseCompleted) {
                toast.success("Course complete! Your certificate is ready to claim. 🎓");
            } else {
                toast.success(`Progress saved — ${result.courseProgress}% done`);
            }

            // Auto-advance so finishing a lesson flows into the next one.
            const index = allVideos.findIndex((video) => video.id === activeVideoId);
            const next = allVideos.slice(index + 1).find((video) => !video.isLocked);
            if (next) setActiveVideoId(next.id);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save your progress.")),
    });

    const uncomplete = useMutation({
        mutationFn: (videoId: string) => progressService.uncompleteVideo(videoId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
            toast.success("Marked as not complete.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update your progress.")),
    });

    // ---- Notes / bookmark / reaction — the active lesson's own state. -----

    const { data: lessonState } = useQuery({
        queryKey: ["lesson-state", activeVideoId],
        queryFn: () => lessonService.state(activeVideoId as string),
        enabled: Boolean(activeVideoId) && !data?.isPreview,
    });

    // Every lesson change starts back at the play-gate overlay, whichever of
    // the several places that change a lesson triggered it.
    useEffect(() => {
        setVideoStarted(false);
    }, [activeVideoId]);

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
            <div className="container mx-auto grid gap-8 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
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

    const allMilestonesOpen = data.curriculum.every((m) => openMilestones.has(m.id));
    const toggleAllMilestones = () =>
        setOpenMilestones(allMilestonesOpen ? new Set() : new Set(data.curriculum.map((m) => m.id)));

    const reaction = lessonState?.reaction ?? null;

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
        activeAssignmentId,
        goToAssignment,
        activeQuizId,
        goToQuiz,
        openMilestones,
        toggleMilestone,
        allMilestonesOpen,
        toggleAllMilestones,
        completedCount,
        totalCount: allVideos.length,
        search: sidebarSearch,
        onSearchChange: setSidebarSearch,
        showBookmarksOnly,
        onToggleBookmarksOnly: () => setShowBookmarksOnly((v) => !v),
        bookmarks,
        bookmarksLoading,
        bookmarkedVideoIds,
        onToggleRowBookmark: (videoId, bookmarked) => toggleRowBookmark.mutate({ videoId, bookmarked }),
    };

    return (
        <div className="min-h-dvh bg-background container mx-auto">
            <header className="sticky top-16 z-40 border-b border-border bg-background/90 backdrop-blur-md">
                <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <BackButton href="/dashboard" label="Dashboard" compact />
                        {data.enrollment && <ProgressRing value={data.enrollment.progress} size={38} />}
                        <div className="min-w-0">
                            <h1 className="truncate font-semibold leading-tight">{data.course.title}</h1>
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {/* An upcoming course has no modules until its classes start. */}
                                {allVideos.length === 0
                                    ? data.course.phase === "UPCOMING"
                                        ? "Classes haven't started yet — lessons appear here once they do"
                                        : "No lessons published yet"
                                    : `${completedCount} of ${allVideos.length} lessons complete`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {data.isPreview && <Badge variant="warning">Preview mode</Badge>}

                        {/* Quick shortcuts to this lesson's own state — mirrors the
                            labelled row under the video, just always in reach. */}
                        {!data.isPreview && !activeAssignmentId && activeVideo && !activeVideo.isLocked && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Jump to notes"
                                    onClick={() =>
                                        document
                                            .getElementById("lesson-notes")
                                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                                    }
                                >
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
                            </>
                        )}

                        {/* The curriculum sidebar lives in a modal below `lg` instead
                            of stacking under the player — a forty-lesson course is a
                            long scroll to reach on a phone otherwise. */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="lg:hidden"
                            onClick={() => setMobileCurriculumOpen(true)}
                        >
                            <ListTree className="size-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
                {/* Player */}
                <div className="space-y-4">
                    {activeAssignmentId ? (
                        <AssignmentPane slug={slug} assignmentId={activeAssignmentId} />
                    ) : activeQuizId ? (
                        <QuizPane quizId={activeQuizId} />
                    ) : activeVideo && !activeVideo.isLocked && activeVideo.type === "TEXT" && activeVideo.content ? (
                        <article className="mx-auto w-full max-w-6xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
                            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <FileText className="size-4" aria-hidden /> Reading ·{" "}
                                {Math.max(1, Math.round(activeVideo.content.trim().split(/\s+/).length / 200))} min
                            </p>
                            <div
                                className="max-w-3xl text-[15px] leading-relaxed"
                                // Escaped and link-restricted by renderLightMarkdown.
                                dangerouslySetInnerHTML={{ __html: renderLightMarkdown(activeVideo.content) }}
                            />
                        </article>
                    ) : activeVideo && !activeVideo.isLocked && activeVideo.type === "RESOURCE" && activeVideo.resourceUrl ? (
                        <div className="mx-auto grid w-full max-w-6xl place-items-center rounded-xl border border-border bg-secondary/30 px-6 py-14 text-center">
                            <div className="space-y-3">
                                <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                                    <LinkIcon className="size-6" aria-hidden />
                                </span>
                                <p className="text-sm text-muted-foreground">
                                    Learning resource on{" "}
                                    <span className="font-medium text-foreground">
                                        {hostnameOf(activeVideo.resourceUrl)}
                                    </span>
                                </p>
                                <Button asChild>
                                    <a href={activeVideo.resourceUrl} target="_blank" rel="noopener noreferrer">
                                        Open resource <ExternalLink className="size-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    ) : activeVideo?.youtubeVideoId ? (
                        <div className="relative mx-auto aspect-video w-full max-w-6xl overflow-hidden rounded-2xl bg-black shadow-panel ring-1 ring-border">
                            <iframe
                                key={activeVideo.id}
                                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeVideoId}?rel=0&modestbranding=1&disablekb=1${videoStarted ? "&autoplay=1" : ""}`}
                                title={activeVideo.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="size-full"
                            />
                            {/* Fully opaque, not just tinted — the paused thumbnail's
                                own clickable title and "Watch on YouTube" link (both
                                YouTube's cross-origin chrome, so they can't be styled
                                or removed) sit underneath and must be completely
                                covered, not merely darkened, until the student
                                chooses to play. Right-click is blocked here too; once
                                playing, clicks reach the iframe's native controls
                                directly and this can no longer intercept them. */}
                            {!videoStarted && (
                                <button
                                    type="button"
                                    onClick={() => setVideoStarted(true)}
                                    onContextMenu={(e) => e.preventDefault()}
                                    aria-label={`Play ${activeVideo.title}`}
                                    className="group absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-hidden bg-black px-6 text-center text-white"
                                >
                                    {/* A soft brand glow behind the button — the cover stays opaque. */}
                                    <span
                                        aria-hidden
                                        className="pointer-events-none absolute left-1/2 top-1/2 size-112 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                                    />
                                    <span className="relative grid size-20 place-items-center rounded-full bg-brand shadow-[0_10px_40px_-8px_oklch(0.55_0.2_260/0.8)] ring-8 ring-white/10 transition-transform duration-300 group-hover:scale-105">
                                        <svg viewBox="0 0 24 24" className="ml-1 size-8 fill-white" aria-hidden>
                                            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                                        </svg>
                                    </span>
                                    <span className="relative max-w-xl space-y-1.5">
                                        <span className="block text-lg font-semibold leading-snug sm:text-xl">{activeVideo.title}</span>
                                        <span className="block text-sm tabular-nums text-white/60">
                                            Lesson {activeLessonNumber} of {allVideos.length}
                                            {activeVideo.durationLabel && ` · ${activeVideo.durationLabel}`}
                                        </span>
                                    </span>
                                </button>
                            )}
                        </div>
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

                    {!activeAssignmentId && activeVideo && (
                        <div className="space-y-3">
                            {/* Previous — Mark complete — Next sit beside the lesson
                                title instead of on their own row. They stay visible in
                                staff preview (there's nothing to record, but browsing
                                between lessons is still useful); only the completion
                                control needs a real enrolment. */}
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
                                        </p>
                                    )}
                                    <h2 className="mt-1.5 text-balance text-2xl font-bold leading-tight tracking-tight">
                                        {activeVideo.title}
                                    </h2>
                                </div>

                                <div className="flex items-center gap-2">
                                    {prevVideo && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="rounded-full"
                                            aria-label="Previous lesson"
                                            title="Previous lesson"
                                            onClick={() => goTo(prevVideo.id)}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                    )}

                                    {!data.isPreview && !activeVideo.isLocked && (
                                        activeVideo.isCompleted ? (
                                            <Button
                                                variant="outline"
                                                className="rounded-full border-success/40 bg-success/5 px-5 text-success hover:bg-success/10"
                                                title="Mark as not complete"
                                                onClick={() => uncomplete.mutate(activeVideo.id)}
                                                isLoading={uncomplete.isPending}
                                            >
                                                <CheckCircle2 className="size-4" />
                                                Completed
                                            </Button>
                                        ) : (
                                            <Button
                                                className="rounded-full px-5"
                                                onClick={() => complete.mutate(activeVideo.id)}
                                                isLoading={complete.isPending}
                                            >
                                                <Check className="size-4" />
                                                Mark as complete
                                            </Button>
                                        )
                                    )}

                                    {nextVideo && (
                                        <Button
                                            variant="outline"
                                            className="rounded-full pl-4 pr-3"
                                            title={nextVideo.title}
                                            onClick={() => goTo(nextVideo.id)}
                                        >
                                            Next <ChevronRight className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {activeVideo.description && (
                                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                    {activeVideo.description}
                                </p>
                            )}

                            {/* Lesson action bar — notes, bookmark, reward, copyright
                                notice and a like/dislike reaction, all real state
                                against this lesson rather than decorative buttons. */}
                            {!data.isPreview && !activeVideo.isLocked && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() =>
                                            document
                                                .getElementById("lesson-notes")
                                                ?.scrollIntoView({ behavior: "smooth", block: "start" })
                                        }
                                    >
                                        <NotebookPen className="size-4" />
                                        Notes
                                    </Button>

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

                                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setCopyrightOpen(true)}>
                                        <Copyright className="size-4" />
                                        Copyright
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

                            {/* Always-open note editor for this lesson, rather than a
                                modal — the "Notes" button above just scrolls to it. */}
                            {!data.isPreview && !activeVideo.isLocked && (
                                <div id="lesson-notes" className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
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
                    <CurriculumSidebar {...curriculumProps} showHeading={false} />
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

            <Modal open={copyrightOpen} onOpenChange={setCopyrightOpen} title="Copyright notice">
                <ModalBody className="space-y-4">
                    <Image
                        src="/handcarf-B-NIE6dN.svg"
                        alt="Copyright and account-sharing warning"
                        width={247}
                        height={171}
                        unoptimized
                        className="mx-auto h-auto w-40"
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

                    <Button asChild variant="outline" className="w-full">
                        <Link href={`/learn/${slug}/support`}>
                            <Headphones className="size-4" /> Report an issue
                        </Link>
                    </Button>
                </ModalBody>
            </Modal>
        </div>
    );
}

interface CurriculumSidebarProps {
    data: CourseLearning;
    slug: string;
    activeVideoId: string | null;
    goTo: (id: string) => void;
    activeAssignmentId: string | null;
    goToAssignment: (id: string) => void;
    activeQuizId: string | null;
    goToQuiz: (id: string) => void;
    openMilestones: Set<string>;
    toggleMilestone: (id: string) => void;
    allMilestonesOpen: boolean;
    toggleAllMilestones: () => void;
    completedCount: number;
    totalCount: number;
    search: string;
    onSearchChange: (value: string) => void;
    showBookmarksOnly: boolean;
    onToggleBookmarksOnly: () => void;
    bookmarks: BookmarkedLesson[] | undefined;
    bookmarksLoading: boolean;
    bookmarkedVideoIds: Set<string>;
    onToggleRowBookmark: (videoId: string, bookmarked: boolean) => void;
    /** False inside the mobile modal, whose own title already says "Course content". */
    showHeading?: boolean;
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
    activeQuizId,
    goToQuiz,
    openMilestones,
    toggleMilestone,
    allMilestonesOpen,
    toggleAllMilestones,
    completedCount,
    totalCount,
    search,
    onSearchChange,
    showBookmarksOnly,
    onToggleBookmarksOnly,
    bookmarks,
    bookmarksLoading,
    bookmarkedVideoIds,
    onToggleRowBookmark,
    showHeading = true,
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

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3.5">
                    {data.enrollment && <ProgressRing value={data.enrollment.progress} size={52} stroke={5} />}
                    <div className="min-w-0 flex-1">
                        {showHeading && <h2 className="font-semibold leading-tight">Course content</h2>}
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {!data.enrollment
                                ? "Previewing as staff — nothing you do here is recorded."
                                : totalCount === 0
                                    ? data.course.phase === "UPCOMING"
                                        ? "Classes haven't started yet — lessons appear here once they do"
                                        : "No lessons published yet"
                                    : `${completedCount} of ${totalCount} lessons complete`}
                        </p>
                        {data.enrollment && data.sequentialLearning && totalCount > 0 && (
                            <p className="text-xs text-muted-foreground">Each module unlocks the next.</p>
                        )}
                    </div>
                    {!query && data.curriculum.length > 1 && (
                        <button
                            type="button"
                            onClick={toggleAllMilestones}
                            className="shrink-0 self-start text-xs font-medium text-primary hover:underline"
                        >
                            {allMilestonesOpen ? "Collapse all" : "Expand all"}
                        </button>
                    )}
                </div>

                {!data.isPreview && totalCount > 0 && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder="Search lessons…"
                                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                            />
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
                                        aria-current={activeVideoId === bookmark.videoId ? "true" : undefined}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60",
                                            activeVideoId === bookmark.videoId && "bg-primary/10 text-primary",
                                        )}
                                    >
                                        <BookmarkCheck className="size-4 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{bookmark.title}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {bookmark.moduleTitle}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {bookmark.durationLabel}
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
                                                {formatHoursMinutes(milestoneSeconds)} · {milestoneCompleted}/
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
                                        withAssignmentsAndPractice={!query}
                                        slug={slug}
                                        activeVideoId={activeAssignmentId || activeQuizId ? null : activeVideoId}
                                        goTo={goTo}
                                        activeAssignmentId={activeAssignmentId}
                                        goToAssignment={goToAssignment}
                                        activeQuizId={activeQuizId}
                                        goToQuiz={goToQuiz}
                                        bookmarkedVideoIds={bookmarkedVideoIds}
                                        onToggleRowBookmark={onToggleRowBookmark}
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
    | { kind: "MODULE"; key: string; courseModule: LearningModule }
    | { kind: "VIDEO"; key: string; video: LearningVideo; courseModule: LearningModule }
    | { kind: "QUIZ"; key: string; quiz: NonNullable<LearningModule["quiz"]> }
    | { kind: "ASSIGNMENT"; key: string; assignment: LearningMilestone["assignments"][number] }
    | { kind: "PRACTICE"; key: string; practice: LearningMilestone["practiceDays"][number] };

const isDone = (item: RouteItem) =>
    item.kind === "MODULE"
        ? item.courseModule.isCompleted
        : item.kind === "VIDEO"
            ? item.video.isCompleted
            : item.kind === "QUIZ"
                ? item.quiz.isCompleted
                : item.kind === "ASSIGNMENT"
                    ? item.assignment.isAccepted
                    : item.practice.isCompleted;

/**
 * One week of the course as a route: every lesson, quiz, assignment and
 * practice day a stop on a line, in the Module Manager's order, each module
 * named where its stops begin. The line fills in the brand colour as stops
 * are done, and the one being studied pulses — so where you are, and how far
 * you've come, is one glance down the sidebar.
 */
function WeekRoute({
    milestone,
    withAssignmentsAndPractice,
    slug,
    activeVideoId,
    goTo,
    activeAssignmentId,
    goToAssignment,
    activeQuizId,
    goToQuiz,
    bookmarkedVideoIds,
    onToggleRowBookmark,
}: {
    milestone: LearningMilestone;
    withAssignmentsAndPractice: boolean;
    slug: string;
    activeVideoId: string | null;
    goTo: (id: string) => void;
    activeAssignmentId: string | null;
    goToAssignment: (id: string) => void;
    activeQuizId: string | null;
    goToQuiz: (id: string) => void;
    bookmarkedVideoIds: Set<string>;
    onToggleRowBookmark: (videoId: string, bookmarked: boolean) => void;
}) {
    // The week in the order it was arranged in — a search only matches
    // lessons, so it leaves assignments and practice days out.
    const items: RouteItem[] = weekRows(milestone, withAssignmentsAndPractice).flatMap((row): RouteItem[] => {
        if (row.kind === "ASSIGNMENT") return [{ kind: "ASSIGNMENT", key: `ASSIGNMENT:${row.entry.id}`, assignment: row.entry }];
        if (row.kind === "PRACTICE") return [{ kind: "PRACTICE", key: `PRACTICE:${row.entry.id}`, practice: row.entry }];
        const courseModule = row.entry;
        return [
            { kind: "MODULE", key: `MODULE:${courseModule.id}`, courseModule },
            ...courseModule.videos.map((video): RouteItem => ({ kind: "VIDEO", key: `VIDEO:${video.id}`, video, courseModule })),
            ...(courseModule.quiz ? [{ kind: "QUIZ" as const, key: `QUIZ:${courseModule.quiz.id}`, quiz: courseModule.quiz }] : []),
        ];
    });

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
                        <div className="relative flex items-center gap-3 pb-1 pl-4 pr-4 pt-2.5">
                            <span className="relative z-10 grid size-6 shrink-0 place-items-center">
                                <span
                                    className={cn(
                                        "size-2.5 rotate-45 rounded-[3px] border-2",
                                        item.courseModule.isCompleted ? "border-primary bg-primary" : "border-border bg-card",
                                    )}
                                />
                            </span>
                            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground/80">
                                {String(item.courseModule.order).padStart(2, "0")}. {item.courseModule.title}
                            </p>
                            {item.courseModule.mode && (
                                <ClassModeTag mode={item.courseModule.mode} className="shrink-0 text-[0.6875rem] font-medium text-muted-foreground [&>svg]:size-3" />
                            )}
                            <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                                {item.courseModule.isLocked ? (
                                    <Lock className="size-3.5" />
                                ) : (
                                    `${item.courseModule.completedVideos}/${item.courseModule.totalVideos}`
                                )}
                            </span>
                        </div>
                    ) : item.kind === "VIDEO" ? (
                        (() => {
                            const { video, courseModule } = item;
                            const isActive = activeVideoId === video.id;
                            const isBookmarked = bookmarkedVideoIds.has(video.id);
                            return (
                                <div className={cn("relative flex items-center", isActive && "bg-primary/6")}>
                                    {isActive && <Marker />}
                                    <button
                                        type="button"
                                        disabled={courseModule.isLocked}
                                        onClick={() => goTo(video.id)}
                                        aria-current={isActive ? "true" : undefined}
                                        className={cn(
                                            rowClass,
                                            "flex-1 disabled:cursor-not-allowed disabled:opacity-60",
                                            isActive && "hover:bg-transparent",
                                        )}
                                    >
                                        <Stop
                                            state={courseModule.isLocked ? "locked" : isActive ? "active" : video.isCompleted ? "done" : "open"}
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
                                            {video.type === "VIDEO" ? video.durationLabel : video.type === "TEXT" ? "Read" : "Link"}
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
                    ) : item.kind === "QUIZ" ? (
                        <button
                            type="button"
                            onClick={() => goToQuiz(item.quiz.id)}
                            aria-current={activeQuizId === item.quiz.id ? "true" : undefined}
                            className={cn(rowClass, activeQuizId === item.quiz.id && activeRow)}
                        >
                            {activeQuizId === item.quiz.id && <Marker />}
                            <Stop
                                state={activeQuizId === item.quiz.id ? "active" : item.quiz.isCompleted ? "done" : "open"}
                                done={item.quiz.isCompleted}
                                icon={HelpCircle}
                            />
                            <span className="min-w-0 flex-1 truncate">Quiz: {item.quiz.title}</span>
                            {item.quiz.isCompleted && <Badge variant="success">{item.quiz.bestScore}%</Badge>}
                        </button>
                    ) : item.kind === "ASSIGNMENT" ? (
                        <button
                            type="button"
                            onClick={() => goToAssignment(item.assignment.id)}
                            aria-current={activeAssignmentId === item.assignment.id ? "true" : undefined}
                            className={cn(rowClass, activeAssignmentId === item.assignment.id && activeRow)}
                        >
                            {activeAssignmentId === item.assignment.id && <Marker />}
                            <Stop
                                state={
                                    activeAssignmentId === item.assignment.id
                                        ? "active"
                                        : item.assignment.isAccepted
                                            ? "done"
                                            : "open"
                                }
                                done={item.assignment.isAccepted}
                                icon={ClipboardCheck}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.assignment.title}</span>
                            {item.assignment.isAccepted ? (
                                <Badge variant="success">{item.assignment.score}</Badge>
                            ) : item.assignment.isSubmitted ? (
                                <Badge variant="secondary">Submitted</Badge>
                            ) : null}
                        </button>
                    ) : (
                        <Link href={`/learn/${slug}/practice/${item.practice.id}`} className={rowClass}>
                            <Stop state={item.practice.isCompleted ? "done" : "open"} done={item.practice.isCompleted} icon={Dumbbell} />
                            <span className="min-w-0 flex-1 truncate">{item.practice.title}</span>
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}

/**
 * The assignment brief and its submission box, swapped into the player pane
 * in place of the video — an assignment is just another piece of lesson
 * content, not a separate destination, so opening one never navigates away
 * from the course shell (header, sidebar, everything stays put).
 */
function AssignmentPane({ slug, assignmentId }: { slug: string; assignmentId: string }) {
    const queryClient = useQueryClient();
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [draft, setDraft] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["assignment", assignmentId],
        queryFn: () => assignmentService.get(assignmentId),
    });

    const submission = data?.submission ?? null;

    // One box in, one box out: the link and the notes are pre-joined here the
    // same way they're split apart on submit, so editing an existing attempt
    // doesn't drop either half of it.
    useEffect(() => {
        setDraft([submission?.submissionUrl, submission?.content].filter(Boolean).join("\n\n"));
        setDescriptionExpanded(false);
    }, [assignmentId, submission?.id, submission?.content, submission?.submissionUrl]);

    // A resubmission starts from the files already handed in; any can be taken off.
    const submittedFiles = submission?.fileUrls.join("\n") ?? "";
    useEffect(() => {
        setFiles(submittedFiles ? submittedFiles.split("\n").map(attachedFrom) : []);
    }, [assignmentId, submittedFiles]);

    const submit = useMutation({
        mutationFn: (content: string) => {
            const urlMatch = content.match(/https?:\/\/\S+/);
            const submissionUrl = urlMatch ? urlMatch[0].replace(/[.,;:!?)\]]+$/, "") : undefined;
            return assignmentService.submit(assignmentId, {
                content: content || undefined,
                submissionUrl,
                fileUrls: files.map((file) => file.url),
            });
        },
        onSuccess: () => {
            toast.success("Submitted — your mentor will review it shortly.");
            void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
            void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't submit your work.")),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Can&apos;t open this assignment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {getApiErrorMessage(error, "It may not be published yet.")}
                </p>
            </div>
        );
    }

    const statusMeta = submission ? SUBMISSION_STATUS_META[submission.status] : null;
    const description = data.description ?? "";
    const isLongDescription = description.length > 420;
    const shownDescription =
        !descriptionExpanded && isLongDescription ? `${description.slice(0, 420)}…` : description;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge>{data.totalMarks} marks</Badge>
                {/* Only while there's no submission yet — after that, what counts
                    is the mark the first submission fixed, shown below. */}
                {data.deadline && !submission && (
                    <Badge
                        variant={
                            data.window.status === "CLOSED"
                                ? "destructive"
                                : data.window.status === "LATE"
                                    ? "warning"
                                    : "secondary"
                        }
                    >
                        <Clock className="size-3" />
                        {data.window.status === "CLOSED"
                            ? "Submissions closed"
                            : data.window.status === "LATE"
                                ? `Late — out of ${data.window.maxScore} until ${formatDateTime(data.window.until!)}`
                                : `Due ${formatDateTime(data.deadline)}`}
                    </Badge>
                )}
                {statusMeta && <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-3 text-xl font-bold">{data.title}</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{shownDescription}</p>
                {isLongDescription && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-full"
                        onClick={() => setDescriptionExpanded((v) => !v)}
                    >
                        {descriptionExpanded ? "See less" : "See more"}
                    </Button>
                )}

                {data.deadline && data.lateTiers.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                        <h3 className="mb-2 font-semibold">Marking schedule</h3>
                        <ol className="space-y-1.5 text-sm">
                            {[
                                { key: "deadline", until: data.deadline, marks: data.totalMarks, current: data.window.status === "ON_TIME" },
                                ...data.lateTiers.map((tier) => ({
                                    key: tier.until,
                                    until: tier.until,
                                    marks: tier.maxMarks,
                                    current: data.window.status === "LATE" && data.window.until === tier.until,
                                })),
                            ].map((step) => (
                                <li
                                    key={step.key}
                                    aria-current={!submission && step.current ? "true" : undefined}
                                    className={cn(
                                        "flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2",
                                        !submission && step.current
                                            ? "bg-primary/10 font-medium text-primary"
                                            : "bg-secondary/40 text-muted-foreground",
                                    )}
                                >
                                    <span>Submitted by {formatDateTime(step.until)}</span>
                                    <span>
                                        out of {step.marks}
                                        {!submission && step.current ? " · now" : ""}
                                    </span>
                                </li>
                            ))}
                            <li className="px-3 text-xs text-muted-foreground">
                                After {formatDateTime(data.lateTiers[data.lateTiers.length - 1].until)}, submissions close.
                            </li>
                        </ol>
                    </div>
                )}

                {data.instructions && (
                    <div className="mt-4 border-t border-border pt-4">
                        <h3 className="mb-2 font-semibold">Instructions</h3>
                        <div
                            className="text-sm leading-relaxed text-muted-foreground"
                            // Escaped and link-restricted by renderLightMarkdown.
                            dangerouslySetInnerHTML={{ __html: renderLightMarkdown(data.instructions) }}
                        />
                    </div>
                )}

                {data.rubric?.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                        <h3 className="mb-2 font-semibold">How it&apos;s marked</h3>
                        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                            {data.rubric.map((line) => (
                                <li key={line.id} className="flex items-start justify-between gap-4 px-3 py-2">
                                    <span className="min-w-0">
                                        <span className="block font-medium">{line.title}</span>
                                        {line.description && <span className="block text-xs text-muted-foreground">{line.description}</span>}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">{line.maxPoints} marks</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.attachments.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                        <h3 className="mb-2 font-semibold">Attachments</h3>
                        <ul className="space-y-1.5">
                            {data.attachments.map((url, index) => (
                                <li key={url}>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                    >
                                        <FileText className="size-4" />
                                        Attachment {index + 1}
                                        <ExternalLink className="size-3" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* The assignment's own lessons — what to watch, read or open before
                submitting. Visible whenever the assignment is. */}
            {data.materials.length > 0 && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
                    <h2 className="font-semibold">
                        Lessons{" "}
                        <span className="font-normal text-muted-foreground">· {data.materials.length}</span>
                    </h2>
                    <ol className="space-y-5">
                        {data.materials.map((material, index) => (
                            <li key={material.id} className="space-y-2">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    {material.type === "VIDEO" ? (
                                        <PlayCircle className="size-4 text-primary" aria-hidden />
                                    ) : material.type === "TEXT" ? (
                                        <FileText className="size-4 text-primary" aria-hidden />
                                    ) : (
                                        <LinkIcon className="size-4 text-primary" aria-hidden />
                                    )}
                                    {material.title}
                                </p>
                                {material.description && (
                                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                                        {material.description}
                                    </p>
                                )}

                                {material.type === "VIDEO" && material.youtubeVideoId && (
                                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                                        <iframe
                                            src={`https://www.youtube-nocookie.com/embed/${material.youtubeVideoId}?rel=0&modestbranding=1`}
                                            title={material.title}
                                            loading="lazy"
                                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="size-full"
                                        />
                                    </div>
                                )}

                                {material.type === "TEXT" && material.content && (
                                    <div
                                        className="rounded-lg border border-border bg-secondary/20 p-4 text-[15px] leading-relaxed"
                                        // Escaped and link-restricted by renderLightMarkdown.
                                        dangerouslySetInnerHTML={{ __html: renderLightMarkdown(material.content) }}
                                    />
                                )}

                                {material.type === "RESOURCE" && material.resourceUrl && (
                                    <Button asChild variant="outline" size="sm">
                                        <a href={material.resourceUrl} target="_blank" rel="noopener noreferrer">
                                            Open resource · {hostnameOf(material.resourceUrl)}
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Mentor feedback, whenever a verdict exists. */}
            {submission?.reviewedAt && (
                <div
                    className={cn(
                        "rounded-xl border p-6 shadow-sm",
                        submission.status === "ACCEPTED"
                            ? "border-success/40 bg-success/5"
                            : "border-accent/40 bg-accent/5",
                    )}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 font-semibold">
                            <MessageSquare className="size-4" /> Mentor feedback
                        </h2>
                        {submission.score !== null && (
                            <span className="text-lg font-bold">
                                {submission.score}
                                <span className="text-sm font-normal text-muted-foreground">
                                    /{data.totalMarks}
                                    {submission.maxScore !== null && ` · late, marked out of ${submission.maxScore}`}
                                </span>
                            </span>
                        )}
                    </div>

                    {submission.feedback && (
                        <p className="mt-3 whitespace-pre-line text-sm">{submission.feedback}</p>
                    )}

                    {(submission.rubricScores?.length ?? 0) > 0 && (
                        <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60 bg-card/60 text-sm">
                            {data.rubric.map((line) => {
                                const given = submission.rubricScores?.find((score) => score.criterionId === line.id);
                                if (!given) return null;
                                return (
                                    <li key={line.id} className="px-3 py-2">
                                        <span className="flex items-baseline justify-between gap-4">
                                            <span className="font-medium">{line.title}</span>
                                            <span className="shrink-0 tabular-nums">
                                                <span className="font-semibold">{given.points}</span>
                                                <span className="text-muted-foreground"> / {line.maxPoints}</span>
                                            </span>
                                        </span>
                                        {given.comment && <span className="mt-0.5 block text-xs text-muted-foreground">{given.comment}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {submission.reviewedBy && (
                        <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                            <Avatar
                                src={submission.reviewedBy.image}
                                name={submission.reviewedBy.name}
                                size={28}
                            />
                            <span className="text-xs text-muted-foreground">
                                {submission.reviewedBy.name} · {formatDateTime(submission.reviewedAt)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Submission — a single box, the same way the reference platform
                takes a link and a description as one free-text paste rather
                than two separate form fields. */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 font-semibold">
                    {submission ? "Your submission" : "Submit your work"}
                </h2>

                {data.canSubmit ? (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!draft.trim() && files.length === 0) {
                                toast.error(
                                    "Add your work before submitting: paste a link, write an answer, or attach a file.",
                                );
                                return;
                            }
                            submit.mutate(draft.trim());
                        }}
                    >
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Paste your GitHub repo link, live demo link, and any notes for your mentor…"
                            rows={7}
                            maxLength={20_000}
                            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                        />

                        <SubmissionFiles assignmentId={assignmentId} files={files} onChange={setFiles} disabled={submit.isPending} />

                        {submission?.status === "NEEDS_REVISION" && (
                            <p className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm">
                                <RotateCcw className="mt-0.5 size-4 shrink-0" />
                                Resubmitting replaces your previous attempt and sends it back for review.
                                {submission.maxScore !== null
                                    ? ` It stays marked out of ${submission.maxScore}, as when you first submitted.`
                                    : " It's still marked out of the full total — a requested revision is never late."}
                            </p>
                        )}

                        {!submission && data.window.status === "LATE" && (
                            <p className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                The deadline has passed. Submit before {formatDateTime(data.window.until!)} and this
                                is marked out of {data.window.maxScore} instead of {data.totalMarks}.
                            </p>
                        )}

                        <Button type="submit" size="lg" isLoading={submit.isPending}>
                            {submission ? "Resubmit" : "Submit assignment"}
                        </Button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {submission?.status === "ACCEPTED" && (
                            <p className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                                <CheckCircle2 className="size-4" />
                                This assignment has been accepted — nothing more to do.
                            </p>
                        )}

                        {submission?.status === "SUBMITTED" && (
                            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                                Waiting for your mentor. You&apos;ll be notified when there&apos;s feedback.
                            </p>
                        )}

                        {submission?.status === "UNDER_REVIEW" && (
                            <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                                Your mentor has started reviewing this. You&apos;ll be notified when there&apos;s feedback.
                            </p>
                        )}

                        {submission?.content && (
                            <p className="whitespace-pre-line text-sm">{submission.content}</p>
                        )}

                        {submission && submission.fileUrls.length > 0 && (
                            <SubmissionFiles assignmentId={assignmentId} files={submission.fileUrls.map(attachedFrom)} onChange={() => {}} disabled />
                        )}

                        {submission && (
                            <p className="text-xs text-muted-foreground">
                                Submitted {formatDateTime(submission.submittedAt)}
                                {submission.maxScore !== null &&
                                    ` · late, so marked out of ${submission.maxScore} of ${data.totalMarks}`}
                            </p>
                        )}

                        {!submission && data.window.status === "CLOSED" && (
                            <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertTriangle className="size-4" />
                                {data.lateTiers.length > 0
                                    ? "Submissions have closed — the last late window has passed."
                                    : "The deadline passed before you submitted."}{" "}
                                Talk to your mentor in a support session.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
