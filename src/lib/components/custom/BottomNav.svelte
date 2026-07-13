<script lang="ts">
    import { page } from "$app/state";
    import {
        SearchIcon,
        ReceiptTextIcon,
        WalletIcon,
        HouseIcon,
    } from "@lucide/svelte";

    const tabs = [
        { href: "/view/home", label: "Home", icon: HouseIcon },
        { href: "/view/search", label: "Search", icon: SearchIcon },
        { href: "/view/history", label: "Orders", icon: ReceiptTextIcon },
        { href: "/view/wallet", label: "Wallet", icon: WalletIcon },
    ];

    const activePath = $derived(page.url.pathname);
</script>

<nav
    class="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
    aria-label="Main navigation"
>
    <div class="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {#each tabs as tab}
            {@const isActive = activePath === tab.href}
            <a
                href={tab.href}
                class="flex flex-1 flex-col items-center justify-center gap-1 transition-colors {isActive
                    ? 'text-primary'
                    : 'text-ink-faint hover:text-ink-muted'}"
                aria-current={isActive ? "page" : undefined}
            >
                <span
                    class="flex h-8 w-14 items-center justify-center rounded-full transition-colors {isActive
                        ? 'bg-primary-soft'
                        : ''}"
                >
                    <tab.icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span
                    class="text-[10px] {isActive
                        ? 'font-bold'
                        : 'font-semibold'}"
                >
                    {tab.label}
                </span>
            </a>
        {/each}
    </div>
</nav>
