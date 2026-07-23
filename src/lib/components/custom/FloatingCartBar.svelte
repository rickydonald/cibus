<script lang="ts">
    import { cart } from "$lib/stores/cart.svelte";
    import { page } from "$app/state";
    import { isHubRoute } from "$lib/nav";
    import {
        ChevronRightIcon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";
    import { contentReveal } from "$lib/utils/transitions";

    // Sit above the bottom tab bar on hub pages, hug the bottom elsewhere.
    const bottomOffset = $derived(
        isHubRoute(page.url.pathname)
            ? "calc(var(--bottom-nav-height) + 0.75rem)"
            : "calc(var(--safe-area-inset-bottom) + 0.75rem)",
    );
</script>

<div
    class="pointer-events-none fixed inset-x-0 z-50 px-3.5 lg:hidden"
    style="bottom: {bottomOffset}"
    in:contentReveal={{ duration: 180 }}
>
    <a
        href="/view/cart"
        class="pointer-events-auto mx-auto flex h-[3.75rem] max-w-sm items-center gap-3 rounded-2xl border border-primary/15 bg-primary-soft/95 p-2 pl-2.5 text-ink shadow-[0_12px_30px_rgba(19,132,199,0.18),0_2px_8px_rgba(26,30,38,0.05)] backdrop-blur-xl transition-[border-color,transform] hover:border-primary/30 active:scale-[0.985]"
        aria-label={`View cart, ${cart.totalItems} ${cart.totalItems === 1 ? "item" : "items"}, ₹${cart.totalAmount}`}
    >
        <div
            class="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface/80 text-primary"
        >
            <ShoppingCart01Icon class="h-[18px] w-[18px]" />
            <span
                class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-circle border-2 border-primary-soft bg-primary px-1 text-[9px] font-bold leading-none text-white tabular-nums"
                aria-hidden="true"
            >
                {cart.totalItems}
            </span>
        </div>

        <p class="min-w-0 flex-1 truncate text-sm font-bold text-ink">
            View cart
        </p>

        <div class="flex shrink-0 items-center gap-2.5">
            <p class="text-[15px] font-bold tabular-nums text-ink">
                ₹{cart.totalAmount}
            </p>
            <div
                class="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white shadow-sm"
            >
                <ChevronRightIcon class="h-4 w-4" />
            </div>
        </div>
    </a>
</div>
