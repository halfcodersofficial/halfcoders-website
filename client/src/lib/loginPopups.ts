/**
 * The signal between the live-notification socket and the pop-up listener
 * (components/shared/LoginPopupListener): a pop-up broadcast has just landed
 * for whoever is signed in here, so show the pending pop-ups now rather than
 * on their next visit.
 */
export const LOGIN_POPUPS_DUE = "halfcoders:login-popups-due";

export const showPendingPopups = () => window.dispatchEvent(new Event(LOGIN_POPUPS_DUE));
