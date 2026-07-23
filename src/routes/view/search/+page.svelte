<script lang="ts">
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import Fuse from "fuse.js";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        PlusIcon,
        MinusIcon,
    } from "@untitled-theme/icons-svelte";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import {
        normalizeMenuItemName,
        normalizeMenuCategory,
        normalizeStoreName,
    } from "$lib/utils/display-text";

    type Outlet = {
        id: number;
        name: string;
        shopNo: number;
        isClosed: boolean;
    };

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

    type DisplaySearchItem = SearchItem & {
        displayName: string;
        displayCategory: string;
        displayOutlet: string;
    };

    let query = $state("");
    let allItems = $state<SearchItem[]>([]);
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);

    async function loadAllItems() {
        isLoading = true;
        loadError = null;

        try {
            const outletsResponse = await fetchEatRight("/api/v1/outlets");
            const outletsData = await outletsResponse.json();

            if (!outletsResponse.ok || outletsData.error) {
                if (
                    await redirectIfEatRightConnectRequired(
                        outletsData.errorCode,
                    )
                )
                    return;
                loadError = outletsData.error ?? "Unable to load outlets.";
                return;
            }

            const openOutlets = (
                Array.isArray(outletsData) ? (outletsData as Outlet[]) : []
            ).filter((outlet) => !outlet.isClosed);

            const menus = await Promise.all(
                openOutlets.map(async (outlet) => {
                    try {
                        const response = await fetchEatRight(
                            `/api/v1/outlets/menu/${outlet.id}/${outlet.shopNo}`,
                        );
                        const data = await response.json();
                        if (!response.ok || !Array.isArray(data)) return [];
                        return data.map((item: Omit<SearchItem, "shopno">) => ({
                            ...item,
                            shopno: outlet.shopNo,
                        }));
                    } catch {
                        return [];
                    }
                }),
            );

            allItems = menus.flat();
        } catch (error) {
            console.error(error);
            loadError = "Unable to load menus. Pull to retry.";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadAllItems();
    });

    const searchDocuments = $derived<DisplaySearchItem[]>(
        allItems
            .filter((item) => item.available_qty > 0)
            .map((item) => ({
                ...item,
                displayName: normalizeMenuItemName(item.itemname),
                displayCategory: normalizeMenuCategory(
                    item.categoryname,
                    item.outletname,
                ),
                displayOutlet: normalizeStoreName(item.outletname),
            })),
    );

    const searchIndex = $derived.by(
        () =>
            new Fuse(searchDocuments, {
                keys: [
                    { name: "displayName", weight: 0.65 },
                    { name: "displayCategory", weight: 0.2 },
                    { name: "displayOutlet", weight: 0.15 },
                ],
                threshold: 0.35,
                distance: 100,
                ignoreLocation: true,
                minMatchCharLength: 2,
                shouldSort: true,
            }),
    );

    const results = $derived.by(() => {
        const q = query.trim();
        if (q.length < 2) return [];

        return searchIndex.search(q, { limit: 30 }).map(({ item }) => item);
    });

    function itemLimit(item: SearchItem) {
        return Math.min(MAX_QTY, Math.max(0, item.available_qty));
    }

    function cartEntry(item: SearchItem) {
        return cart.items.find(
            (entry) =>
                entry.id === item.id && entry.outletid === item.outletid,
        );
    }

    function addItem(item: SearchItem) {
        const limit = itemLimit(item);
        if (limit === 0) return;

        cart.add({
            id: item.id,
            itemname: item.itemname,
            amount: item.amount,
            outletid: item.outletid,
            outletname: item.outletname,
            shopno: item.shopno,
            available_qty: limit,
        });
    }

    function formatPrice(value: number) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "--";
        return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    }
</script>

