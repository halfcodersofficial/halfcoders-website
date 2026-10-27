/**
 * Draws a student's admission ticket — the picture they get on enrolling, to
 * save and share — onto a canvas, 1080 × 1350 (a 4:5 post). Drawn in the
 * browser rather than on the server so a Bangla name or course shapes
 * properly, and from the course's own words (written per course by an
 * admin) plus the student's name and photo.
 *
 * Deep-violet page, a light streak and confetti, the brand lockup, the
 * headline; then the ticket itself, slightly turned: a pale body with the
 * photo, name and course and up to three fields along its foot, torn along a
 * perforation from a lilac stub carrying one big value ("BATCH 03"); the
 * tagline and the site's address under it.
 */

import { graphemesOf } from "@/lib/lang";
import type { AdmissionTicketWords } from "@/types/domain.types";

export interface AdmissionTicketDrawing extends AdmissionTicketWords {
    learnerName: string;
    learnerImage: string | null;
    courseTitle: string;
    /** "half-coders.tech" — printed in the foot pill. */
    siteHost: string;
}

export const TICKET_WIDTH = 1080;
export const TICKET_HEIGHT = 1350;

const LOCKUP_SRC = "/brand/trimmed/lockup-on-dark.png";

/** The palette, read from the site's tokens so the picture matches the page; the hex is a fallback. */
const palette = () => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    return {
        night: token("--color-primary-950", "#1A0D3D"),
        deep: token("--color-primary-900", "#3E1984"),
        blue: token("--color-primary-500", "#8B4DFF"),
        blueSoft: token("--color-primary-300", "#C2A5FF"),
        blueTint: token("--color-primary-100", "#ECE3FF"),
        bluePale: token("--color-primary-50", "#F5F1FF"),
        ink: token("--color-primary-950", "#1A0D3D"),
        label: token("--color-primary-600", "#7432F0"),
        green: token("--color-lilac-400", "#D48AFF"),
        greenDeep: token("--color-lilac-500", "#C065F7"),
    };
};

const fontStacks = () => {
    const style = getComputedStyle(document.documentElement);
    return {
        heading: style.getPropertyValue("--font-heading").trim() || "ui-sans-serif, system-ui, sans-serif",
        body: style.getPropertyValue("--font-sans").trim() || "ui-sans-serif, system-ui, sans-serif",
    };
};

const BANGLA = /[ঀ-৿]/;

/** A small, steady random: the same ticket always throws the same confetti. */
const seeded = (seed: string) => {
    let state = 0;
    for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const loadImage = (src: string, timeoutMs = 8000) =>
    new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        const timer = window.setTimeout(() => resolve(null), timeoutMs);
        image.onload = () => {
            window.clearTimeout(timer);
            resolve(image);
        };
        image.onerror = () => {
            window.clearTimeout(timer);
            resolve(null);
        };
        image.src = src;
    });

type Ctx = CanvasRenderingContext2D;

/**
 * Text with tracking. Canvas `letterSpacing` where the browser has it,
 * otherwise letter by letter — never for Bangla, whose letters join.
 */
const tracked = (ctx: Ctx, text: string, spacing: number) => {
    // Older Safari has no `letterSpacing` on the context (the property reads undefined).
    const native = typeof (ctx as { letterSpacing?: unknown }).letterSpacing === "string";
    const apply = spacing > 0 && !BANGLA.test(text);
    return {
        width: () => {
            if (!apply) return ctx.measureText(text).width;
            if (native) {
                ctx.letterSpacing = `${spacing}px`;
                const width = ctx.measureText(text).width - spacing;
                ctx.letterSpacing = "0px";
                return width;
            }
            return ctx.measureText(text).width + spacing * (text.length - 1);
        },
        /** Drawn from its left edge. */
        draw: (x: number, y: number) => {
            if (!apply) {
                ctx.fillText(text, x, y);
                return;
            }
            if (native) {
                ctx.letterSpacing = `${spacing}px`;
                ctx.fillText(text, x, y);
                ctx.letterSpacing = "0px";
                return;
            }
            let cursor = x;
            for (const char of text) {
                ctx.fillText(char, cursor, y);
                cursor += ctx.measureText(char).width + spacing;
            }
        },
    };
};

