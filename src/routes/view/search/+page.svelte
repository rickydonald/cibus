<script lang="ts">
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        PlusIcon,
        MinusIcon,
        Building02Icon,
    } from "@untitled-theme/icons-svelte";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";

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

    let query = $state("");
    let allItems = $state<SearchItem[]>([]);
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);

    function titleCase(value: string) {
        return value
            .toLowerCase()
            .replace(/\b([a-z])/g, (char) => char.toUpperCase())
            .replace(/\bIdly\b/g, "Idli");
    }

    function cleanString(str: string | undefined) {
        if (!str) return "";

        return titleCase(
            str
                .replace(/\s*-\s*(YAMUNA'?S?\s*KITCHEN|GIVE\s*LIFE).*$/gi, "")
                .replace(/\s+/g, " ")
                .trim(),
        );
    }

    function itemTitle(str: string) {
        return cleanString(str.split(/\s+-\s+/)[0]);
    }

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

    const results = $derived.by(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];

        return allItems
            .filter(
                (item) =>
                    item.available_qty > 0 &&
                    `${itemTitle(item.itemname)} ${cleanString(item.categoryname)} ${item.outletname}`
                        .toLowerCase()
                        .includes(q),
            )
            .slice(0, 30);
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

            {#if isLoading}
                <div
                    class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary"
                ></div>
            {/if}
        </div>
    </div>

    <!-- Results -->
    <div
        class="px-5 pt-4 max-w-md mx-auto"
        class:pb-cart-float={cart.totalItems > 0}
    >
        {#if results.length > 0}
            <div class="space-y-3">
                {#each results as item (item.id + "-" + item.outletid)}
                    {@const cartItem = cart.items.find(
                        (entry) =>
                            entry.id === item.id &&
                            entry.outletid === item.outletid,
                    )}

                    <article
                        class="card overflow-hidden p-4 flex gap-4 items-start transition-all duration-200 hover:border-line-strong"
                    >
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <Building02Icon
                                    class="h-3 w-3 shrink-0 text-ink-faint"
                                />
                                <p
                                    class="text-[11px] font-semibold text-ink-muted truncate"
                                >
                                    {cleanString(item.outletname)}
                                </p>
                            </div>

                            <h3
                                class="mt-1.5 text-[15px] font-bold tracking-tight text-ink leading-snug"
                            >
                                {itemTitle(item.itemname)}
                            </h3>

                            <div class="mt-2 flex items-center gap-2">
                                <span
                                    class="max-w-full rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary truncate"
                                >
                                    {cleanString(item.categoryname)}
                                </span>
                                <span
                                    class={`text-[10px] font-bold ${item.available_qty <= 5 ? "text-warning" : "text-ink-faint"}`}
                                >
                                    {item.available_qty <= 5
                                        ? `Only ${item.available_qty} left`
                                        : `${item.available_qty} available`}
                                </span>
                            </div>
                        </div>

                        <div
                            class="shrink-0 self-center flex flex-col items-end gap-2"
                        >
                            <div
                                class="text-base font-black tracking-tight text-ink tabular-nums"
                            >
                                ₹{item.amount}
                            </div>

                            {#if cartItem}
                                <div
                                    class="flex items-center gap-2.5 rounded-xl bg-primary p-1 text-white shadow-sm"
                                >
                                    <button
                                        class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition-all active:scale-90"
                                        onclick={() =>
                                            cart.remove(
                                                item.id,
                                                item.outletid,
                                            )}
                                        aria-label="Remove item"
                                    >
                                        <MinusIcon
                                            class="h-3 w-3"
                                            stroke-width="3"
                                        />
                                    </button>

                                    <span
                                        class="font-bold text-xs min-w-[14px] text-center tabular-nums"
                                    >
                                        {cartItem.qty}
                                    </span>

                                    <button
                                        class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition-all active:scale-90 disabled:opacity-20"
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
                                            Math.min(
                                                MAX_QTY,
                                                item.available_qty,
                                            )}
                                        aria-label="Add item"
                                    >
                                        <PlusIcon
                                            class="h-3 w-3"
                                            stroke-width="3"
                                        />
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
                                    class="rounded-xl border border-primary/20 bg-primary-soft px-4 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-white active:scale-[0.96]"
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
