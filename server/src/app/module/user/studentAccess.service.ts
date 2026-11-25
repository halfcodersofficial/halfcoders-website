import status from "http-status";
import { SignInOutcome } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IpPlace, placeKey, placesOf } from "../../lib/ipLocation";
import { prisma } from "../../lib/prisma";
import { endSession, MAX_DEVICES } from "../../lib/session";
import { describeUserAgent } from "../../lib/userAgent";
import { logger } from "../../utils/logger";
import { assertStudent } from "./studentScope";

/**
 * Where a student's account is used from, for the admin's student page — to
 * spot a course being shared or resold. The devices signed in now (and when
 * each was last used, from where), every device and place it has been used
 * from, the whole sign-in history, and a few plain signs of sharing drawn from
 * the last 30 days. An admin can sign one of the devices out from here.
 *
 * All of it is a hint, never proof: the device names are what each browser
 * says about itself, and the places come from the network's address — a phone
 * network or a VPN can put someone a city or a country away.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
/** Two devices last used within this long of each other count as in use at the same time. */
const TOGETHER_MS = 30 * 60 * 1000;
/**
 * A refusal the same device follows this soon with a sign-in that signed the
 * others out is someone switching devices — the usual way through the limit —
 * not someone turned away.
 */
const SWITCH_MS = 15 * 60 * 1000;
/** How far back the device and place lists read. */
const HISTORY_LIMIT = 2000;

/**
 * When a figure from the last 30 days is worth a look (`medium`) or a strong
 * sign (`high`). A phone and a laptop, a lab computer now and then, home and
 * campus — that's an ordinary student, and stays under these.
 */
const THRESHOLDS = {
    /** Turned away, and left the signed-in devices alone rather than push them out. */
    gaveUp: { medium: 1, high: 3 },
    kickouts: { medium: 3, high: 6 },
    devices: { medium: 4, high: 6 },
    places: { medium: 3, high: 5 },
    countries: { medium: 2, high: 3 },
} as const;

type Level = "medium" | "high";

/** A device as the history tells devices apart: the same browser on the same system is one device, whatever its version. */
const deviceOf = (userAgent: string | null) => {
    const info = describeUserAgent(userAgent);
    const browser = info.browser?.replace(/\s+\d+$/, "") ?? null;
    return { browser, os: info.os, deviceType: info.deviceType, key: `${browser ?? "?"}|${info.os ?? "?"}|${info.deviceType}` };
};

/** A place's group: its city, the server's own network, or not known. */
const placeGroup = (place: IpPlace | null | undefined) => (place?.local ? "local" : (placeKey(place) ?? "unknown"));

const levelOf = (value: number, limits: { medium: number; high: number }): Level | null =>
    value >= limits.high ? "high" : value >= limits.medium ? "medium" : null;

const times = (count: number) => (count === 1 ? "once" : count === 2 ? "twice" : `${count} times`);

const listNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

// ── Devices, places and the signs of sharing ────────────────────────────────

