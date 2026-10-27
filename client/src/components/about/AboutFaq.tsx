"use client";

import { ChevronRight, MessageCircle, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Section from "@/components/site/Section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAQ } from "./content";
import { DocHeading } from "./paper";

/** How long "typing…" shows before an answer arrives. */
const TYPING_MS = 900;

/**
 * Questions about Half Coders itself, answered as a chat. The questions sit
 * in a column like quick replies; pick one and, on wide screens, it's asked
 * in the chat window beside them — someone types for a moment, then the
 * answer arrives. On a phone the answer opens right under the question
 * instead. Under the chat, the way to ask anything else. With reduced motion
 * asked for, answers arrive without the typing.
 */
export default function AboutFaq() {
    const { chat, support, items } = FAQ;
    const [active, setActive] = useState(0);
    const [typing, setTyping] = useState(false);
    const still = useRef(true);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => void (still.current = media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        if (!typing) return;
        const timer = window.setTimeout(() => setTyping(false), TYPING_MS);
        return () => window.clearTimeout(timer);
    }, [typing, active]);

    const ask = (index: number) => {
        if (index === active) return;
        setActive(index);
        setTyping(!still.current);
    };

    const current = items[active];

    return (
        <Section tone="surface" id="faq" labelledBy="about-faq-title">
            <DocHeading id="about-faq-title" title={FAQ.title} lead={FAQ.description} />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
                <ul className="space-y-2.5">
                    {items.map((item, index) => {
                        const picked = index === active;
                        return (
                            <li key={item.q}>
                                <button
                                    type="button"
                                    onClick={() => ask(index)}
                                    aria-pressed={picked}
                                    aria-controls="about-faq-answer"
                                    className={cn(
                                        "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-5 py-3.5 text-left font-medium transition-[background-color,border-color,color,translate,box-shadow] duration-200",
                                        picked
                                            ? "border-primary bg-primary text-primary-foreground shadow-[0_14px_28px_-16px_var(--primary)] lg:translate-x-2"
                                            : "border-border bg-card hover:border-primary/40 hover:text-primary lg:hover:translate-x-1",
                                    )}
                                >
                                    <MessageCircleQuestion className="size-4.5 shrink-0 opacity-70" aria-hidden />
                                    <span className="flex-1">{item.q}</span>
                                    <ChevronRight
                                        className={cn(
                                            "size-4 shrink-0 opacity-60 transition-transform duration-200",
                                            picked ? "rotate-90 lg:rotate-0" : "group-hover:translate-x-0.5",
                                        )}
                                        aria-hidden
                                    />
                                </button>
                                {/* On a phone, the answer opens right under its question. */}
                                {picked && (
                                    <p className="mx-2 mt-2 rounded-2xl rounded-tl-sm border border-border bg-card px-5 py-4 leading-relaxed text-foreground/85 animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none lg:hidden">
                                        {item.a}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {/* The chat window (wide screens). */}
                <div className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
                    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_30px_60px_-34px_rgb(21_17_42/0.45)]">
                        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                            <span
                                lang="en"
                                className="relative grid size-10 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground"
                            >
                                {chat.us}
                                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
                            </span>
                            <span>
                                <span className="block font-semibold">{chat.title}</span>
                                <span className="block text-xs text-muted-foreground">{chat.status}</span>
                            </span>
                        </div>

                        <div id="about-faq-answer" aria-live="polite" className="relative min-h-[21rem] space-y-4 px-5 py-6">
                            <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-50" />
                            <div
                                key={`q-${active}`}
                                className="relative flex justify-end animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none"
                            >
                                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
                                    <span className="mb-0.5 block text-[0.7rem] font-semibold opacity-75">{chat.you}</span>
                                    {current.q}
                                </p>
                            </div>
                            <div className="relative flex items-end gap-2.5">
                                <span
                                    lang="en"
                                    aria-hidden
                                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[0.7rem] font-bold text-primary"
                                >
                                    {chat.us}
                                </span>
                                {typing ? (
                                    <p
                                        aria-hidden
                                        className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3.5"
                                    >
                                        {[0, 0.15, 0.3].map((delay) => (
                                            <span
                                                key={delay}
                                                className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                                                style={{ animationDelay: `${delay}s` }}
                                            />
                                        ))}
                                    </p>
                                ) : (
                                    <p
                                        key={`a-${active}`}
                                        className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 leading-relaxed text-foreground/85 shadow-card animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
                                    >
                                        {current.a}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/60 px-5 py-4">
                            <p className="text-sm text-muted-foreground">{support.text}</p>
                            <Button asChild variant="brand" size="sm">
                                <Link href={support.href} lang="en">
                                    <MessageCircle aria-hidden /> {support.cta}
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* On a phone, the way to ask anything else sits under the questions. */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 lg:hidden">
                    <p className="text-sm text-muted-foreground">{support.text}</p>
                    <Button asChild variant="brand" size="sm">
                        <Link href={support.href} lang="en">
                            <MessageCircle aria-hidden /> {support.cta}
                        </Link>
                    </Button>
                </div>
            </div>
        </Section>
    );
}