/** One line, shrunk from `max` towards `min` until it fits `width`; returns the size used. */
const fitSize = (ctx: Ctx, text: string, font: (size: number) => string, width: number, max: number, min: number, spacing = 0) => {
    let size = max;
    for (; size > min; size -= 2) {
        ctx.font = font(size);
        if (tracked(ctx, text, spacing).width() <= width) return size;
    }
    ctx.font = font(min);
    return min;
};

/** Word-wrapped into at most `maxLines`, the last one cut with an ellipsis if it still runs over. */
const wrap = (ctx: Ctx, text: string, width: number, maxLines: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= width || !line) {
            line = next;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return { lines, overflow: false };

    const kept = lines.slice(0, maxLines);
    let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return { lines: kept, overflow: true };
};

/** The largest size from `max` down at which `text` wraps into `maxLines` without being cut. */
const fitWrapped = (ctx: Ctx, text: string, font: (size: number) => string, width: number, maxLines: number, max: number, min: number) => {
    for (let size = max; size >= min; size -= 2) {
        ctx.font = font(size);
        const result = wrap(ctx, text, width, maxLines);
        if (!result.overflow) return { size, lines: result.lines };
    }
    ctx.font = font(min);
    return { size: min, lines: wrap(ctx, text, width, maxLines).lines };
};

const roundedRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

/** The ticket's outline: a rounded card with a half-circle bitten out top and bottom where the stub tears off. */
const ticketPath = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, seam: number, notch: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(seam - notch, y);
    ctx.arc(seam, y, notch, Math.PI, 0, true);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(seam + notch, y + h);
    ctx.arc(seam, y + h, notch, 0, Math.PI, true);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
};

const sparkle = (ctx: Ctx, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.12, -size * 0.12, size, 0);
    ctx.quadraticCurveTo(size * 0.12, size * 0.12, 0, size);
    ctx.quadraticCurveTo(-size * 0.12, size * 0.12, -size, 0);
    ctx.quadraticCurveTo(-size * 0.12, -size * 0.12, 0, -size);
    ctx.fill();
    ctx.restore();
};

/** First letter of the first two words — whole letters, so a Bangla name gets "মো", not a bare "ম". */
const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => graphemesOf(part)[0]?.toUpperCase() ?? "")
        .join("");

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

const inside = (x: number, y: number, box: Box, pad = 0) =>
    x > box.x - pad && x < box.x + box.w + pad && y > box.y - pad && y < box.y + box.h + pad;

/**
 * Draws the ticket onto `canvas` (resized to 1080 × 1350). Waits for the
 * fonts and pictures first; a photo that can't be read (no CORS, gone) is
 * replaced by the student's initials rather than spoiling the export.
 *
 * Laid out before anything is drawn: the headline, the ticket and the
 * tagline are measured, then centred together between the lockup and the
 * foot pill, so a ticket without a subheadline or fields doesn't leave a
 * hole. Confetti and sparkles keep clear of every block.
 */
