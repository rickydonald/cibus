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

type CollapseOptions = {
    duration?: number;
    delay?: number;
};

/**
 * Collapse-and-fade — like `slide`, but it also fades opacity and shrinks the
 * element's own borders/margins, so a removed list row or card melts away and
 * the layout closes the gap smoothly. Pair with `animate:flip` on siblings so
 * they glide into the freed space. Honors reduced-motion.
 */
export function collapse(node: Element, options: CollapseOptions = {}) {
    const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : (options.duration ?? 260);

    const style = getComputedStyle(node);
    const height = parseFloat(style.height);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const marginTop = parseFloat(style.marginTop);
    const marginBottom = parseFloat(style.marginBottom);
    const borderTopWidth = parseFloat(style.borderTopWidth);
    const borderBottomWidth = parseFloat(style.borderBottomWidth);

    return {
        duration,
        delay: options.delay ?? 0,
        easing: cubicOut,
        css: (t: number) =>
            "overflow: hidden;" +
            `opacity: ${t};` +
            `height: ${t * height}px;` +
            `padding-top: ${t * paddingTop}px;` +
            `padding-bottom: ${t * paddingBottom}px;` +
            `margin-top: ${t * marginTop}px;` +
            `margin-bottom: ${t * marginBottom}px;` +
            `border-top-width: ${t * borderTopWidth}px;` +
            `border-bottom-width: ${t * borderBottomWidth}px;`,
    };
}