<div class="min-h-screen text-ink antialiased">
    <!-- Search Input -->
    <div class="mx-auto max-w-lg px-4 pt-5 lg:max-w-4xl">
        <div
            class="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
        >
            <SearchMdIcon class="h-5 w-5 shrink-0 text-ink-faint" />

            <input
                bind:value={query}
                placeholder="Search food across all outlets..."
                class="w-full bg-transparent text-sm font-medium outline-none placeholder:text-ink-faint"
            />

            {#if isLoading}
                <Spinner size={20} class="shrink-0 text-primary" />
            {/if}
        </div>
    </div>

    <!-- Results -->
    <div
        class="mx-auto max-w-lg px-4 pt-4 lg:max-w-4xl"
        class:pb-cart-float={cart.totalItems > 0}
    >
        {#if results.length > 0}
            <div
                class="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(26,30,38,0.025)] lg:grid lg:grid-cols-2"
            >
                {#each results as item, index (`${item.outletid}-${item.id}`)}
                    {@const cartItem = cartEntry(item)}
                    {@const lowStock = item.available_qty <= 5}

                    <article
                        class={`relative flex min-h-28 items-center gap-4 px-4 py-4 ${
                            index > 0 ? "border-t border-line/70" : ""
                        } ${
                            index % 2 === 1
                                ? "lg:border-l lg:border-line/70"
                                : ""
                        } ${
                            index === 1
                                ? "lg:border-t-0"
                                : index > 1
                                  ? "lg:border-t lg:border-line/70"
                                  : ""
                        }`}
                    >
                        <div class="min-w-0 flex-1">
                            <h3
                                class="text-[15px] font-semibold leading-snug text-ink"
                            >
                                {item.displayName}
                            </h3>

                            <p
                                class="mt-1 truncate text-[10px] font-semibold text-ink-faint"
                            >
                                {item.displayOutlet}
                                <span class="px-1 text-line-strong">·</span>
                                {item.displayCategory}
                            </p>

                            <div
                                class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1"
                            >
                                <span
                                    class="text-[15px] font-bold tabular-nums text-ink"
                                >
                                    ₹{formatPrice(item.amount)}
                                </span>
                                <span
                                    class={`flex items-center gap-1.5 text-[10px] font-semibold ${
                                        lowStock
                                            ? "text-warning"
                                            : "text-ink-faint"
                                    }`}
                                >
                                    <span
                                        class={`h-1.5 w-1.5 shrink-0 rounded-circle ${
                                            lowStock
                                                ? "bg-warning"
                                                : "bg-success"
                                        }`}
                                    ></span>
                                    {lowStock
                                        ? `Only ${item.available_qty} left`
                                        : "Available"}
                                </span>
                            </div>
                        </div>

                        <div
                            class="flex h-10 w-28 shrink-0 items-center justify-end"
                        >
                            {#if cartItem}
                                <div
                                    class="grid h-10 w-28 grid-cols-[2.5rem_2rem_2.5rem] items-center overflow-hidden rounded-lg bg-primary text-white shadow-sm"
                                >
                                    <button
                                        type="button"
                                        class="grid h-10 place-items-center text-white transition-colors active:bg-white/15"
                                        onclick={() =>
                                            cart.remove(item.id, item.outletid)}
                                        aria-label={`Remove one ${item.displayName}`}
                                    >
                                        <MinusIcon
                                            class="h-3.5 w-3.5"
                                            stroke-width="3"
                                        />
                                    </button>

                                    <span
                                        class="text-center text-sm font-bold tabular-nums"
                                    >
                                        {cartItem.qty}
                                    </span>

                                    <button
                                        type="button"
                                        class="grid h-10 place-items-center text-white transition-colors active:bg-white/15 disabled:opacity-30"
                                        onclick={() => addItem(item)}
                                        disabled={cartItem.qty >= itemLimit(item)}
                                        aria-label={`Add one ${item.displayName}`}
                                    >
                                        <PlusIcon
                                            class="h-3.5 w-3.5"
                                            stroke-width="3"
                                        />
                                    </button>
                                </div>
                            {:else}
                                <button
                                    type="button"
                                    onclick={() => addItem(item)}
                                    class="h-10 w-24 rounded-lg border border-primary/25 bg-primary-soft text-xs font-bold text-primary transition-[background-color,color,transform] hover:bg-primary hover:text-white active:scale-95"
                                    aria-label={`Add ${item.displayName} to cart`}
                                >
                                    Add
                                </button>
                            {/if}
                        </div>
                    </article>
                {/each}
            </div>
        {:else if loadError}
            <div
                class="flex flex-col items-center justify-center pt-20 text-center"
            >
                <p class="text-sm text-ink-muted">{loadError}</p>
                <button
                    class="mt-3 rounded-xl border border-primary/20 bg-primary-soft px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-[0.96]"
                    onclick={loadAllItems}
                >
                    Retry
                </button>
            </div>
        {:else if query.trim().length >= 2 && !isLoading}
            <div
                class="flex flex-col items-center justify-center pt-20 text-center"
            >
                <p class="text-sm text-ink-muted">No items found</p>
                <p class="mt-1 text-xs text-ink-faint">
                    Try a different search term
                </p>
            </div>
        {:else}
            <div
                class="flex flex-col items-center justify-center pt-20 text-center"
            >
                <div
                    class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft border border-primary/10 text-primary mb-3"
                >
                    <SearchMdIcon class="h-5 w-5" />
                </div>
                <p class="text-sm font-semibold text-ink-muted">
                    Search food across all outlets
                </p>
                <p class="mt-1 text-xs text-ink-faint">
                    {isLoading
                        ? "Loading menus…"
                        : "Type at least 2 characters to start"}
                </p>
            </div>
        {/if}
    </div>

    <!-- Floating Cart -->
    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>
