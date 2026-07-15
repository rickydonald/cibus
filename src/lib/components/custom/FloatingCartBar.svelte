<script lang="ts">
    import { cart } from "$lib/store/cart.svelte";
    import { page } from "$app/state";
    import { isHubRoute } from "$lib/nav";
    import {
        ChevronRightIcon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";

    // Sit above the bottom tab bar on hub pages, hug the bottom elsewhere.
    const bottomOffset = $derived(
        isHubRoute(page.url.pathname)
            ? "calc(var(--bottom-nav-height) + 1rem)"
            : "calc(var(--safe-area-inset-bottom) + 1rem)",
    );
</script>

<div
    class="fixed left-0 right-0 z-50 px-5 lg:hidden"
    style="bottom: {bottomOffset}"
>
    <a
        href="/view/cart"
        class="mx-auto flex max-w-sm items-center justify-between gap-4 rounded-[28px] bg-primary px-4 py-3.5 text-white shadow-float backdrop-blur-xl transition-all hover:bg-primary-strong active:scale-[0.985]"
        aria-label="View cart"
    >
        <div class="flex min-w-0 items-center gap-3">
            <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/12"
            >
                <ShoppingCart01Icon class="h-5 w-5 text-white" />
            </div>
            <div class="min-w-0">
                <p class="text-sm font-bold tracking-tight text-white">
                    View cart
                </p>
                <p class="text-xs font-medium text-white/70">
                    {cart.totalItems} {cart.totalItems === 1 ? "item" : "items"}
                </p>
            </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
            <p
                class="rounded-full bg-white px-3.5 py-2 text-sm font-bold text-primary tabular-nums"
            >
                ₹ {cart.totalAmount}
            </p>
            <div
                class="flex h-9 w-9 items-center justify-center rounded-full bg-white/12"
            >
                <ChevronRightIcon class="h-4 w-4 text-white" />
            </div>
        </div>
    </a>
</div>
