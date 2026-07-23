import { tick } from "svelte";

/**
 * Runs a state update inside a document view transition when the browser
 * supports it (and the user hasn't asked for reduced motion), so the old
 * and new DOM crossfade/morph instead of hard-swapping. Falls back to a
 * plain synchronous update everywhere else.
 */
export function withViewTransition(update: () => void): void {
    if (
        typeof document === "undefined" ||
        !document.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        update();
        return;
    }

    document.startViewTransition(async () => {
        update();
        await tick();
    });
}
