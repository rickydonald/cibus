<script lang="ts">
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { goto } from "$app/navigation";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";

    type SearchItem = {
        id: number;
        itemname: string;
        amount: number;
        available_qty: number;
        categoryname: string;
        outletname: string;
        outletid: number;
        shopno: number;
    };

    let query = $state("");
    let results = $state<SearchItem[]>([]);
    let isSearching = $state(false);

    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let searchVersion = 0;

    async function doSearch(q: string) {
        const version = ++searchVersion;

        if (q.length < 2) {
            results = [];
            isSearching = false;
            return;
        }

        isSearching = true;

        try {
            const res = await fetchEatRight(
                `/api/v1/search?q=${encodeURIComponent(q)}`,
            );
            const data = await res.json();
            if (version === searchVersion) {
                results = Array.isArray(data.results) ? data.results.slice(0, 30) : [];
            }
        } catch {
            if (version === searchVersion) {
                results = [];
            }
        } finally {
            if (version === searchVersion) {
                isSearching = false;
            }
        }
    }

    $effect(() => {
        const q = query;
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => doSearch(q), 300);
    });
</script>

<div class="min-h-screen bg-[#f5f5f7]">
    <!-- Header -->
    <div class="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur-2xl">
        <div class="safe-top-offset flex items-center-safe gap-3 px-6 pb-5">
            <button onclick={() => history.back()}>
                <ArrowLeftIcon class="h-5 w-5" />
            </button>
            <h1 class="mt-1 text-[26px] font-bold leading-none">
                Search Food
            </h1>
        </div>
    </div>

    <!-- Search Input -->
    <div class="px-5 pt-5">
        <div class="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <SearchMdIcon class="h-5 w-5 shrink-0 text-neutral-400" />

            <input
                bind:value={query}
                placeholder="Search food across all outlets..."
                class="w-full bg-transparent outline-none"
            />

            {#if isSearching}
                <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-black"></div>
            {/if}
        </div>
    </div>

    <!-- Results -->
    <div class="px-5 pt-3 pb-30">
        {#if results.length > 0}
            {#each results as item (item.id + "-" + item.outletid)}
                {@const cartItem = cart.items.find(
                    (i) => i.id === item.id && i.outletid === item.outletid,
                )}

                <div class="mb-3 overflow-hidden rounded-3xl border border-black/4 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                    <div class="p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-medium text-neutral-500">
                                    {item.outletname}
                                </p>

                                <h3 class="mt-1 text-lg font-semibold tracking-[-0.02em]">
                                    {item.itemname.split(" - ")[0]}
                                </h3>

                                <div class="mt-3 flex items-center justify-between">
                                    <div>
                                        <p class="text-2xl font-bold tracking-tighter">
                                            ₹{item.amount}
                                        </p>

                                        <p class="text-sm text-neutral-500">
                                            {item.available_qty} left
                                        </p>
                                    </div>

                                    <div>
                                        {#if cartItem}
                                            <div class="flex items-center gap-4 rounded-full bg-black px-4 py-2 text-white">
                                                <button
                                                    class="text-lg"
                                                    onclick={() => cart.remove(item.id, item.outletid)}
                                                >
                                                    −
                                                </button>

                                                <span class="font-medium">
                                                    {cartItem.qty}
                                                </span>

                                                <button
                                                    class="text-lg disabled:opacity-30"
                                                    onclick={() =>
                                                        cart.add({
                                                            id: item.id,
                                                            itemname: item.itemname,
                                                            amount: item.amount,
                                                            outletid: item.outletid,
                                                            outletname: item.outletname,
                                                            shopno: item.shopno,
                                                            available_qty: Math.min(
                                                                MAX_QTY,
                                                                item.available_qty,
                                                            ),
                                                        })}
                                                    disabled={cartItem.qty >=
                                                        Math.min(MAX_QTY, item.available_qty)}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        {:else}
                                            <button
                                                onclick={() =>
                                                    cart.add({
                                                        id: item.id,
                                                        itemname: item.itemname,
                                                        amount: item.amount,
                                                        outletid: item.outletid,
                                                        outletname: item.outletname,
                                                        shopno: item.shopno,
                                                        available_qty: Math.min(
                                                            MAX_QTY,
                                                            item.available_qty,
                                                        ),
                                                    })}
                                                class="rounded-full bg-black px-5 py-2 text-sm font-medium text-white"
                                            >
                                                Add
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        {:else if query.length >= 2 && !isSearching}
            <div class="flex flex-col items-center justify-center pt-20 text-center">
                <p class="text-sm text-neutral-400">No items found</p>
                <p class="mt-1 text-xs text-neutral-300">Try a different search term</p>
            </div>
        {:else if query.length === 0}
            <div class="flex flex-col items-center justify-center pt-20 text-center">
                <SearchMdIcon class="mb-3 h-10 w-10 text-neutral-300" />
                <p class="text-sm text-neutral-400">Search food across all outlets</p>
                <p class="mt-1 text-xs text-neutral-300">Type at least 2 characters to start</p>
            </div>
        {/if}
    </div>

    <!-- Floating Cart -->
    {#if cart.totalItems > 0}
        <div class="fixed bottom-6 left-0 right-0 z-50 px-5">
            <a
                href="/view/cart"
                class="mx-auto flex max-w-md items-center justify-between rounded-full bg-black px-6 py-4 text-white shadow-xl"
            >
                <div class="flex items-center gap-3">
                    <ShoppingCart01Icon class="h-5 w-5" />
                    <span>{cart.totalItems} items</span>
                </div>

                <div class="font-semibold">
                    ₹{cart.totalAmount}
                </div>
            </a>
        </div>
    {/if}
</div>

<style>
    :global(body) {
        background: #f5f5f7;
    }

    :global(*) {
        -webkit-tap-highlight-color: transparent;
    }
</style>
