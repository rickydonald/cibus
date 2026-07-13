<script lang="ts">
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { ArrowLeftIcon, SearchMdIcon } from "@untitled-theme/icons-svelte";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
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

<div class="min-h-screen text-ink antialiased">
    <!-- Header -->
    <div class="page-header">
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => history.back()}
                class="icon-btn"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-4 w-4" />
            </button>
            <h1 class="text-lg font-bold tracking-tight text-ink">
                Search Food
            </h1>
        </div>
    </div>

    <!-- Search Input -->
    <div class="px-5 pt-5 max-w-md mx-auto">
        <div
            class="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
        >
            <SearchMdIcon class="h-5 w-5 shrink-0 text-ink-faint" />

            <input
                bind:value={query}
                placeholder="Search food across all outlets..."
                class="w-full bg-transparent text-sm font-medium outline-none placeholder:text-ink-faint"
            />

            {#if isSearching}
                <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary"></div>
            {/if}
        </div>
    </div>

    <!-- Results -->
    <div class="px-5 pt-3 pb-nav-float max-w-md mx-auto">
        {#if results.length > 0}
            {#each results as item (item.id + "-" + item.outletid)}
                {@const cartItem = cart.items.find(
                    (i) => i.id === item.id && i.outletid === item.outletid,
                )}

                <div class="card mb-3 overflow-hidden">
                    <div class="p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-medium text-ink-muted">
                                    {item.outletname}
                                </p>

                                <h3 class="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
                                    {item.itemname.split(" - ")[0]}
                                </h3>

                                <div class="mt-3 flex items-center justify-between">
                                    <div>
                                        <p class="text-2xl font-bold tracking-tighter text-ink tabular-nums">
                                            ₹{item.amount}
                                        </p>

                                        <p class="text-sm text-ink-muted">
                                            {item.available_qty} left
                                        </p>
                                    </div>

                                    <div>
                                        {#if cartItem}
                                            <div class="flex items-center gap-4 rounded-full bg-primary px-4 py-2 text-white">
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
                                                class="rounded-full border border-primary/20 bg-primary-soft px-5 py-2 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-[0.96]"
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
                <p class="text-sm text-ink-muted">No items found</p>
                <p class="mt-1 text-xs text-ink-faint">Try a different search term</p>
            </div>
        {:else if query.length === 0}
            <div class="flex flex-col items-center justify-center pt-20 text-center">
                <SearchMdIcon class="mb-3 h-10 w-10 text-ink-faint" />
                <p class="text-sm text-ink-muted">Search food across all outlets</p>
                <p class="mt-1 text-xs text-ink-faint">Type at least 2 characters to start</p>
            </div>
        {/if}
    </div>

    <!-- Floating Cart -->
    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>
