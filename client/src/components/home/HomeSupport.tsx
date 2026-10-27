"use client";

import { CheckCircle2, Loader2, MessageSquare, Mic, MonitorUp, MousePointer2, PhoneOff, Play, Video, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { cn } from "@/lib/utils";
import { LIVE_SHARE } from "./content";

/**
 * The story's beats, and how long each holds: the learner asks, the mentor
 * points at the bug and explains, the learner types the fix, runs it, the
 * output comes out right and they say thanks — then a breath, and again.
 */
const BEATS = [2600, 3200, 1500, 1100, 3000, 1200] as const;
const ASK = 0;
const HINT = 1;
const TYPING = 2;
const RUNNING = 3;
const SOLVED = 4;

/* The code around the changing line (line 6). English, like real code. */
const BEFORE = ["#include <iostream>", "using namespace std;", "", "int main() {", "    int n = 5;"];
const AFTER = ['        cout << i << " ";', "    }", "    return 0;", "}"];

/** The call has been going a few minutes when the visitor arrives. */
const CALL_STARTED_AT = 4 * 60 + 12;

const bnClock = (seconds: number) => {
    const two = (value: number) => value.toLocaleString("bn-BD", { minimumIntegerDigits: 2 });
    return `${two(Math.floor(seconds / 60))}:${two(seconds % 60)}`;
};

/**
 * A support session acted out as a video call — an illustration of how one
 * feels (real sessions are on Google Meet): the call's bar with its running
 * clock and "your screen is being shared", the learner's shared editor, the
 * two people on the call with a level meter on whoever is talking, live
 * captions of what's said, and the call's buttons. The learner asks why the
 * loop runs once too often; the mentor's pointer circles the `<=` and they
 * explain; the learner types `<`, presses Run, and the output comes out
 * right. Beside it, how a session works in three plain steps. It loops on
 * its own, rests while pointed at, and with reduced motion asked for shows
 * the solved state.
 */
export default function HomeSupport() {
    const [beat, setBeat] = useState(0);
    const [still, setStill] = useState(false);
    const [paused, setPaused] = useState(false);
    const [seconds, setSeconds] = useState(CALL_STARTED_AT);
    const { call } = LIVE_SHARE;

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setStill(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (still || paused) return;
        const timer = window.setTimeout(() => setBeat((current) => (current + 1) % BEATS.length), BEATS[beat]);
        return () => window.clearTimeout(timer);
    }, [beat, still, paused]);

    // The call's clock keeps running, as a real call's does, even while the story rests.
    useEffect(() => {
        if (still) return;
        const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
        return () => window.clearInterval(timer);
    }, [still]);

    const step = still ? SOLVED : beat;
    const pointing = step >= HINT && step <= RUNNING;
    const fixed = step >= TYPING && step <= SOLVED;
    const speaker = step === ASK || step === SOLVED ? "you" : step === HINT ? "mentor" : null;
    const caption =
        step === ASK
            ? { from: "you" as const, text: call.captions.ask }
            : step === HINT || step === TYPING
              ? { from: "mentor" as const, text: call.captions.hint }
              : step === SOLVED
                ? { from: "you" as const, text: call.captions.thanks }
                : null;

    return (
        <Section tone="dark" labelledBy="home-support-title">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14">
                <div>
                    <SectionHeader id="home-support-title" eyebrow={LIVE_SHARE.eyebrow} title={LIVE_SHARE.title} description={LIVE_SHARE.description} className="mb-8 sm:mb-8" />
                    <ol className="space-y-4">
                        {LIVE_SHARE.points.map((point, index) => (
                            <li key={point.title} className="flex gap-4">
                                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-editor-line bg-editor-panel font-mono text-sm text-syn-keyword">
                                    {(index + 1).toLocaleString("bn-BD")}
                                </span>
                                <div>
                                    <p className="font-semibold">{point.title}</p>
                                    <p className="mt-0.5 text-sm text-editor-muted">{point.text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <div
                    aria-hidden
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    className="overflow-hidden rounded-panel border border-editor-line bg-editor-panel shadow-[0_32px_80px_-30px_rgb(0_0_0/0.8)]"
                >
                    {/* The call's bar: live, how long, and what's being shared. */}
                    <div className="flex items-center justify-between gap-3 border-b border-editor-line px-4 py-2.5 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-editor-fg">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inset-0 animate-ping rounded-full bg-syn-tag/70 motion-reduce:animate-none" />
                                <span className="relative size-2 rounded-full bg-syn-tag" />
                            </span>
                            <span className="truncate">{call.title}</span>
                            <span className="font-mono font-normal tabular-nums text-editor-muted">{bnClock(seconds)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-syn-string/15 px-2.5 py-1 font-medium text-syn-string">
                            <MonitorUp className="size-3.5" />
                            <span className="hidden sm:inline">{call.sharing}</span>
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_9.5rem]">
                        {/* The shared screen: the learner's editor, framed the way a shared screen is. */}
                        <div className="min-w-0 overflow-hidden rounded-md border-2 border-syn-string/50 bg-editor">
                            <div className="flex items-center gap-2 border-b border-editor-line bg-editor-panel px-3 py-1.5 text-[0.7rem] text-editor-muted">
                                <span className="flex gap-1">
                                    <span className="size-2 rounded-full bg-syn-tag/60" />
                                    <span className="size-2 rounded-full bg-syn-number/60" />
                                    <span className="size-2 rounded-full bg-syn-string/60" />
                                </span>
                                <span className="ml-1">{call.screen}</span>
                                <span
                                    className={cn(
                                        "ml-auto flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-semibold transition-[color,background-color,scale] duration-200",
                                        step === RUNNING ? "scale-95 bg-syn-string text-editor" : "bg-editor-raised text-editor-muted",
                                    )}
                                >
                                    <Play className="size-2.5 fill-current" /> Run
                                </span>
                            </div>

                            <ol className="code-lines overflow-hidden py-3 font-mono text-[0.74rem] leading-6 sm:text-[0.8rem]">
                                {BEFORE.map((line, index) => (
                                    <li key={index} className="whitespace-pre pl-11 pr-3">
                                        {line || " "}
                                    </li>
                                ))}
                                <li className={cn("whitespace-pre pl-11 pr-3 transition-colors duration-500", fixed ? "bg-syn-string/10" : "bg-syn-tag/10")}>
                                    {"    "}
                                    {call.line.head}
                                    <span className="relative inline-block">
                                        <span className={cn(fixed ? "text-syn-string" : "squiggle text-syn-tag [text-decoration-color:var(--syn-tag)]")}>
                                            {fixed ? call.line.fix : call.line.bug}
                                        </span>
                                        {step === TYPING && <span className="caret text-syn-string" />}
                                        {/* The mentor's ring around the bug… */}
                                        <span
                                            className={cn(
                                                "absolute -inset-x-1.5 -inset-y-0.5 rounded-sm border-2 border-syn-keyword transition-[opacity,scale] duration-500",
                                                pointing ? "scale-100 opacity-100" : "scale-150 opacity-0",
                                            )}
                                        />
                                        {/* …and their pointer, gliding in to it. */}
                                        <span
                                            className={cn(
                                                "absolute left-1/2 top-full z-10 flex items-start gap-0.5 transition-[opacity,translate] duration-700 ease-out",
                                                pointing ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-24 translate-y-10 opacity-0",
                                            )}
                                        >
                                            <MousePointer2 className="size-4 fill-syn-keyword text-syn-keyword" />
                                            <span className="mt-3 rounded-sm bg-syn-keyword px-1.5 py-0.5 font-sans text-[0.62rem] font-semibold text-editor">{call.mentor}</span>
                                        </span>
                                    </span>
                                    {call.line.tail}
                                </li>
                                {AFTER.map((line, index) => (
                                    <li key={index} className="whitespace-pre pl-11 pr-3">
                                        {line}
                                    </li>
                                ))}
                            </ol>

                            <div className="flex items-center gap-2 border-t border-editor-line bg-editor-panel px-3 py-2.5 text-[0.75rem]">
                                <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-editor-gutter">Output</span>
                                <span
                                    key={step === RUNNING ? "running" : step === SOLVED ? "right" : "wrong"}
                                    className={cn(
                                        "flex items-center gap-1.5 animate-in fade-in duration-300 motion-reduce:animate-none",
                                        step === SOLVED ? "text-syn-string" : step === RUNNING ? "text-editor-muted" : "text-syn-tag",
                                    )}
                                >
                                    {step === RUNNING ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : step === SOLVED ? (
                                        <CheckCircle2 className="size-3.5" />
                                    ) : (
                                        <XCircle className="size-3.5" />
                                    )}
                                    {step === RUNNING ? call.output.running : step === SOLVED ? call.output.right : call.output.wrong}
                                </span>
                            </div>
                        </div>

                        {/* The people on the call. */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
                            <Person name={call.mentor} initial={call.initials.mentor} who="mentor" speaking={speaker === "mentor"} />
                            <Person name={call.you} initial={call.initials.you} who="you" speaking={speaker === "you"} />
                        </div>
                    </div>

                    {/* Live captions of what's being said. */}
                    <div className="mx-3 flex min-h-[3.6rem] items-center rounded-md bg-black/45 px-3.5 py-2 text-[0.82rem] leading-snug">
                        {caption && (
                            <p key={caption.text} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                                <span className={cn("mr-1.5 font-semibold", caption.from === "mentor" ? "text-syn-keyword" : "text-syn-func")}>
                                    {caption.from === "mentor" ? call.mentor : call.you}:
                                </span>
                                <span className="text-editor-fg">{caption.text}</span>
                            </p>
                        )}
                    </div>

                    {/* The call's buttons, decoration. */}
                    <div className="flex items-center justify-center gap-2.5 px-4 py-3">
                        <CallButton icon={Mic} />
                        <CallButton icon={Video} />
                        <CallButton icon={MonitorUp} active />
                        <CallButton icon={MessageSquare} />
                        <CallButton icon={PhoneOff} danger />
                    </div>
                </div>
            </div>
        </Section>
    );
}

/** Someone on the call: a tile with their initial, a ring and a level meter while they talk. */
function Person({ name, initial, who, speaking }: { name: string; initial: string; who: "you" | "mentor"; speaking: boolean }) {
    return (
        <div
            className={cn(
                "relative grid aspect-video place-items-center overflow-hidden rounded-md border-2 bg-linear-to-br to-editor transition-colors duration-300",
                who === "mentor" ? "from-syn-keyword/30" : "from-syn-func/25",
                speaking ? "border-syn-string" : "border-transparent",
            )}
        >
            <span className="relative grid size-11 place-items-center">
                {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-syn-string/30 motion-reduce:animate-none" />}
                <span
                    className={cn(
                        "relative grid size-11 place-items-center rounded-full text-lg font-bold text-editor",
                        who === "mentor" ? "bg-syn-keyword" : "bg-syn-func",
                    )}
                >
                    {initial}
                </span>
            </span>
            <span className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-sm bg-black/40 px-1.5 py-0.5 text-[0.65rem] font-semibold text-editor-fg">
                {speaking ? <Level /> : <Mic className="size-3 text-editor-muted" />}
                {name}
            </span>
        </div>
    );
}

/** A speaker's level meter: three bars bouncing. */
function Level() {
    return (
        <span className="flex h-3 items-end gap-[2px]">
            {[0, 0.25, 0.12].map((delay) => (
                <span
                    key={delay}
                    className="h-full w-[3px] origin-bottom rounded-full bg-syn-string animate-[eq_0.8s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}s` }}
                />
            ))}
        </span>
    );
}

function CallButton({ icon: Icon, active, danger }: { icon: LucideIcon; active?: boolean; danger?: boolean }) {
    return (
        <span
            className={cn(
                "grid h-9 place-items-center rounded-full",
                danger ? "w-12 bg-syn-tag text-editor" : active ? "w-9 bg-syn-string/20 text-syn-string" : "w-9 bg-editor-raised text-editor-fg",
            )}
        >
            <Icon className="size-4" />
        </span>
    );
}