const getStudentAccess = async (userId: string) => {
    await assertStudent(userId);

    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

    const [sessions, events] = await Promise.all([
        prisma.session.findMany({
            where: { userId, expiresAt: { gt: now } },
            orderBy: { createdAt: "desc" },
            select: { id: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true, lastSeenAt: true, lastIp: true },
        }),
        prisma.signInEvent.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: HISTORY_LIMIT,
            select: { id: true, outcome: true, method: true, sessionId: true, signedOutOthers: true, ipAddress: true, userAgent: true, createdAt: true },
        }),
    ]);

    const places = await placesOf([...events.map((event) => event.ipAddress), ...sessions.flatMap((session) => [session.ipAddress, session.lastIp])]);
    const placeOf = (ip: string | null) => (ip ? (places.get(ip) ?? null) : null);
    const signInOf = new Map(events.filter((event) => event.sessionId).map((event) => [event.sessionId as string, event]));

    // ---- Signed in now, most recently used first
    const live = sessions
        .map((session) => {
            const device = describeUserAgent(session.userAgent);
            const lastIp = session.lastIp ?? session.ipAddress;
            return {
                id: session.id,
                ...device,
                key: deviceOf(session.userAgent).key,
                userAgent: session.userAgent,
                method: signInOf.get(session.id)?.method ?? null,
                signedInAt: session.createdAt,
                signedInFrom: { ip: session.ipAddress, place: placeOf(session.ipAddress) },
                lastSeenAt: session.lastSeenAt ?? session.createdAt,
                lastSeenFrom: { ip: lastIp, place: placeOf(lastIp) },
                expiresAt: session.expiresAt,
            };
        })
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

    // ---- Every device and every place it's been used from
    type DeviceRow = ReturnType<typeof deviceOf> & {
        firstSeenAt: Date;
        lastSeenAt: Date;
        signIns: number;
        refused: number;
        addresses: Set<string>;
        places: Map<string, IpPlace>;
        live: boolean;
    };
    type PlaceRow = {
        key: string;
        place: IpPlace | null;
        networks: Set<string>;
        addresses: Set<string>;
        signIns: number;
        refused: number;
        firstSeenAt: Date;
        lastSeenAt: Date;
    };
    const devices = new Map<string, DeviceRow>();
    const placeRows = new Map<string, PlaceRow>();

    const note = (userAgent: string | null, ip: string | null, at: Date, counts: { signIn?: boolean; refused?: boolean; live?: boolean }) => {
        const device = deviceOf(userAgent);
        const row =
            devices.get(device.key) ??
            ({ ...device, firstSeenAt: at, lastSeenAt: at, signIns: 0, refused: 0, addresses: new Set(), places: new Map(), live: false } as DeviceRow);
        if (counts.signIn) row.signIns += 1;
        if (counts.refused) row.refused += 1;
        if (counts.live) row.live = true;
        if (at < row.firstSeenAt) row.firstSeenAt = at;
        if (at > row.lastSeenAt) row.lastSeenAt = at;
        const place = placeOf(ip);
        if (ip) row.addresses.add(ip);
        const key = placeKey(place);
        if (key && place) row.places.set(key, place);
        devices.set(device.key, row);

        if (!ip) return;
        const group = placeGroup(place);
        const spot =
            placeRows.get(group) ??
            ({ key: group, place, networks: new Set(), addresses: new Set(), signIns: 0, refused: 0, firstSeenAt: at, lastSeenAt: at } as PlaceRow);
        spot.addresses.add(ip);
        if (place?.network) spot.networks.add(place.network);
        if (counts.signIn) spot.signIns += 1;
        if (counts.refused) spot.refused += 1;
        if (at < spot.firstSeenAt) spot.firstSeenAt = at;
        if (at > spot.lastSeenAt) spot.lastSeenAt = at;
        placeRows.set(group, spot);
    };

    for (const event of events) {
        const refused = event.outcome === SignInOutcome.DEVICE_LIMIT_REFUSED;
        note(event.userAgent, event.ipAddress, event.createdAt, { signIn: !refused, refused });
    }
    for (const session of live) note(session.userAgent, session.lastSeenFrom.ip, session.lastSeenAt, { live: true });

    // ---- The last 30 days
    const recent = events.filter((event) => event.createdAt >= since);
    const refusals = recent.filter((event) => event.outcome === SignInOutcome.DEVICE_LIMIT_REFUSED);
    const switches = recent.filter((event) => event.signedOutOthers > 0);
    const gaveUp = refusals.filter((refusal) => {
        const device = deviceOf(refusal.userAgent).key;
        const after = refusal.createdAt.getTime();
        return !switches.some(
            (event) => event.createdAt.getTime() >= after && event.createdAt.getTime() - after <= SWITCH_MS && deviceOf(event.userAgent).key === device,
        );
    });
    const seenLately = live.filter((session) => session.lastSeenAt >= since);
    const recentIps = [...recent.map((event) => event.ipAddress), ...seenLately.map((session) => session.lastSeenFrom.ip)].filter((ip): ip is string =>
        Boolean(ip),
    );
    const recentPlaces = new Map<string, IpPlace>();
    for (const ip of recentIps) {
        const place = placeOf(ip);
        const key = placeKey(place);
        if (key && place) recentPlaces.set(key, place);
    }
    const window = {
        days: WINDOW_DAYS,
        signIns: recent.filter((event) => event.outcome === SignInOutcome.SIGNED_IN).length,
        refused: refusals.length,
        /** Refused, and never followed by signing the other devices out — someone who didn't want to push them out. */
        gaveUp: gaveUp.length,
        /** Sign-ins that signed other devices out to make room. */
        kickouts: switches.length,
        devices: new Set([...recent.map((event) => deviceOf(event.userAgent).key), ...seenLately.map((session) => session.key)]).size,
        places: recentPlaces.size,
        countries: new Set([...recentPlaces.values()].map((place) => place.country).filter(Boolean)).size,
        addresses: new Set(recentIps).size,
    };

    // Two devices in use within half an hour of each other, from different cities.
    let together: { a: (typeof live)[number]; b: (typeof live)[number] } | null = null;
    for (let i = 0; i < live.length && !together; i += 1) {
        for (let j = i + 1; j < live.length; j += 1) {
            const [a, b] = [live[i], live[j]];
            const [keyA, keyB] = [placeKey(a.lastSeenFrom.place), placeKey(b.lastSeenFrom.place)];
            if (keyA && keyB && keyA !== keyB && Math.abs(a.lastSeenAt.getTime() - b.lastSeenAt.getTime()) <= TOGETHER_MS) {
                together = { a, b };
                break;
            }
        }
    }

    // ---- The signs, in plain words
    const signs: { id: string; level: Level; title: string; detail: string }[] = [];
    const add = (id: string, level: Level | null, title: string, detail: string) => {
        if (level) signs.push({ id, level, title, detail });
    };
    if (together) {
        add(
            "together",
            "high",
            `In use at the same time in ${together.a.lastSeenFrom.place?.city} and ${together.b.lastSeenFrom.place?.city}`,
            "Two of the devices signed in now were both used within half an hour of each other, from different cities.",
        );
    }
    add(
        "refused",
        levelOf(window.gaveUp, THRESHOLDS.gaveUp),
        `Turned away by the device limit ${times(window.gaveUp)}`,
        `Someone with the right password tried another device while ${MAX_DEVICES} were signed in — and left them signed in rather than push them out, as someone sharing the account would.`,
    );
    add(
        "kickouts",
        levelOf(window.kickouts, THRESHOLDS.kickouts),
        `Signed other devices out to get in ${times(window.kickouts)}`,
        "Each time, a device that was signed in got pushed out — what happens when an account is passed between people.",
    );
    add(
        "devices",
        levelOf(window.devices, THRESHOLDS.devices),
        `Used on ${window.devices} different devices`,
        "Each browser on each system counts once, whatever its version.",
    );
    add(
        "places",
        levelOf(window.places, THRESHOLDS.places),
        `Signed in from ${window.places} different cities`,
        `${listNames([...recentPlaces.values()].map((place) => place.city as string).slice(0, 6))}. A phone network can show a nearby city, so look at how far apart they are.`,
    );
    add(
        "countries",
        levelOf(window.countries, THRESHOLDS.countries),
        `Used from ${window.countries} countries`,
        "A VPN can do this too, but it's worth asking about.",
    );
    signs.sort((a, b) => (a.level === b.level ? 0 : a.level === "high" ? -1 : 1));

    const highs = signs.filter((sign) => sign.level === "high").length;
    const level = highs > 0 || signs.length >= 2 ? "high" : signs.length === 1 ? "medium" : "low";

    return {
        maxDevices: MAX_DEVICES,
        /** The oldest sign-in on record — the history starts there. */
        historySince: events.length > 0 ? events[events.length - 1].createdAt : null,
        risk: { level, signs },
        window,
        live: live.map(({ key: _key, ...session }) => session),
        devices: [...devices.values()]
            .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
            .map(({ key, addresses, places: seenIn, ...device }) => ({ ...device, id: key, addresses: addresses.size, places: [...seenIn.values()] })),
        places: [...placeRows.values()]
            .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
            .map(({ networks, addresses, ...spot }) => ({ ...spot, networks: [...networks], addresses: addresses.size })),
    };
};

