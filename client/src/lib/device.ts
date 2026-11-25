import { HelpCircle, Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import type { DeviceInfo } from "@/types/domain.types";

/** The signed-in account's own devices — `authService.devices`. */
export const MY_DEVICES_KEY = ["auth", "devices"];

/** A sign-in's device, as an icon: a laptop, a phone, a tablet. */
export const DEVICE_ICONS: Record<DeviceInfo["deviceType"], LucideIcon> = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
    unknown: HelpCircle,
};

/** "Chrome 128 on Windows", or whatever part of that is known. */
export const deviceLabel = ({ browser, os }: DeviceInfo) =>
    browser && os ? `${browser} on ${os}` : (browser ?? os ?? "Unknown device");

/** Where an IP address is, as the server's lookup placed it (admin types' `IpPlace`). */
export interface PlaceInfo {
    city: string | null;
    region: string | null;
    country: string | null;
    network: string | null;
    local: boolean;
}

let countryNames: Intl.DisplayNames | null = null;

/** "BD" → "Bangladesh"; the code itself if the browser can't name it. */
export const countryName = (code: string | null | undefined) => {
    if (!code) return null;
    try {
        countryNames ??= new Intl.DisplayNames(["en"], { type: "region" });
        return countryNames.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
};

/** "Dhaka, Bangladesh" — or "Local network", or null when the place isn't known (yet). */
export const placeLabel = (place: PlaceInfo | null | undefined) => {
    if (!place) return null;
    if (place.local) return "Local network";
    const parts = [place.city, countryName(place.country)].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
};

/** How someone got in, in plain words. */
export const SIGN_IN_METHOD_LABEL: Record<string, string> = {
    PASSWORD: "Email and password",
    GOOGLE: "Google",
    EMAIL_CODE: "After verifying their email",
    PASSWORD_RESET: "After resetting their password",
};
