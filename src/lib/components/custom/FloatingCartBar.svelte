<script lang="ts">
    import { cart } from "$lib/store/cart.svelte";
    import {
        ChevronRightIcon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";
</script>

<div
    class="fixed left-0 right-0 z-50 px-5"
    style="bottom: max(env(safe-area-inset-bottom), 0px); padding-bottom: 1rem;"
>
    <a
        href="/view/cart"
        class="mx-auto flex max-w-sm items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-neutral-950/95 px-4 py-3.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-all hover:bg-neutral-900 active:scale-[0.985]"
        aria-label="View cart"
    >
        <div class="flex min-w-0 items-center gap-3">
            <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10"
            >
                <ShoppingCart01Icon class="h-5 w-5 text-white" />
            </div>
            <div class="min-w-0">
                <p class="text-sm font-bold tracking-tight text-white">
                    View cart
                </p>
                <p class="text-xs font-medium text-neutral-400">
                    {cart.totalItems} {cart.totalItems === 1 ? "item" : "items"}
                </p>
            </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
            <p
                class="rounded-full bg-amber-400 px-3.5 py-2 text-sm font-black tracking-tight text-neutral-950 tabular-nums"
            >
                ₹{cart.totalAmount}
            </p>
            <div
                class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
            >
                <ChevronRightIcon class="h-4 w-4 text-white" />
            </div>
        </div>
    </a>
</div>
