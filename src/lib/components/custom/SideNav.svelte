<script lang="ts">
    import { page } from "$app/state";
    import { cart } from "$lib/store/cart.svelte";
    import {
        SearchIcon,
        ReceiptTextIcon,
        WalletIcon,
        ShoppingCartIcon,
        SettingsIcon,
        House,
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
</script>

<aside
    class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex"
>
    <!-- Brand -->
    <a href="/view/home" class="flex items-center gap-3 px-6 pb-6 pt-8">
        <img
            src={LoyolaCollegeLogo}
            alt="Loyola College"
            class="h-14 w-14 object-contain border border-gray-200 rounded-xl bg-white"
        />
        <span class="min-w-0">
            <span
                class="block text-base font-bold leading-none tracking-tight text-ink"
            >
                Eat Right
            </span>
            <span class="mt-1 block text-[11px] font-medium text-ink-muted">
                Campus Food Court
            </span>
        </span>
    </a>

    <nav
        class="flex flex-1 flex-col gap-1 px-4 pt-2"
        aria-label="Main navigation"
    >
        {#each tabs as tab}
            {@const isActive = tab.matches(activePath)}
            <a
                href={tab.href}
                class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors {isActive
                    ? 'bg-primary-soft font-bold text-primary'
                    : 'font-semibold text-ink-muted hover:bg-canvas hover:text-ink'}"
                aria-current={isActive ? "page" : undefined}
            >
                <tab.icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                {tab.label}
            </a>
        {/each}

        <div class="mx-1 my-3 border-t border-line"></div>

        <a
            href="/view/cart"
            class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors {isCartActive
                ? 'bg-primary-soft font-bold text-primary'
                : 'font-semibold text-ink-muted hover:bg-canvas hover:text-ink'}"
            aria-current={isCartActive ? "page" : undefined}
        >
            <ShoppingCartIcon size={18} strokeWidth={isCartActive ? 2.4 : 2} />
            <span class="flex-1">Cart</span>
            {#if cart.totalItems > 0}
                <span
                    class="rounded-circle bg-primary px-2 py-0.5 text-[11px] font-bold text-white tabular-nums"
                >
                    {cart.totalItems}
                </span>
            {/if}
        </a>

        {#if cart.totalItems > 0}
            <a
                href="/view/cart"
                class="mx-1 mt-2 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-strong"
            >
                <span>View cart</span>
                <span class="font-bold tabular-nums">₹{cart.totalAmount}</span>
            </a>
        {/if}

        <div class="mt-auto pb-2">
            <a
                href="/view/settings"
                class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors {isSettingsActive
                    ? 'bg-primary-soft font-bold text-primary'
                    : 'font-semibold text-ink-muted hover:bg-canvas hover:text-ink'}"
                aria-current={isSettingsActive ? "page" : undefined}
            >
                <SettingsIcon
                    size={18}
                    strokeWidth={isSettingsActive ? 2.4 : 2}
                />
                Settings
            </a>
        </div>
    </nav>

    <p class="px-6 pb-6 text-[11px] font-medium text-ink-faint">
        Designed by Ricky Donald.
    </p>
</aside>
