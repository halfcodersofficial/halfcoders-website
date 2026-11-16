"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  Binary,
  BrainCircuit,
  CodeXml,
  FileUser,
  Flag,
  GraduationCap,
  Handshake,
  Layers,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import CtaButton from "@/components/site/CtaButton";
import SectionHeader from "@/components/site/SectionHeader";
import { SETTLE } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { CAREER, type CareerIcon } from "./content";

const ICONS: Record<CareerIcon, LucideIcon> = {
  foundation: CodeXml,
  dsa: Binary,
  fullstack: Layers,
  ai: BrainCircuit,
  portfolio: FileUser,
  branding: Megaphone,
  interview: Handshake,
};

/** Where the road "is" on screen, as a share of the viewport's height: the spine fills to this line as the page scrolls. */
const LINE = 0.7;

/** Tablets up, where the cards zigzag (matches `.career-road` in globals.css). */
const ZIGZAG = "(min-width: 48rem)";

const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * The road from a first line of code to a developer job, in seven steps
 * (CAREER in content.ts), on a soft lavender ground with dot paper.
 *
 * From tablets up the step cards zigzag down a dashed spine in the middle —
 * one on the left, the next on the right, half a card lower, so they
 * interleave — each tied to the spine by its marker (the step's icon in a
 * ring of its colour) and a short dashed line. On a phone the same road is a
 * timeline down the left edge. Each card wears a bar of its step's colour
 * down its left side, the step number large, what the step is in Bangla and
 * English, the skills, and the published courses that help with it — or, for
 * a step no course covers yet, that plainly. The road ends at the goal, and
 * a note says the courses may cover part of a step, not all of it.
 *
 * Motion: the spine's dashes drift slowly downward (CSS) and fill in the
 * steps' colours as the page scrolls; each card slides in from its own side
 * as it arrives, its marker popping onto the spine. Rendered complete, so
 * without JavaScript or with reduced motion asked for it is simply the whole
 * road, standing still.
 */
