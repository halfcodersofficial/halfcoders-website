import { Prisma } from "../../generated/prisma/client";
import { AccountStatus, LearningStatus } from "../../generated/prisma/enums";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";
import { HALF_CODERS_ROLES, isHalfCodersRole, Role } from "./roles";

/**
 * Helpers around `LearningProfile` — an account's membership of the learning
 * platform. The account itself (name, email, phone, photo, password, role)
 * is the `User` row; everything else Half Coders knows about a person sits on
 * the learning profile.
 */

/**
 * Returns the account's learning profile, creating it if it's missing (sign-up
 * creates it, but an account made another way gets one on first sign-in).
 * Upsert rather than create so two requests racing on a new account both
 * succeed.
 */
export const ensureLearningProfile = async (userId: string) => {
    const profile = await prisma.learningProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { status: true, createdAt: true, updatedAt: true },
    });

    // A fresh row has createdAt === updatedAt; log only genuine first visits.
    if (profile.createdAt.getTime() === profile.updatedAt.getTime()) {
        logger.create("Provisioned learning profile", { userId });
    }

    return { status: profile.status };
};

const rolesOf = (role: Role | Role[]) => (Array.isArray(role) ? role : [role]);

/**
 * Prisma filter: live accounts holding `role` (any role when omitted) that
 * have a learning profile and haven't been removed from learning.
 *
 * Everything sits inside one `AND` array. QueryBuilder merges server
 * conditions over client filters key by key, so a server `role` key would
 * either discard a client `?role=` filter or be overridden by it — widening
 * the scope. Under `AND`, both always apply.
 *
 * `requireMembership: false` also matches accounts that have no learning
 * profile yet — e.g. listing the admins.
 */
export const learnerScope = (
    role?: Role | Role[],
    { requireMembership = true }: { requireMembership?: boolean } = {},
): Prisma.UserWhereInput => ({
    AND: [
        { isDeleted: false },
        { role: { in: role === undefined ? [...HALF_CODERS_ROLES] : rolesOf(role) } },
        ...(requireMembership ? [{ learningProfile: { isNot: null } }] : []),
        { NOT: { learningProfile: { status: LearningStatus.DELETED } } },
    ],
});

/**
 * Stricter than `learnerScope`: only people who can actually use Half Coders
 * right now — account active *and* learning profile active. Used for public
 * counters and broadcast audiences.
 */
export const activeLearnerScope = (role: Role | Role[]): Prisma.UserWhereInput => ({
    AND: [
        { isDeleted: false, status: AccountStatus.ACTIVE, role: { in: rolesOf(role) } },
        { learningProfile: { status: LearningStatus.ACTIVE } },
    ],
});

/**
 * List endpoints accept `?status=` and `?role=` as they always have. Status
 * lives on the learning profile, so translate it before the query builder
 * sees it.
 */
export const toLearnerQuery = <Q extends Record<string, unknown>>(query: Q): Record<string, unknown> => {
    const { status, role, ...rest } = query;
    const wantedRoles = (Array.isArray(role) ? role : role === undefined ? [] : String(role).split(","))
        .map((value) => String(value).trim())
        .filter(isHalfCodersRole);
    return {
        ...rest,
        ...(status !== undefined ? { "learningProfile.status": status } : {}),
        // An unknown role matches nobody rather than being silently dropped.
        ...(role !== undefined ? { role: wantedRoles.length ? wantedRoles : ["__none__"] } : {}),
    };
};

/** Identity fields every learner listing needs, from the account. */
export const learnerIdentitySelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    image: true,
    emailVerified: true,
    role: true,
    createdAt: true,
} as const satisfies Prisma.UserSelect;

type LearnerProfileLike = { status?: LearningStatus; createdAt?: Date; [field: string]: unknown };

/**
 * Flattens `{ ...user, learningProfile }` into the single object shape the
 * client has always received (`role`, `status`, `bio`, … at top level).
 *
 * `createdAt` means when the person joined learning when the learning
 * profile's timestamp was selected; the account's own creation date is then
 * exposed as `accountCreatedAt`.
 */
export const flattenLearner = <T extends { role: Role; learningProfile?: LearnerProfileLike | null; createdAt?: Date }>(record: T) => {
    type P = NonNullable<T["learningProfile"]>;
    const { learningProfile, ...rest } = record;
    const { createdAt: joinedAt, ...profile } = (learningProfile ?? {}) as P;

    return {
        ...rest,
        ...profile,
        ...(joinedAt ? { createdAt: joinedAt, accountCreatedAt: rest.createdAt } : {}),
        status: learningProfile?.status ?? LearningStatus.ACTIVE,
    } as Omit<T, "learningProfile"> &
        Partial<Omit<P, "createdAt">> & {
            status: LearningStatus;
            accountCreatedAt?: Date;
        };
};
