import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "crypto";

/**
 * Password hashing with scrypt (Node's built-in memory-hard KDF), stored as
 * `scrypt$N$r$p$<salt>$<hash>` so the cost can be raised later without
 * breaking existing hashes — `verifyPassword` reads the parameters back.
 */

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

const scrypt = (password: string, salt: Buffer, keyLength: number, options: ScryptOptions) =>
    new Promise<Buffer>((resolve, reject) =>
        scryptCallback(password.normalize("NFKC"), salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key))),
    );

export const hashPassword = async (password: string): Promise<string> => {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEM });
    return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), hash.toString("base64")].join("$");
};

export const verifyPassword = async (password: string, stored: string | null | undefined): Promise<boolean> => {
    const parts = stored?.split("$");
    if (!parts || parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: MAX_MEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/**
 * A fixed hash to check against when the email isn't on file, so a sign-in for
 * an unknown address takes as long as one with a wrong password — the response
 * time doesn't reveal who has an account.
 */
let decoy: Promise<string> | null = null;
export const burnPasswordCheck = async (password: string) => {
    decoy ??= hashPassword(randomBytes(16).toString("hex"));
    await verifyPassword(password, await decoy);
};
