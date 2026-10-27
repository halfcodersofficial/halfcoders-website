import status from "http-status";
import { CouponKind, OrderStatus } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { toCsv } from "../../utils/csvExport";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * How long a code on an unpaid order holds one of a limited code's uses: long
 * enough to pay at the gateway, short enough that an abandoned checkout gives
 * its use back. Without it, a crowd applying the last few uses of an event
 * code at once would all get them and all pay.
 */
export const COUPON_HOLD_MINUTES = 30;

const withCourses = { courses: { select: { courseId: true } } } as const;
type Coupon = Prisma.CouponGetPayload<{ include: typeof withCourses }>;

/** What `resolveCoupon` needs to know about the course being bought. */
type PricedCourse = { id: string; price: number; discountPrice: number | null };

export const normaliseCode = (code: string) => code.trim().toUpperCase();

const salePriceOf = (course: { price: number; discountPrice: number | null }) => (course.discountPrice !== null ? course.discountPrice : course.price);

/** What a coupon takes off a sale price: its percentage (capped) or its sum, never more than the price itself. */
export const couponOff = (coupon: Pick<Coupon, "kind" | "value" | "maxDiscount"> | null, salePrice: number) => {
    if (!coupon || salePrice <= 0) return 0;
    const off =
        coupon.kind === CouponKind.PERCENT
            ? Math.min(Math.round((salePrice * coupon.value) / 100), coupon.maxDiscount ?? Number.POSITIVE_INFINITY)
            : coupon.value;
    return Math.min(off, salePrice);
};

const holdCutoff = () => new Date(Date.now() - COUPON_HOLD_MINUTES * 60_000);

/** Unpaid orders carrying the code that were given it recently enough to hold a use. */
const heldWhere = () => ({ status: OrderStatus.PENDING, couponAppliedAt: { gte: holdCutoff() } });

const bdt = (amount: number) => `৳${amount.toLocaleString("en-US")}`;

/** "That code isn't valid." and friends — what a student can be told about a code that's off or outside its dates. */
const assertOpen = (coupon: Coupon | null): Coupon => {
    const now = new Date();
    if (!coupon || !coupon.isActive) throw new AppError(status.BAD_REQUEST, "That code isn't valid.");
    if (coupon.startsAt && coupon.startsAt > now) throw new AppError(status.BAD_REQUEST, "That code isn't open yet.");
    if (coupon.endsAt && coupon.endsAt < now) throw new AppError(status.BAD_REQUEST, "That code has expired.");
    return coupon;
};

/**
 * Whether an open code can go on this course for this student: the course is
 * one it covers and costs enough, the code isn't used up — counting uses held
 * by other students paying right now — and this student hasn't used it as
 * many times as they may. `exceptOrderId` is the order it's going on, which
 * doesn't count against itself. A 400 that says why otherwise.
 */
const assertUsable = async (db: Db, coupon: Coupon, course: PricedCourse | null, studentId: string | null, exceptOrderId?: string) => {
    if (course) {
        if (!coupon.allCourses && !coupon.courses.some((entry) => entry.courseId === course.id)) {
            throw new AppError(status.BAD_REQUEST, "That code is for a different course.");
        }
        if (coupon.minAmount !== null && salePriceOf(course) < coupon.minAmount) {
            throw new AppError(status.BAD_REQUEST, `That code works on courses of ${bdt(coupon.minAmount)} or more.`);
        }
    }

    const others = { couponCode: coupon.code, ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}) };
    if (coupon.maxRedemptions !== null) {
        const [paid, held] = await Promise.all([
            db.order.count({ where: { ...others, status: OrderStatus.PAID } }),
            db.order.count({ where: { ...others, ...heldWhere() } }),
        ]);
        if (paid >= coupon.maxRedemptions) throw new AppError(status.BAD_REQUEST, "That code has been used up.");
        if (paid + held >= coupon.maxRedemptions) {
            throw new AppError(status.BAD_REQUEST, "Every use of that code is taken by someone paying right now — try again in a few minutes.");
        }
    }

    if (studentId && coupon.perStudentLimit !== null) {
        const mine = { ...others, studentId };
        const [paid, held] = await Promise.all([
            db.order.count({ where: { ...mine, status: OrderStatus.PAID } }),
            db.order.count({ where: { ...mine, ...heldWhere() } }),
        ]);
        if (paid >= coupon.perStudentLimit) {
            throw new AppError(
                status.BAD_REQUEST,
                coupon.perStudentLimit === 1
                    ? "You've already used that code."
                    : `You've already used that code ${coupon.perStudentLimit} times — that's as many as it allows.`,
            );
        }
        if (paid + held >= coupon.perStudentLimit) {
            throw new AppError(status.BAD_REQUEST, "That code is on another of your unpaid orders — pay for that one, or take the code off it, first.");
        }
    }
};

