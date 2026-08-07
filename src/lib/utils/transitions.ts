import { cubicOut, linear } from "svelte/easing";

function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

type ContentRevealOptions = {
    duration?: number;
};

export function contentReveal(
    _node: Element,
    options: ContentRevealOptions = {},
) {
    const duration = prefersReducedMotion() ? 0 : (options.duration ?? 280);

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
    const duration = prefersReducedMotion() ? 0 : (options.duration ?? 260);

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

type SlideDownOptions = {
    duration?: number;
    delay?: number;
    distance?: number;
};

// Opacity has to finish well before the travel does, otherwise the element
// is still translucent while it settles and the landing reads as a smear.
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

// Overshoot is deliberately gentler than the textbook back curve (c1 =
// 1.70158): the receipt should dip a hair past its resting place and settle,
// not bounce.
const easeOutBack = (x: number) => {
    const c1 = 1.5;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

/**
 * Drop-in from above — the element falls into place and settles, for content
 * revealed after something covering it lifts away. Pass a staggered `delay`
 * across siblings to cascade them. Honors reduced-motion.
 */
export function slideDown(_node: Element, options: SlideDownOptions = {}) {
    const reduceMotion = prefersReducedMotion();
    const distance = options.distance ?? 26;

    return {
        duration: reduceMotion ? 0 : (options.duration ?? 520),
        delay: reduceMotion ? 0 : (options.delay ?? 0),
        // Each property carries its own curve below, so the transition
        // itself must not pre-ease the clock.
        easing: linear,
        css: (t: number) =>
            `opacity:${easeOutCubic(Math.min(t * 1.7, 1))};` +
            `transform:translate3d(0,${((easeOutBack(t) - 1) * distance).toFixed(3)}px,0);` +
            "will-change:transform,opacity;",
    };
}
