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

<!--
  The cart tray is the one raised object on any screen it appears on, so it
  carries the extrusion and the accent fill. Everything behind it stays flat.
-->
<div class="fixed left-0 right-0 z-50 px-5" style="bottom: {bottomOffset}">
    <a
        href="/view/cart"
        class="np-elevate mx-auto block max-w-sm"
        style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
        aria-label="View cart"
    >
        <span class="np-face flex items-center justify-between gap-4 px-4 py-3">
            <span class="flex min-w-0 items-center gap-3">
                <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center bg-ink"
                >
                    <ShoppingCart01Icon class="h-4.5 w-4.5 text-accent" />
                </span>
                <span class="min-w-0">
                    <span
                        class="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink/50"
                    >
                        {cart.totalItems}
                        {cart.totalItems === 1 ? "item" : "items"}
                    </span>
                    <span
                        class="block text-sm font-extrabold uppercase tracking-[0.1em] text-ink"
                    >
                        View cart
                    </span>
                </span>
            </span>

            <span class="flex shrink-0 items-center gap-2.5">
                <span class="text-base font-extrabold tabular-nums text-ink">
                    ₹{cart.totalAmount}
                </span>
                <span
                    class="flex h-7 w-7 items-center justify-center bg-ink"
                >
                    <ChevronRightIcon class="h-4 w-4 text-accent" />
                </span>
            </span>
        </span>
    </a>
</div>
