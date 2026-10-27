import type { AdminBundle, AdminPromoCourse } from "@/types/admin.types";

/** Where a bundle stands for a student today, in the order an admin would fix them. */
export type BundleState = "selling" | "off" | "scheduled" | "expired" | "not-ready" | "unpriced";

export const BUNDLE_STATE: Record<BundleState, { label: string; tone: "success" | "warning" | "default" | "secondary"; dot: string; hint: string }> = {
    unpriced: { label: "Not priced yet", tone: "warning", dot: "bg-warning", hint: "Set its price or discount — until then it can't be switched on." },
    selling: { label: "On sale", tone: "success", dot: "bg-success", hint: "Students can buy it now." },
    scheduled: { label: "Not open yet", tone: "default", dot: "bg-primary", hint: "Goes on sale when its window opens." },
    expired: { label: "Ended", tone: "secondary", dot: "bg-muted-foreground", hint: "Its window has closed." },
    "not-ready": { label: "Not on sale", tone: "warning", dot: "bg-warning", hint: "A course in it isn't published, so it's hidden." },
    off: { label: "Switched off", tone: "secondary", dot: "bg-muted-foreground", hint: "Hidden, and nobody can buy it." },
};

/** A seeded bundle starts with neither a price nor a discount. */
export const isPriced = (bundle: Pick<AdminBundle, "pricing" | "price" | "discountPercent">) =>
    bundle.pricing === "FIXED" ? bundle.price !== null : bundle.discountPercent !== null;

export const bundleState = (bundle: AdminBundle, now = Date.now()): BundleState =>
    !isPriced(bundle)
        ? "unpriced"
        : !bundle.isActive
          ? "off"
          : bundle.startsAt && new Date(bundle.startsAt).getTime() > now
            ? "scheduled"
            : bundle.endsAt && new Date(bundle.endsAt).getTime() < now
              ? "expired"
              : bundle.sellable
                ? "selling"
                : "not-ready";

/** What a course sells for on its own today. */
export const salePrice = (course: Pick<AdminPromoCourse, "price" | "discountPrice">) => course.discountPrice ?? course.price;

/** The saving as a whole percentage of the one-by-one total; 0 when there's none. */
export const savingPercent = (combined: number, bundlePrice: number) =>
    combined > 0 && bundlePrice < combined ? Math.round(((combined - bundlePrice) / combined) * 100) : 0;
