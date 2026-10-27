import CourseOverviewMotion from "@/components/shared/CourseOverviewMotion";
import { emphasiseLatin } from "@/lib/scriptEmphasis";

/** Longer than this, an opening paragraph is body copy, not a lead to set large. */
const LEAD_MAX_LENGTH = 320;

/**
 * The course overview on the course page and its admin preview, set like a
 * README's opening: a short first paragraph becomes the lead, large, behind a
 * violet rule like a markdown quote; the paragraphs after it are body copy,
 * with their English terms in the stronger ink (`emphasiseLatin`). Paragraphs
 * are split on blank lines, as the admin typed them.
 */
export default function CourseOverview({
    overview,
    animate = false,
}: {
    overview: string;
    /** Plays `CourseOverviewMotion`'s entrance. Off in the admin preview,
     *  which scrolls inside its own panel rather than the window. */
    animate?: boolean;
}) {
    const paragraphs = overview
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    const [first = "", ...rest] = paragraphs;
    const lead = first.length <= LEAD_MAX_LENGTH ? first.replace(/\s*\n\s*/g, " ") : null;
    const body = lead ? rest : paragraphs;

    const content = (
        <div className="max-w-3xl space-y-5">
            {lead && (
                <p data-overview-lead className="text-pretty border-l-2 border-primary pl-5 text-xl leading-[1.7] text-foreground sm:text-[1.3rem]">
                    {lead}
                </p>
            )}
            {body.map((paragraph, index) => (
                <p
                    key={index}
                    data-overview-body
                    className="whitespace-pre-line text-[0.9375rem] leading-[1.8] text-muted-foreground"
                >
                    {emphasiseLatin(paragraph, "text-foreground")}
                </p>
            ))}
        </div>
    );

    return animate ? <CourseOverviewMotion>{content}</CourseOverviewMotion> : content;
}