/**
 * The coupon behind `code`, if this student can use it on this course right
 * now — otherwise a 400 that says why, in words they can act on. Pass a
 * transaction that has `lockCoupon`ed the code to make the check and the
 * write that follows it one step.
 */
export const resolveCoupon = async (db: Db, code: string, course: PricedCourse, studentId: string, exceptOrderId?: string): Promise<Coupon> => {
    const coupon = assertOpen(await db.coupon.findUnique({ where: { code: normaliseCode(code) }, include: withCourses }));
    await assertUsable(db, coupon, course, studentId, exceptOrderId);
    return coupon;
};

/**
 * Takes the code's row lock for the rest of the transaction, so two students
 * applying the last use of a code at the same moment are checked one after
 * the other: the second sees the first's order and is told it's taken.
 */
export const lockCoupon = async (tx: Prisma.TransactionClient, code: string) => {
    await tx.$queryRaw`SELECT "id" FROM "learning"."coupon" WHERE "code" = ${normaliseCode(code)} FOR UPDATE`;
};

/**
 * What an order costs: the course's list price, everything taken off it (its
 * own sale price, then the coupon on what's left) and the total. Read from
 * the course, never the request.
 */
export const priceOrder = (course: { price: number; discountPrice: number | null }, coupon: Coupon | null) => {
    const amount = course.price;
    const salePrice = salePriceOf(course);
    const couponDiscount = couponOff(coupon, salePrice);
    const discount = amount - salePrice + couponDiscount;
    return { amount, discount, total: amount - discount, couponCode: coupon?.code ?? null, couponDiscount };
};

/** A code's public face: what it takes off and where, with no counts and nothing for admins only. */
const publicCourseSelect = { id: true, title: true, slug: true, status: true, isDeleted: true } as const;

/**
 * "Is this code any good?", for a share link or the course page, before there's
 * an order: what it takes off, which courses it covers, and — with a course —
 * what that course would cost with it. A signed-in student's own uses count
 * too. Never throws for a bad code: `usable` is false with the reason.
 */
const check = async (code: string, courseId: string | undefined, user: IRequestUser | undefined) => {
    const found = await prisma.coupon.findUnique({
        where: { code: normaliseCode(code) },
        include: { courses: { select: { courseId: true, course: { select: publicCourseSelect } } } },
    });
    if (!found || !found.isActive) return { code: normaliseCode(code), usable: false, reason: "That code isn't valid." };

    const summary = {
        code: found.code,
        label: found.label,
        kind: found.kind,
        value: found.value,
        maxDiscount: found.maxDiscount,
        minAmount: found.minAmount,
        allCourses: found.allCourses,
        endsAt: found.endsAt,
        courses: found.allCourses
            ? []
            : found.courses
                  .filter((entry) => entry.course.status === "PUBLISHED" && !entry.course.isDeleted)
                  .map(({ course }) => ({ id: course.id, title: course.title, slug: course.slug })),
    };
    const course = courseId
        ? await prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: { id: true, price: true, discountPrice: true } })
        : null;

    try {
        assertOpen(found);
        await assertUsable(prisma, found, course, user?.role === Role.STUDENT ? user.userId : null);
    } catch (error) {
        if (error instanceof AppError) return { ...summary, usable: false, reason: error.message };
        throw error;
    }

    const preview = course
        ? (() => {
              const salePrice = salePriceOf(course);
              const off = couponOff(found, salePrice);
              return { courseId: course.id, salePrice, off, total: salePrice - off };
          })()
        : null;
    return { ...summary, usable: true, reason: null, preview };
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const adminInclude = {
    courses: { select: { course: { select: { id: true, title: true, slug: true, thumbnail: true, price: true, discountPrice: true, status: true, isDeleted: true } } } },
    createdBy: { select: { id: true, name: true } },
} as const;
type AdminCouponRow = Prisma.CouponGetPayload<{ include: typeof adminInclude }>;

