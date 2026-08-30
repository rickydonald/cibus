<script lang="ts">
    import { cart, MAX_QTY } from "$lib/store/cart.svelte";
    import { ArrowLeftIcon, SearchMdIcon } from "@untitled-theme/icons-svelte";
    import Stepper from "$lib/components/ui/Stepper.svelte";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";

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
            const res = await fetch(
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
        <div class="safe-top-offset mx-auto flex max-w-md items-center gap-4 px-5 py-4">
            <button onclick={() => history.back()} class="icon-btn" aria-label="Go back">
                <ArrowLeftIcon class="h-4 w-4" />
            </button>
            <div>
                <p class="section-label">Everything on campus</p>
                <h1 class="mt-1 text-lg font-extrabold tracking-tight text-ink">Search Food</h1>
            </div>
        </div>
    </div>

    <!-- Search field. The border swap is the whole focus treatment — no ring, no glow. -->
    <div class="mx-auto max-w-md px-5 pt-5">
        <div class="flex items-center gap-3 border border-line bg-surface px-4 py-3.5 transition-colors focus-within:border-accent-edge">
            <SearchMdIcon class="h-5 w-5 shrink-0 text-ink-faint" />

            <input
                bind:value={query}
                placeholder="Search across all outlets"
                class="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-medium placeholder:text-ink-faint"
            />

            {#if isSearching}
                <div class="h-4 w-4 shrink-0 animate-spin border-2 border-hairline border-t-ink"></div>
            {/if}
        </div>
    </div>

    <!-- Results. Flat rows in one bordered block, separated by hairlines. -->
    <div class="mx-auto max-w-md px-5 pt-4" class:pb-cart-float={cart.totalItems > 0}>
        {#if results.length > 0}
            <div class="border border-hairline bg-surface">
                {#each results as item, i (item.id + "-" + item.outletid)}
                    {@const cartItem = cart.items.find(
                        (x) => x.id === item.id && x.outletid === item.outletid,
                    )}
                    {@const limit = Math.min(MAX_QTY, item.available_qty)}

                    <div class="p-4 {i > 0 ? 'border-t border-hairline' : ''}">
                        <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                            {item.outletname}
                        </p>

                        <h3 class="mt-1.5 text-[15px] font-extrabold leading-snug tracking-tight text-ink">
                            {item.itemname.split(" - ")[0]}
                        </h3>

                        <div class="mt-3.5 flex items-end justify-between gap-3">
                            <div>
                                <p class="text-xl font-extrabold tabular-nums tracking-tight text-ink">
                                    ₹{item.amount}
                                </p>
                                <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] {item.available_qty <= 3 ? 'text-tang-edge' : 'text-ink-faint'}">
                                    {item.available_qty} left
                                </p>
                            </div>

                            {#if cartItem}
                                <Stepper
                                    value={cartItem.qty}
                                    max={limit}
                                    onchange={(next) => {
                                        if (next > cartItem.qty) {
                                            cart.add({
                                                id: item.id,
                                                itemname: item.itemname,
                                                amount: item.amount,
                                                outletid: item.outletid,
                                                outletname: item.outletname,
                                                shopno: item.shopno,
                                                available_qty: limit,
                                            });
                                        } else {
                                            cart.remove(item.id, item.outletid);
                                        }
                                    }}
                                    onremove={() => cart.remove(item.id, item.outletid)}
                                />
                            {:else}
                                <!-- Adding to cart is the commit action of a result row. -->
                                <button
                                    onclick={() =>
                                        cart.add({
                                            id: item.id,
                                            itemname: item.itemname,
                                            amount: item.amount,
                                            outletid: item.outletid,
                                            outletname: item.outletname,
                                            shopno: item.shopno,
                                            available_qty: limit,
                                        })}
                                    class="flex h-9 items-center justify-center border border-line bg-accent px-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink transition-transform active:translate-x-px active:translate-y-px"
                                >
                                    Add
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else if query.length >= 2 && !isSearching}
            <div class="flex flex-col items-center justify-center border border-hairline bg-surface px-6 py-16 text-center">
                <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">No items found</p>
                <p class="mt-2 text-xs text-ink-faint">Try a different search term</p>
            </div>
        {:else if query.length === 0}
            <div class="flex flex-col items-center justify-center px-6 pt-20 text-center">
                <div class="mb-5 flex h-14 w-14 items-center justify-center bg-ink">
                    <SearchMdIcon class="h-6 w-6 text-accent" />
                </div>
                <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">Search all outlets</p>
                <p class="mt-2 text-xs text-ink-faint">Type at least 2 characters to start</p>
            </div>
        {/if}
    </div>

    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>
