/**
 * YouTube's IFrame Player API, as the lesson player and the lesson-length
 * collector use it — loaded once per page, typed to the slice we call.
 */

export interface YTPlayer {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    cueVideoById(videoId: string): void;
    /** Loads (and plays) a video from a given second, with a fresh buffer. */
    loadVideoById(options: { videoId: string; startSeconds?: number }): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    setVolume(volume: number): void;
    getVolume(): number;
    getDuration(): number;
    getCurrentTime(): number;
    getVideoLoadedFraction(): number;
    getVideoUrl(): string;
    getPlayerState(): number;
    setPlaybackRate(rate: number): void;
    getPlaybackRate(): number;
    getAvailablePlaybackRates(): number[];
    /** What's playing now ("hd720", "large", …); "unknown" before playback. */
    getPlaybackQuality(): string;
    /** Every quality this video has; empty until it has started playing. */
    getAvailableQualityLevels(): string[];
    destroy(): void;
}

export interface YTEvent<T = number> {
    target: YTPlayer;
    data: T;
}

type YTEventName = "onReady" | "onStateChange" | "onError" | "onPlaybackRateChange" | "onPlaybackQualityChange";

interface YTNamespace {
    Player: new (
        element: HTMLElement,
        options: {
            host?: string;
            videoId: string;
            width?: string;
            height?: string;
            playerVars?: Record<string, string | number>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- quality events carry a string, the rest a number
            events?: Partial<Record<YTEventName, (event: YTEvent<any>) => void>>;
        },
    ) => YTPlayer;
}

declare global {
    interface Window {
        YT?: YTNamespace;
        onYouTubeIframeAPIReady?: () => void;
    }
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** The privacy-enhanced host: no cookies until a video actually plays. */
export const YT_HOST = "https://www.youtube-nocookie.com";

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads YouTube's player script once per page, however many players ask for it. */
export function loadYouTubeApi(): Promise<YTNamespace> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise<YTNamespace>((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            if (window.YT) resolve(window.YT);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
            apiPromise = null;
            reject(new Error("Couldn't load the video player."));
        };
        document.head.appendChild(script);
    });
    return apiPromise;
}

/* ---- Quality ------------------------------------------------------------- */

/**
 * YouTube stopped honouring quality requests from embedded players in 2019,
 * but it still caps quality by the size the player is drawn at (times the
 * screen's pixel density). So a quality is chosen by giving the frame that
 * size and scaling it to fit. Measured in a real browser:
 *
 *   frame height × pixel ratio   →  quality YouTube plays
 *   1080 → 1080p · 720 → 720p · 480 → 720p · 360 → 480p · smaller → still 480p
 *
 * — so 480p is the lowest that can be asked for, and each level below maps
 * to the frame height that lands on it. It's a ceiling: YouTube can still
 * pick lower, and no API call can stop it (`setPlaybackQuality` exists but
 * does nothing; `vq` and raw player messages are ignored — all measured).
 * The lesson player holds playback instead until YouTube plays the choice.
 */
export const QUALITY_FRAME_HEIGHT = {
    hd2160: 2160,
    hd1440: 1440,
    hd1080: 1080,
    hd720: 720,
    large: 360,
} as const;

export type QualityChoice = keyof typeof QUALITY_FRAME_HEIGHT;

export const QUALITY_CHOICES = Object.keys(QUALITY_FRAME_HEIGHT) as QualityChoice[];

/** The picture height of each YouTube quality code, to tell higher from lower. */
export const QUALITY_HEIGHT: Record<string, number> = {
    hd2160: 2160,
    hd1440: 1440,
    hd1080: 1080,
    hd720: 720,
    large: 480,
    medium: 360,
    small: 240,
    tiny: 144,
};

/** Plain names for YouTube's quality codes. */
export const QUALITY_LABEL: Record<string, string> = {
    hd2160: "4K",
    hd1440: "1440p",
    hd1080: "1080p",
    hd720: "720p",
    large: "480p",
    medium: "360p",
    small: "240p",
    tiny: "144p",
};

/* ---- Lesson lengths ------------------------------------------------------ */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads each video's running time with one invisible player: load the first,
 * then switch it to each of the others without playing anything. Only the
 * video's details are fetched — no video data — so a whole course takes a
 * few seconds.
 *
 * Right after a switch the player still reports the *previous* video's
 * length for a moment, so a length is only trusted once the player's own
 * video address names the video asked for.
 *
 * Videos are pulled one at a time from `takeNext`, so the caller can keep
 * adding to its queue while this runs (lessons that unlock mid-visit).
 */
export async function measureYouTubeDurations(
    takeNext: () => string | undefined,
    onDuration: (youtubeId: string, seconds: number) => void,
    shouldStop: () => boolean,
): Promise<void> {
    const first = takeNext();
    if (!first) return;
    const YT = await loadYouTubeApi();
    if (shouldStop()) return;

    // On screen but invisible and untouchable — a frame pushed off-screen can
    // be throttled by the browser.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    Object.assign(host.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "320px",
        height: "180px",
        opacity: "0",
        pointerEvents: "none",
        zIndex: "-1",
    });
    const target = document.createElement("div");
    host.appendChild(target);
    document.body.appendChild(host);

    let player: YTPlayer | null = null;

    const readDuration = async (youtubeId: string) => {
        for (let attempt = 0; attempt < 60 && !shouldStop(); attempt++) {
            const current = player;
            if (!current) return 0;
            const seconds = current.getDuration();
            if (seconds > 0 && (current.getVideoUrl() ?? "").includes(youtubeId)) return seconds;
            await sleep(100);
        }
        return 0;
    };

    try {
        player = await new Promise<YTPlayer | null>((resolve) => {
            const timer = setTimeout(() => resolve(null), 15_000);
            new YT.Player(target, {
                host: YT_HOST,
                videoId: first,
                width: "100%",
                height: "100%",
                playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, mute: 1, origin: window.location.origin },
                events: {
                    onReady: (event) => {
                        clearTimeout(timer);
                        resolve(event.target);
                    },
                },
            });
        });
        if (!player) return;

        for (let youtubeId: string | undefined = first; youtubeId && !shouldStop(); youtubeId = takeNext()) {
            if (youtubeId !== first) player.cueVideoById(youtubeId);
            const seconds = await readDuration(youtubeId);
            if (seconds > 0 && !shouldStop()) onDuration(youtubeId, seconds);
        }
    } finally {
        try {
            player?.destroy();
        } catch {
            // Already gone with the page.
        }
        host.remove();
    }
}