type CouponStats = { used: number; held: number; refunded: number; discountGiven: number; revenue: number };
const NO_STATS: CouponStats = { used: 0, held: 0, refunded: 0, discountGiven: 0, revenue: 0 };

/** Each code's paid uses (and what they took off and brought in), refunds, and uses held by students paying now. */
const statsFor = async (codes: string[]) => {
    const where = { couponCode: { in: codes } };
    const [settled, held] = await Promise.all([
        prisma.order.groupBy({
            by: ["couponCode", "status"],
            where: { ...where, status: { in: [OrderStatus.PAID, OrderStatus.REFUNDED] } },
            _count: { _all: true },
            _sum: { couponDiscount: true, total: true },
        }),
        prisma.order.groupBy({ by: ["couponCode"], where: { ...where, ...heldWhere() }, _count: { _all: true } }),
    ]);
    const stats = new Map<string, CouponStats>(codes.map((code) => [code, { ...NO_STATS }]));
    for (const row of settled) {
        const entry = stats.get(row.couponCode as string);
        if (!entry) continue;
        if (row.status === OrderStatus.PAID) {
            entry.used = row._count._all;
            entry.discountGiven = row._sum.couponDiscount ?? 0;
            entry.revenue = row._sum.total ?? 0;
        } else {
            entry.refunded = row._count._all;
        }
    }
    for (const row of held) {
        const entry = stats.get(row.couponCode as string);
        if (entry) entry.held = row._count._all;
    }
    return stats;
};

const present = (coupon: AdminCouponRow, stats: CouponStats) => {
    const { courses, ...rest } = coupon;
    return { ...rest, courses: courses.map((entry) => entry.course), ...stats };
};

/** Every coupon, with how often it's been used (on paid orders), and what that came to. */
const list = async () => {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: adminInclude });
    const stats = await statsFor(coupons.map((coupon) => coupon.code));
    return coupons.map((coupon) => present(coupon, stats.get(coupon.code) ?? NO_STATS));
};

const redemptionSelect = {
    id: true,
    orderNumber: true,
    status: true,
    amount: true,
    discount: true,
    couponDiscount: true,
    total: true,
    createdAt: true,
    couponAppliedAt: true,
    student: { select: { id: true, name: true, email: true, phone: true, image: true } },
    course: { select: { id: true, title: true, slug: true } },
    payment: { select: { gateway: true, paidAt: true } },
} as const;

/** Most recent first — enough for any one campaign's screen; the CSV has them all. */
const REDEMPTION_PAGE = 500;

const findOr404 = async (couponId: string) => {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, include: adminInclude });
    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found.");
    return coupon;
};

/**
 * One coupon and everyone who has put it on an order — paid, refunded,
 * paying now, or gave up — newest first. Unpaid orders past the hold stay
 * listed (they're abandoned checkouts) but don't hold a use.
 */
const detail = async (couponId: string) => {
    const coupon = await findOr404(couponId);
    const [stats, orders] = await Promise.all([
        statsFor([coupon.code]),
        prisma.order.findMany({
            where: { couponCode: coupon.code },
            orderBy: { createdAt: "desc" },
            take: REDEMPTION_PAGE,
            select: redemptionSelect,
        }),
    ]);
    const cutoff = holdCutoff();
    return {
        ...present(coupon, stats.get(coupon.code) ?? NO_STATS),
        holdMinutes: COUPON_HOLD_MINUTES,
        redemptions: orders.map(({ couponAppliedAt, ...order }) => ({
            ...order,
            held: order.status === OrderStatus.PENDING && couponAppliedAt !== null && couponAppliedAt >= cutoff,
        })),
    };
};

/** Every order the code went on, as a spreadsheet. */
const exportRedemptions = async (couponId: string) => {
    const coupon = await findOr404(couponId);
    const orders = await prisma.order.findMany({ where: { couponCode: coupon.code }, orderBy: { createdAt: "desc" }, select: redemptionSelect });
    const csv = toCsv(
        ["Order", "Placed", "Status", "Student", "Email", "Phone", "Course", "Price", "Coupon took off", "Total discount", "Paid", "Gateway", "Paid at"],
        orders.map((order) => [
            order.orderNumber,
            order.createdAt,
            order.status,
            order.student.name,
            order.student.email,
            order.student.phone,
            order.course.title,
            order.amount,
            order.couponDiscount,
            order.discount,
            order.total,
            order.payment?.gateway ?? null,
            order.payment?.paidAt ?? null,
        ]),
    );
    return { csv, name: `coupon-${coupon.code.toLowerCase()}` };
};

