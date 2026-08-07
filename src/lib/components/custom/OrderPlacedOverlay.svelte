<script lang="ts">
    import { onMount } from "svelte";
    import { cubicOut } from "svelte/easing";

    type Props = {
        /** Grand total actually charged, as returned by checkout. */
        total: number;
        /** How many counters the checkout split across. */
        counters: number;
        /** Item count from the cart that was just cleared. */
        items: number;
        /** True once the receipt behind the veil is ready to be shown. */
        ready: boolean;
        /** Called once, when the veil should lift. */
        onDone: () => void;
    };

    let { total, counters, items, ready, onDone }: Props = $props();

    // The tick always plays long enough to be read, then hands off the moment
    // the receipt is ready. A slow counter API must never trap someone behind
    // the veil, so there is a hard ceiling as well.
    const MIN_VISIBLE_MS = 1300;
    const MIN_VISIBLE_STILL_MS = 650;
    const MAX_VISIBLE_MS = 4200;

    const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let minimumElapsed = $state(false);
    let timedOut = $state(false);
    let handedOff = false;

    const amount = $derived(
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
        }).format(Number(total) || 0),
    );

    const detail = $derived(
        [
            items > 0 ? `${items} ${items === 1 ? "item" : "items"}` : null,
            counters > 1 ? `${counters} counters` : null,
        ]
            .filter(Boolean)
            .join(" · "),
    );

    function veilLift(_node: Element) {
        return {
            duration: reduceMotion ? 0 : 320,
            easing: cubicOut,
            css: (t: number) =>
                `opacity:${t};pointer-events:none;will-change:opacity`,
        };
    }

    onMount(() => {
        const timers = [
            setTimeout(
                () => (minimumElapsed = true),
                reduceMotion ? MIN_VISIBLE_STILL_MS : MIN_VISIBLE_MS,
            ),
            setTimeout(() => (timedOut = true), MAX_VISIBLE_MS),
            // A short double tap timed to the check landing. Kept for
            // reduced-motion too — it is a separate sense, not motion.
            setTimeout(
                () => {
                    try {
                        navigator.vibrate?.([12, 44, 20]);
                    } catch {
                        // Vibration is unsupported or blocked by policy.
                    }
                },
                reduceMotion ? 0 : 260,
            ),
        ];

        return () => timers.forEach(clearTimeout);
    });

    $effect(() => {
        if (handedOff) return;
        if (!((minimumElapsed && ready) || timedOut)) return;
        handedOff = true;
        onDone();
    });
</script>

<div
    class="veil fixed inset-0 z-70 flex flex-col items-center justify-center bg-canvas px-8 text-center"
    role="status"
    aria-live="polite"
    out:veilLift
>
    <svg class="h-20 w-20" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <g class="disc-group">
            <circle class="disc" cx="60" cy="60" r="54" />
            <path class="check" d="M38 62 L53 77 L82 44" />
        </g>
    </svg>

    <h1 class="headline mt-6 text-xl font-bold tracking-tight text-ink">
        Order placed
    </h1>

    <p
        class="amount mt-2 font-geist-mono text-base font-semibold text-ink-muted tabular-nums"
    >
        {amount}{detail ? ` · ${detail}` : ""}
    </p>

    {#if minimumElapsed && !ready}
        <p class="waiting mt-6 text-xs font-medium text-ink-faint">
            Preparing your receipt…
        </p>
    {/if}
</div>

<style>
    .veil {
        animation: veil-in 200ms ease both;
    }

    @keyframes veil-in {
        from {
            opacity: 0;
        }
    }

    .disc-group {
        transform-origin: 60px 60px;
        animation: disc-pop 520ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
    }

    @keyframes disc-pop {
        from {
            transform: scale(0);
        }
        to {
            transform: scale(1);
        }
    }

    .disc {
        fill: var(--color-success);
    }

    .check {
        fill: none;
        stroke: #fff;
        stroke-width: 9;
        stroke-linecap: round;
        stroke-linejoin: round;
        /* Slightly longer than the path so it starts fully hidden. */
        stroke-dasharray: 68;
        stroke-dashoffset: 68;
        animation: check-draw 380ms cubic-bezier(0.65, 0, 0.35, 1) 260ms both;
    }

    @keyframes check-draw {
        to {
            stroke-dashoffset: 0;
        }
    }

    .headline {
        animation: rise 420ms cubic-bezier(0.22, 1, 0.36, 1) 380ms both;
    }

    .amount {
        animation: rise 420ms cubic-bezier(0.22, 1, 0.36, 1) 460ms both;
    }

    .waiting {
        animation: rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes rise {
        from {
            opacity: 0;
            transform: translate3d(0, 10px, 0);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .veil,
        .disc-group,
        .check,
        .headline,
        .amount,
        .waiting {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
        }
    }
</style>
