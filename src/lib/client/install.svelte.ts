import { browser } from "$app/environment";

const DISMISS_KEY = "eatright:install-dismissed";
const SEEN_KEY = "eatright:install-seen";

/** Stop volunteering the nudge once it has been ignored this many times. */
const MAX_NUDGES = 3;

/**
 * How the current browser can — or can't — install the app.
 *
 *   installed    already running from the home screen
 *   promptable   Chrome fired beforeinstallprompt; one tap does it
 *   ios          iOS Safari, which has no install API — needs manual steps
 *   webview      an in-app browser that cannot install at all
 *   unsupported  a browser with no install path worth offering
 */
export type InstallMode =
    | "installed"
    | "promptable"
    | "ios"
    | "webview"
    | "unsupported";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
    if (!browser) return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        // Safari's own flag, set when launched from the home screen.
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

function isIOS(): boolean {
    if (!browser) return false;
    const ua = navigator.userAgent;
    // Settle Android first: the iPadOS fallback below keys off a Mac-like
    // platform string, which an Android device under emulation can also
    // report, and misreading Android as iOS would hide the real prompt.
    if (/Android/.test(ua)) return false;
    return (
        /iPad|iPhone|iPod/.test(ua) ||
        // iPadOS 13+ claims to be a Mac; the touch points give it away.
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}

/**
 * In-app browsers can't install anything, and a link shared in a class group
 * chat opens in one of them. Detect them so we send people to a real browser
 * instead of showing a button that silently does nothing.
 */
function isWebView(): boolean {
    if (!browser) return false;
    const ua = navigator.userAgent;
    if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/i.test(ua)) {
        return true;
    }
    // Android WebViews mark themselves; Chrome Custom Tabs do not.
    if (/\bwv\b/.test(ua)) return true;
    // Every real iOS browser ships "Safari" in its UA. A WKWebView doesn't —
    // and neither Chrome nor Firefox on iOS can add to the home screen, so
    // both belong in the "open it elsewhere" bucket too.
    if (isIOS() && !/Safari/.test(ua)) return true;
    if (isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return true;
    return false;
}

function readCount(key: string): number {
    if (!browser) return 0;
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
}

class InstallState {
    #deferred: BeforeInstallPromptEvent | null = null;
    #started = false;

    mode = $state<InstallMode>("unsupported");
    dismissed = $state(false);
    nudgesSeen = $state(0);

    /** Called once from the root layout — beforeinstallprompt fires early. */
    start() {
        if (!browser || this.#started) return;
        this.#started = true;

        this.dismissed = localStorage.getItem(DISMISS_KEY) === "1";
        this.nudgesSeen = readCount(SEEN_KEY);
        this.#refresh();

        window.addEventListener("beforeinstallprompt", (event) => {
            // Suppress Chrome's own mini-infobar so the app can ask at a
            // moment it chooses instead.
            event.preventDefault();
            this.#deferred = event as BeforeInstallPromptEvent;
            this.#refresh();
        });

        window.addEventListener("appinstalled", () => {
            this.#deferred = null;
            this.mode = "installed";
        });

        window
            .matchMedia("(display-mode: standalone)")
            .addEventListener("change", () => this.#refresh());
    }

    #refresh() {
        if (isStandalone()) {
            this.mode = "installed";
            return;
        }
        if (this.#deferred) {
            this.mode = "promptable";
            return;
        }
        if (isWebView()) {
            this.mode = "webview";
            return;
        }
        if (isIOS()) {
            this.mode = "ios";
            return;
        }
        this.mode = "unsupported";
    }

    /** Whether it's worth showing an install entry point at all. */
    get isOfferable(): boolean {
        return this.mode !== "installed" && this.mode !== "unsupported";
    }

    /** Whether to volunteer the nudge unprompted. */
    get shouldNudge(): boolean {
        return (
            this.isOfferable &&
            !this.dismissed &&
            this.nudgesSeen < MAX_NUDGES
        );
    }

    get isIOS(): boolean {
        return isIOS();
    }

    async promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
        const deferred = this.#deferred;
        if (!deferred) return "unavailable";

        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        // The event is single-use; Chrome re-fires it if the user declines.
        this.#deferred = null;
        this.#refresh();
        return outcome;
    }

    /** Record that the nudge was shown, so it fades away if ignored. */
    countNudge() {
        if (!browser) return;
        this.nudgesSeen += 1;
        localStorage.setItem(SEEN_KEY, String(this.nudgesSeen));
    }

    dismiss() {
        this.dismissed = true;
        if (browser) localStorage.setItem(DISMISS_KEY, "1");
    }
}

export const install = new InstallState();
