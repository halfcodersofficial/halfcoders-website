/**
 * DevTools protection
 * (main code/client/src/lib/security/devtoolsProtection.ts), in Half Coders'
 * colours.
 *
 * On only when NEXT_PUBLIC_ENABLE_DEVTOOLS_PROTECTION is "true", which the
 * production image sets (Dockerfile.prod); unset, as in local dev, every
 * browser tool works normally. A custom NEXT_PUBLIC_ variable because Next
 * overrides NODE_ENV per command.
 */
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand";
import envConfig from "@/lib/envConfig";

// Capture the native console methods at MODULE LOAD — before overrideConsole()
// swaps them for no-ops. The console-based DevTools probe needs a real
// console.debug to trigger the property getter, and the security banner needs
// a real console.log/warn to actually print.
const nativeConsole = {
    debug: console.debug.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
};

let devtoolsOpen = false;
let warningOverlay: HTMLDivElement | null = null;

// ─── Mobile Detection ───────────────────────────────────────────────────────

// The size-based and debugger-timing heuristics below are desktop-only
// signals in disguise:
//   - Size-based: mobile browser chrome (address bar + toolbar) routinely
//     eats more than the 160px threshold on its own — especially iOS Safari
//     in portrait — so it false-positives on virtually every visit.
//   - Debugger-timing: ordinary main-thread jank on a throttled mobile CPU
//     (GC pauses, background-tab throttling) can push a trivial function
//     call past the 100ms threshold with no debugger attached at all.
// Real "DevTools open while browsing" only happens via a desktop-attached
// remote/USB debugger, which is a developer scenario, not a visitor one —
// so both checks are skipped on touch/mobile devices.
function isMobileDevice() {
    if (typeof navigator === "undefined") return false;
    const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
    return isTouch && isMobileUA;
}

// ─── DevTools Detection ─────────────────────────────────────────────────────