// ── The sign-in history ─────────────────────────────────────────────────────

const getStudentSignIns = async (userId: string, query: { page?: unknown; limit?: unknown; outcome?: unknown }) => {
    await assertStudent(userId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const outcome = query.outcome === SignInOutcome.DEVICE_LIMIT_REFUSED || query.outcome === SignInOutcome.SIGNED_IN ? query.outcome : undefined;
    const where = { userId, ...(outcome && { outcome }) };

    const [rows, total, firsts] = await Promise.all([
        prisma.signInEvent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                outcome: true,
                method: true,
                sessionId: true,
                signedOutOthers: true,
                ipAddress: true,
                userAgent: true,
                endedAt: true,
                createdAt: true,
            },
        }),
        prisma.signInEvent.count({ where }),
        // Oldest first, to tell when a device or a place turned up for the first time.
        prisma.signInEvent.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            take: HISTORY_LIMIT,
            select: { id: true, ipAddress: true, userAgent: true },
        }),
    ]);

    const now = new Date();
    const [liveSessions, places] = await Promise.all([
        prisma.session.findMany({
            where: { id: { in: rows.map((row) => row.sessionId).filter((id): id is string => Boolean(id)) }, expiresAt: { gt: now } },
            select: { id: true, lastSeenAt: true },
        }),
        placesOf([...rows.map((row) => row.ipAddress), ...firsts.map((row) => row.ipAddress)]),
    ]);
    const liveBy = new Map(liveSessions.map((session) => [session.id, session]));

    // The first sign-in from each device, and from each city.
    const firstOnDevice = new Set<string>();
    const firstInPlace = new Set<string>();
    const devicesSeen = new Set<string>();
    const placesSeen = new Set<string>();
    for (const row of firsts) {
        const device = deviceOf(row.userAgent).key;
        if (!devicesSeen.has(device)) {
            devicesSeen.add(device);
            firstOnDevice.add(row.id);
        }
        const place = placeKey(row.ipAddress ? places.get(row.ipAddress) : null);
        if (place && !placesSeen.has(place)) {
            placesSeen.add(place);
            firstInPlace.add(row.id);
        }
    }
    // The account's very first sign-in is "new" by definition — not worth a flag.
    const firstEver = firsts[0]?.id;

    return {
        data: rows.map(({ userAgent, sessionId, ...row }) => {
            const session = sessionId ? liveBy.get(sessionId) : undefined;
            return {
                ...row,
                ...describeUserAgent(userAgent),
                userAgent,
                place: row.ipAddress ? (places.get(row.ipAddress) ?? null) : null,
                /** Still signed in on that device, and when it was last used. */
                live: Boolean(session),
                lastSeenAt: session?.lastSeenAt ?? null,
                newDevice: row.id !== firstEver && firstOnDevice.has(row.id),
                newPlace: row.id !== firstEver && firstInPlace.has(row.id),
            };
        }),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
};

// ── Signing a device out ────────────────────────────────────────────────────

/** Signs one of the student's devices out, at once: its next request finds no session. */
const signOutStudentDevice = async (userId: string, sessionId: string) => {
    await assertStudent(userId);
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
    if (!session) throw new AppError(status.NOT_FOUND, "That device isn't signed in any more.");
    await endSession(session.id);
    logger.update("Student device signed out by an admin", { userId, sessionId });
};

export const StudentAccessService = {
    getStudentAccess,
    getStudentSignIns,
    signOutStudentDevice,
};
