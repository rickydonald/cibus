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

<!--
  A hard black bar, CRED-style. It is chrome, so it never carries the
  extrusion — the black itself does the separating and no top rule is needed.

  The active tab is a solid accent block behind the icon rather than a tint:
  on black, a low-opacity wash of a colour this bright turns to mud, while a
  filled shape stays unambiguous. Inactive tabs sit at 45% white, which is the
  body-text step of the opacity hierarchy.
-->
<nav
    class="fixed bottom-0 left-0 right-0 z-40 bg-ink"
    style="padding-right: var(--safe-area-inset-right); padding-bottom: var(--safe-area-inset-bottom); padding-left: var(--safe-area-inset-left);"
    aria-label="Main navigation"
>
    <div class="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {#each tabs as tab}
            {@const isActive = activePath === tab.href}
            <a
                href={tab.href}
                class="flex flex-1 flex-col items-center justify-center gap-1.5 transition-colors {isActive
                    ? 'text-white'
                    : 'text-white/45'}"
                aria-current={isActive ? "page" : undefined}
            >
                <span
                    class="flex h-7 w-12 items-center justify-center transition-colors {isActive
                        ? 'bg-accent text-ink'
                        : ''}"
                >
                    <tab.icon size={18} strokeWidth={isActive ? 2.6 : 2} />
                </span>
                <span
                    class="text-[9px] uppercase tracking-[0.14em] {isActive
                        ? 'font-extrabold'
                        : 'font-bold'}"
                >
                    {tab.label}
                </span>
            </a>
        {/each}
    </div>
</nav>
