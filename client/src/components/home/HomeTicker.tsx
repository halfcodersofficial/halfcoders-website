import { TICKER } from "./content";

/* The topics take the syntax colours in turn. */
const TONES = ["text-syn-keyword", "text-syn-func", "text-syn-string", "text-syn-number", "text-syn-tag"];

/**
 * What Half Coders teaches, scrolling past under the hero like a long line of
 * code: one copy, then a second that takes its place, so the loop never
 * jumps. It pauses under the pointer and stands still with reduced motion
 * asked for. Screen readers get the list once; the second copy is hidden.
 */
export default function HomeTicker() {
    return (
        <div className="overflow-hidden border-b border-border bg-surface [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            <ul lang="en" aria-label="What you can learn" className="flex w-max animate-ticker hover:[animation-play-state:paused] motion-reduce:animate-none">
                {[...TICKER, ...TICKER].map((topic, index) => (
                    <li
                        key={`${topic}-${index}`}
                        aria-hidden={index >= TICKER.length || undefined}
                        className="flex items-center gap-5 py-3.5 pl-5 font-mono text-sm"
                    >
                        <span className={TONES[index % TONES.length]}>{topic}</span>
                        <span aria-hidden className="text-border-strong">
                            {"/"}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
