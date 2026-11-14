"use client";

import {
    AlertTriangle,
    ChevronRight,
    LoaderCircle,
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Settings,
    SkipBack,
    SkipForward,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
    loadYouTubeApi,
    QUALITY_CHOICES,
    QUALITY_FRAME_HEIGHT,
    QUALITY_HEIGHT,
    QUALITY_LABEL,
    YT_HOST,
    YT_STATE,
    type QualityChoice,
    type YTPlayer,
} from "@/lib/youtube";

/* ---- Small helpers ------------------------------------------------------ */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatTime = (totalSeconds: number) => {
    const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = String(safe % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

const rateLabel = (rate: number) => (rate === 1 ? "Normal" : `${rate}×`);

/**
 * How far YouTube's frame runs past the stage above and below, in the frame's
 * own pixels. When paused, YouTube pins the video's title and channel to the
 * top edge of its frame (and "More videos" to the bottom). A frame taller than
 * 16:9 letterboxes the video in its middle, so with this much extra height the
 * video still fills the stage exactly while those strips sit outside it, cut
 * off by the stage's `overflow-hidden`.
 */
const frameBleed = (videoHeight: number) => Math.max(96, Math.round(videoHeight / 4));

/**
 * What the student picked: "best" — the default on every lesson — is the
 * highest quality the video has; a set quality is a lower one picked for
 * this video only (a slow connection), so the next lesson is "best" again.
 */
type QualityPick = QualityChoice | "best";

/** The highest quality YouTube has for this video, once it has said. */
const topQuality = (levels: string[]): QualityChoice | null =>
    QUALITY_CHOICES.find((level) => levels.includes(level)) ?? null;

/**
 * The quality a pick comes to for this video: its best, the pick itself, or
 * the best one under the pick it has. Null until YouTube lists the levels.
 */
const lockedQuality = (pick: QualityPick, levels: string[]): QualityChoice | null => {
    if (pick === "best") return topQuality(levels);
    return (
        QUALITY_CHOICES.find(
            (level) => levels.includes(level) && QUALITY_FRAME_HEIGHT[level] <= QUALITY_FRAME_HEIGHT[pick],
        ) ?? null
    );
};

/** Whether YouTube's quality code `playing` is at least `wanted`. */
const reaches = (playing: string, wanted: QualityChoice) =>
    (QUALITY_HEIGHT[playing] ?? 0) >= QUALITY_HEIGHT[wanted];

// While a picked quality loads, the video waits. YouTube is asked again every
// few seconds; if it still won't play that quality after the limit, the video
// carries on at what YouTube gives, rather than leaving the student stuck.
const HOLD_RETRY_MS = 4000;
const HOLD_LIMIT_MS = 20000;

interface QualityHold {
    target: QualityChoice;
    /** The second the video is held at, and reloaded from. */
    at: number;
    /** Play once the quality is there (otherwise stay paused). */
    resume: boolean;
    /** A reload is on its way and hasn't settled yet. */
    loading: boolean;
    retryTimer?: number;
    limitTimer?: number;
}

// Volume and speed carry over from one lesson to the next — someone who
// watches at 1.5× shouldn't have to pick it again on every video. Quality
// doesn't: every lesson starts at its best (see QualityPick).
const PREFS_KEY = "hc-lesson-player";
type PlayerPrefs = { volume?: number; rate?: number };

const readPrefs = (): PlayerPrefs => {
    try {
        return (JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as PlayerPrefs) ?? {};
    } catch {
        return {};
    }
};

const writePrefs = (patch: PlayerPrefs) => {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
    } catch {
        // Private mode or blocked storage — the setting just won't carry over.
    }
};

type FullscreenDocument = Document & {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

type Status = "idle" | "playing" | "paused" | "buffering" | "ended";

interface LessonVideoPlayerProps {
    youtubeVideoId: string;
    title: string;
    /** Under the title on the cover, e.g. "Lesson 3 of 12 · 8:40". */
    subtitle?: string;
    /** The course's cover image, behind the play button before the first play. */
    coverImage?: string | null;
    prev?: { title: string; onSelect: () => void } | null;
    next?: { title: string; onSelect: () => void } | null;
    /** The viewer's email, drifting over the video so a screen recording names who made it. */
    watermark?: string;
    /** Called once with the video's running time, as soon as the player knows it. */
    onDuration?: (seconds: number) => void;
    /**
     * Start playing as soon as it mounts, as if the cover had been pressed —
     * for a player that only mounts on a tap (the checkout's guide video), so
     * one tap is enough.
     */
    autoPlay?: boolean;
}

/**
 * The lesson video, played through YouTube but never looking like it.
 *
 * YouTube's own controls are switched off and every control here is ours.
 * The YouTube frame itself can't be clicked, tapped, hovered or tabbed into
 * (`inert`), so its title, channel link and logo can't take a student off to
 * YouTube. Even with controls off, YouTube still shows the video's title and
 * channel when paused, so its frame is drawn taller than the stage and the
 * edges where it pins those are cut off (see `frameBleed`). Its end screen
 * is covered by our "You finished this video" screen.
 */
export default function LessonVideoPlayer({
    youtubeVideoId,
    title,
    subtitle,
    coverImage,
    prev,
    next,
    watermark,
    onDuration,
    autoPlay = false,
}: LessonVideoPlayerProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const startedRef = useRef(false);
    // With autoPlay it starts the way a press before the player is ready
    // does: playback begins in onReady.
    const pendingPlayRef = useRef(autoPlay);
    const lastPointerRef = useRef("mouse");
    const hideTimerRef = useRef<number | undefined>(undefined);
    const onDurationRef = useRef(onDuration);
    const durationReportedRef = useRef(false);

    useEffect(() => {
        onDurationRef.current = onDuration;
    }, [onDuration]);

    /** Passes the running time up once, the first time it's known. */
    const reportDuration = useCallback((seconds: number) => {
        if (durationReportedRef.current || !(seconds > 0)) return;
        durationReportedRef.current = true;
        onDurationRef.current?.(seconds);
    }, []);

    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [status, setStatus] = useState<Status>("idle");
    const [started, setStarted] = useState(false);
    const [starting, setStarting] = useState(autoPlay);
    const [current, setCurrent] = useState(0);
    const [scrubTime, setScrubTime] = useState<number | null>(null);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(100);
    const [muted, setMuted] = useState(false);
    const [soundBlocked, setSoundBlocked] = useState(false);
    const [rate, setRate] = useState(1);
    const [rates, setRates] = useState<number[]>([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    const [menuOpen, setMenuOpen] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const [stageWidth, setStageWidth] = useState(0);
    const [pixelRatio, setPixelRatio] = useState(1);
    const [quality, setQuality] = useState<QualityPick>("best");
    const [availableQualities, setAvailableQualities] = useState<string[]>([]);
    const [currentQuality, setCurrentQuality] = useState("");
    // The picked quality, for the player's event handlers.
    const qualityRef = useRef<QualityPick>("best");
    // Set while the video waits for its picked quality ("Loading 1080p…").
    const holdRef = useRef<QualityHold | null>(null);
    const [holding, setHolding] = useState<QualityChoice | null>(null);
    // The video only waits by itself as the lesson starts — until this time
    // (ms), just after the first play. Later, a slow connection may lower the
    // quality, like on YouTube; holding then would stop the video every few
    // seconds. Picking the quality again from the menu brings it back.
    const startCheckUntilRef = useRef(0);
    const [chromeAwake, setChromeAwake] = useState(true);
    const [nativeFullscreen, setNativeFullscreen] = useState(false);
    const [canNativeFullscreen, setCanNativeFullscreen] = useState(true);
    const [pseudoFullscreen, setPseudoFullscreen] = useState(false);

    const isFullscreen = nativeFullscreen || pseudoFullscreen;
    const active = status === "playing" || status === "buffering";
    const controlsShown = started && !failed && (!active || menuOpen || chromeAwake || scrubTime !== null);

    /** Shows the controls, then hides them again after a moment of no movement. */
    const poke = useCallback(() => {
        setChromeAwake(true);
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setChromeAwake(false), 2500);
    }, []);

    useEffect(
        () => () => {
            window.clearTimeout(hideTimerRef.current);
            window.clearTimeout(holdRef.current?.retryTimer);
            window.clearTimeout(holdRef.current?.limitTimer);
        },
        [],
    );

    /* ---- Holding for the picked quality -----------------------------------
     * YouTube can't be told which quality to play — the frame's size only
     * caps it (see QUALITY_FRAME_HEIGHT) — and when the cap goes up mid-video
     * it keeps playing what it already downloaded at the old quality for a few
     * more seconds. So for a picked quality the video waits behind
     * "Loading 1080p…": it's reloaded from the same second with an empty
     * buffer (the picture is then the new quality from its first frame —
     * measured), kept paused while YouTube offers less, and only plays once
     * YouTube plays the picked quality — up to HOLD_LIMIT_MS. That happens
     * as a lesson starts and when the student picks a quality, never on its
     * own mid-video (see startCheckUntilRef).
     */

    /** Stops waiting: plays (or stays paused) at whatever YouTube has now. */
    const endHold = useCallback((player: YTPlayer) => {
        const hold = holdRef.current;
        if (!hold) return;
        window.clearTimeout(hold.retryTimer);
        window.clearTimeout(hold.limitTimer);
        holdRef.current = null;
        if (hold.resume) player.playVideo();
        else player.pauseVideo();
        setStatus(hold.resume ? "playing" : "paused");
        setCurrent(player.getCurrentTime());
        setCurrentQuality(player.getPlaybackQuality());
        setHolding(null);
    }, []);

    /** Reloads from the held second, so nothing old-quality is left to play. */
    const reloadForHold = useCallback(
        (player: YTPlayer) => {
            const hold = holdRef.current;
            if (!hold) return;
            window.clearTimeout(hold.retryTimer);
            hold.loading = true;
            player.loadVideoById({ videoId: youtubeVideoId, startSeconds: hold.at });
        },
        [youtubeVideoId],
    );

    /** YouTube offered less than the picked quality: stay paused, ask again shortly. */
    const keepHolding = useCallback(
        (player: YTPlayer) => {
            const hold = holdRef.current;
            if (!hold) return;
            hold.loading = false;
            player.pauseVideo();
            window.clearTimeout(hold.retryTimer);
            hold.retryTimer = window.setTimeout(() => reloadForHold(player), HOLD_RETRY_MS);
        },
        [reloadForHold],
    );

    /** Starts (or restarts, for a new pick) waiting for `target` at the current second. */
    const holdFor = useCallback(
        (player: YTPlayer, target: QualityChoice, resume: boolean, reloadDelay = 0) => {
            const previous = holdRef.current;
            if (previous) {
                window.clearTimeout(previous.retryTimer);
                window.clearTimeout(previous.limitTimer);
            }
            const hold: QualityHold = previous
                ? { ...previous, target, loading: false }
                : { target, at: player.getCurrentTime(), resume, loading: false };
            hold.limitTimer = window.setTimeout(() => endHold(player), HOLD_LIMIT_MS);
            holdRef.current = hold;
            // One wait at the start is enough; after it, YouTube adapts freely.
            startCheckUntilRef.current = 0;
            setHolding(target);
            setStatus(hold.resume ? "buffering" : "paused");
            if (reloadDelay > 0) {
                // Stop now; reload once the frame has taken its new size.
                player.pauseVideo();
                hold.retryTimer = window.setTimeout(() => reloadForHold(player), reloadDelay);
            } else {
                reloadForHold(player);
            }
        },
        [endHold, reloadForHold],
    );

    /**
     * As the lesson starts: if YouTube plays less than the pick, wait for it
     * ("load 1080p first, then play"). Only then — a drop mid-video is left
     * to YouTube. The short delay lets the frame grow first when YouTube has
     * only just said the video goes higher than it was sized for (1440p, 4K).
     */
    const guardQuality = useCallback(
        (player: YTPlayer, playing: string) => {
            if (holdRef.current || !startedRef.current || Date.now() > startCheckUntilRef.current) return;
            const target = lockedQuality(qualityRef.current, player.getAvailableQualityLevels() ?? []);
            if (!target || QUALITY_HEIGHT[playing] === undefined || reaches(playing, target)) return;
            const state = player.getPlayerState();
            if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) return;
            holdFor(player, target, true, 150);
        },
        [holdFor],
    );

    /** The player's events while waiting: play once the quality is there. */
    const onHoldEvent = useCallback(
        (player: YTPlayer, event: "playing" | "quality", playing: string) => {
            const hold = holdRef.current;
            if (!hold) return;
            if (reaches(playing, hold.target)) {
                if (!hold.loading) {
                    // YouTube moved up while paused, but what's downloaded
                    // is still the old quality — reload to start clean.
                    reloadForHold(player);
                } else if (event === "playing" || !hold.resume) {
                    endHold(player);
                }
            } else if (QUALITY_HEIGHT[playing] !== undefined && hold.loading) {
                // Paused before it plays a single frame (or sound) at less.
                keepHolding(player);
            }
        },
        [endHold, keepHolding, reloadForHold],
    );

    /**
     * Starts playback from our play button. Browsers may refuse to start a
     * video with sound when the click happened outside the video frame
     * (iPhones mostly) — then it starts muted, and a "turn sound on" button
     * shows instead of nothing happening.
     */
    const beginPlayback = useCallback((player: YTPlayer) => {
        pendingPlayRef.current = false;
        player.playVideo();
        window.setTimeout(() => {
            if (startedRef.current || playerRef.current !== player) return;
            const state = player.getPlayerState();
            if (state === YT_STATE.UNSTARTED || state === YT_STATE.CUED) {
                player.mute();
                setMuted(true);
                setSoundBlocked(true);
                player.playVideo();
            }
        }, 1500);
    }, []);

    // One YouTube player per video. YouTube swaps the element it's given for
    // its iframe, so that element is made here rather than by React — React
    // would otherwise trip over a node it no longer recognises on unmount.
    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        let cancelled = false;
        const target = document.createElement("div");
        host.appendChild(target);

        loadYouTubeApi()
            .then((YT) => {
                if (cancelled) return;
                playerRef.current = new YT.Player(target, {
                    host: YT_HOST,
                    videoId: youtubeVideoId,
                    width: "100%",
                    height: "100%",
                    playerVars: {
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        playsinline: 1,
                        rel: 0,
                        enablejsapi: 1,
                        origin: window.location.origin,
                    },
                    events: {
                        onReady: ({ target: player }) => {
                            if (cancelled) return;
                            const prefs = readPrefs();
                            if (typeof prefs.volume === "number") player.setVolume(prefs.volume);
                            setVolume(prefs.volume ?? player.getVolume());
                            setMuted(player.isMuted());
                            setDuration(player.getDuration());
                            reportDuration(player.getDuration());
                            const available = player.getAvailablePlaybackRates();
                            if (available?.length) setRates(available);
                            setReady(true);
                            if (pendingPlayRef.current) beginPlayback(player);
                        },
                        onStateChange: ({ target: player, data }) => {
                            if (cancelled) return;
                            const hold = holdRef.current;
                            if (hold) {
                                // A reload's passing states (paused, unstarted,
                                // buffering) aren't the student's — skip them.
                                if (data === YT_STATE.PLAYING) {
                                    onHoldEvent(player, "playing", player.getPlaybackQuality());
                                }
                                if (data !== YT_STATE.ENDED) return;
                                // Held at the very end: nothing left to wait for.
                                window.clearTimeout(hold.retryTimer);
                                window.clearTimeout(hold.limitTimer);
                                holdRef.current = null;
                                setHolding(null);
                            }
                            if (data === YT_STATE.PLAYING) {
                                if (!startedRef.current) {
                                    startedRef.current = true;
                                    // YouTube's first quality report can trail
                                    // the first frame a little — check for a moment.
                                    startCheckUntilRef.current = Date.now() + 1500;
                                    setStarted(true);
                                    setStarting(false);
                                    const savedRate = readPrefs().rate;
                                    if (savedRate && savedRate !== player.getPlaybackRate()) {
                                        player.setPlaybackRate(savedRate);
                                    }
                                }
                                setStatus("playing");
                                setDuration(player.getDuration());
                                reportDuration(player.getDuration());
                                // Only known once playback has begun.
                                const levels = player.getAvailableQualityLevels();
                                if (levels?.length) setAvailableQualities(levels);
                                setCurrentQuality(player.getPlaybackQuality());
                                guardQuality(player, player.getPlaybackQuality());
                            } else if (data === YT_STATE.BUFFERING) {
                                setStatus("buffering");
                            } else if (data === YT_STATE.PAUSED) {
                                setStatus("paused");
                                setCurrent(player.getCurrentTime());
                            } else if (data === YT_STATE.ENDED) {
                                setStatus("ended");
                                setCurrent(player.getDuration());
                            }
                        },
                        onPlaybackRateChange: ({ data }) => !cancelled && setRate(data),
                        onPlaybackQualityChange: ({ target: player, data }) => {
                            if (cancelled) return;
                            setCurrentQuality(data);
                            if (holdRef.current) onHoldEvent(player, "quality", data);
                            else guardQuality(player, data);
                        },
                        onError: () => !cancelled && setFailed(true),
                    },
                });
            })
            .catch(() => !cancelled && setFailed(true));

        return () => {
            cancelled = true;
            try {
                playerRef.current?.destroy();
            } catch {
                // Already gone with the page.
            }
            playerRef.current = null;
            host.replaceChildren();
        };
    }, [youtubeVideoId, beginPlayback, reportDuration, onHoldEvent, guardQuality]);

    // The time and the buffered stretch of the seek bar, while playing.
    useEffect(() => {
        if (!active) return;
        const id = window.setInterval(() => {
            const player = playerRef.current;
            // While held, a reload's time reads 0 for a moment — keep the bar still.
            if (!player || holdRef.current) return;
            setCurrent(player.getCurrentTime());
            setBuffered(player.getVideoLoadedFraction());
            const playing = player.getPlaybackQuality();
            setCurrentQuality(playing);
            guardQuality(player, playing);
        }, 250);
        return () => window.clearInterval(id);
    }, [active, guardQuality]);

    useEffect(() => {
        if (started) poke();
    }, [started, poke]);

    // Mounted by a tap on something that's now gone: keep focus here, so the
    // keyboard shortcuts work and keyboard users aren't sent back to the top.
    useEffect(() => {
        if (autoPlay) rootRef.current?.focus({ preventScroll: true });
    }, [autoPlay]);

    // The stage's width (full screen, a resized window) and the screen's
    // pixel density decide how a chosen quality's frame is scaled to fit.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const measure = () => {
            setStageWidth(stage.clientWidth);
            setPixelRatio(window.devicePixelRatio || 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);

    // Real full screen where the browser allows it on an element; iPhones
    // don't, so there the player fills the window instead.
    useEffect(() => {
        const doc = document as FullscreenDocument;
        setCanNativeFullscreen(Boolean(document.fullscreenEnabled || doc.webkitFullscreenEnabled));
        const sync = () => {
            const element = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
            setNativeFullscreen(element !== null && element === rootRef.current);
        };
        document.addEventListener("fullscreenchange", sync);
        document.addEventListener("webkitfullscreenchange", sync);
        return () => {
            document.removeEventListener("fullscreenchange", sync);
            document.removeEventListener("webkitfullscreenchange", sync);
        };
    }, []);

    useEffect(() => {
        if (!pseudoFullscreen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [pseudoFullscreen]);

    /* ---- Actions --------------------------------------------------------- */

    const readyPlayer = () => (ready ? playerRef.current : null);

    const start = () => {
        if (starting || started) return;
        setStarting(true);
        const player = playerRef.current;
        if (player && ready) beginPlayback(player);
        else pendingPlayRef.current = true;
    };

    const togglePlay = () => {
        const player = readyPlayer();
        if (!player) return;
        const hold = holdRef.current;
        if (hold) {
            // Still loading the picked quality: just change what happens once it's there.
            hold.resume = !hold.resume;
            setStatus(hold.resume ? "buffering" : "paused");
            return;
        }
        if (status === "ended") {
            player.seekTo(0, true);
            player.playVideo();
        } else if (active) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    };

    const seekTo = (seconds: number) => {
        const player = readyPlayer();
        if (!player) return;
        const target = clamp(seconds, 0, duration || player.getDuration());
        setCurrent(target);
        const hold = holdRef.current;
        if (hold) {
            // Still loading the picked quality: load it from the new spot instead.
            hold.at = target;
            reloadForHold(player);
            return;
        }
        player.seekTo(target, true);
    };

    const seekBy = (delta: number) => {
        const player = readyPlayer();
        if (player) seekTo(player.getCurrentTime() + delta);
    };

    const changeVolume = (next: number) => {
        const player = readyPlayer();
        if (!player) return;
        const value = Math.round(clamp(next, 0, 100));
        player.setVolume(value);
        setVolume(value);
        if (value === 0) {
            player.mute();
            setMuted(true);
        } else {
            if (player.isMuted()) player.unMute();
            setMuted(false);
            setSoundBlocked(false);
            writePrefs({ volume: value });
        }
    };

    const toggleMute = () => {
        const player = readyPlayer();
        if (!player) return;
        if (muted || volume === 0) {
            player.unMute();
            if (volume === 0) {
                player.setVolume(50);
                setVolume(50);
            }
            setMuted(false);
            setSoundBlocked(false);
        } else {
            player.mute();
            setMuted(true);
        }
    };

    // A pick reloads the video at the same second and waits behind
    // "Loading 1080p…" until YouTube plays it (see `holdFor`). Picking the
    // same quality again does the same if a slow connection has since made
    // YouTube go lower — like YouTube's own menu. A pick lasts for this
    // video only; the next lesson starts at its best again.
    const changeQuality = (next: QualityPick) => {
        setMenuOpen(false);
        const player = readyPlayer();
        const samePick = next === qualityRef.current;
        setQuality(next);
        qualityRef.current = next;
        if (!player || !started || status === "ended") return;
        const target = lockedQuality(next, player.getAvailableQualityLevels() ?? []) ?? (next === "best" ? null : next);
        if (!target) return;
        // Already playing what was picked: nothing to load.
        if (samePick && !holdRef.current && reaches(player.getPlaybackQuality(), target)) return;
        holdFor(player, target, active, 150);
    };

    const changeRate = (next: number) => {
        const player = readyPlayer();
        if (!player) return;
        player.setPlaybackRate(next);
        setRate(next);
        writePrefs({ rate: next });
        setMenuOpen(false);
    };

    const toggleFullscreen = () => {
        const root = rootRef.current as FullscreenElement | null;
        if (!root) return;
        if (!canNativeFullscreen) {
            setPseudoFullscreen((value) => !value);
            return;
        }
        const doc = document as FullscreenDocument;
        if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
            if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
            else doc.webkitExitFullscreen?.();
        } else if (root.requestFullscreen) {
            void root.requestFullscreen().catch(() => setPseudoFullscreen(true));
        } else {
            root.webkitRequestFullscreen?.();
        }
    };

    const exitPseudoFullscreen = () => setPseudoFullscreen(false);

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        // A focused button or slider handles its own Space/Enter.
        if ((event.key === " " || event.key === "Enter") && event.target !== event.currentTarget) return;

        if (!started) {
            if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                start();
            }
            return;
        }

        switch (event.key.toLowerCase()) {
            case " ":
            case "k":
                togglePlay();
                break;
            case "arrowleft":
            case "j":
                seekBy(-10);
                break;
            case "arrowright":
            case "l":
                seekBy(10);
                break;
            case "arrowup":
                changeVolume((muted ? 0 : volume) + 10);
                break;
            case "arrowdown":
                changeVolume((muted ? 0 : volume) - 10);
                break;
            case "m":
                toggleMute();
                break;
            case "f":
                toggleFullscreen();
                break;
            case "escape":
                if (menuOpen) setMenuOpen(false);
                else if (pseudoFullscreen) exitPseudoFullscreen();
                else return;
                break;
            default:
                return;
        }
        event.preventDefault();
        poke();
    };

    // This video's highest quality — what "Best" plays — once YouTube has
    // said (on the first play). Until then the frame is sized for 1080p, and
    // grows if the video turns out to go higher.
    const bestQuality = topQuality(availableQualities);
    // The lower ones a student can drop to, e.g. on a slow connection.
    const lowerOptions = bestQuality
        ? QUALITY_CHOICES.filter((choice) => availableQualities.includes(choice) && choice !== bestQuality)
        : (["hd720", "large"] as QualityChoice[]);
    const shownQuality: QualityPick =
        quality === "best" || lowerOptions.includes(quality) ? quality : "best";

    // The frame is drawn at the size YouTube plays the wanted quality at, then
    // scaled to fit the stage — YouTube never plays more than its frame's
    // size, so this is what lets it play its best. The frame also runs past
    // the stage above and below (see `frameBleed`), so YouTube's title strip
    // and "More videos" row fall outside the picture.
    const frameQuality: QualityChoice = quality === "best" ? (bestQuality ?? "hd1080") : quality;
    const frameStyle = (() => {
        if (stageWidth === 0) return undefined;
        const videoHeight = QUALITY_FRAME_HEIGHT[frameQuality] / pixelRatio;
        const width = (videoHeight * 16) / 9;
        const scale = stageWidth / width;
        const bleed = frameBleed(videoHeight);
        return {
            width,
            height: videoHeight + 2 * bleed,
            top: -bleed * scale,
            transform: `scale(${scale})`,
        };
    })();

    const shownTime = scrubTime ?? current;
    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

    return (
        <div
            ref={rootRef}
            role="region"
            aria-label={`Video player: ${title}`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={(event) => event.pointerType === "mouse" && poke()}
            onPointerLeave={() => active && !menuOpen && setChromeAwake(false)}
            onContextMenu={(event) => event.preventDefault()}
            className={cn(
                // `isolate`: the player's layers stack among themselves, never
                // over the page's sticky header as it scrolls past.
                "relative isolate mx-auto w-full max-w-6xl select-none overflow-hidden bg-black text-white outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isFullscreen
                    ? "flex items-center justify-center"
                    : "aspect-video rounded-2xl shadow-panel ring-1 ring-border",
                pseudoFullscreen && "fixed inset-0 z-100 h-dvh max-w-none rounded-none",
                isFullscreen && !controlsShown && "cursor-none",
            )}
        >
            {/* The stage: always 16:9, letterboxed when full screen isn't. */}
            <div
                ref={stageRef}
                className={cn(
                    "relative aspect-video overflow-hidden",
                    isFullscreen ? "w-[min(100%,calc(100dvh*16/9))]" : "w-full",
                )}
            >
                <div
                    ref={hostRef}
                    inert
                    aria-hidden
                    style={frameStyle}
                    className={cn(
                        "pointer-events-none absolute left-0 top-0 origin-top-left [&>iframe]:pointer-events-none [&>iframe]:size-full",
                        !frameStyle && "size-full",
                    )}
                />

                {/* Inside the stage, so it only ever moves over the picture —
                    and above every other layer, cover included. */}
                {watermark && <MovingWatermark text={watermark} />}
            </div>

            {/* Clicks land here, never on YouTube: tap to play or pause,
                double-click for full screen. */}
            <div
                aria-hidden
                className="absolute inset-0"
                onPointerDown={(event) => {
                    lastPointerRef.current = event.pointerType;
                }}
                onClick={() => {
                    if (!started) return;
                    if (menuOpen) {
                        setMenuOpen(false);
                        return;
                    }
                    // On a phone, the first tap brings the controls back.
                    if (lastPointerRef.current === "touch" && !controlsShown) {
                        poke();
                        return;
                    }
                    togglePlay();
                    poke();
                }}
                onDoubleClick={() => started && toggleFullscreen()}
            />

            {started && status === "buffering" && !holding && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                    <LoaderCircle className="size-10 animate-spin text-white/80" aria-hidden />
                </div>
            )}

            {/* Loading the picked quality: the video waits under here, and
                anything YouTube shows at a lower quality meanwhile is hidden. */}
            {holding && (
                <div
                    role="status"
                    className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/70 backdrop-blur-md"
                >
                    <div className="flex flex-col items-center gap-3">
                        <LoaderCircle className="size-10 animate-spin text-white/85" aria-hidden />
                        <p className="text-sm font-medium text-white/90 sm:text-base">
                            Loading {QUALITY_LABEL[holding]}…
                        </p>
                    </div>
                </div>
            )}

            {/* Paused: the same play button as the cover, a size smaller and
                still, dead centre on a soft dark spot so it reads on a white
                whiteboard as well as a dark frame. */}
            {started && status === "paused" && scrubTime === null && !holding && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                    <span
                        aria-hidden
                        className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.32),transparent)] sm:size-52"
                    />
                    <PlayBadge className="size-14 sm:size-16" />
                </div>
            )}

            {/* Fully opaque: it also hides YouTube's "more videos" end screen. */}
            {status === "ended" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-black px-4 text-center sm:gap-4 sm:px-6">
                    <p className="text-sm font-semibold sm:text-lg">You finished this video</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={togglePlay}
                            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <RotateCcw className="size-4" aria-hidden /> Watch again
                        </button>
                        {next && (
                            <button
                                type="button"
                                onClick={next.onSelect}
                                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                                Next lesson <ChevronRight className="size-4" aria-hidden />
                            </button>
                        )}
                    </div>
                    {next && <p className="line-clamp-1 max-w-md text-sm text-white/60">Up next: {next.title}</p>}
                </div>
            )}

            {isFullscreen && (
                <div
                    className={cn(
                        "pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/80 to-transparent px-4 pb-10 pt-3 transition-opacity duration-200 sm:px-6 sm:pt-4",
                        controlsShown ? "opacity-100" : "opacity-0",
                    )}
                >
                    <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
                </div>
            )}

            {started && soundBlocked && (
                <button
                    type="button"
                    onClick={toggleMute}
                    className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 transition-colors hover:bg-black/90 sm:text-sm"
                >
                    <VolumeX className="size-4" aria-hidden /> Sound is off — tap to turn it on
                </button>
            )}

            {/* Controls */}
            <div
                onFocusCapture={poke}
                className={cn(
                    "absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pb-1.5 pt-10 transition-opacity duration-200 sm:px-4 sm:pb-2",
                    controlsShown ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                <Slider
                    label="Seek"
                    value={shownTime}
                    max={duration}
                    step={5}
                    buffered={buffered}
                    valueText={`${formatTime(shownTime)} of ${formatTime(duration)}`}
                    hoverLabel={formatTime}
                    onScrub={setScrubTime}
                    onCommit={(seconds) => {
                        setScrubTime(null);
                        seekTo(seconds);
                    }}
                    className="mx-1"
                />

                <div className="mt-0.5 flex items-center gap-0.5 sm:gap-1.5">
                    <ControlButton label={active ? "Pause (K)" : "Play (K)"} onClick={togglePlay}>
                        {active ? <Pause className="fill-current" /> : <Play className="fill-current" />}
                    </ControlButton>

                    <ControlButton label="Back 10 seconds (←)" onClick={() => seekBy(-10)}>
                        <RotateCcw />
                        <span aria-hidden className="absolute inset-0 grid place-items-center pt-px text-[0.5rem] font-bold">
                            10
                        </span>
                    </ControlButton>
                    <ControlButton label="Forward 10 seconds (→)" onClick={() => seekBy(10)}>
                        <RotateCw />
                        <span aria-hidden className="absolute inset-0 grid place-items-center pt-px text-[0.5rem] font-bold">
                            10
                        </span>
                    </ControlButton>

                    <div className="group/volume flex items-center">
                        <ControlButton label={muted || volume === 0 ? "Unmute (M)" : "Mute (M)"} onClick={toggleMute}>
                            <VolumeIcon />
                        </ControlButton>
                        <div className="hidden w-0 overflow-hidden transition-[width] duration-200 group-hover/volume:w-22 group-focus-within/volume:w-22 sm:block">
                            <Slider
                                label="Volume"
                                value={muted ? 0 : volume}
                                max={100}
                                step={5}
                                valueText={`${muted ? 0 : volume}%`}
                                onScrub={changeVolume}
                                onCommit={changeVolume}
                                className="mx-2 w-18"
                            />
                        </div>
                    </div>

                    <span className="ml-1 whitespace-nowrap text-xs tabular-nums sm:text-sm">
                        {formatTime(shownTime)}
                        <span className="text-white/55"> / {formatTime(duration)}</span>
                    </span>

                    <span className="flex-1" />

                    {/* Previous and next lesson, side by side. Phones have the
                        page's own "Previous" and "Next" right under the video. */}
                    {prev && (
                        <ControlButton
                            label={`Previous lesson: ${prev.title}`}
                            onClick={prev.onSelect}
                            className="hidden sm:grid"
                        >
                            <SkipBack className="fill-current" />
                        </ControlButton>
                    )}
                    {next && (
                        <ControlButton
                            label={`Next lesson: ${next.title}`}
                            onClick={next.onSelect}
                            className="hidden sm:grid"
                        >
                            <SkipForward className="fill-current" />
                        </ControlButton>
                    )}

                    <ControlButton
                        label="Settings"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                        className={cn(menuOpen && "bg-white/15")}
                    >
                        <Settings className={cn("transition-transform duration-200", menuOpen && "rotate-45")} />
                        {rate !== 1 && (
                            <span className="absolute -right-0.5 -top-0.5 rounded-sm bg-primary px-1 text-[0.5625rem] font-bold leading-tight text-primary-foreground">
                                {rate}×
                            </span>
                        )}
                    </ControlButton>

                    <ControlButton
                        label={isFullscreen ? "Exit full screen (F)" : "Full screen (F)"}
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize /> : <Maximize />}
                    </ControlButton>
                </div>
            </div>

            {menuOpen && controlsShown && (
                <div
                    role="menu"
                    aria-label="Video settings"
                    className="absolute bottom-16 right-2 z-30 max-h-[calc(100%-4.5rem)] w-64 max-w-[calc(100%-1rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-3 text-sm shadow-2xl backdrop-blur-md sm:bottom-17 sm:right-4"
                >
                    <p className="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold text-white/60">
                        Quality
                        {holding ? (
                            <span className="inline-flex items-center gap-1 font-normal text-white/75">
                                <LoaderCircle className="size-3 animate-spin self-center" aria-hidden />
                                Loading {QUALITY_LABEL[holding]}…
                            </span>
                        ) : (
                            QUALITY_LABEL[currentQuality] && (
                                <span className="font-normal text-white/50">
                                    Playing now: {QUALITY_LABEL[currentQuality]}
                                </span>
                            )
                        )}
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                        <MenuChip
                            selected={shownQuality === "best"}
                            onClick={() => changeQuality("best")}
                            className="col-span-2"
                        >
                            Best{bestQuality && ` · ${QUALITY_LABEL[bestQuality]}`}
                        </MenuChip>
                        {lowerOptions.map((choice) => (
                            <MenuChip
                                key={choice}
                                selected={choice === shownQuality}
                                onClick={() => changeQuality(choice)}
                            >
                                {QUALITY_LABEL[choice]}
                            </MenuChip>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[0.6875rem] leading-snug text-white/45">
                        {shownQuality === "best"
                            ? "The highest quality this video has. If slow internet lowers it, tap Best again."
                            : "Lower quality for this video only — it uses less internet. The next lesson plays in Best again."}
                    </p>

                    <p className="mb-2 mt-3 border-t border-white/10 pt-2.5 text-xs font-semibold text-white/60">
                        Playback speed
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                        {rates.map((option) => (
                            <MenuChip key={option} selected={option === rate} onClick={() => changeRate(option)}>
                                {rateLabel(option)}
                            </MenuChip>
                        ))}
                    </div>

                    <div className="mt-3 hidden border-t border-white/10 pt-2.5 text-xs leading-relaxed text-white/55 sm:block">
                        <p className="mb-1 font-semibold text-white/60">Keyboard shortcuts</p>
                        <p>Space — play / pause · ← → — 10 seconds</p>
                        <p>↑ ↓ — volume · M — mute · F — full screen</p>
                    </div>
                </div>
            )}

            {/* Before the first play: the course's cover, the play button and
                the lesson's name — never the video's own frame. It's ours, not
                YouTube's waiting screen, so it carries no YouTube title or link. */}
            {!started && !failed && (
                <button
                    type="button"
                    onClick={start}
                    aria-label={`Play ${title}`}
                    className="group absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 overflow-hidden bg-black px-6 text-center text-white focus-visible:outline-none sm:gap-5"
                >
                    {coverImage ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={coverImage}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                            />
                            {/* Dark enough for white text on any cover. */}
                            <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/90 via-black/65 to-black/45" />
                        </>
                    ) : (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute left-1/2 top-1/2 size-112 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                        />
                    )}
                    <PlayBadge pulse={!starting} loading={starting} className="size-14 shrink-0 sm:size-20" />
                    <span className="relative max-w-xl space-y-1 sm:space-y-1.5">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug drop-shadow-sm sm:text-xl">{title}</span>
                        {subtitle && <span className="block text-xs tabular-nums text-white/70 sm:text-sm">{subtitle}</span>}
                    </span>
                </button>
            )}

            {failed && (
                <div className="absolute inset-0 z-40 grid place-items-center bg-black px-6 text-center">
                    <div className="max-w-sm space-y-2">
                        <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden />
                        <p className="font-semibold">This video can&apos;t play right now</p>
                        <p className="text-sm text-white/60">
                            Check your internet connection and refresh the page. If it keeps happening, let us know
                            from Support.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * The play button: a violet core in a dark glass ring with an even glow, so it
 * stands out on a bright whiteboard frame and a dark one alike. On the cover it sends
 * out a slow ripple asking to be pressed (still, for anyone whose device
 * asks for less motion) and grows a touch under the pointer.
 */
function PlayBadge({
    pulse = false,
    loading = false,
    className,
}: {
    pulse?: boolean;
    loading?: boolean;
    className?: string;
}) {
    return (
        <span aria-hidden className={cn("relative grid place-items-center", className)}>
            {pulse && (
                // Tailwind's ping, slowed from 1s to a calmer 2.2s.
                <span
                    className="absolute inset-0 animate-ping rounded-full bg-violet-400/40 motion-reduce:hidden"
                    style={{ animationDuration: "2.2s" }}
                />
            )}
            {/* An even violet glow on every side, so the button looks centred. */}
            <span className="absolute -inset-3 rounded-full bg-violet-500/35 blur-xl transition-opacity duration-300 group-hover:opacity-80 sm:-inset-4" />
            {/* The glass ring — and the keyboard focus ring, when the cover has focus. */}
            <span className="absolute -inset-1.5 rounded-full bg-black/25 ring-1 ring-white/35 backdrop-blur-md transition-colors duration-300 group-hover:bg-black/35 group-focus-visible:ring-2 group-focus-visible:ring-white sm:-inset-2" />
            <span className="relative grid size-full place-items-center rounded-full bg-[linear-gradient(145deg,var(--violet-400),var(--violet-600)_55%,var(--violet-800))] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-3px_8px_rgb(0_0_0/0.18)] transition-transform duration-300 ease-out group-hover:scale-[1.07] group-active:scale-95">
                {loading ? (
                    <LoaderCircle className="size-[42%] animate-spin" />
                ) : (
                    // A rounded triangle. The viewBox starts 0.8 in, which moves it
                    // left until its visual middle (between its box's centre and
                    // its centroid) sits on the circle's centre.
                    <svg viewBox="0.8 0 24 24" className="size-[50%] drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
                        <path
                            fill="currentColor"
                            d="M7 5.27v13.46c0 1.17 1.28 1.89 2.28 1.28l10.9-6.73a1.5 1.5 0 0 0 0-2.56L9.28 3.99C8.28 3.38 7 4.1 7 5.27z"
                        />
                    </svg>
                )}
            </span>
        </span>
    );
}

/**
 * The viewer's email over the video, jumping to a new spot every 2 seconds —
 * always, playing or not — so a screen recording shows whose account made
 * it. Positioned within the picture only, never the letterbox around it.
 */
function MovingWatermark({ text }: { text: string }) {
    // Fixed first spot, so the server and browser render the same thing.
    const [spot, setSpot] = useState({ x: 8, y: 10, key: 0 });

    useEffect(() => {
        const id = window.setInterval(() => {
            setSpot((previous) => ({
                x: Math.round(Math.random() * 100),
                y: 6 + Math.round(Math.random() * 82),
                key: previous.key + 1,
            }));
        }, 2000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <span
            aria-hidden
            className="pointer-events-none absolute z-50 select-none"
            // translate by the same percentage keeps the text inside the frame at either edge.
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: `translate(-${spot.x}%, -${spot.y}%)` }}
        >
            <span
                key={spot.key}
                className="block whitespace-nowrap text-xs font-semibold text-[#ff4d4f]/85 duration-500 animate-in fade-in [text-shadow:0_1px_2px_rgb(0_0_0/0.5)] sm:text-sm"
            >
                {text}
            </span>
        </span>
    );
}

/** One choice in the settings menu — a quality or a speed. */
function MenuChip({
    selected,
    onClick,
    className,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    className?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={onClick}
            className={cn(
                "relative rounded-lg px-1 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/85 hover:bg-white/15",
                className,
            )}
        >
            {children}
        </button>
    );
}

function ControlButton({
    label,
    className,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={cn(
                // A little smaller on phones, so the whole row fits a 360px screen.
                "relative grid size-8 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:size-9 [&>svg]:size-4.5 sm:[&>svg]:size-5",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface SliderProps {
    label: string;
    value: number;
    max: number;
    step: number;
    valueText: string;
    /** The stretch already downloaded, 0–1 — the seek bar's lighter fill. */
    buffered?: number;
    /** A tooltip over the pointer, e.g. the time you'd jump to. */
    hoverLabel?: (value: number) => string;
    /** While dragging. */
    onScrub: (value: number) => void;
    /** On release, or a key press. */
    onCommit: (value: number) => void;
    className?: string;
}

/** A drag-or-click bar (seek, volume) that also works with the arrow keys. */
function Slider({
    label,
    value,
    max,
    step,
    valueText,
    buffered,
    hoverLabel,
    onScrub,
    onCommit,
    className,
}: SliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [hover, setHover] = useState<number | null>(null);

    const fractionAt = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        return rect && rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
    };
    const percent = max > 0 ? clamp(value / max, 0, 1) * 100 : 0;

    return (
        <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={Math.round(max)}
            aria-valuenow={Math.round(value)}
            aria-valuetext={valueText}
            onPointerDown={(event) => {
                if (event.button !== 0 || max <= 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                onScrub(fractionAt(event.clientX) * max);
            }}
            onPointerMove={(event) => {
                const fraction = fractionAt(event.clientX);
                if (event.pointerType === "mouse") setHover(fraction);
                if (dragging) onScrub(fraction * max);
            }}
            onPointerUp={(event) => {
                if (!dragging) return;
                setDragging(false);
                onCommit(fractionAt(event.clientX) * max);
            }}
            onPointerCancel={() => {
                if (!dragging) return;
                setDragging(false);
                onCommit(value);
            }}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(event) => {
                let next: number | null = null;
                if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + step;
                else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - step;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = max;
                if (next === null) return;
                event.preventDefault();
                event.stopPropagation();
                onCommit(clamp(next, 0, max));
            }}
            className={cn(
                "group/slider relative flex h-4 cursor-pointer touch-none items-center outline-none",
                className,
            )}
        >
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 group-hover/slider:h-1.5 group-focus-visible/slider:h-1.5">
                {buffered !== undefined && (
                    <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${clamp(buffered, 0, 1) * 100}%` }} />
                )}
                <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span
                aria-hidden
                className={cn(
                    "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-transform duration-150 group-hover/slider:scale-100 group-focus-visible/slider:scale-100 group-focus-visible/slider:ring-2 group-focus-visible/slider:ring-white",
                    dragging ? "scale-100" : "scale-0",
                )}
                style={{ left: `${percent}%` }}
            />
            {hoverLabel && hover !== null && max > 0 && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/90 px-1.5 py-0.5 text-xs tabular-nums text-white ring-1 ring-white/10"
                    style={{ left: `clamp(1.5rem, ${hover * 100}%, calc(100% - 1.5rem))` }}
                >
                    {hoverLabel(hover * max)}
                </span>
            )}
        </div>
    );
}
