import { THUMBNAIL_CHIP } from "@/components/shared/courseCardParts";
import { Badge } from "@/components/ui/badge";
import type { Choice } from "@/components/ui/choice-cards";
import {
    CLASS_MODES,
    COURSE_DELIVERIES,
    COURSE_MODES,
    COURSE_PHASES,
    COURSE_PRICINGS,
    DELIVERY_META,
    hasVenue,
    MODE_META,
    PHASE_META,
    PRICING_META,
} from "@/lib/courseClassification";
import { cn } from "@/lib/utils";
import type { ClassMode, CourseDelivery, CourseMode, CoursePhase, CoursePricing } from "@/types/api.types";

/**
 * How a course's classification shows: a phase's dot, the chip on a card's
 * thumbnail, the delivery line, the course page's three pills and the
 * consoles' badges. Words and colours come from `lib/courseClassification`.
 */

/** The phase's marker. `pulse` for a running course where it heads a section — once per screen, not per card. */
export function PhaseDot({ phase, pulse = false, className }: { phase: CoursePhase; pulse?: boolean; className?: string }) {
    return (
        <span aria-hidden className={cn("relative flex size-1.5 shrink-0", className)}>
            {pulse && phase === "PRESENT" && (
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
            )}
            <span className={cn("relative size-full rounded-full", PHASE_META[phase].dot)} />
        </span>
    );
}

/** On a card's thumbnail: ongoing, upcoming or previous. */
export function CoursePhaseChip({ phase, className }: { phase: CoursePhase; className?: string }) {
    return (
        <span className={cn(THUMBNAIL_CHIP, "gap-1.5", PHASE_META[phase].text, className)}>
            <PhaseDot phase={phase} />
            {PHASE_META[phase].card}
        </span>
    );
}

/**
 * Online or offline, and how the classes are delivered, on one line:
 * "Offline · Live classes". The icon is the mode's — a pin for in person.
 */
export function CourseDeliveryTag({
    delivery,
    mode,
    className,
}: {
    delivery: CourseDelivery;
    mode?: CourseMode | null;
    className?: string;
}) {
    const { icon: Icon } = mode ? MODE_META[mode] : DELIVERY_META[delivery];
    return (
        <p className={cn("flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground/80", className)}>
            <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
                {mode && <span className={cn(hasVenue(mode) && "font-semibold text-foreground")}>{MODE_META[mode].label} · </span>}
                {DELIVERY_META[delivery].label}
            </span>
        </p>
    );
}

/**
 * Where one module or outline item happens, on a course that runs both:
 * "Online", or "Offline" with a pin and a little more weight — the one a
 * student has to travel for.
 */
export function ClassModeTag({ mode, className }: { mode: ClassMode; className?: string }) {
    const { icon: Icon, label } = MODE_META[mode];
    return (
        <span className={cn("inline-flex items-center gap-1", mode === "OFFLINE" && "font-semibold text-foreground", className)}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label}
        </span>
    );
}

/**
 * The course page's facts, in Bangla, as mono tags on the hero's editor
 * surface: "● চলমান কোর্স · অনলাইন কোর্স · লাইভ + রেকর্ডেড ক্লাস · ফ্রি কোর্স" —
 * and the venue of a course with offline classes, when it has one.
 */
export function CourseClassPills({
    phase,
    delivery,
    pricing,
    mode,
    venue,
    className,
}: {
    phase: CoursePhase;
    /** Null only on a draft nobody has classified yet — that pill is left out. */
    delivery: CourseDelivery | null;
    pricing: CoursePricing | null;
    mode?: CourseMode | null;
    venue?: string | null;
    className?: string;
}) {
    const DeliveryIcon = delivery ? DELIVERY_META[delivery].icon : null;
    const ModeIcon = mode ? MODE_META[mode].icon : null;
    const pill = "inline-flex items-center gap-1.5 rounded-sm border border-editor-line bg-editor-panel px-2.5 py-1 text-sm text-editor-fg";

    return (
        <ul lang="bn" aria-label="কোর্সের ধরন" className={cn("flex flex-wrap gap-2", className)}>
            <li className={pill}>
                <PhaseDot phase={phase} pulse className={cn(phase === "PREVIOUS" && "[&>span]:bg-editor-muted")} />
                {PHASE_META[phase].bn}
            </li>
            {mode && ModeIcon && (
                <li className={pill}>
                    <ModeIcon className="size-3.5 text-syn-func" aria-hidden />
                    {MODE_META[mode].bn}
                    {hasVenue(mode) && venue && <span className="text-editor-muted">· {venue}</span>}
                </li>
            )}
            {delivery && DeliveryIcon && (
                <li className={pill}>
                    <DeliveryIcon className="size-3.5 text-syn-keyword" aria-hidden />
                    {DELIVERY_META[delivery].bn}
                </li>
            )}
            {pricing && <li className={cn(pill, pricing === "FREE" && "border-syn-string/40 text-syn-string")}>{PRICING_META[pricing].bn}</li>}
        </ul>
    );
}

