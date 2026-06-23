<script lang="ts">
    import { cart } from "$lib/store/cart.svelte";
    import { ShoppingCart01Icon } from "@untitled-theme/icons-svelte";
</script>

<div class="fixed bottom-6 left-0 right-0 z-50 px-5">
    <a
        href="/view/cart"
        class="mx-auto flex max-w-sm items-center justify-between rounded-4xl bg-neutral-950 px-5 py-4 text-white shadow-xl hover:bg-neutral-900 active:scale-98 transition border border-white/5"
    >
        <div class="flex items-center gap-2.5">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"
            >
                <ShoppingCart01Icon class="h-4 w-4 text-white" />
            </div>
            <span class="text-sm font-medium text-neutral-200"
                >{cart.totalItems}
                {cart.totalItems === 1 ? "item" : "items"}</span
            >
        </div>

        <div
            class="text-sm font-semibold tracking-tight text-white tabular-nums"
        >
            ₹{cart.totalAmount}
        </div>
    </a>
</div>