export default function HomeCareer() {
  const roadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const road = roadRef.current;
    if (!road) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const at = `${LINE * 100}%`;
      const fill = road.querySelector("[data-career-fill]");
      const list = road.querySelector("[data-career-list]");
      if (fill && list) {
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: list,
              start: `top ${at}`,
              end: `bottom ${at}`,
              scrub: 0.6,
            },
          },
        );
      }

      const zigzag = window.matchMedia(ZIGZAG).matches;
      const finish: (() => void)[] = [];
      road
        .querySelectorAll<HTMLElement>("[data-career-step]")
        .forEach((step) => {
          // One already on screen at load is left as it is.
          if (step.getBoundingClientRect().top < window.innerHeight * 0.85)
            return;

          const card = step.querySelector("[data-career-card]");
          const marker = step.querySelector("[data-career-marker]");
          const fromX = zigzag
            ? step.dataset.side === "right"
              ? 36
              : step.dataset.side === "left"
                ? -36
                : 0
            : 0;
          const timeline = gsap.timeline({
            paused: true,
            defaults: { ease: "power3.out" },
          });
          if (card)
            timeline.from(card, {
              autoAlpha: 0,
              x: fromX,
              y: zigzag && fromX !== 0 ? 0 : 20,
              duration: 0.7,
              ...SETTLE,
            });
          if (marker)
            timeline.from(
              marker,
              { scale: 0, duration: 0.45, ease: "back.out(2.4)", ...SETTLE },
              0.1,
            );
          const tags = step.querySelectorAll("[data-career-tag]");
          if (tags.length > 0)
            timeline.from(
              tags,
              { autoAlpha: 0, y: 6, duration: 0.3, stagger: 0.04, ...SETTLE },
              0.3,
            );

          ScrollTrigger.create({
            trigger: step,
            start: "top 85%",
            once: true,
            onEnter: () => void timeline.play(),
          });
          finish.push(() => void timeline.progress(1));
        });

      return () => finish.forEach((done) => done());
    });

    return () => media.revert();
  }, []);

  return (
    <section
      aria-labelledby="home-career-title"
      className="career section relative overflow-hidden"
    >
      <div
        aria-hidden
        className="career-ground pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="career-dots pointer-events-none absolute inset-0"
      />
      {/* A few faint glyphs at the edges, for the code the road is made of. */}
      <div
        aria-hidden
        lang="en"
        className="pointer-events-none absolute inset-0 hidden select-none font-mono font-bold text-primary/[0.07] lg:block"
      >
        <span className="absolute left-[5%] top-[18%] text-7xl">{"{ }"}</span>
        <span className="absolute right-[6%] top-[34%] text-6xl">{"</>"}</span>
        <span className="absolute left-[7%] top-[62%] text-6xl">{"=>"}</span>
        <span className="absolute right-[8%] top-[82%] text-7xl">{"[ ]"}</span>
      </div>

      <div className="container-page relative">
        <SectionHeader
          id="home-career-title"
          eyebrow={CAREER.eyebrow}
          align="center"
          className="mx-auto max-w-3xl [&>div]:max-w-3xl"
          title={CAREER.title.map((part, index) =>
            part.kind === "tag" ? (
              <span
                key={index}
                lang="en"
                className="selected-text whitespace-nowrap text-primary-ink"
              >
                {part.text}
              </span>
            ) : part.kind === "mark" ? (
              <span key={index} className="text-primary-ink">
                {part.text}
              </span>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
          description={CAREER.description}
        />

        <div
          ref={roadRef}
          className="career-road mx-auto mt-4 max-w-6xl sm:mt-8"
        >
          <div className="relative">
            <div aria-hidden className="career-spine">
              <span data-career-fill className="career-spine-fill" />
            </div>
            <ol data-career-list className="career-list">
              {CAREER.steps.map((step, index) => {
                const Icon = ICONS[step.icon];
                const number = pad2(index + 1);
                const side = index % 2 === 0 ? "left" : "right";
                const style = {
                  "--row": index + 1,
                  "--step": `var(--career-${index + 1})`,
                } as CSSProperties;
                return (
                  <li
                    key={step.icon}
                    data-career-step
                    data-side={side}
                    className="career-item"
                    style={style}
                  >
                    <span aria-hidden className="career-connector" />
                    <span
                      aria-hidden
                      data-career-marker
                      className="career-marker"
                    >
                      <Icon className="size-5" />
                    </span>

                    <article
                      data-career-card
                      className="career-card p-5 pl-6 sm:p-6 sm:pl-7"
                    >
                      {/* The step's number, large, with a dashed rule running off from it. */}
                      <div className="flex items-end gap-3">
                        <p
                          lang="en"
                          className="leading-none"
                          style={{ color: "var(--step)" }}
                        >
                          <span className="block font-mono text-[0.68rem] font-semibold tracking-[0.2em] opacity-75">
                            {CAREER.stepLabel}
                          </span>
                          <span className="mt-1 block font-heading text-4xl font-bold tracking-tight sm:text-5xl">
                            {number}
                          </span>
                        </p>
                        <span
                          aria-hidden
                          className="mb-2 h-0 flex-1 border-t-2 border-dashed opacity-30"
                          style={{ borderColor: "var(--step)" }}
                        />
                      </div>

                      <h3 className="mt-4 text-lg font-semibold leading-snug text-balance sm:text-xl">
                        <span className="sr-only">ধাপ {index + 1}: </span>
                        {step.title}
                      </h3>
                      <p
                        lang="en"
                        className="mt-1 font-mono text-xs text-muted-foreground"
                      >
                        {step.en}
                      </p>
                      <p className="mt-3 leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>

                      <ul
                        className="mt-4 flex flex-wrap gap-1.5"
                        aria-label="যা শিখবেন"
                      >
                        {step.tags.map((tag) => (
                          <li
                            key={tag}
                            lang="en"
                            data-career-tag
                            className="career-tag rounded-sm px-2 py-0.5 font-mono text-[0.72rem]"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-5 border-t border-dashed border-border pt-4">
                        {step.courses.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <GraduationCap className="size-3.5" aria-hidden />
                              {CAREER.coursesLabel}
                            </span>
                            {step.courses.map((course) => (
                              <Link
                                key={course.slug}
                                href={`/courses/${course.slug}`}
                                lang="en"
                                className="career-course inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 text-xs font-semibold"
                              >
                                {course.name}
                                <ArrowUpRight className="size-3" aria-hidden />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="size-3.5" aria-hidden />
                            {CAREER.noCourse}
                          </p>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* The goal: where the road ends. */}
          <div data-career-step data-side="center" className="career-goal">
            <span aria-hidden data-career-marker className="career-marker">
              <Flag className="size-5" />
            </span>
            <div data-career-card className="md:pt-16">
              <div
                className={cn(
                  "inline-flex flex-col rounded-card border border-border bg-card px-5 py-3 shadow-card md:items-center",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {CAREER.goal.label}
                </span>
                <span
                  lang="en"
                  className="mt-0.5 bg-linear-to-r from-(--career-1) to-(--career-7) bg-clip-text font-mono text-base font-bold text-transparent sm:text-lg"
                >
                  {`<${CAREER.goal.title} />`}
                </span>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:mx-auto">
                {CAREER.note}
              </p>
              <div className="mt-6">
                <CtaButton kind="courses" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
