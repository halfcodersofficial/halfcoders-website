"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { Bell, Mail, Megaphone, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import RowActions from "@/components/admin/RowActions";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchRow } from "@/components/ui/switch";
import { useSession } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { staffCourseRoutes, type StaffArea } from "@/lib/staffRoutes";
import { cn, formatDateTime } from "@/lib/utils";
import { textField } from "@/lib/validation";
import { announcementService } from "@/services";
import type { CourseAnnouncement } from "@/types/domain.types";

const schema = z.object({
    title: textField({ label: "Title", min: 3, max: 160 }),
    body: textField({ label: "Message", min: 3, max: 5000 }),
    isPinned: z.boolean(),
});

/** A post longer than this is folded on the board, with "Read all" to open it. */
const LONG_POST = 360;

const dayOf = (iso: string) => {
    const date = new Date(iso);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEEE");
    return format(date, "d MMMM yyyy");
};

/** The unpinned posts, newest first, under one heading per day. */
const byDay = (posts: CourseAnnouncement[]) =>
    posts.reduce<{ day: string; posts: CourseAnnouncement[] }[]>((groups, post) => {
        const day = dayOf(post.createdAt);
        const last = groups.at(-1);
        if (last?.day === day) last.posts.push(post);
        else groups.push({ day, posts: [post] });
        return groups;
    }, []);

/**
 * A course's notice board, for its staff: write to everyone on the course —
 * each student is notified, and emailed if they take emails — then pin, edit
 * or take down what's there. Edits aren't sent again. Mounted by both
 * consoles; `area` keeps links inside the one it's in.
 *
 * The composer sits beside the board on a wide screen (above it on a narrow
 * one) and redraws the post as a student will meet it while it's written.
 */
