<script lang="ts">
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import type { Snippet } from "svelte";

    let { children, footer } = $props<{
        children: Snippet;
        footer?: Snippet;
    }>();
</script>

<main
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-primary px-5 py-[max(3.5rem,var(--safe-area-inset-top))]"
>
    <!-- light same-hue gradient wash -->
    <div
        class="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_40%,rgba(255,255,255,0)_60%),linear-gradient(340deg,rgba(10,54,86,0.4),rgba(10,54,86,0)_60%)]"
    ></div>
    <!-- subtle grid texture behind the card -->
    <div
        class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_72%)]"
    ></div>
    <!-- soft same-hue depth blobs -->
    <div
        class="absolute -left-24 -top-24 h-96 w-96 rounded-circle bg-white/10 blur-3xl"
    ></div>
    <div
        class="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-circle bg-primary-strong/35 blur-3xl"
    ></div>
    <!-- glow behind the card -->
    <div
        class="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-circle bg-[radial-gradient(circle,rgba(255,255,255,0.13),transparent_65%)]"
    ></div>

    <!-- wordmark -->
    <div class="auth-rise relative mb-14 text-center">
        <p class="text-xl font-bold tracking-tight text-white">Eat Right</p>
        <p
            class="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"
        >
            Loyola College
        </p>
    </div>

    <!-- floating card -->
    <div
        class="auth-rise relative w-full max-w-[26rem] rounded-[32px] bg-surface p-7 pt-0 shadow-float ring-1 ring-black/5 sm:p-9 sm:pt-0"
        style="animation-delay: 90ms"
    >
        <!-- logo chip straddling the card edge -->
        <div class="flex justify-center">
            <div
                class="-mt-9 flex h-18 w-18 items-center justify-center rounded-[22px] border border-line bg-surface shadow-card"
            >
                <img
                    src={LoyolaCollegeLogo}
                    alt="Loyola College"
                    class="h-13 w-auto object-contain"
                />
            </div>
        </div>

        {@render children()}
    </div>

    {#if footer}
        <div
            class="auth-rise relative mt-8 text-center"
            style="animation-delay: 180ms"
        >
            {@render footer()}
        </div>
    {/if}

    <p
        class="absolute bottom-[max(1.25rem,var(--safe-area-inset-bottom))] text-xs text-white/35"
    >
        Designed by Rockfort Labs.
    </p>
</main>

<style>
    @media (prefers-reduced-motion: no-preference) {
        .auth-rise {
            animation: auth-rise 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes auth-rise {
            from {
                opacity: 0;
                transform: translateY(14px);
            }
        }
    }
</style>
