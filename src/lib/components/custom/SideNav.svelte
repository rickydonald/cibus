<script lang="ts">
    import { page } from "$app/state";
    import { cart } from "$lib/store/cart.svelte";
    import { getCachedEatRightProfile } from "$lib/client/eatright-profile";
    import { onMount, tick } from "svelte";
    import { slide } from "svelte/transition";
    import {
        SearchIcon,
        ReceiptTextIcon,
        WalletIcon,
        ShoppingCartIcon,
        SettingsIcon,
        House,
        ArrowRightIcon,
    } from "@lucide/svelte";
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";

    const tabs = [
        {
            href: "/view/home",
            label: "Home",
            icon: House,
            // Browsing a counter's menu still belongs to Home
            matches: (path: string) =>
                path === "/view/home" || path.startsWith("/view/order"),
        },
        {
            href: "/view/search",
            label: "Search",
            icon: SearchIcon,
            matches: (path: string) => path === "/view/search",
        },
        {
            href: "/view/history",
            label: "Orders",
            icon: ReceiptTextIcon,
            matches: (path: string) =>
                path === "/view/history" ||
                path.startsWith("/view/confirmation"),
        },
        {
            href: "/view/wallet",
            label: "Wallet",
            icon: WalletIcon,
            matches: (path: string) => path === "/view/wallet",
        },
    ];

    const activePath = $derived(page.url.pathname);
    const isCartActive = $derived(activePath === "/view/cart");
    const isSettingsActive = $derived(activePath === "/view/settings");

    let profileName = $state<string | null>(null);
    onMount(() => {
        profileName = getCachedEatRightProfile()?.name ?? null;
    });

    const userid = $derived(
        ((page.data as Record<string, unknown>).userid as string | undefined) ??
            "",
    );
    const displayName = $derived(profileName ?? (userid || "My account"));
    const avatarInitial = $derived(
        (profileName || userid || "E").charAt(0).toUpperCase(),
    );

    // A single soft pill slides behind whichever item is active instead of
    // each link painting its own background.
    let listEl = $state<HTMLElement | null>(null);
    let indicator = $state({ top: 0, height: 0, visible: false });
    let indicatorReady = $state(false);

    $effect(() => {
        void activePath;
        const el = listEl;
        if (!el) return;
        void tick().then(() => {
            const active = el.querySelector<HTMLElement>(
                '[data-active="true"]',
            );
            if (active) {
                indicator = {
                    top: active.offsetTop,
                    height: active.offsetHeight,
                    visible: true,
                };
            } else {
                indicator = { ...indicator, visible: false };
            }
            // Skip the transition on first paint so the pill doesn't slide
            // in from the top corner on page load.
            if (!indicatorReady) {
                requestAnimationFrame(() => (indicatorReady = true));
            }
        });
    });

    const itemClass =
        "relative z-10 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
</script>

<aside
    class="fixed inset-y-0 left-0 z-40 hidden w-68 flex-col border-r border-line bg-surface lg:flex"
