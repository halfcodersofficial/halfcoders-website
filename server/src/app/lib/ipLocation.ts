import { isIP } from "net";
import { envVars } from "../config/env";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";

/**
 * Where an IP address is, roughly: the city its network is registered in, and
 * the network itself (the internet provider, or a host or VPN), from
 * ipinfo.io. For the admin's view of where a student signs in from, to spot an
 * account used in several places. A hint, never a check: a phone network or a
 * VPN can put someone a city or a country away.
 *
 * Each address is looked up once and kept (`IpLocation`), then looked up again
 * once it's a month old. Lookups run in the background after a sign-in, or
 * when a device turns up on a new address. Nothing waits on them, and a failed
 * lookup just leaves the place blank. After a "too many requests" they rest
 * for an hour.
 */

const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 4000;
const REST_MS = 60 * 60 * 1000;

let restingUntil = 0;
const inFlight = new Set<string>();

/** A bare address: "::ffff:203.0.113.5" (IPv4 seen over IPv6) becomes "203.0.113.5". Null when it isn't one. */
export const normaliseIp = (ip: string | null | undefined): string | null => {
    if (!ip) return null;
    const trimmed = ip.trim();
    const bare = trimmed.toLowerCase().startsWith("::ffff:") && isIP(trimmed.slice(7)) === 4 ? trimmed.slice(7) : trimmed;
    return isIP(bare) ? bare : null;
};

/** Loopback, a home or office network, link-local, a carrier's shared range: nowhere a lookup can place. */
export const isPrivateIp = (ip: string) => {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split(".").map(Number);
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }
    const lower = ip.toLowerCase();
    return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
};

const text = (value: unknown, max = 120) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

const lookUp = async (ip: string) => {
    const url = new URL(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
    if (envVars.IPINFO_TOKEN) url.searchParams.set("token", envVars.IPINFO_TOKEN);

    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 429) {
        restingUntil = Date.now() + REST_MS;
        logger.warn("IP location lookups hit ipinfo.io's limit — resting for an hour. An IPINFO_TOKEN raises the limit.");
        return;
    }
    if (!response.ok) return;

    const body = (await response.json()) as { bogon?: boolean; city?: unknown; region?: unknown; country?: unknown; org?: unknown };
    if (body.bogon) return;

    const data = {
        city: text(body.city),
        region: text(body.region),
        country: text(body.country, 2),
        // "AS24389 Grameenphone Limited" → "Grameenphone Limited".
        network: text(body.org)?.replace(/^AS\d+\s+/i, "") ?? null,
        lookedUpAt: new Date(),
    };
    await prisma.ipLocation.upsert({ where: { ip }, create: { ip, ...data }, update: data });
};

/**
 * Finds out where the address is, in the background — unless it's private,
 * already known and fresh, being looked up already, or lookups are resting.
 */
export const rememberIpLocation = (rawIp: string | null | undefined) => {
    const ip = normaliseIp(rawIp);
    if (!ip || isPrivateIp(ip) || envVars.NODE_ENV === "test") return;
    if (Date.now() < restingUntil || inFlight.has(ip)) return;

    inFlight.add(ip);
    void (async () => {
        try {
            const known = await prisma.ipLocation.findUnique({ where: { ip }, select: { lookedUpAt: true } });
            if (known && Date.now() - known.lookedUpAt.getTime() < STALE_MS) return;
            await lookUp(ip);
        } catch (error) {
            logger.warn("IP location lookup failed", { reason: error instanceof Error ? error.message : String(error) });
        } finally {
            inFlight.delete(ip);
        }
    })();
};

/** Where an address is, as far as is known. `local` marks a private address — the same network as the server. */
export interface IpPlace {
    city: string | null;
    region: string | null;
    country: string | null;
    network: string | null;
    local: boolean;
}

const LOCAL_PLACE: IpPlace = { city: null, region: null, country: null, network: null, local: true };

/** The known place of each address, keyed by the address as given. Unknown ones are left out. */
export const placesOf = async (ips: (string | null | undefined)[]) => {
    const byIp = new Map<string, IpPlace>();
    const lookups = new Map<string, string[]>();

    for (const raw of new Set(ips.filter((ip): ip is string => Boolean(ip)))) {
        const ip = normaliseIp(raw);
        if (!ip) continue;
        if (isPrivateIp(ip)) {
            byIp.set(raw, LOCAL_PLACE);
            continue;
        }
        lookups.set(ip, [...(lookups.get(ip) ?? []), raw]);
    }
    if (lookups.size === 0) return byIp;

    const rows = await prisma.ipLocation.findMany({
        where: { ip: { in: [...lookups.keys()] } },
        select: { ip: true, city: true, region: true, country: true, network: true },
    });
    for (const { ip, ...place } of rows) {
        for (const raw of lookups.get(ip) ?? []) byIp.set(raw, { ...place, local: false });
    }
    return byIp;
};

/** One place as a key for counting distinct places: its city and country, or nothing when the city isn't known. */
export const placeKey = (place: IpPlace | null | undefined) =>
    place && !place.local && place.city ? `${place.city.toLowerCase()}|${(place.country ?? "").toLowerCase()}` : null;