export default function AnnouncementsBoard({ courseId, area, courseTitle }: { courseId: string; area: StaffArea; courseTitle?: string }) {
    const queryClient = useQueryClient();
    const routes = staffCourseRoutes(area, courseId);
    const [editing, setEditing] = useState<CourseAnnouncement | null>(null);
    const key = ["staff", "announcements", courseId];

    const list = useQuery({ queryKey: key, queryFn: () => announcementService.forCourse(courseId) });
    const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

    const change = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Partial<z.infer<typeof schema>> }) => announcementService.update(id, patch),
        onSuccess: (_, { patch }) => {
            if (patch.isPinned !== undefined) toast.success(patch.isPinned ? "Pinned to the top." : "Unpinned.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change that.")),
    });
    const remove = useMutation({
        mutationFn: (id: string) => announcementService.remove(id),
        onSuccess: () => {
            toast.success("Taken down.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't take that down.")),
    });

    const askRemove = async (announcement: CourseAnnouncement) => {
        const ok = await confirmAction({
            title: `Take down “${announcement.title}”?`,
            text: "It goes from the course's board. Students who were notified keep the notification.",
            confirmText: "Take it down",
        });
        if (ok) remove.mutate(announcement.id);
    };

    const announcements = list.data ?? [];
    const pinned = announcements.filter((post) => post.isPinned);
    const days = byDay(announcements.filter((post) => !post.isPinned));

    const postActions = (post: CourseAnnouncement) => ({
        onPin: () => change.mutate({ id: post.id, patch: { isPinned: !post.isPinned } }),
        onEdit: () => setEditing(post),
        onRemove: () => void askRemove(post),
        pinning: change.isPending && change.variables?.id === post.id,
    });

    return (
        <div className={cn("@container space-y-6", area === "mentor" ? "container-page py-8" : "max-w-7xl")}>
            {area === "admin" && <BackButton href={routes.overview} label="Back to the course" />}
            <header className="max-w-3xl">
                {courseTitle && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{courseTitle}</p>}
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Announcements</h2>
                <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                    Write to everyone on the course. Each student is notified here and by email (unless they&apos;ve turned email off), and it stays on the
                    course&apos;s board for anyone who joins later.
                </p>
            </header>

            <div className="grid grid-cols-1 items-start gap-6 @5xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] @7xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
                <Composer courseId={courseId} onPosted={refresh} />

                <section aria-labelledby="board-title" className="min-w-0 space-y-5">
                    <div className="flex items-baseline justify-between gap-3">
                        <h3 id="board-title" className="text-lg font-semibold tracking-tight">
                            On the board
                        </h3>
                        {announcements.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {announcements.length} {announcements.length === 1 ? "post" : "posts"}
                                {pinned.length > 0 && ` · ${pinned.length} pinned`}
                            </p>
                        )}
                    </div>

                    {list.isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                        </div>
                    ) : list.isError ? (
                        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                            {getApiErrorMessage(list.error, "Couldn't load the board.")}{" "}
                            <button type="button" onClick={() => list.refetch()} className="font-medium text-primary hover:underline">
                                Try again
                            </button>
                        </p>
                    ) : announcements.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-primary">
                                <Megaphone className="size-5" aria-hidden />
                            </span>
                            <p className="mt-4 font-semibold">Nothing posted yet</p>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                                Your first announcement goes to every student on the course, and stays here for anyone who joins later.
                            </p>
                        </div>
                    ) : (
                        <>
                            {pinned.length > 0 && (
                                <div className="space-y-2.5">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                                        <Pin className="size-3.5" aria-hidden /> Pinned
                                    </p>
                                    <ol className="space-y-3">
                                        {pinned.map((post) => (
                                            <li key={post.id}>
                                                <PostCard post={post} {...postActions(post)} />
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {days.map((group) => (
                                <div key={group.day} className="space-y-2.5">
                                    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {group.day}
                                        <span aria-hidden className="h-px flex-1 bg-border" />
                                    </p>
                                    <ol className="space-y-3">
                                        {group.posts.map((post) => (
                                            <li key={post.id}>
                                                <PostCard post={post} {...postActions(post)} />
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </>
                    )}
                </section>
            </div>

            <EditModal announcement={editing} onClose={() => setEditing(null)} onSaved={refresh} />
        </div>
    );
}

/** Writing a new post, with the post as a student will see it underneath. */
function Composer({ courseId, onPosted }: { courseId: string; onPosted: () => void }) {
    const { user } = useSession();
    const post = useMutation({
        mutationFn: (values: z.infer<typeof schema>) => announcementService.create(courseId, values),
        onSuccess: (created) => {
            toast.success(
                created.recipients
                    ? `Posted — ${created.recipients} ${created.recipients === 1 ? "student has" : "students have"} been told.`
                    : "Posted. Nobody's on the course yet, so nobody was told.",
            );
            form.reset({ title: "", body: "", isPinned: false });
            onPosted();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't post that. Try again.")),
    });
    const form = useZodForm({ schema, initialValues: { title: "", body: "", isPinned: false }, onSubmit: (values) => post.mutate(values) });
    const { title, body, isPinned } = form.values;
    const written = Boolean(title.trim() || body.trim());

    return (
        <section aria-labelledby="compose-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm @5xl:sticky @5xl:top-6">
            <form noValidate onSubmit={form.handleSubmit}>
                <div className="space-y-4 p-5 sm:p-6">
                    <h3 id="compose-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        New announcement
                    </h3>
                    <FormField form={form} name="title" label="Title" required counterMax={160}>
                        <Input placeholder="e.g. Friday's class moves to 8 pm" autoComplete="off" />
                    </FormField>
                    <FormField form={form} name="body" label="Message" required counterMax={5000}>
                        <Textarea rows={5} placeholder="What students need to know, and what to do about it…" />
                    </FormField>
                    <SwitchRow
                        checked={isPinned}
                        onCheckedChange={(next) => form.setValue("isPinned", next)}
                        label="Pin to the top"
                        description={isPinned ? "Stays first on the board until you unpin it." : "Takes its place by date."}
                    />
                </div>

                <div className="border-t border-border bg-surface/70 p-5 sm:p-6">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">How students see it</p>
                    <article
                        aria-hidden
                        className={cn(
                            "mt-2.5 rounded-xl border bg-card p-4 transition-opacity",
                            isPinned ? "border-primary/40" : "border-border",
                            !written && "opacity-60",
                        )}
                    >
                        {isPinned && (
                            <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">
                                <Pin className="size-3" /> Pinned
                            </p>
                        )}
                        <p className={cn("font-semibold leading-snug", !title.trim() && "text-muted-foreground")}>{title.trim() || "Your title"}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Avatar src={user?.image ?? null} name={user?.name ?? "You"} size={16} />
                            <span className="font-medium text-foreground/80">{user?.name ?? "You"}</span>
                            <span>· just now</span>
                        </p>
                        <p className={cn("mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed", !body.trim() && "text-muted-foreground")}>
                            {body.trim() || "Your message shows here as you write it."}
                        </p>
                    </article>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <Bell className="size-3.5" aria-hidden /> Notified
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Mail className="size-3.5" aria-hidden /> Emailed
                            </span>
                        </p>
                        <Button type="submit" isLoading={post.isPending} className="max-sm:w-full">
                            {!post.isPending && <Send />} Post to the course
                        </Button>
                    </div>
                </div>
            </form>
        </section>
    );
}

interface PostCardProps {
    post: CourseAnnouncement;
    onPin: () => void;
    onEdit: () => void;
    onRemove: () => void;
    pinning: boolean;
}

/** One post on the board: who and when, the words (folded when long), and pin / edit / take down at hand. */
function PostCard({ post, onPin, onEdit, onRemove, pinning }: PostCardProps) {
    const [open, setOpen] = useState(false);
    const long = post.body.length > LONG_POST || post.body.split("\n").length > 6;
    const edited = post.updatedAt !== post.createdAt;

    return (
        <article
            className={cn(
                "group relative rounded-2xl border bg-card p-5 shadow-sm transition-colors sm:p-6",
                post.isPinned ? "border-primary/40" : "border-border",
            )}
        >
            {post.isPinned && <span aria-hidden className="absolute inset-y-5 left-0 w-0.5 rounded-full bg-primary sm:inset-y-6" />}
            <div className="flex items-start gap-3">
                <Avatar src={post.author.image} name={post.author.name} size={36} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{post.author.name}</p>
                    <p className="text-xs text-muted-foreground">
                        <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
                            {formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true })}
                        </time>
                        {edited && <span title={`Edited ${formatDateTime(post.updatedAt)}`}> · edited</span>}
                    </p>
                </div>
                <div className="-mr-2 -mt-1 flex shrink-0 items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("w-9 px-0", post.isPinned && "text-primary")}
                        onClick={onPin}
                        disabled={pinning}
                        aria-label={post.isPinned ? `Unpin ${post.title}` : `Pin ${post.title} to the top`}
                        title={post.isPinned ? "Unpin" : "Pin to the top"}
                    >
                        {post.isPinned ? <PinOff /> : <Pin />}
                    </Button>
                    <RowActions
                        label={`More for ${post.title}`}
                        items={[
                            { label: "Edit", icon: Pencil, onSelect: onEdit },
                            { label: "Take down", icon: Trash2, destructive: true, separatorBefore: true, onSelect: onRemove },
                        ]}
                    />
                </div>
            </div>

            <h4 className="mt-4 text-base font-semibold leading-snug sm:text-lg">{post.title}</h4>
            <p className={cn("mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85", long && !open && "line-clamp-5")}>{post.body}</p>
            {long && (
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                    aria-expanded={open}
                >
                    {open ? "Show less" : "Read all"}
                </button>
            )}
        </article>
    );
}

/** Fixes a post in place — nobody is told again. */
function EditModal({ announcement, onClose, onSaved }: { announcement: CourseAnnouncement | null; onClose: () => void; onSaved: () => void }) {
    return (
        <Modal
            open={announcement !== null}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            title="Edit announcement"
            description="Fixes it on the board. Students aren't notified again."
            closeOnOutsideClick={false}
        >
            {announcement && <EditForm announcement={announcement} onClose={onClose} onSaved={onSaved} />}
        </Modal>
    );
}

function EditForm({ announcement, onClose, onSaved }: { announcement: CourseAnnouncement; onClose: () => void; onSaved: () => void }) {
    const save = useMutation({
        mutationFn: (values: z.infer<typeof schema>) => announcementService.update(announcement.id, values),
        onSuccess: () => {
            toast.success("Saved.");
            onSaved();
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save that.")),
    });
    const form = useZodForm({
        schema,
        initialValues: { title: announcement.title, body: announcement.body, isPinned: announcement.isPinned },
        onSubmit: (values) => save.mutate(values),
    });
    return (
        <form noValidate onSubmit={form.handleSubmit} className={modalFormClass}>
            <ModalBody className="space-y-4">
                <FormField form={form} name="title" label="Title" required counterMax={160}>
                    <Input />
                </FormField>
                <FormField form={form} name="body" label="Message" required counterMax={5000}>
                    <Textarea rows={8} />
                </FormField>
                <SwitchRow
                    checked={form.values.isPinned}
                    onCheckedChange={(next) => form.setValue("isPinned", next)}
                    label="Pin to the top"
                    description="Stays first on the board until you unpin it."
                />
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending} disabled={!form.isDirty}>
                    Save changes
                </Button>
            </ModalFooter>
        </form>
    );
}
