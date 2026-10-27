import { buttonVariants } from "@/components/ui/button";

/**
 * SweetAlert2 confirmations, themed to look like the rest of the console.
 *
 * Every destructive action funnels through here rather than calling
 * `window.confirm` directly: the native dialog is unstyleable, ignores dark
 * mode, and renders the origin ("localhost:3001 says") above whatever we
 * wrote — which reads as a browser warning rather than a decision the app is
 * asking for.
 */

type ConfirmTone = "danger" | "default";

interface ConfirmOptions {
    /** The decision itself, phrased as a question. */
    title: string;
    /** Consequences the admin should know before answering. Optional. */
    text?: string;
    confirmText?: string;
    cancelText?: string;
    /** `danger` paints the confirm button red and focuses Cancel instead. */
    tone?: ConfirmTone;
}

/**
 * The buttons reuse the app's own variants so a dialog's Delete looks exactly
 * like a Delete anywhere else. The popup chrome around them is themed in
 * globals.css, which can beat SweetAlert's runtime-injected stylesheet on
 * specificity — utilities passed through here cannot.
 */
const buttonClasses = (tone: ConfirmTone) => ({
    confirmButton: buttonVariants({
        variant: tone === "danger" ? "destructive" : "default",
    }),
    cancelButton: buttonVariants({ variant: "outline" }),
});

/**
 * Where to mount the dialog: inside the open popup (components/ui/modal) when
 * asked from one, otherwise on <body>. A Radix popup blocks pointer events and
 * pulls focus back from everything outside itself, so a SweetAlert on <body>
 * above it draws fine but can't be clicked. Modal also lets Escape answer the
 * SweetAlert without closing the popup underneath.
 */
const mountTarget = (): HTMLElement => {
    const popups = document.querySelectorAll<HTMLElement>('[data-modal][data-state="open"]');
    return popups[popups.length - 1] ?? document.body;
};

/**
 * Resolves `true` only when the admin explicitly confirms — dismissing with
 * Escape, the backdrop or Cancel all resolve `false`, so callers can keep the
 * `if (await confirmAction(...))` shape `window.confirm` gave them.
 */
export async function confirmAction({
    title,
    text,
    confirmText = "Confirm",
    cancelText = "Cancel",
    tone = "danger",
}: ConfirmOptions): Promise<boolean> {
    // Imported on demand: SweetAlert2 reaches for `document` at module scope,
    // and this keeps ~40kB out of the bundle of every page that never asks.
    const { default: Swal } = await import("sweetalert2");

    const result = await Swal.fire({
        target: mountTarget(),
        title,
        text,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        // Cancel sits left of Confirm, matching the button order used in the
        // app's own inline confirm/cancel pairs.
        reverseButtons: true,
        // A destructive action shouldn't have its confirm button pre-focused —
        // an Enter keypress meant for the page behind would fire it.
        focusCancel: tone === "danger",
        buttonsStyling: false,
        customClass: buttonClasses(tone),
    });

    return result.isConfirmed;
}

/**
 * Asked before every sign-out in Half Coders — a stray click shouldn't end the
 * session. `action` is the word on the button that was pressed
 * ("Log out" in the student menus, "Sign out" in the consoles), so the
 * question and its answer read the same as the button.
 */
export const confirmSignOut = (action: "Log out" | "Sign out" = "Log out") =>
    confirmAction({
        title: `${action}?`,
        text: "This signs you out of Half Coders on this device.",
        confirmText: action,
    });

interface InfoOptions {
    /** What happened / why the action didn't go through. */
    title: string;
    text?: string;
    confirmText?: string;
}

/**
 * A themed heads-up with a single acknowledgement button — for telling the
 * user why something they just clicked didn't do anything, rather than
 * failing silently or via a toast that's easy to miss.
 */
export async function infoAlert({ title, text, confirmText = "OK" }: InfoOptions): Promise<void> {
    const { default: Swal } = await import("sweetalert2");

    await Swal.fire({
        target: mountTarget(),
        title,
        text,
        icon: "info",
        confirmButtonText: confirmText,
        buttonsStyling: false,
        customClass: { confirmButton: buttonVariants({ variant: "default" }) },
    });
}

interface LoginPopupOptions {
    title: string;
    text: string;
    /** A path inside Half Coders to offer as a "View" button once the popup unlocks. */
    link?: string | null;
}

/** Also what the admin's Popup Alert preview counts down from. */
export const LOGIN_POPUP_LOCK_SECONDS = 10;

/**
 * An admin broadcast flagged to pop up at login (`LoginPopupListener`). Can't
 * be dismissed — no close button, backdrop click or Escape — for the first
 * `LOGIN_POPUP_LOCK_SECONDS` seconds, so an announcement can't be reflexively
 * clicked away before it's actually read; a footer countdown says why nothing
 * is happening. Once unlocked it behaves like any other dismissible alert,
 * plus a "View" button when the broadcast carries a link.
 *
 * Resolves the link only if the recipient clicks "View" — closing any other
 * way (the × button, backdrop, Escape) resolves `null`.
 */
export async function loginPopupAlert({ title, text, link }: LoginPopupOptions): Promise<string | null> {
    const { default: Swal } = await import("sweetalert2");

    let remaining = LOGIN_POPUP_LOCK_SECONDS;
    let interval: ReturnType<typeof setInterval> | undefined;
    const countdownText = () => `You can close this in ${remaining}s…`;
    // Read by SweetAlert at the moment of the click or keypress. Its Escape
    // and backdrop handlers keep the options object the popup opened with,
    // so flipping these through `Swal.update` never reaches them — a
    // function over this flag does.
    let unlocked = false;
    const whenUnlocked = () => unlocked;

    const result = await Swal.fire({
        // `titleText`, not `title`: SweetAlert reads `title` as HTML, and this
        // one is whatever an admin typed — "Learn <div> & CSS" must arrive as
        // written, not as markup.
        titleText: title,
        text,
        icon: "info",
        allowOutsideClick: whenUnlocked,
        allowEscapeKey: whenUnlocked,
        showConfirmButton: false,
        showCloseButton: false,
        footer: countdownText(),
        buttonsStyling: false,
        customClass: {
            confirmButton: buttonVariants({ variant: "default" }),
            // The admin's line breaks are the message's paragraphs; SweetAlert
            // would otherwise run them together.
            htmlContainer: "whitespace-pre-line",
        },
        didOpen: () => {
            interval = setInterval(() => {
                remaining -= 1;
                if (remaining > 0) {
                    const footer = Swal.getFooter();
                    if (footer) footer.textContent = countdownText();
                    return;
                }
                clearInterval(interval);
                unlocked = true;
                void Swal.update({
                    footer: "",
                    showCloseButton: true,
                    showConfirmButton: Boolean(link),
                    confirmButtonText: "View",
                });
            }, 1000);
        },
        // Stops the countdown once the popup is gone, however it got there —
        // unlocked-and-closed by the recipient, or torn down some other way.
        willClose: () => clearInterval(interval),
    });

    return result.isConfirmed && link ? link : null;
}
