"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Copyright, NotebookPen, ThumbsDown, ThumbsUp } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import LessonQuestions from "@/components/learn/LessonQuestions";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { Button } from "@/components/ui/button";
import { infoAlert } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { lessonService } from "@/services";
import type { LessonReaction, LessonState, LessonTarget } from "@/types/domain.types";

export type LessonPanel = "notes" | "copyright";

const NOTE_MAX = 10_000;

/** The cache key for one lesson's own state — shared by everything that shows it. */
export const lessonStateKey = (lesson: LessonTarget | null) => ["lesson-state", lesson?.kind ?? null, lesson?.id ?? null] as const;

/**
 * A student's own layer on a lesson — a module's or a practice day's: their
 * note, bookmark and like/dislike, read once and shared by whatever shows
 * them (the bar under the lesson, the shortcuts in the page header).
 */
export function useLessonState(lesson: LessonTarget | null, courseId: string | undefined, enabled: boolean) {
    const queryClient = useQueryClient();

    const { data: state } = useQuery({
        queryKey: lessonStateKey(lesson),
        queryFn: () => lessonService.state(lesson!),
        enabled: enabled && Boolean(lesson),
    });

    const saveNote = useMutation({
        mutationFn: ({ target, content }: { target: LessonTarget; content: string }) => lessonService.saveNote(target, content),
        onSuccess: (_result, { target }) => {
            toast.success("Note saved.");
            void queryClient.invalidateQueries({ queryKey: lessonStateKey(target) });
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your note.")),
    });

    // Optimistic: a toggle should feel instant, and the invalidate-and-refetch
    // this still triggers is what makes the number of clicks and the number of
    // rows in the database agree once the round trip actually lands.
    const setBookmark = useMutation({
        mutationFn: ({ target, bookmarked }: { target: LessonTarget; bookmarked: boolean }) => lessonService.setBookmark(target, bookmarked),
        onMutate: async ({ target, bookmarked }) => {
            const key = lessonStateKey(target);
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<LessonState>(key);
            queryClient.setQueryData<LessonState | undefined>(key, (current) => (current ? { ...current, isBookmarked: bookmarked } : current));
            return { previous };
        },
        onSuccess: (result) => {
            toast.success(result.isBookmarked ? "Lesson bookmarked." : "Bookmark removed.");
            if (courseId) void queryClient.invalidateQueries({ queryKey: ["lesson-bookmarks", courseId] });
        },
        onError: (error, { target }, context) => {
            if (context) queryClient.setQueryData(lessonStateKey(target), context.previous);
            toast.error(getApiErrorMessage(error, "Couldn't update your bookmark."));
        },
        onSettled: (_result, _error, { target }) => void queryClient.invalidateQueries({ queryKey: lessonStateKey(target) }),
    });

    const setReaction = useMutation({
        mutationFn: ({ target, reaction }: { target: LessonTarget; reaction: LessonReaction | null }) => lessonService.setReaction(target, reaction),
        onMutate: async ({ target, reaction }) => {
            const key = lessonStateKey(target);
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<LessonState>(key);
            queryClient.setQueryData<LessonState | undefined>(key, (current) => (current ? { ...current, reaction } : current));
            return { previous };
        },
        onError: (error, { target }, context) => {
            if (context) queryClient.setQueryData(lessonStateKey(target), context.previous);
            toast.error(getApiErrorMessage(error, "Couldn't save your reaction."));
        },
        onSettled: (_result, _error, { target }) => void queryClient.invalidateQueries({ queryKey: lessonStateKey(target) }),
    });

    return { state, saveNote, setBookmark, setReaction };
}

export type LessonStateApi = ReturnType<typeof useLessonState>;

/**
 * Everything under a lesson: the Notes / Copyright switch, a bookmark and a
 * like/dislike, the panel they switch — the student's notes in the text
 * editor, or the copyright notice — and the lesson's questions.
 */
export default function LessonExtras({
    lesson,
    api,
    panel,
    onPanelChange,
    copyright,
}: {
    lesson: LessonTarget;
    api: LessonStateApi;
    panel: LessonPanel;
    onPanelChange: (panel: LessonPanel) => void;
    /** What the Copyright tab shows. */
    copyright: ReactNode;
}) {
    const { state, saveNote, setBookmark, setReaction } = api;
    const [draft, setDraft] = useState("");
    const saved = state?.note ?? "";
    const reaction = state?.reaction ?? null;

    // A new lesson, or the saved note arriving: the box shows what's saved.
    useEffect(() => setDraft(state?.note ?? ""), [state?.note, lesson.kind, lesson.id]);

    // A reaction is a one-shot vote, not a toggle — once given it can't be
    // changed to the other option or cleared, so a repeat click just
    // explains why instead of silently doing nothing.
    const react = (next: LessonReaction) => {
        if (reaction) {
            void infoAlert({ title: "You've already given feedback", text: "Your like/dislike on this lesson can't be changed." });
            return;
        }
        setReaction.mutate({ target: lesson, reaction: next });
    };

    const unsaved = draft.trim() !== saved.trim();

    return (
        <>
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
                            aria-selected={panel === id}
                            aria-controls="lesson-panel"
                            onClick={() => onPanelChange(id)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                                panel === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Icon className={cn("size-4", panel === id && "text-primary")} />
                            {label}
                        </button>
                    ))}
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setBookmark.mutate({ target: lesson, bookmarked: !state?.isBookmarked })}
                    isLoading={setBookmark.isPending}
                    aria-pressed={state?.isBookmarked ?? false}
                    className={cn("rounded-full", state?.isBookmarked && "bg-primary/10 text-primary hover:bg-primary/15")}
                >
                    {state?.isBookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                    {state?.isBookmarked ? "Bookmarked" : "Bookmark"}
                </Button>

                <span className="ml-auto flex items-center gap-1 rounded-full bg-secondary p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Like this lesson"
                        aria-pressed={reaction === "LIKE"}
                        className={cn("size-8 rounded-full", reaction === "LIKE" && "bg-success/15 text-success")}
                        onClick={() => react("LIKE")}
                    >
                        <ThumbsUp className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Dislike this lesson"
                        aria-pressed={reaction === "DISLIKE"}
                        className={cn("size-8 rounded-full", reaction === "DISLIKE" && "bg-destructive/15 text-destructive")}
                        onClick={() => react("DISLIKE")}
                    >
                        <ThumbsDown className="size-4" />
                    </Button>
                </span>
            </div>

            {/* The panel the Notes / Copyright tabs switch. */}
            <div id="lesson-panel" role="tabpanel" aria-labelledby={`lesson-tab-${panel}`} className="scroll-mt-32">
                {panel === "copyright" ? (
                    copyright
                ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-card">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                                <NotebookPen className="size-4 text-primary" aria-hidden /> Your notes
                            </p>
                            <p className="text-xs text-muted-foreground">Only you can see these.</p>
                        </div>

                        <div className="p-3">
                            <RichTextEditor
                                value={draft}
                                onChange={setDraft}
                                maxLength={NOTE_MAX}
                                height="18rem"
                                placeholder="Write your note here — what clicked, what to look at again…"
                                previewLabel="Preview"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-secondary/30 px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                                {unsaved ? (
                                    <span className="font-medium text-warning-ink">Not saved yet</span>
                                ) : state?.noteUpdatedAt ? (
                                    `Last saved ${formatDateTime(state.noteUpdatedAt)}`
                                ) : (
                                    "Not saved yet"
                                )}
                                <span className="tabular-nums">
                                    {" "}
                                    · {draft.length.toLocaleString()} / {NOTE_MAX.toLocaleString()}
                                </span>
                            </p>
                            <Button
                                size="sm"
                                className="rounded-full px-5"
                                onClick={() => saveNote.mutate({ target: lesson, content: draft })}
                                isLoading={saveNote.isPending}
                                disabled={!unsaved && !saveNote.isPending}
                            >
                                Save note
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <LessonQuestions lesson={lesson} />
        </>
    );
}
