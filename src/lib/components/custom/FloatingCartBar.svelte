<script lang="ts">
    import { cart } from "$lib/stores/cart.svelte";
    import { page } from "$app/state";
    import { isHubRoute } from "$lib/nav";
    import helpers from "$lib/helpers";
    import { ArrowRightIcon } from "@lucide/svelte";

    // Sit above the bottom tab bar on hub pages, hug the bottom elsewhere.
    const bottomOffset = $derived(
        isHubRoute(page.url.pathname)
            ? "calc(var(--bottom-nav-height) + 0.75rem)"
            : "calc(var(--safe-area-inset-bottom) + 0.75rem)",
    );

    const itemLabel = $derived(cart.totalItems === 1 ? "item" : "items");

    // One food-icon avatar per distinct counter in the cart — real texture
    // over a generic cart glyph, and a hint of where the food is coming from.
    const outletAvatars = $derived.by(() => {
        const seen = new Map<number, string>();
        for (const item of cart.items) {
            if (!seen.has(item.shopno)) {
                seen.set(item.shopno, helpers.mapStoreIcon(String(item.shopno)));
            }
        }
        return [...seen.values()];
    });
    const shownAvatars = $derived(outletAvatars.slice(0, 3));
    const extraAvatars = $derived(Math.max(outletAvatars.length - 3, 0));
</script>

<div
    class="pointer-events-none fixed inset-x-0 z-50 px-3.5 lg:hidden"
    style="bottom: {bottomOffset}"
>
    <a
        href="/view/cart"
        class="cart-bar pointer-events-auto relative mx-auto flex h-[3.75rem] max-w-sm items-center gap-3 overflow-hidden rounded-[20px] bg-primary py-2 pl-2.5 pr-2 text-white transition-transform active:scale-[0.99]"
        style="view-transition-name: floating-cart;"
        aria-label={`View cart, ${cart.totalItems} ${itemLabel}, ₹${cart.totalAmount}`}
    >
        <!-- directional depth toward the deep-navy edge -->
        <span
            class="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.12),rgba(255,255,255,0)_30%,rgba(26,52,82,0.35))]"
            aria-hidden="true"
        ></span>

        <!-- outlet avatar stack -->
        <span class="relative z-10 flex shrink-0 -space-x-2.5">
            {#each shownAvatars as icon}
                <span
                    class="grid h-9 w-9 place-items-center overflow-hidden rounded-circle bg-white ring-2 ring-primary"
                >
                    <img src={icon} alt="" class="h-5.5 w-5.5 object-contain" />
                </span>
            {/each}
            {#if extraAvatars > 0}
                <span
                    class="grid h-9 w-9 place-items-center rounded-circle bg-white/20 text-[11px] font-bold tabular-nums ring-2 ring-primary backdrop-blur-sm"
                >
                    +{extraAvatars}
                </span>
            {/if}
        </span>

        <!-- total + count -->
        <span class="relative z-10 min-w-0 flex-1 leading-tight">
            <span class="block text-[17px] font-mono font-bold tabular-nums tracking-[-0.020em]">
                ₹{cart.totalAmount}
            </span>
            <span class="block truncate text-[11px] font-medium text-white/60">
                {cart.totalItems}
                {itemLabel} in cart
            </span>
        </span>

        <!-- action pill: white on blue for a clear focal CTA -->
        <span
            class="relative z-10 flex h-10 shrink-0 items-center gap-1.5 rounded-circle bg-white pl-4 pr-3 text-[13px] font-bold text-primary shadow-[0_4px_12px_-4px_rgba(26,30,38,0.35)]"
        >
            View cart
            <ArrowRightIcon size={16} strokeWidth={2.6} />
        </span>
    </a>
</div>

<style>
    .cart-bar {
        box-shadow:
            0 14px 30px -12px rgb(19 126 193 / 0.6),
            0 2px 6px rgb(26 30 38 / 0.1);
    }
</style>