/** Every chosen course must exist; a deleted one can't be given a code. */
const assertCourses = async (courseIds: string[]) => {
    if (courseIds.length === 0) return;
    const found = await prisma.course.count({ where: { id: { in: courseIds }, isDeleted: false } });
    if (found !== new Set(courseIds).size) throw new AppError(status.BAD_REQUEST, "One of those courses doesn't exist.");
};

const takenCode = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? new AppError(status.CONFLICT, "There's already a coupon with that code.")
        : error;

type CouponInput = {
    code: string;
    label?: string | null;
    description?: string | null;
    kind: CouponKind;
    value: number;
    maxDiscount?: number | null;
    minAmount?: number | null;
    allCourses?: boolean;
    courseIds?: string[];
    maxRedemptions?: number | null;
    perStudentLimit?: number | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    isActive?: boolean;
};

const create = async (user: IRequestUser, payload: CouponInput) => {
    const { courseIds = [], allCourses = true, ...fields } = payload;
    if (!allCourses && courseIds.length === 0) throw new AppError(status.BAD_REQUEST, "Pick at least one course, or make it for every course.");
    await assertCourses(courseIds);
    try {
        const coupon = await prisma.coupon.create({
            data: {
                ...fields,
                code: normaliseCode(fields.code),
                // A cap only means something on a percentage.
                maxDiscount: fields.kind === CouponKind.PERCENT ? (fields.maxDiscount ?? null) : null,
                allCourses,
                createdById: user.userId,
                courses: allCourses ? undefined : { create: [...new Set(courseIds)].map((courseId) => ({ courseId })) },
            },
            include: adminInclude,
        });
        return present(coupon, NO_STATS);
    } catch (error) {
        throw takenCode(error);
    }
};

const update = async (couponId: string, payload: Partial<CouponInput>) => {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, include: withCourses });
    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found.");
    const { courseIds, allCourses: allCoursesInput, ...fields } = payload;

    const kind = fields.kind ?? coupon.kind;
    const value = fields.value ?? coupon.value;
    if (kind === CouponKind.PERCENT && value > 100) throw new AppError(status.BAD_REQUEST, "A percentage can't be more than 100.");

    const allCourses = allCoursesInput ?? coupon.allCourses;
    const nextCourses = allCourses ? [] : (courseIds ?? coupon.courses.map((entry) => entry.courseId));
    if (!allCourses && nextCourses.length === 0) throw new AppError(status.BAD_REQUEST, "Pick at least one course, or make it for every course.");

    // Orders keep the code they were bought with, so a used code can't be renamed out from under them.
    if (fields.code && normaliseCode(fields.code) !== coupon.code && (await prisma.order.count({ where: { couponCode: coupon.code } })) > 0) {
        throw new AppError(status.CONFLICT, "Orders already carry this code — switch it off and make a new one instead.");
    }
    if (courseIds) await assertCourses(courseIds);

    const scopeChanged = allCoursesInput !== undefined || courseIds !== undefined;
    try {
        const updated = await prisma.$transaction(async (tx) => {
            if (scopeChanged) {
                await tx.couponCourse.deleteMany({ where: { couponId } });
                if (!allCourses) await tx.couponCourse.createMany({ data: [...new Set(nextCourses)].map((courseId) => ({ couponId, courseId })) });
            }
            return tx.coupon.update({
                where: { id: couponId },
                data: {
                    ...fields,
                    ...(fields.code ? { code: normaliseCode(fields.code) } : {}),
                    ...(kind === CouponKind.FIXED ? { maxDiscount: null } : {}),
                    allCourses,
                },
                include: adminInclude,
            });
        });
        const stats = await statsFor([updated.code]);
        return present(updated, stats.get(updated.code) ?? NO_STATS);
    } catch (error) {
        throw takenCode(error);
    }
};

/** Deletes a coupon no order has used; one that has stays for the record — switch it off instead. */
const remove = async (couponId: string) => {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, select: { code: true } });
    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found.");
    if ((await prisma.order.count({ where: { couponCode: coupon.code } })) > 0) {
        throw new AppError(status.CONFLICT, "Orders already carry this code — switch it off instead of deleting it.");
    }
    await prisma.coupon.delete({ where: { id: couponId } });
};

export const CouponService = { check, list, detail, exportRedemptions, create, update, remove };
