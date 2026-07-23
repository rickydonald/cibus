<script lang="ts" module>
    // The entrance animation should only play on a fresh page load — not
    // when hopping between auth pages client-side, where the view
    // transition already carries the motion.
    let entranceShown = false;
</script>

<script lang="ts">
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import { browser } from "$app/environment";
    import { onNavigate } from "$app/navigation";
    import type { Snippet } from "svelte";

    let { children, footer } = $props<{
        children: Snippet;
        footer?: Snippet;
    }>();

    const animateEntrance = browser ? !entranceShown : true;
    if (browser) entranceShown = true;

    const authRoutes = new Set(["/login", "/register", "/forgot-password"]);

    // Morph the auth pages into each other instead of hard-swapping the
    // whole document. The named ::view-transition groups in layout.css
    // keep the brand lockup still while the form column crossfades.
    // Only auth → auth: a view transition into the app would freeze the
    // captured auth frame on screen until the destination finishes loading.
    onNavigate((navigation) => {
        if (!navigation.to || !authRoutes.has(navigation.to.url.pathname))
            return;
        if (!document.startViewTransition) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;

        return new Promise((resolve) => {
            document.startViewTransition(async () => {
                resolve();
                await navigation.complete;
            });
        });
    });
</script>

<svelte:head>
    <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<main class="flex min-h-dvh flex-col bg-surface">
    <div
        class="mx-auto flex w-full max-w-[26.5rem] flex-1 flex-col px-6 pb-[max(1.75rem,var(--safe-area-inset-bottom))] pt-[calc(var(--safe-area-inset-top)+3rem)] sm:justify-center sm:px-8 sm:py-16"
    >
        <!-- brand -->
        <div
            class="flex flex-col items-center text-center {animateEntrance
                ? 'auth-rise'
                : ''}"
            style="view-transition-name: auth-brand;"
        >
            <img
                src={LoyolaCollegeLogo}
                alt="Loyola College"
                class="h-24 w-auto object-contain"
            />
            <p
                class="mt-3.5 font-display text-[1.35rem] leading-none tracking-[-0.01em] text-ink font-semibold"
            >
                Eat Right
            </p>
            <p
                class="mt-2 text-[9.5px] font-bold uppercase leading-none tracking-[0.24em] text-ink-faint"
            >
                Loyola College
            </p>
        </div>

        <div
            class="mt-9 {animateEntrance ? 'auth-rise' : ''}"
            style="view-transition-name: auth-form; animation-delay: 100ms"
        >
            {@render children()}
        </div>

        <div
            class="mt-auto pt-9 sm:mt-10 sm:pt-0 {animateEntrance
                ? 'auth-rise'
                : ''}"
            style="animation-delay: 170ms"
        >
            {#if footer}
                {@render footer()}
            {/if}
            <p class="mt-4 text-center text-[11px] text-ink-faint">
                Designed by Ricky Donald.
            </p>
        </div>
    </div>
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
