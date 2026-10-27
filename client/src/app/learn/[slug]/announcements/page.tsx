"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, Megaphone, Pin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import { announcementService } from "@/services";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/**
 * A course's notice board, for its students: what its mentors posted, pinned
 * posts first. A notification links straight to its post (`#id`), which is
 * brought into view and marked.
 */
export default function CourseAnnouncementsPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: ["learning", slug, "announcements"],
        queryFn: () => announcementService.forLearner(slug),
    });

    // The post a notification pointed at.
    const [target, setTarget] = useState<string | null>(null);
    useEffect(() => {
        const read = () => setTarget(window.location.hash.slice(1) || null);
        read();
        window.addEventListener("hashchange", read);
        return () => window.removeEventListener("hashchange", read);
    }, []);
    useEffect(() => {
        if (target && data) document.getElementById(target)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [target, data]);

    if (isLoading) {
        return (
            <div className="container-page max-w-3xl space-y-4 py-10">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-2/3" />
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="grid min-h-[70dvh] place-items-center px-4">
                <div className="max-w-md text-center">
                    <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
                        <Lock className="size-6" />
                    </span>
                    <h1 className="text-xl font-bold">Can&apos;t open this course</h1>
                    <p className="mt-2 text-muted-foreground">Enrol in this course to see its announcements.</p>
                    <Button asChild className="mt-6 rounded-full px-6">
                        <Link href={`/courses/${slug}`}>View course details</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const { course, announcements } = data;

    return (
        <div className="container-page max-w-3xl space-y-8 py-8 sm:py-10">
            <header className={RISE}>
                <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="size-4" aria-hidden /> Back to the course
                </Link>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">{course.title}</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Announcements</h1>
                <p className="mt-2 text-muted-foreground">What your mentors have posted for the course. New ones also reach your notifications.</p>
            </header>

            {announcements.length === 0 ? (
                <div className={cn(RISE, "delay-100 rounded-3xl border border-dashed border-border px-6 py-14 text-center")}>
                    <Megaphone className="mx-auto size-7 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-semibold">Nothing posted yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">When your mentors post something for the course, it shows up here.</p>
                </div>
            ) : (
                <ol className="space-y-4">
                    {announcements.map((announcement, index) => (
                        <li
                            key={announcement.id}
                            id={announcement.id}
                            style={{ animationDelay: `${Math.min(index, 6) * 60 + 80}ms` }}
                            className={cn(
                                RISE,
                                "scroll-mt-24 rounded-2xl border bg-card p-5 shadow-sm transition-shadow sm:p-6",
                                announcement.isPinned ? "border-primary/40" : "border-border",
                                target === announcement.id && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
                            )}
                        >
                            {announcement.isPinned && (
                                <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">
                                    <Pin className="size-3" aria-hidden /> Pinned
                                </p>
                            )}
                            <h2 className="text-lg font-semibold leading-snug">{announcement.title}</h2>
                            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                                <Avatar src={announcement.author.image} name={announcement.author.name} size={20} />
                                <span className="font-medium text-foreground/80">{announcement.author.name}</span>
                                <span aria-hidden>·</span>
                                <time dateTime={announcement.createdAt}>{formatDateTime(announcement.createdAt)}</time>
                            </p>
                            <p className="mt-4 whitespace-pre-line leading-relaxed">{announcement.body}</p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
