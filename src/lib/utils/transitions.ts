import { cubicOut } from "svelte/easing";

type ContentRevealOptions = {
    duration?: number;
};

export function contentReveal(
    _node: Element,
    options: ContentRevealOptions = {},
) {
    const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : (options.duration ?? 280);

    return {
        duration,
        easing: cubicOut,
        css: (t: number) => `opacity:${t};will-change:opacity`,
    };
}