/** In the consoles: the phase, and optionally the delivery, online/offline and free/paid, as badges. */
export function CourseClassBadges({
    phase,
    delivery,
    pricing,
    mode,
    lang = "en",
    className,
}: {
    phase: CoursePhase;
    /** Pass what the course has; `null` (not set yet) shows as "Needs setup". */
    delivery?: CourseDelivery | null;
    pricing?: CoursePricing | null;
    mode?: CourseMode | null;
    lang?: "en" | "bn";
    className?: string;
}) {
    const phaseMeta = PHASE_META[phase];
    const unset = delivery === null || pricing === null || mode === null;
    const DeliveryIcon = delivery ? DELIVERY_META[delivery].icon : null;
    const ModeIcon = mode ? MODE_META[mode].icon : null;

    return (
        <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
            <Badge variant={phaseMeta.badge} title={lang === "bn" ? phaseMeta.hintBn : phaseMeta.hint}>
                <PhaseDot phase={phase} />
                {lang === "bn" ? phaseMeta.adminBn : phaseMeta.admin}
            </Badge>
            {delivery && DeliveryIcon && (
                <Badge variant="outline">
                    <DeliveryIcon className="size-3" aria-hidden />
                    {lang === "bn" ? DELIVERY_META[delivery].bn : DELIVERY_META[delivery].short}
                </Badge>
            )}
            {mode && ModeIcon && (
                <Badge variant="outline">
                    <ModeIcon className="size-3" aria-hidden />
                    {lang === "bn" ? MODE_META[mode].bn : MODE_META[mode].short}
                </Badge>
            )}
            {pricing && (
                <Badge variant={pricing === "FREE" ? "success" : "outline"}>
                    {lang === "bn" ? PRICING_META[pricing].bn : PRICING_META[pricing].label}
                </Badge>
            )}
            {unset && (
                <Badge
                    variant="warning"
                    title={
                        lang === "bn"
                            ? "ফ্রি না পেইড, ক্লাস কীভাবে হবে বা অনলাইন না অফলাইন এখনো ঠিক করা হয়নি। এগুলো ছাড়া প্রকাশ করা যাবে না।"
                            : "Free or paid, class delivery or online/offline isn't set yet. It can't be published until it is."
                    }
                >
                    {lang === "bn" ? "সেটআপ বাকি" : "Needs setup"}
                </Badge>
            )}
        </span>
    );
}

/** The three decisions as `ChoiceCards` options, each with what it means — in the console's language. */
export const phaseChoices = (lang: "en" | "bn" = "en"): Choice[] =>
    COURSE_PHASES.map((value) => ({
        value,
        label: lang === "bn" ? PHASE_META[value].adminBn : PHASE_META[value].admin,
        description: lang === "bn" ? PHASE_META[value].hintBn : PHASE_META[value].hint,
        marker: <PhaseDot phase={value} className="size-2" />,
    }));

export const pricingChoices = (lang: "en" | "bn" = "en"): Choice[] =>
    COURSE_PRICINGS.map((value) => ({
        value,
        label: lang === "bn" ? PRICING_META[value].bn : PRICING_META[value].label,
        description: lang === "bn" ? PRICING_META[value].hintBn : PRICING_META[value].hint,
        icon: PRICING_META[value].icon,
    }));

export const deliveryChoices = (lang: "en" | "bn" = "en"): Choice[] =>
    COURSE_DELIVERIES.map((value) => ({
        value,
        label: lang === "bn" ? DELIVERY_META[value].bn : DELIVERY_META[value].label,
        description: lang === "bn" ? DELIVERY_META[value].hintBn : DELIVERY_META[value].hint,
        icon: DELIVERY_META[value].icon,
    }));

export const modeChoices = (lang: "en" | "bn" = "en"): Choice[] =>
    COURSE_MODES.map((value) => ({
        value,
        label: lang === "bn" ? MODE_META[value].bn : MODE_META[value].label,
        description: lang === "bn" ? MODE_META[value].hintBn : MODE_META[value].hint,
        icon: MODE_META[value].icon,
    }));

/** Online or offline for one module or outline item, as `RadioGroup` options — the editors speak English. */
export const classModeOptions = () =>
    CLASS_MODES.map((value) => ({ value, label: MODE_META[value].label, description: MODE_META[value].hint }));
