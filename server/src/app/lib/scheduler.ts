import { AssignmentService } from "../module/assignment/assignment.service";
import { CourseService } from "../module/course/course.service";
import { CourseModuleService } from "../module/courseModule/courseModule.service";
import { LiveClassService } from "../module/liveClass/liveClass.service";
import { PracticeService } from "../module/practice/practice.service";
import { SupportService } from "../module/support/support.service";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";

/**
 * The one job scheduler in this codebase — a plain interval poller, not a
 * queue library. Every API instance runs it (the Docker deployment runs
 * several), and a PostgreSQL advisory lock taken per tick lets exactly one of
 * them do the work: two instances ticking together would otherwise both see
 * the same session as "not yet announced" and notify its students twice.
 *
 * Independent jobs run every tick, each wrapped so one domain's failure
 * can't block the others:
 *  - `publishDueModules`, `publishDueAssignments` and `publishDuePracticeDays`
 *    auto-publish a scheduled module / assignment / practice day the moment
 *    its `releaseAt` arrives.
 *  - `notifyLiveSessions` sends the "session is live now" push the moment a
 *    `SupportSession` enters its start/end window.
 *  - `rollOverBatches` moves a bootcamp's next batch — its dates and its
 *    enrolment window — up once its present batch has ended.
 *  - `remindStartingClasses` nudges a course's students about fifteen
 *    minutes before each live class.
 *
 * Both are naturally idempotent — see the comments on each for how the query
 * itself is the dedup guard — so a slow tick overlapping the next one is
 * harmless, but a boolean re-entrancy guard keeps that from happening anyway.
 */
const POLL_INTERVAL_MS = 30_000;

/** Advisory locks are database-wide, so a number of Half Coders' own. */
const SCHEDULER_LOCK_KEY = 4_637_201;

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

const runJobs = () =>
    Promise.allSettled([
        CourseModuleService.publishDueModules().catch((error) =>
            logger.error("Scheduler: publishDueModules failed", error),
        ),
        AssignmentService.publishDueAssignments().catch((error) =>
            logger.error("Scheduler: publishDueAssignments failed", error),
        ),
        PracticeService.publishDuePracticeDays().catch((error) =>
            logger.error("Scheduler: publishDuePracticeDays failed", error),
        ),
        SupportService.notifyLiveSessions().catch((error) =>
            logger.error("Scheduler: notifyLiveSessions failed", error),
        ),
        CourseService.rollOverBatches().catch((error) =>
            logger.error("Scheduler: rollOverBatches failed", error),
        ),
        LiveClassService.remindStartingClasses().catch((error) =>
            logger.error("Scheduler: remindStartingClasses failed", error),
        ),
    ]);

const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
        // Transaction-scoped: the lock goes with the transaction, so an
        // instance that dies mid-tick can't leave it held.
        await prisma.$transaction(
            async (tx) => {
                const [lock] = await tx.$queryRaw<{ held: boolean }[]>`
                    SELECT pg_try_advisory_xact_lock(${SCHEDULER_LOCK_KEY}::bigint) AS held`;
                if (!lock?.held) {
                    logger.read("Scheduler tick skipped: another instance is running it");
                    return;
                }
                await runJobs();
            },
            { maxWait: 5_000, timeout: 2 * POLL_INTERVAL_MS },
        );
    } catch (error) {
        logger.error("Scheduler tick failed", error);
    } finally {
        ticking = false;
    }
};

export const startScheduler = () => {
    if (timer) return;
    timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    // Fire once on boot too — otherwise anything due while the server was
    // down (or in the gap right after it comes up) waits a full interval.
    void tick();
    logger.create("Release scheduler started", { intervalMs: POLL_INTERVAL_MS });
};

export const stopScheduler = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
};
