/**
 * Just enough of a user agent to name a device in a list — "Chrome 128 on
 * Windows", a phone or a laptop icon. Not a full parser: user agents are
 * self-reported and routinely spoofed, so this is a label, never a check.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface DeviceInfo {
    browser: string | null;
    os: string | null;
    deviceType: DeviceType;
}

const OS_PATTERNS: [RegExp, string][] = [
    [/Windows NT/i, "Windows"],
    [/Android/i, "Android"],
    [/iPhone|iPod/i, "iOS"],
    [/iPad/i, "iPadOS"],
    [/CrOS/i, "ChromeOS"],
    [/Mac OS X|Macintosh/i, "macOS"],
    [/Linux/i, "Linux"],
];

// Order matters: Edge, Opera and Samsung Internet all also say "Chrome", and
// every Chromium browser also says "Safari".
const BROWSER_PATTERNS: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
    [/(?:OPR|Opera)\/(\d+)/, "Opera"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/(?:CriOS|Chrome)\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[\d.]* .*Safari\//, "Safari"],
];

export const describeUserAgent = (userAgent: string | null | undefined): DeviceInfo => {
    if (!userAgent) return { browser: null, os: null, deviceType: "unknown" };

    const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

    let browser: string | null = null;
    for (const [pattern, name] of BROWSER_PATTERNS) {
        const match = userAgent.match(pattern);
        if (match) {
            browser = `${name} ${match[1]}`;
            break;
        }
    }

    const deviceType: DeviceType =
        /iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
            ? "tablet"
            : /Mobi|iPhone|iPod|Android/i.test(userAgent)
              ? "mobile"
              : os
                ? "desktop"
                : "unknown";

    return { browser, os, deviceType };
};
