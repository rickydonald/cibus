<script lang="ts">
    import type { PageProps } from "./$types";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        MinusIcon,
        PlusIcon,
        RefreshCw01Icon,
        SearchMdIcon,
        ShoppingBag01Icon,
        XCloseIcon,
    } from "@untitled-theme/icons-svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import {
        normalizeMenuCategory,
        normalizeMenuItemName,
        normalizeStoreName,
    } from "$lib/utils/display-text";
    import { contentReveal } from "$lib/utils/transitions";

    let { params }: PageProps = $props();

    type MenuItem = {
        id: number;
        itemname: string;
        amount: number;
        available_qty: number;
        categoryname: string;
        outletname: string;
        outletid: number;
    };

    type DisplayMenuItem = MenuItem & {
        displayName: string;
        displayCategory: string;
    };

    let items = $state<MenuItem[]>([]);
    let search = $state("");
    let selectedCategory = $state("All");
    let isLoading = $state(true);
    let loadError = $state("");
    let isHeaderCollapsed = $state(false);
    let lastScrollY = 0;
    let ticking = false;

    async function getItems() {
        isLoading = true;
        loadError = "";

        try {
            const response = await fetchEatRight(
                `/api/v1/outlets/menu/${params.outlet_id}/${params.shop_no}`,
            );
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }
                throw new Error(data.error ?? "Unable to load this menu.");
            }

            items = Array.isArray(data) ? data : [];
        } catch (error) {
            loadError =
                error instanceof Error
                    ? error.message
                    : "Unable to load this menu.";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        void getItems();
    });

    const displayItems = $derived(
        items.map((item) => ({
            ...item,
            displayName: normalizeMenuItemName(item.itemname),
            displayCategory: normalizeMenuCategory(
                item.categoryname,
                item.outletname,
            ),
        })),
    );

    const outletName = $derived(
        items[0]?.outletname
            ? normalizeStoreName(items[0].outletname)
            : "Menu",
    );

    const categories = $derived([
        "All",
        ...new Set(
            displayItems
                .map((item) => item.displayCategory)
                .filter((category) => category && category !== "All"),
        ),
    ]);

    const filteredItems = $derived.by(() => {
        const query = search.trim().toLowerCase();

        return displayItems.filter((item) => {
            const matchesSearch =
                query.length === 0 ||
                `${item.displayName} ${item.displayCategory}`
                    .toLowerCase()
                    .includes(query);
            const matchesCategory =
                selectedCategory === "All" ||
                item.displayCategory === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    });

    const menuGroups = $derived.by(() => {
        const groups = new Map<string, DisplayMenuItem[]>();

        for (const item of filteredItems) {
            if (item.available_qty <= 0) continue;

            const existing = groups.get(item.displayCategory);
            if (existing) {
                existing.push(item);
            } else {
                groups.set(item.displayCategory, [item]);
            }
        }

        const availableGroups = Array.from(
            groups,
            ([category, groupedItems]) => ({
                category,
                items: groupedItems,
                unavailable: false,
            }),
        );
        const unavailableItems = filteredItems.filter(
            (item) => item.available_qty <= 0,
        );

        if (unavailableItems.length > 0) {
            availableGroups.push({
                category: "Unavailable",
                items: unavailableItems,
                unavailable: true,
            });
        }

        return availableGroups;
    });

    const hasActiveFilters = $derived(
        search.trim().length > 0 || selectedCategory !== "All",
    );

    function clearFilters() {
        search = "";
        selectedCategory = "All";
    }

    function itemLimit(item: MenuItem) {
        return Math.min(MAX_QTY, Math.max(0, item.available_qty));
    }

    function cartEntry(item: MenuItem) {
        return cart.items.find(
            (entry) =>
                entry.id === item.id && entry.outletid === item.outletid,
        );
    }

    function addItem(item: MenuItem) {
        const limit = itemLimit(item);
        if (limit === 0) return;

        cart.add({
            id: item.id,
            itemname: item.itemname,
            amount: item.amount,
            outletid: item.outletid,
            outletname: item.outletname,
            shopno: Number(params.shop_no),
            available_qty: limit,
        });
    }

    function formatPrice(value: number) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "--";
        return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    }

    function handleWindowScroll() {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
            const currentScrollY = Math.max(window.scrollY, 0);
            const scrollDelta = currentScrollY - lastScrollY;

            if (currentScrollY < 64 || search.trim().length > 0) {
                isHeaderCollapsed = false;
            } else if (scrollDelta > 8 && currentScrollY > 112) {
                isHeaderCollapsed = true;
            } else if (scrollDelta < -8) {
                isHeaderCollapsed = false;
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    }
</script>

<svelte:window onscroll={handleWindowScroll} />

<div class="min-h-dvh text-ink antialiased">
    <div
        class={`sticky top-0 z-40 border-b border-line/80 bg-canvas/95 shadow-[0_1px_0_rgba(26,30,38,0.02)] backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
            isHeaderCollapsed && !isLoading
                ? "-translate-y-[calc(100%+1px)]"
                : "translate-y-0"
        }`}
    >
        <div class="mx-auto max-w-lg lg:max-w-4xl">
            <header class="safe-top-offset flex items-center gap-3 px-4 pb-3">
                <button
                    onclick={() => history.back()}
                    class="icon-btn"
                    aria-label="Go back"
                >
                    <ArrowLeftIcon class="h-5 w-5 text-ink-muted" />
                </button>

                <div class="min-w-0 flex-1">
                    {#if isLoading}
                        <div
                            class="h-5 w-40 animate-pulse rounded bg-line"
                        ></div>
                        <div
                            class="mt-2 h-3 w-24 animate-pulse rounded bg-line/70"
                        ></div>
                    {:else}
                        <h1
                            class="truncate text-xl font-bold tracking-tight text-ink"
                        >
                            {outletName}
                        </h1>
                        <p
                            class="mt-0.5 truncate text-[11px] font-semibold text-ink-muted"
                        >
                            Counter {params.shop_no}
                            {#if items.length > 0}
                                <span class="px-1 text-line-strong">·</span>
                                {items.length}
                                {items.length === 1 ? "item" : "items"}
                            {/if}
                        </p>
                    {/if}
                </div>
            </header>

            <div class="px-4 pb-3">
                <div
                    class="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
                >
                    <SearchMdIcon
                        class="h-[18px] w-[18px] shrink-0 text-ink-faint"
                    />
                    <input
                        type="search"
                        bind:value={search}
                        onfocus={() => (isHeaderCollapsed = false)}
                        placeholder="Search this menu"
                        autocomplete="off"
                        aria-label="Search menu"
                        class="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint"
                    />
                    {#if search.trim().length > 0}
                        <button
                            type="button"
                            onclick={() => (search = "")}
                            class="grid h-6 w-6 shrink-0 place-items-center rounded-circle bg-canvas text-ink-muted transition-transform active:scale-90"
                            aria-label="Clear search"
                        >
                            <XCloseIcon class="h-3.5 w-3.5" />
                        </button>
                    {/if}
                </div>
            </div>

            {#if !isLoading && categories.length > 1}
                <nav
                    class="no-scrollbar mask-gradient flex gap-2 overflow-x-auto px-4 pb-3"
                    aria-label="Menu categories"
                >
                    {#each categories as category}
                        <button
                            type="button"
                            onclick={() => (selectedCategory = category)}
                            aria-pressed={selectedCategory === category}
                            class={`h-9 shrink-0 whitespace-nowrap rounded-circle px-4 text-xs font-semibold transition-[background-color,color,border-color,transform] active:scale-95 ${
                                selectedCategory === category
                                    ? "border border-primary bg-primary text-white"
                                    : "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                            }`}
                        >
                            {category}
                        </button>
                    {/each}
                </nav>
            {/if}
        </div>
    </div>

    <main
        class="mx-auto max-w-lg px-4 pt-5 lg:max-w-4xl lg:pt-7"
        style:padding-bottom={cart.totalItems > 0
            ? "calc(env(safe-area-inset-bottom, 0px) + 6.25rem)"
            : "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)"}
    >
        {#if isLoading}
            <div class="space-y-7">
                {#each Array(2) as _}
                    <section>
                        <div
                            class="ml-1 h-3.5 w-24 animate-pulse rounded bg-line"
                        ></div>
                        <div
                            class="mt-2 overflow-hidden rounded-lg border border-line bg-surface"
                        >
                            {#each Array(3) as _, index}
                                {#if index > 0}
                                    <div
                                        class="ml-4 border-t border-line/70"
                                    ></div>
                                {/if}
                                <div
                                    class="flex min-h-24 items-center gap-4 px-4 py-4"
                                >
                                    <div class="min-w-0 flex-1 space-y-2.5">
                                        <div
                                            class="h-4 w-3/5 animate-pulse rounded bg-canvas"
                                        ></div>
                                        <div
                                            class="h-3.5 w-2/5 animate-pulse rounded bg-canvas"
                                        ></div>
                                    </div>
                                    <div
                                        class="h-10 w-[5.5rem] shrink-0 animate-pulse rounded-lg bg-canvas"
                                    ></div>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/each}
            </div>
        {:else if loadError}
            <div
                class="flex min-h-[52vh] flex-col items-center justify-center px-4 text-center"
                in:contentReveal={{ duration: 240 }}
            >
                <div
                    class="grid h-14 w-14 place-items-center rounded-circle bg-danger-soft text-danger"
                >
                    <ShoppingBag01Icon class="h-6 w-6" />
                </div>
                <h2 class="mt-4 text-base font-bold text-ink">
                    Could not load menu
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium leading-relaxed text-ink-muted"
                >
                    {loadError}
                </p>
                <button
                    type="button"
                    class="btn-primary mt-5 h-11 px-5 text-xs"
                    onclick={getItems}
                >
                    <RefreshCw01Icon class="h-4 w-4" />
                    Try again
                </button>
            </div>
        {:else if filteredItems.length === 0}
            <div
                class="flex min-h-[52vh] flex-col items-center justify-center px-4 text-center"
                in:contentReveal={{ duration: 240 }}
            >
                <div
                    class="grid h-14 w-14 place-items-center rounded-circle bg-primary-soft text-primary"
                >
                    <ShoppingBag01Icon class="h-6 w-6" />
                </div>
                <h2 class="mt-4 text-base font-bold text-ink">
                    {items.length === 0
                        ? "Menu unavailable"
                        : "No matching items"}
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium leading-relaxed text-ink-muted"
                >
                    {items.length === 0
                        ? "This counter has not listed any items yet."
                        : "Try a different search or category."}
                </p>
                {#if hasActiveFilters}
                    <button
                        type="button"
                        class="btn-quiet mt-5 h-11 px-5 text-xs"
                        onclick={clearFilters}
                    >
                        Clear filters
                    </button>
                {/if}
            </div>
        {:else}
            <div
                class="space-y-7"
                in:contentReveal={{ duration: 260 }}
            >
                {#each menuGroups as group, groupIndex}
                    <section
                        aria-labelledby={`menu-category-${groupIndex}`}
                    >
                        <h2
                            id={`menu-category-${groupIndex}`}
                            class="px-1 text-[13px] font-bold text-ink"
                        >
                            {group.category}
                        </h2>

                        <div
                            class="mt-2 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(26,30,38,0.025)] lg:grid lg:grid-cols-2"
                        >
                            {#each group.items as item, index (`${item.outletid}-${item.id}`)}
                                {@const selectedItem = cartEntry(item)}
                                {@const soldOut = item.available_qty <= 0}
                                {@const lowStock =
                                    !soldOut && item.available_qty <= 5}

                                <article
                                    class={`relative flex min-h-24 items-center gap-4 px-4 py-4 ${
                                        index > 0
                                            ? "border-t border-line/70"
                                            : ""
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
                                    } ${soldOut ? "bg-canvas/45" : ""}`}
                                >
                                    <div class="min-w-0 flex-1">
                                        <h3
                                            class={`text-[15px] font-semibold leading-snug text-ink ${
                                                soldOut ? "text-ink-muted" : ""
                                            }`}
                                        >
                                            {item.displayName}
                                        </h3>
                                        {#if group.unavailable}
                                            <p
                                                class="mt-1 truncate text-[10px] font-semibold text-ink-faint"
                                            >
                                                {item.displayCategory}
                                            </p>
                                        {/if}

                                        <div
                                            class={`${group.unavailable ? "mt-1.5" : "mt-2"} flex flex-wrap items-center gap-x-2.5 gap-y-1`}
                                        >
                                            <span
                                                class="text-[15px] font-bold tabular-nums text-ink"
                                            >
                                                ₹{formatPrice(item.amount)}
                                            </span>
                                            <span
                                                class={`flex items-center gap-1.5 text-[10px] font-semibold ${
                                                    soldOut
                                                        ? "text-danger"
                                                        : lowStock
                                                          ? "text-warning"
                                                          : "text-ink-faint"
                                                }`}
                                            >
                                                <span
                                                    class={`h-1.5 w-1.5 shrink-0 rounded-circle ${
                                                        soldOut
                                                            ? "bg-danger"
                                                            : lowStock
                                                              ? "bg-warning"
                                                              : "bg-success"
                                                    }`}
                                                ></span>
                                                {soldOut
                                                    ? "Sold out"
                                                    : lowStock
                                                      ? `Only ${item.available_qty} left`
                                                      : "Available"}
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        class="flex h-10 w-28 shrink-0 items-center justify-end"
                                    >
                                        {#if selectedItem}
                                            <div
                                                class="grid h-10 w-28 grid-cols-[2.5rem_2rem_2.5rem] items-center overflow-hidden rounded-lg bg-primary text-white shadow-sm"
                                            >
                                                <button
                                                    type="button"
                                                    class="grid h-10 place-items-center text-white transition-colors active:bg-white/15"
                                                    onclick={() =>
                                                        cart.remove(
                                                            item.id,
                                                            item.outletid,
                                                        )}
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
                                                    {selectedItem.qty}
                                                </span>

                                                <button
                                                    type="button"
                                                    class="grid h-10 place-items-center text-white transition-colors active:bg-white/15 disabled:opacity-30"
                                                    onclick={() => addItem(item)}
                                                    disabled={selectedItem.qty >=
                                                        itemLimit(item)}
                                                    aria-label={`Add one ${item.displayName}`}
                                                >
                                                    <PlusIcon
                                                        class="h-3.5 w-3.5"
                                                        stroke-width="3"
                                                    />
                                                </button>
                                            </div>
                                        {:else if soldOut}
                                            <span
                                                class="flex h-10 w-24 items-center justify-center text-xs font-semibold text-ink-faint"
                                            >
                                                Unavailable
                                            </span>
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
                    </section>
                {/each}
            </div>
        {/if}
    </main>

    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>

<style>
    .mask-gradient {
        -webkit-mask-image: linear-gradient(
            to right,
            black 90%,
            transparent 100%
        );
        mask-image: linear-gradient(to right, black 90%, transparent 100%);
    }

    input[type="search"]::-webkit-search-cancel-button {
        display: none;
    }
</style>