>
    <!-- Brand -->
    <a href="/view/home" class="flex items-center gap-3.5 px-6 pb-7 pt-8">
        <span
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface"
        >
            <img
                src={LoyolaCollegeLogo}
                alt="Loyola College"
                class="h-9 w-auto object-contain"
            />
        </span>
        <span class="min-w-0">
            <span
                class="block font-display text-[1.25rem] font-semibold leading-none tracking-[-0.01em] text-ink"
            >
                Eat Right
            </span>
            <span
                class="mt-1.5 block text-[9px] font-bold uppercase leading-none tracking-[0.22em] text-ink-faint"
            >
                Loyola College
            </span>
        </span>
    </a>

    <nav
        class="flex min-h-0 flex-1 flex-col px-4 pb-5"
        aria-label="Main navigation"
    >
        <p class="section-label px-3.5 pb-2.5">Menu</p>

        <div bind:this={listEl} class="relative flex flex-col gap-1">
            <div
                class="nav-indicator {indicatorReady
                    ? 'nav-indicator-animate'
                    : ''}"
                style="top: {indicator.top}px; height: {indicator.height}px; opacity: {indicator.visible
                    ? 1
                    : 0}"
                aria-hidden="true"
            ></div>

            {#each tabs as tab}
                {@const isActive = tab.matches(activePath)}
                <a
                    href={tab.href}
                    data-active={isActive}
                    aria-current={isActive ? "page" : undefined}
                    class="{itemClass} {isActive
                        ? 'font-bold text-primary-ink'
                        : 'font-semibold text-ink-muted hover:bg-canvas hover:text-ink'}"
                >
                    <tab.icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                    {tab.label}
                </a>
            {/each}

            <div class="mx-1 my-3 border-t border-line"></div>

            <a
                href="/view/cart"
                data-active={isCartActive}
                aria-current={isCartActive ? "page" : undefined}
                class="{itemClass} {isCartActive
                    ? 'font-bold text-primary-ink'
                    : 'font-semibold text-ink-muted hover:bg-canvas hover:text-ink'}"
            >
                <ShoppingCartIcon
                    size={18}
                    strokeWidth={isCartActive ? 2.4 : 2}
                />
                <span class="flex-1">Cart</span>
                {#if cart.totalItems > 0}
                    <span
                        class="rounded-circle bg-primary px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
                    >
                        {cart.totalItems}
                    </span>
                {/if}
            </a>

            {#if cart.totalItems > 0}
                <a
                    transition:slide={{ duration: 280 }}
                    href="/view/cart"
                    class="cart-cta group relative z-10 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-white transition-colors hover:bg-primary-strong"
                >
                    <span class="min-w-0">
                        <span class="block text-[13px] font-bold leading-tight">
                            View cart
                        </span>
                        <span
                            class="mt-1 block text-[11px] font-medium leading-none text-white/70"
                        >
                            {cart.totalItems}
                            {cart.totalItems === 1 ? "item" : "items"}
                        </span>
                    </span>
                    <span
                        class="flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums"
                    >
                        ₹{cart.totalAmount}
                        <ArrowRightIcon
                            size={15}
                            strokeWidth={2.4}
                            class="transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                    </span>
                </a>
            {/if}
        </div>

        <!-- Account -->
        <div class="mt-auto pt-4">
            <a
                href="/view/settings"
                aria-current={isSettingsActive ? "page" : undefined}
                class="group flex items-center gap-3 rounded-2xl border p-2.5 transition-all focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary {isSettingsActive
                    ? 'border-primary/30 bg-primary-soft'
                    : 'border-line hover:bg-canvas'}"
            >
                <span
                    class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-circle font-display text-[15px] font-semibold text-primary-ink {isSettingsActive
                        ? 'bg-surface'
                        : 'bg-primary-soft'}"
                >
                    {avatarInitial}
                </span>
                <span class="min-w-0 flex-1">
                    <span
                        class="block truncate text-[13px] font-bold leading-tight text-ink"
                    >
                        {displayName}
                    </span>
                    <span
                        class="mt-1 block truncate text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-ink-faint"
                    >
                        {profileName && userid ? userid : "Settings"}
                    </span>
                </span>
                <SettingsIcon
                    size={17}
                    strokeWidth={2}
                    class="mr-1 shrink-0 transition-all duration-300 group-hover:rotate-45 {isSettingsActive
                        ? 'text-primary-ink'
                        : 'text-ink-faint group-hover:text-ink'}"
                />
            </a>
        </div>
    </nav>
</aside>

<style>
    .nav-indicator {
        position: absolute;
        left: 0;
        right: 0;
        border-radius: 0.75rem;
        background: var(--color-primary-soft);
        pointer-events: none;
    }

    @media (prefers-reduced-motion: no-preference) {
        .nav-indicator-animate {
            transition:
                top 320ms cubic-bezier(0.22, 1, 0.36, 1),
                height 320ms cubic-bezier(0.22, 1, 0.36, 1),
                opacity 200ms ease;
        }
    }

    .cart-cta {
        background-image: linear-gradient(
            180deg,
            rgb(255 255 255 / 0.14),
            rgb(255 255 255 / 0) 55%
        );
        box-shadow: 0 10px 24px -10px rgb(225 50 14 / 0.5);
    }
</style>