function createWarningOverlay() {
    if (warningOverlay) return;

    warningOverlay = document.createElement("div");
    warningOverlay.id = "devtools-warning-overlay";
    warningOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(26, 13, 61, 0.96);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
        backdrop-filter: blur(8px);
    `;

    warningOverlay.innerHTML = `
        <div style="text-align:center;color:#fff;max-width:480px;padding:2rem;">
            <div style="font-size:4rem;margin-bottom:1rem;">🛡️</div>
            <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:0.75rem;color:#f87171;">
                Developer Tools Detected
            </h2>
            <p style="font-size:0.95rem;color:#cbd5e1;line-height:1.6;margin-bottom:1.5rem;">
                For security reasons, this application does not allow Developer Tools to be open.
                Please close Developer Tools to continue using the application.
            </p>
            <div style="display:inline-block;padding:0.5rem 1.5rem;border-radius:0.75rem;background:#7432f0;color:#fff;font-weight:700;font-size:0.875rem;">
                Close DevTools to continue
            </div>
        </div>
    `;

    document.body.appendChild(warningOverlay);
}

function removeWarningOverlay() {
    if (warningOverlay) {
        warningOverlay.remove();
        warningOverlay = null;
    }
}

// Size-based detection
function checkDevToolsBySize() {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    return widthDiff || heightDiff;
}

// Console-based detection (catches undocked DevTools too)
// Uses a getter on a logged object — the getter only fires when DevTools
// is open and tries to display the object.
let consoleDetected = false;

function checkDevToolsByConsole() {
    const el = new Image();
    Object.defineProperty(el, "id", {
        get: () => {
            consoleDetected = true;
        },
    });

    // Clear and re-check: if DevTools is open, the getter fires immediately
    consoleDetected = false;

    // Use the NATIVE console.debug captured at module load — the public
    // console.debug has been replaced with a no-op by overrideConsole().
    nativeConsole.debug(el);
    return consoleDetected;
}

// Debugger-timing detection (catches detached/undocked DevTools that the
// size heuristic misses). A `debugger` statement is a no-op when DevTools is
// closed, but pauses execution when it is open — so the elapsed time spikes.
//
// CRITICAL: the statement must be built from a STRING via `new Function`, not
// written as a literal `debugger;`. The production minifier drops literal
// `debugger` statements as dead code, which silently disables this detector
// in the deployed bundle. Hiding it inside a string defeats that pass.
// Requires `script-src` to permit eval — Half Coders sets no CSP, so it's allowed;
// still guarded with try/catch in case a stricter policy is introduced later.
let debuggerProbe: (() => void) | null | undefined;

function getDebuggerProbe(): (() => void) | null {
    if (debuggerProbe !== undefined) return debuggerProbe;
    try {
        debuggerProbe = new Function("debugger") as () => void;
    } catch {
        // eval blocked by CSP — fall back to size/console detection only.
        debuggerProbe = null;
    }
    return debuggerProbe;
}

function checkDevToolsByDebugger() {
    const probe = getDebuggerProbe();
    if (!probe) return false;
    const start = performance.now();
    probe();
    return performance.now() - start > 100;
}

function checkDevTools() {
    // Size and debugger-timing heuristics are unreliable on mobile chrome/CPUs
    // (see isMobileDevice() above) — only the console-based probe runs there.
    const sizeDetected = isMobileDevice() ? false : checkDevToolsBySize();
    const consoleOpen = checkDevToolsByConsole();
    const debuggerOpen = isMobileDevice() ? false : checkDevToolsByDebugger();

    const isOpen = sizeDetected || consoleOpen || debuggerOpen;

    if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true;
        createWarningOverlay();
    } else if (!isOpen && devtoolsOpen) {
        devtoolsOpen = false;
        removeWarningOverlay();
    }
}

// ─── Keyboard Shortcut Blocking ─────────────────────────────────────────────

function blockShortcuts(e: KeyboardEvent) {
    // F12
    if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd + Shift + I (Inspector)
    if (ctrlOrMeta && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Ctrl/Cmd + Shift + J (Console)
    if (ctrlOrMeta && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Ctrl/Cmd + Shift + C (Element picker)
    if (ctrlOrMeta && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Ctrl/Cmd + U (View source)
    if (ctrlOrMeta && !e.shiftKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

// ─── Context Menu Blocking ──────────────────────────────────────────────────

function blockContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

// ─── Console Override ───────────────────────────────────────────────────────

function overrideConsole() {
    // Show a styled self-XSS scam warning FIRST, using the native console
    // methods captured at module load (the public ones are about to be
    // no-op'd below). This banner is the single most useful part of this
    // module: it protects non-technical users from "paste this in the
    // console" account-takeover social engineering.
    nativeConsole.log(
        "%c🛡️ Security Warning",
        "color: #f87171; font-size: 2rem; font-weight: 900; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);",
    );
    nativeConsole.warn(
        "%c⚠️ Stop! This browser feature is intended for developers only.\n\n" +
            "If someone told you to copy-paste something here, " +
            "it is a scam and will give them access to your account.\n\n" +
            "This console is monitored for security purposes.",
        "color: #fbbf24; font-size: 1rem; font-weight: 700; line-height: 1.6;",
    );
    nativeConsole.log(
        `%c${BRAND_NAME} — ${SITE_DOMAIN}`,
        "color: #7c2cf6; font-size: 0.85rem; font-weight: 600;",
    );

    // Now silence all console methods
    const noop = () => {};
    const methods: (keyof Console)[] = [
        "log", "warn", "error", "debug", "info", "table", "trace",
        "dir", "dirxml", "group", "groupCollapsed", "groupEnd",
        "count", "countReset", "time", "timeLog", "timeEnd",
        "profile", "profileEnd",
    ];

    for (const method of methods) {
        try {
            (console as unknown as Record<string, unknown>)[method] = noop;
        } catch {
            // Some console methods may be non-configurable in certain browsers
        }
    }
}

// ─── Source Selection Block ─────────────────────────────────────────────────

function blockTextSelection() {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    // Allow text selection in input/textarea elements for usability
    const style = document.createElement("style");
    style.id = "devtools-protection-style";
    style.textContent = `
        input, textarea, [contenteditable="true"] {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
    `;
    document.head.appendChild(style);
}

function restoreTextSelection() {
    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";
    const style = document.getElementById("devtools-protection-style");
    if (style) style.remove();
}

// ─── Drag Prevention ────────────────────────────────────────────────────────

function blockDragStart(e: DragEvent) {
    // Allow drag on actual drag-enabled elements (file inputs, etc.)
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.getAttribute("draggable") === "true") return;
    e.preventDefault();
}

// ─── Public API ─────────────────────────────────────────────────────────────

let cleanupFn: (() => void) | null = null;

export function initDevToolsProtection() {
    // Only run when protection is explicitly enabled
    if (!envConfig.devtoolsProtection) return;

    // Prevent double-init
    if (cleanupFn) return;

    // Override console methods
    overrideConsole();

    // Block keyboard shortcuts (capture phase to intercept before browser)
    document.addEventListener("keydown", blockShortcuts, true);

    // Block right-click context menu
    document.addEventListener("contextmenu", blockContextMenu, true);

    // Block text selection (except inputs)
    blockTextSelection();

    // Block drag
    document.addEventListener("dragstart", blockDragStart, true);

    // Periodic DevTools check (size-based + debugger-based)
    const interval = setInterval(checkDevTools, 1500);

    // Initial check
    checkDevTools();

    // Resize-based detection
    window.addEventListener("resize", checkDevTools);

    cleanupFn = () => {
        document.removeEventListener("keydown", blockShortcuts, true);
        document.removeEventListener("contextmenu", blockContextMenu, true);
        document.removeEventListener("dragstart", blockDragStart, true);
        window.removeEventListener("resize", checkDevTools);
        clearInterval(interval);
        removeWarningOverlay();
        restoreTextSelection();
        cleanupFn = null;
    };
}

export function cleanupDevToolsProtection() {
    cleanupFn?.();
}
