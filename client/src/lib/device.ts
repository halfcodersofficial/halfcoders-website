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
