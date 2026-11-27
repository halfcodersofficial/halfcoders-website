import { AssignmentService } from "../module/assignment/assignment.service";
import { CourseService } from "../module/course/course.service";
import { CourseModuleService } from "../module/courseModule/courseModule.service";
import { LiveClassService } from "../module/liveClass/liveClass.service";
import { PracticeService } from "../module/practice/practice.service";
import { SupportService } from "../module/support/support.service";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";

/**
 * The one job scheduler in this codebase — a plain timer, not a queue library.
 * Every API instance runs it (the Docker deployment runs several), and a
 * PostgreSQL advisory lock taken per tick lets exactly one of them do the
 * work: two instances ticking together would otherwise both see the same
 * session as "not yet announced" and notify its students twice.
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
 * Each is naturally idempotent — see the comments on each for how the query
 * itself is the dedup guard — so an extra tick is harmless.
 *
 * It doesn't tick on a fixed beat. Neon suspends the database's compute after
 * five idle minutes, and every minute it's awake counts against the plan's
 * compute quota: a query every 30 seconds kept it up around the clock and
 * spent the free plan's whole month in about two weeks. So after each tick it
 * asks each job when it next has work (the `next…At` beside each job, on the
 * job's own filter) and sleeps until then. Every scheduled time is written
 * through the API, so each write request nudges it to tick within
 * POLL_INTERVAL_MS to pick up what that request may have scheduled. The
 * database is awake for the request anyway.
 */
const POLL_INTERVAL_MS = 30_000;

/** Longest sleep even with nothing scheduled: a safety net for rows changed outside the API. */
const MAX_SLEEP_MS = 6 * 60 * 60_000;

/** Wake a little after a due instant, so the job's own `<= now` check (on the database clock, for batches) sees it as due. */
const WAKE_SLACK_MS = 2_000;

/** A failed tick retries after 30s, 1m, 2m … up to this, so an outage doesn't keep the database awake. */
const MAX_RETRY_MS = 30 * 60_000;

/** Advisory locks are database-wide, so a number of Half Coders' own. */
const SCHEDULER_LOCK_KEY = 4_637_201;

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let wakeAt = 0;
let ticking = false;
let nudgedDuringTick = false;
let failures = 0;

/** Runs one job, logging its error and reporting `false` instead of throwing. */
const guard = (name: string, job: () => Promise<unknown>) =>
    job().then(
        () => true,
        (error) => {
            logger.error(`Scheduler: ${name} failed`, error);
            return false;
        },
    );

/** True when every job succeeded. */
const runJobs = async () => {
    const results = await Promise.all([
        guard("publishDueModules", () => CourseModuleService.publishDueModules()),
        guard("publishDueAssignments", () => AssignmentService.publishDueAssignments()),
        guard("publishDuePracticeDays", () => PracticeService.publishDuePracticeDays()),
        guard("notifyLiveSessions", () => SupportService.notifyLiveSessions()),
        guard("rollOverBatches", () => CourseService.rollOverBatches()),
        guard("remindStartingClasses", () => LiveClassService.remindStartingClasses()),
    ]);
    return results.every(Boolean);
};

/** The earliest instant after `after` at which any job has work, or null when nothing is scheduled. */
const nextDueAt = async (after: Date) => {
    const times = await Promise.all([
        CourseModuleService.nextModuleReleaseAt(after),
        AssignmentService.nextAssignmentReleaseAt(after),
        PracticeService.nextPracticeDayReleaseAt(after),
        SupportService.nextLiveSessionAt(after),
        CourseService.nextBatchRollOverAt(after),
        LiveClassService.nextReminderAt(after),
    ]);
    const due = times.filter((time): time is Date => time !== null).map((time) => time.getTime());
    return due.length > 0 ? Math.min(...due) : null;
};

const retryDelay = () => Math.min(POLL_INTERVAL_MS * 2 ** failures++, MAX_RETRY_MS);

/** One tick; never throws. Returns how long to sleep before the next. */
const tick = async (): Promise<number> => {
    // Taken before the jobs run, so whatever falls due while they work is
    // still "after" it and counts as next.
    const startedAt = new Date();
    try {
        // Transaction-scoped: the lock goes with the transaction, so an
        // instance that dies mid-tick can't leave it held.
        const outcome = await prisma.$transaction(
            async (tx) => {
                const [lock] = await tx.$queryRaw<{ held: boolean }[]>`
                    SELECT pg_try_advisory_xact_lock(${SCHEDULER_LOCK_KEY}::bigint) AS held`;
                if (!lock?.held) return "skipped";
                return (await runJobs()) ? "done" : "failed";
            },
            { maxWait: 5_000, timeout: 2 * POLL_INTERVAL_MS },
        );

        if (outcome === "skipped") {
            // The other instance may have looked just before something here fell due.
            logger.read("Scheduler tick skipped: another instance is running it");
            return POLL_INTERVAL_MS;
        }
        if (outcome === "failed") return retryDelay();

        failures = 0;
        const next = await nextDueAt(startedAt);
        if (next === null) return MAX_SLEEP_MS;
        return Math.min(Math.max(next + WAKE_SLACK_MS - Date.now(), 0), MAX_SLEEP_MS);
    } catch (error) {
        logger.error("Scheduler tick failed", error);
        return retryDelay();
    }
};

const schedule = (delayMs: number) => {
    if (timer) clearTimeout(timer);
    wakeAt = Date.now() + delayMs;
    timer = setTimeout(() => void run(), delayMs);
};

const run = async () => {
    timer = null;
    ticking = true;
    nudgedDuringTick = false;
    const delay = await tick();
    ticking = false;
    if (!running) return;
    // A write that landed mid-tick may have scheduled something this tick didn't see.
    schedule(nudgedDuringTick ? Math.min(delay, POLL_INTERVAL_MS) : delay);
    logger.read("Scheduler: next tick", { at: new Date(wakeAt).toISOString() });
};

/**
 * Called after every API write: tick within POLL_INTERVAL_MS, since the write
 * may have scheduled something sooner than the scheduler is sleeping for.
 */
export const nudgeScheduler = () => {
    if (!running) return;
    if (ticking) {
        nudgedDuringTick = true;
        return;
    }
    if (wakeAt - Date.now() > POLL_INTERVAL_MS) schedule(POLL_INTERVAL_MS);
};

export const startScheduler = () => {
    if (running) return;
    running = true;
    // Tick once on boot — anything due while the server was down goes out now.
    schedule(0);
    logger.create("Release scheduler started", { maxSleepMs: MAX_SLEEP_MS });
};

export const stopScheduler = () => {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
};