export async function drawAdmissionTicket(canvas: HTMLCanvasElement, data: AdmissionTicketDrawing) {
    const colors = palette();
    const fonts = fontStacks();
    const heading = (weight: number) => (size: number) => `${weight} ${size}px ${fonts.heading}`;
    const body = (weight: number) => (size: number) => `${weight} ${size}px ${fonts.body}`;

    const courseText = data.courseName?.trim() || data.courseTitle;
    const sample = [data.headline, data.learnerName, courseText, data.taglineLead, data.taglineAccent].filter(Boolean).join(" ");
    await Promise.all([
        document.fonts.load(heading(700)(40), sample),
        document.fonts.load(heading(600)(40), sample),
        document.fonts.load(body(600)(20), sample),
        document.fonts.load(body(500)(20), sample),
    ]).catch(() => undefined);
    const [lockup, photo] = await Promise.all([
        loadImage(LOCKUP_SRC),
        data.showPhoto && data.learnerImage ? loadImage(data.learnerImage) : Promise.resolve(null),
    ]);

    canvas.width = TICKET_WIDTH;
    canvas.height = TICKET_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = TICKET_WIDTH;
    const H = TICKET_HEIGHT;
    const random = seeded(`${data.learnerName}|${data.courseTitle}`);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // ---- Layout ---------------------------------------------------------------
    const hasFields = data.fields.length > 0;
    const th = hasFields ? 520 : 430;
    const headlineSize = fitSize(ctx, data.headline, heading(700), W - 120, 112, 56, 2);
    const subSize = data.subheadline ? fitSize(ctx, data.subheadline, heading(600), W - 140, 34, 22, 2) : 0;
    const taglines = [
        data.taglineLead && { text: data.taglineLead, color: "#ffffff" },
        data.taglineAccent && { text: data.taglineAccent, color: colors.green },
    ].filter((line): line is { text: string; color: string } => Boolean(line));
    const taglineSizes = taglines.map((line) => fitSize(ctx, line.text, heading(700), W - 160, 56, 34));
    const taglineSize = taglineSizes.length ? Math.min(...taglineSizes) : 0;

    const headBlock = headlineSize * 0.74 + (data.subheadline ? 34 + subSize * 0.74 : 0) + 10;
    const taglineBlock = taglines.length ? taglineSize * 0.74 + (taglines.length - 1) * taglineSize * 1.22 + 14 : 0;
    const gapAbove = 76;
    const gapBelow = 96;
    const regionTop = 140;
    const regionBottom = H - 210;
    const total = headBlock + gapAbove + th + (taglines.length ? gapBelow + taglineBlock : 0);
    const startY = regionTop + Math.max(0, (regionBottom - regionTop - total) / 2);
    const ty = startY + headBlock + gapAbove;
    const taglineTop = ty + th + gapBelow;

    // The foot pill, measured now so the confetti can keep off it.
    const pillH = 84;
    const pillY = H - 76 - pillH;
    ctx.font = body(600)(22);
    const host = tracked(ctx, data.siteHost.toUpperCase(), 1.5);
    const footer = data.footerText ? tracked(ctx, data.footerText.toUpperCase(), 1.5) : null;
    const footerWidth = footer?.width() ?? 0;
    const hostWidth = host.width();
    const pillW = Math.min(W - 120, 72 + footerWidth + (footer ? 60 : 0) + hostWidth + 64);
    const pillX = (W - pillW) / 2;

    const blocks: Box[] = [
        { x: W / 2 - 230, y: 40, w: 460, h: 80 },
        { x: 40, y: startY - 20, w: W - 80, h: headBlock + 30 },
        { x: 40, y: ty - 50, w: W - 80, h: th + 100 },
        ...(taglines.length ? [{ x: 90, y: taglineTop - 20, w: W - 180, h: taglineBlock + 34 }] : []),
        { x: pillX, y: pillY, w: pillW, h: pillH },
    ];
    const clear = (x: number, y: number, pad: number) => blocks.every((box) => !inside(x, y, box, pad));

    // ---- The night page ---------------------------------------------------------
    ctx.fillStyle = colors.night;
    ctx.fillRect(0, 0, W, H);

    const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        ctx.globalAlpha = alpha;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    };
    glow(W * 0.88, H * 0.16, 620, colors.blue, 0.55);
    glow(W * 0.05, H * 0.92, 560, colors.blue, 0.35);
    glow(W * 0.5, H * 0.5, 520, colors.deep, 0.9);
    glow(W * 0.12, H * 0.08, 380, colors.green, 0.12);

    // A fine dot grid towards the edges.
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let gx = 30; gx < W; gx += 36) {
        for (let gy = 30; gy < H; gy += 36) {
            const fromCentre = Math.hypot(gx - W / 2, gy - H / 2) / Math.hypot(W / 2, H / 2);
            if (fromCentre < 0.55) continue;
            ctx.beginPath();
            ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // The light streak, sweeping up behind the ticket.
    const streak = (offset: number, width: number, alpha: number) => {
        const gradient = ctx.createLinearGradient(0, H * 0.75, W, H * 0.12);
        gradient.addColorStop(0, "rgba(255,255,255,0)");
        gradient.addColorStop(0.45, colors.blueSoft);
        gradient.addColorStop(0.8, "#ffffff");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.shadowColor = colors.blue;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(-60, H * 0.78 + offset);
        ctx.bezierCurveTo(W * 0.3, H * 0.62 + offset, W * 0.62, H * 0.5 + offset, W + 60, H * 0.08 + offset * 1.6);
        ctx.stroke();
        ctx.restore();
    };
    streak(0, 5, 0.9);
    streak(26, 2, 0.6);
    streak(-22, 1.5, 0.45);
    streak(60, 1, 0.35);

    // Confetti, only where nothing is written.
    const shades = [colors.green, colors.green, colors.blueSoft, "#ffffff", colors.blue];
    let thrown = 0;
    for (let attempt = 0; attempt < 400 && thrown < 30; attempt++) {
        const x = random() * W;
        const y = random() * H;
        const turn = random() * Math.PI;
        const alpha = 0.55 + random() * 0.4;
        const shade = shades[Math.floor(random() * shades.length)];
        const w = 10 + random() * 18;
        const h = 6 + random() * 8;
        if (!clear(x, y, 24)) continue;
        thrown++;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(turn);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, -h / 2 - h * 0.4);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2 + h * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    for (const [x, y, size, color] of [
        [118, 380, 16, "#ffffff"],
        [962, 236, 11, "#ffffff"],
        [1000, ty + th + 60, 18, "#ffffff"],
        [80, ty + th + 120, 10, colors.blueSoft],
        [880, 116, 8, colors.blueSoft],
        [150, 150, 9, "#ffffff"],
    ] as const) {
        if (clear(x, y, 20)) sparkle(ctx, x, y, size, color);
    }

    // ---- Lockup and headline ------------------------------------------------------
    if (lockup) {
        // The badge makes the lockup tall for its width: drawn a little taller
        // than a text-only lockup would be, ending where one did (y = 100).
        const lockupHeight = 56;
        const lockupWidth = (lockup.naturalWidth / lockup.naturalHeight) * lockupHeight;
        ctx.drawImage(lockup, (W - lockupWidth) / 2, 44, lockupWidth, lockupHeight);
    } else {
        ctx.font = heading(700)(36);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("Half Coders", W / 2, 92);
        ctx.textAlign = "left";
    }

    const headlineBaseline = startY + headlineSize * 0.74;
    ctx.font = heading(700)(headlineSize);
    const headlineText = tracked(ctx, data.headline, 2);
    const headlineGradient = ctx.createLinearGradient(0, startY, 0, headlineBaseline);
    headlineGradient.addColorStop(0, "#ffffff");
    headlineGradient.addColorStop(1, colors.blueTint);
    ctx.save();
    ctx.fillStyle = headlineGradient;
    ctx.shadowColor = colors.blue;
    ctx.shadowBlur = 36;
    headlineText.draw((W - headlineText.width()) / 2, headlineBaseline);
    ctx.restore();

    if (data.subheadline) {
        ctx.font = heading(600)(subSize);
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        const sub = tracked(ctx, data.subheadline, 2);
        sub.draw((W - sub.width()) / 2, headlineBaseline + 34 + subSize * 0.74);
    }

    // ---- The ticket -----------------------------------------------------------------
    const tx = 70;
    const tw = W - 140;
    const stubWidth = 224;
    const seam = tx + tw - stubWidth;
    const radius = 40;
    const notch = 26;

    ctx.save();
    ctx.translate(W / 2, ty + th / 2);
    ctx.rotate((-2.2 * Math.PI) / 180);
    ctx.translate(-W / 2, -(ty + th / 2));

    // Its shadow, then the paper.
    ctx.save();
    ticketPath(ctx, tx, ty, tw, th, radius, seam, notch);
    ctx.shadowColor = "rgba(3, 10, 30, 0.6)";
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ticketPath(ctx, tx, ty, tw, th, radius, seam, notch);
    ctx.clip();
    const paper = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
    paper.addColorStop(0, "#ffffff");
    paper.addColorStop(1, colors.bluePale);
    ctx.fillStyle = paper;
    ctx.fillRect(tx, ty, tw, th);
    // A blue rule along the body's foot.
    ctx.fillStyle = colors.blue;
    ctx.fillRect(tx, ty + th - 10, seam - tx, 10);
    // The stub.
    const stubPaper = ctx.createLinearGradient(seam, ty, tx + tw, ty + th);
    stubPaper.addColorStop(0, colors.green);
    stubPaper.addColorStop(1, colors.greenDeep);
    ctx.fillStyle = stubPaper;
    ctx.fillRect(seam, ty, tx + tw - seam, th);
    ctx.restore();

    // The inner frame and the perforation.
    ctx.strokeStyle = colors.blueTint;
    ctx.lineWidth = 2;
    roundedRect(ctx, tx + 26, ty + 26, seam - tx - 52, th - 56, 22);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = "rgba(26, 13, 61, 0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 9]);
    ctx.beginPath();
    ctx.moveTo(seam, ty + notch + 10);
    ctx.lineTo(seam, ty + th - notch - 10);
    ctx.stroke();
    ctx.restore();

    const left = tx + 64;
    const right = seam - 54;
    const top = ty + 60;

    // Header row: the chip first, so the title knows how much room it has.
    let titleRight = right;
    if (data.badge) {
        ctx.font = body(600)(19);
        const badgeText = data.badge.toUpperCase();
        const badge = tracked(ctx, badgeText, 3);
        const badgeWidth = Math.min(badge.width() + 74, 300);
        const bx = right - badgeWidth;
        const by = top - 6;
        titleRight = bx - 24;
        roundedRect(ctx, bx, by, badgeWidth, 46, 23);
        ctx.fillStyle = colors.bluePale;
        ctx.fill();
        ctx.strokeStyle = colors.blueTint;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.fillStyle = colors.green;
        ctx.shadowColor = colors.green;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bx + 26, by + 23, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 40, by, badgeWidth - 52, 46);
        ctx.clip();
        ctx.fillStyle = colors.label;
        badge.draw(bx + 44, by + 30);
        ctx.restore();
    }
    if (data.ticketTitle) {
        fitSize(ctx, data.ticketTitle, heading(700), titleRight - left, 30, 16, 5);
        ctx.fillStyle = colors.ink;
        tracked(ctx, data.ticketTitle, 5).draw(left, top + 26);
    }

    // Photo, then the name and the course in the room beside it.
    const rowTop = ty + 130;
    const ruleY = ty + th - 150;
    const columnBottom = hasFields ? ruleY - 26 : ty + th - 62;
    const photoSize = Math.min(210, columnBottom - rowTop);
    let textLeft = left;
    if (data.showPhoto) {
        const px = left;
        const py = rowTop;
        ctx.save();
        roundedRect(ctx, px - 6, py - 6, photoSize + 12, photoSize + 12, 34);
        ctx.fillStyle = colors.blueTint;
        ctx.fill();
        roundedRect(ctx, px, py, photoSize, photoSize, 28);
        ctx.clip();
        if (photo) {
            const side = Math.min(photo.naturalWidth, photo.naturalHeight);
            const sx = (photo.naturalWidth - side) / 2;
            const sy = (photo.naturalHeight - side) * 0.3;
            ctx.drawImage(photo, sx, sy, side, side, px, py, photoSize, photoSize);
        } else {
            const monogram = ctx.createLinearGradient(px, py, px + photoSize, py + photoSize);
            monogram.addColorStop(0, colors.blue);
            monogram.addColorStop(1, colors.night);
            ctx.fillStyle = monogram;
            ctx.fillRect(px, py, photoSize, photoSize);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            fitSize(ctx, initialsOf(data.learnerName), heading(700), photoSize - 50, 84, 40);
            ctx.fillText(initialsOf(data.learnerName), px + photoSize / 2, py + photoSize / 2 + 28);
            ctx.textAlign = "left";
        }
        ctx.restore();
        textLeft = left + photoSize + 40;
    }

    const textWidth = right - textLeft;
    let cursor = rowTop + 18;
    const label = (text: string) => {
        ctx.font = body(600)(19);
        ctx.fillStyle = colors.label;
        tracked(ctx, text.toUpperCase(), 4).draw(textLeft, cursor);
    };

    if (data.learnerLabel) {
        label(data.learnerLabel);
        cursor += 12;
    }
    // One line if it'll go at a readable size, two otherwise.
    const oneLine = fitSize(ctx, data.learnerName, heading(700), textWidth, 48, 32);
    const nameFits = ctx.measureText(data.learnerName).width <= textWidth;
    const name = nameFits ? { size: oneLine, lines: [data.learnerName] } : fitWrapped(ctx, data.learnerName, heading(700), textWidth, 2, 36, 26);
    ctx.font = heading(700)(name.size);
    ctx.fillStyle = colors.ink;
    for (const line of name.lines) {
        cursor += name.size * 1.1;
        ctx.fillText(line, textLeft, cursor);
    }
    cursor += 40;

    if (data.courseLabel) {
        label(data.courseLabel);
        cursor += 8;
    }
    // The course takes whatever height is left, as large as it'll go there.
    const room = columnBottom - cursor;
    let course = { size: 20, lines: [courseText] };
    for (let size = 36; size >= 20; size -= 2) {
        const lines = Math.max(1, Math.min(4, Math.floor(room / (size * 1.16))));
        ctx.font = heading(700)(size);
        const wrapped = wrap(ctx, courseText, textWidth, lines);
        course = { size, lines: wrapped.lines };
        if (!wrapped.overflow) break;
    }
    ctx.font = heading(700)(course.size);
    ctx.fillStyle = colors.ink;
    for (const line of course.lines) {
        cursor += course.size * 1.14;
        ctx.fillText(line, textLeft, cursor);
    }

    if (hasFields) {
        ctx.strokeStyle = colors.blueTint;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, ruleY);
        ctx.lineTo(right, ruleY);
        ctx.stroke();

        const gap = 36;
        const columnWidth = (right - left - gap * (data.fields.length - 1)) / data.fields.length;
        data.fields.forEach((field, index) => {
            const x = left + index * (columnWidth + gap);
            const fieldLabel = field.label.toUpperCase();
            fitSize(ctx, fieldLabel, body(600), columnWidth, 17, 13, 4);
            ctx.fillStyle = colors.label;
            tracked(ctx, fieldLabel, 4).draw(x, ruleY + 42);
            const value = fitWrapped(ctx, field.value, heading(600), columnWidth, 2, 23, 16);
            ctx.font = heading(600)(value.size);
            ctx.fillStyle = colors.ink;
            value.lines.forEach((line, lineIndex) => ctx.fillText(line, x, ruleY + 78 + lineIndex * value.size * 1.2));
        });
    }

    // The stub: one label, one big value, and the arrows — centred on their own when it has neither.
    const stubCentre = seam + (tx + tw - seam) / 2;
    const stubInner = tx + tw - seam - 56;
    const stubHasWords = Boolean(data.stubLabel || data.stubValue);
    ctx.fillStyle = colors.ink;
    if (data.stubLabel) {
        const stubLabelText = data.stubLabel.toUpperCase();
        fitSize(ctx, stubLabelText, heading(700), stubInner, 28, 16, 6);
        const stubLabel = tracked(ctx, stubLabelText, 6);
        stubLabel.draw(stubCentre - stubLabel.width() / 2, ty + 112);
    }
    if (data.stubValue) {
        const valueSize = fitSize(ctx, data.stubValue, heading(700), stubInner, 150, 44);
        const value = ctx.measureText(data.stubValue).width;
        ctx.fillText(data.stubValue, stubCentre - value / 2, ty + 142 + valueSize * 0.78);
    }
    const arrowsY = stubHasWords ? ty + th - (hasFields ? 120 : 96) : ty + th / 2;
    if (stubHasWords) {
        ctx.strokeStyle = "rgba(26, 13, 61, 0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(stubCentre - stubInner / 2 + 10, arrowsY - 54);
        ctx.lineTo(stubCentre + stubInner / 2 - 10, arrowsY - 54);
        ctx.stroke();
    }
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const shift of [-17, 17]) {
        ctx.beginPath();
        ctx.moveTo(stubCentre + shift - 14, arrowsY - 22);
        ctx.lineTo(stubCentre + shift + 8, arrowsY);
        ctx.lineTo(stubCentre + shift - 14, arrowsY + 22);
        ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    ctx.restore();

    // ---- Tagline and the foot pill --------------------------------------------------
    ctx.textAlign = "center";
    taglines.forEach((line, index) => {
        ctx.font = heading(700)(taglineSize);
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, W / 2, taglineTop + taglineSize * 0.74 + index * taglineSize * 1.22);
    });
    ctx.textAlign = "left";

    roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(141, 184, 248, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = body(600)(22);
    let pillCursor = pillX + 36;
    const textY = pillY + pillH / 2 + 8;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    if (footer) {
        footer.draw(pillCursor, textY);
        pillCursor += footerWidth + 30;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(pillCursor, pillY + 20, 2, pillH - 40);
        pillCursor += 30;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
    }
    host.draw(pillCursor, textY);
    pillCursor += hostWidth + 26;
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pillCursor, pillY + pillH / 2);
    ctx.lineTo(pillCursor + 30, pillY + pillH / 2);
    ctx.moveTo(pillCursor + 18, pillY + pillH / 2 - 11);
    ctx.lineTo(pillCursor + 30, pillY + pillH / 2);
    ctx.lineTo(pillCursor + 18, pillY + pillH / 2 + 11);
    ctx.stroke();
    ctx.lineCap = "butt";
}

/** The drawing as a PNG file, named for the course. */
export async function admissionTicketFile(data: AdmissionTicketDrawing, slug: string) {
    const canvas = document.createElement("canvas");
    await drawAdmissionTicket(canvas, data);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Couldn't make the picture.");
    return new File([blob], `half-coders-admission-ticket-${slug}.png`, { type: "image/png" });
}

/** The words a new ticket starts from in the editor — the admin changes them per course. */
export const ADMISSION_TICKET_STARTER: AdmissionTicketWords = {
    headline: "CONGRATULATIONS",
    subheadline: "YOUR SEAT IS CONFIRMED",
    ticketTitle: "YOUR NEXT JOURNEY",
    badge: "Access confirmed",
    learnerLabel: "Learner",
    courseLabel: "Course",
    courseName: null,
    fields: [],
    stubLabel: null,
    stubValue: null,
    showPhoto: true,
    taglineLead: "You earned your place.",
    taglineAccent: "Now build what's next.",
    footerText: "Begin your next chapter",
};
