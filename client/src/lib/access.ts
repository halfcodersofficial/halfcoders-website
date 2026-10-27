import type { Role } from "@/types/api.types";

/**
 * One table describing who may open which part of the app.
 *
 * Every console guard, the post-login redirect and the `?next=` sanitiser read
 * from here, so a path can't be locked in one place and left open in another.
 * The API enforces the same boundaries per request — this is what keeps the UI
 * honest, not what keeps the data safe.
 */

export const ADMIN_ROLES: readonly Role[] = ["ADMIN", "SUPER_ADMIN"];
export const MENTOR_ROLES: readonly Role[] = ["MENTOR"];
export const STUDENT_ROLES: readonly Role[] = ["STUDENT"];
/** Course-scoped tooling both consoles mount under their own prefix. */
export const STAFF_ROLES: readonly Role[] = ["MENTOR", "ADMIN", "SUPER_ADMIN"];

/** Where a signed-in account belongs when it has nowhere else to be. */
export const homeFor = (role: Role | null | undefined): string => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
    if (role === "MENTOR") return "/mentor";
    if (role === "STUDENT") return "/dashboard";
    return "/";
};

/** "My devices" — under each role's own home, so it opens in that role's chrome. */
export const devicesFor = (role: Role): string => `${homeFor(role)}/devices`;

/** Human name for the area an account owns, for the "wrong door" message. */
export const areaNameFor = (role: Role | null | undefined): string => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") return "admin console";
    if (role === "MENTOR") return "mentor console";
    return "dashboard";
};

interface Rule {
    prefix: string;
    /** `null` means "any signed-in account"; a list means those roles only. */
    roles: readonly Role[] | null;
    /** Match the prefix exactly rather than as a path segment prefix. */
    exact?: boolean;
}

/**
 * Longest prefix wins, so a more specific rule can sit inside a broader one
 * without the two fighting — not currently needed here, but `ruleFor` still
 * supports it for whichever path next asks for it.
 *
 * Profile and notifications used to be account screens shared under
 * `/dashboard/*` by every role. Each console now has its own copy instead —
 * `/mentor/profile`, `/admin/notifications`, and so on — so the `/mentor` and
 * `/admin` prefix rules below already cover them; `/dashboard` is students only.
 */
const RULES: Rule[] = [
    { prefix: "/admin", roles: ADMIN_ROLES },
    // The admin directory: a super admin's alone.
    { prefix: "/admin/admins", roles: ["SUPER_ADMIN"] },
    { prefix: "/mentor", roles: MENTOR_ROLES },
    { prefix: "/learn", roles: STUDENT_ROLES },
    { prefix: "/checkout", roles: STUDENT_ROLES },
    { prefix: "/dashboard", roles: STUDENT_ROLES },
];

const ruleFor = (pathname: string): Rule | null => {
    let best: Rule | null = null;

    for (const rule of RULES) {
        const matches = rule.exact
            ? pathname === rule.prefix
            : pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);

        if (matches && (!best || rule.prefix.length > best.prefix.length)) {
            best = rule;
        }
    }

    return best;
};

/** True for a path no rule covers — the marketing site and the catalogue. */
export const isPublicPath = (pathname: string): boolean => ruleFor(pathname) === null;

/**
 * Can this account open this path? An anonymous visitor (`role` nullish) may
 * only reach the public paths.
 */
export const canAccess = (pathname: string, role: Role | null | undefined): boolean => {
    const rule = ruleFor(pathname);
    if (!rule) return true;
    if (!role) return false;
    return rule.roles === null || rule.roles.includes(role);
};

/**
 * Where to send an account after sign-in.
 *
 * A `?next=` is only honoured when it is a same-origin path the account is
 * actually allowed to open — otherwise an admin who was bounced off `/learn`
 * would be handed straight back to the page that rejected them.
 */
export const resolveLandingPath = (next: string | null, role: Role): string => {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return homeFor(role);

    const pathname = next.split(/[?#]/)[0];
    return canAccess(pathname, role) ? next : homeFor(role);
};
