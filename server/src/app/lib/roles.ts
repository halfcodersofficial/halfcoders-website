/**
 * Half Coders roles — `User.role`. Everyone who signs up is a STUDENT; admins
 * make mentors and other admins, and the first SUPER_ADMIN comes from
 * `pnpm seed:admin`. Route guards and services work in these roles.
 */
export const Role = {
    STUDENT: "STUDENT",
    MENTOR: "MENTOR",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const HALF_CODERS_ROLES: readonly Role[] = Object.values(Role);

export const isHalfCodersRole = (value: string): value is Role => (HALF_CODERS_ROLES as readonly string[]).includes(value);
