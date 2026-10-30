import { cn, formatBDT, formatDate } from "@/lib/utils";
import type { AdminCoupon } from "@/types/admin.types";

/*
 * Words and states for a coupon, shared by the list, its page and the form's
 * preview, so a code reads the same everywhere an admin meets it.
 */

export type CouponState = "active" | "full" | "used-up" | "scheduled" | "expired" | "off";

export const COUPON_STATE: Record<CouponState, { label: string; tone: "success" | "warning" | "default" | "secondary"; dot: string; hint: string }> = {
    active: { label: "Usable now", tone: "success", dot: "bg-success", hint: "Students can apply it." },
    full: { label: "Held by buyers", tone: "warning", dot: "bg-warning", hint: "Every use left is held by a student paying right now; one comes back if they don't pay." },
    "used-up": { label: "Used up", tone: "secondary", dot: "bg-muted-foreground", hint: "Every use has been paid for." },
    scheduled: { label: "Not open yet", tone: "default", dot: "bg-primary", hint: "Opens on its start date." },
    expired: { label: "Expired", tone: "secondary", dot: "bg-muted-foreground", hint: "Its end date has passed." },
    off: { label: "Switched off", tone: "secondary", dot: "bg-muted-foreground", hint: "Nobody can apply it." },
};

export const couponState = (coupon: AdminCoupon, now = Date.now()): CouponState =>
    !coupon.isActive
        ? "off"
        : coupon.startsAt && new Date(coupon.startsAt).getTime() > now
          ? "scheduled"
          : coupon.endsAt && new Date(coupon.endsAt).getTime() < now
            ? "expired"
            : coupon.maxRedemptions !== null && coupon.used >= coupon.maxRedemptions
              ? "used-up"
              : coupon.maxRedemptions !== null && coupon.used + coupon.held >= coupon.maxRedemptions
                ? "full"
                : "active";

/** The big figure on the ticket: "25%" or "৳500". */
export const offFigure = (coupon: Pick<AdminCoupon, "kind" | "value">) => (coupon.kind === "PERCENT" ? `${coupon.value}%` : formatBDT(coupon.value));

/** "25% off, up to ৳1,500" / "৳500 off". */
export const offText = (coupon: Pick<AdminCoupon, "kind" | "value" | "maxDiscount">) =>
    coupon.kind === "PERCENT"
        ? `${coupon.value}% off${coupon.maxDiscount !== null ? `, up to ${formatBDT(coupon.maxDiscount)}` : ""}`
        : `${formatBDT(coupon.value)} off`;

/** "Any course", the one course's name, or "3 courses". */
export const scopeText = (coupon: Pick<AdminCoupon, "allCourses" | "courses">) =>
    coupon.allCourses ? "Any course" : coupon.courses.length === 1 ? coupon.courses[0].title : `${coupon.courses.length} courses`;

/** "Once per student", "Up to 3 per student", "No limit per student". */
export const perStudentText = (limit: number | null) =>
    limit === null ? "No limit per student" : limit === 1 ? "Once per student" : `Up to ${limit} per student`;

/** "Any time", "Until 30 Nov", "From 1 Nov", "1 Nov – 30 Nov". */
export const windowText = (coupon: Pick<AdminCoupon, "startsAt" | "endsAt">) =>
    coupon.startsAt && coupon.endsAt
        ? `${formatDate(coupon.startsAt)} – ${formatDate(coupon.endsAt)}`
        : coupon.startsAt
          ? `From ${formatDate(coupon.startsAt)}`
          : coupon.endsAt
            ? `Until ${formatDate(coupon.endsAt)}`
            : "Any time";

/**
 * The link to hand out: it opens the course (for a one-course code) or the
 * catalogue with the code saved, and checkout applies it by itself.
 */
export const couponLink = (coupon: Pick<AdminCoupon, "code" | "allCourses" | "courses">) => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const one = !coupon.allCourses && coupon.courses.length === 1 ? coupon.courses[0] : null;
    return `${origin}${one ? `/courses/${one.slug}` : "/courses"}?coupon=${encodeURIComponent(coupon.code)}`;
};

/** A friendly code from the label's first word: "Eden Mohila…" → "EDEN-7KQ3". Letters that read alike are left out. */
export const generateCode = (label: string) => {
    const word = label.trim().split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "HALFCODE";
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const random = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => alphabet[n % alphabet.length]).join("");
    return `${word}-${random}`;
};

/**
 * How much of the code is gone: paid uses solid, uses held by students paying
 * now lighter, against its limit — or just the count when it has none.
 */
export function CouponUsage({ coupon, className }: { coupon: Pick<AdminCoupon, "used" | "held" | "maxRedemptions">; className?: string }) {
    const { used, held, maxRedemptions: max } = coupon;
    if (max === null) {
        return (
            <p className={cn("text-xs text-muted-foreground", className)}>
                <span className="font-semibold tabular-nums text-foreground">{used.toLocaleString("en-US")}</span> used · no limit
                {held > 0 && <span> · {held} paying now</span>}
            </p>
        );
    }
    const usedShare = Math.min(100, (used / max) * 100);
    const heldShare = Math.min(100 - usedShare, (held / max) * 100);
    return (
        <div className={className}>
            <div
                className="flex h-1.5 overflow-hidden rounded-full bg-secondary"
                role="img"
                aria-label={`${used} of ${max} used${held ? `, ${held} held by students paying` : ""}`}
            >
                <span className="h-full bg-primary" style={{ width: `${usedShare}%` }} />
                <span className="h-full bg-primary/35" style={{ width: `${heldShare}%` }} />
            </div>
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                <span>
                    <span className="font-semibold tabular-nums text-foreground">{used.toLocaleString("en-US")}</span> of {max.toLocaleString("en-US")} used
                    {held > 0 && <span> · {held} paying now</span>}
                </span>
                <span className="tabular-nums">{Math.max(0, max - used - held).toLocaleString("en-US")} left</span>
            </p>
        </div>
    );
}

/** The ticket's stub: the figure, big, on navy — and its cap under it. */
export function CouponStub({ coupon, className }: { coupon: Pick<AdminCoupon, "kind" | "value" | "maxDiscount">; className?: string }) {
    return (
        <div className={cn("grid shrink-0 place-content-center bg-primary-950 px-4 py-5 text-center text-white", className)}>
            <p className="text-3xl font-bold leading-none tabular-nums tracking-tight">{offFigure(coupon)}</p>
            <p className="mt-1.5 text-[0.6875rem] font-semibold font-mono uppercase tracking-[0.2em] text-lilac-400">off</p>
            {coupon.kind === "PERCENT" && coupon.maxDiscount !== null && (
                <p className="mt-1 text-[0.6875rem] text-white/70">up to {formatBDT(coupon.maxDiscount)}</p>
            )}
        </div>
    );
}
