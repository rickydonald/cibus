<script lang="ts">
    import type { PageProps } from "./$types";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        PlusIcon,
        MinusIcon,
        ShoppingBag01Icon,
    } from "@untitled-theme/icons-svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";

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

    let items = $state<MenuItem[]>([]);
    let search = $state("");
    let selectedCategory = $state("All");
    let isLoading = $state(true);
    let isHeaderCollapsed = $state(false);
    let lastScrollY = 0;
    let ticking = false;

    function titleCase(value: string) {
        return value
            .toLowerCase()
            .replace(/\b([a-z])/g, (char) => char.toUpperCase())
            .replace(/\bIdly\b/g, "Idli")
            .replace(/\bVeg\b/g, "Veg");
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

    async function getItems() {
        isLoading = true;
        try {
            const response = await fetchEatRight(
                `/api/v1/outlets/menu/${params.outlet_id}/${params.shop_no}`,
            );
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }
                return;
            }
            items = data;
        } catch (err) {
            console.error(err);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        getItems();
    });

    const categories = $derived([
        "All",
        ...new Set(items.map((item) => item.categoryname)),
    ]);

    const filteredItems = $derived(
        items.filter((item) => {
            const normalizedName = itemTitle(item.itemname);
            const normalizedCategory = cleanString(item.categoryname);
            const normalizedQuery = search.trim().toLowerCase();

            const matchesSearch = `${normalizedName} ${normalizedCategory}`
                .toLowerCase()
                .includes(normalizedQuery);

            const matchesCategory =
                selectedCategory === "All" ||
                item.categoryname === selectedCategory;

            return matchesSearch && matchesCategory;
        }),
    );

    function handleWindowScroll() {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            const scrollDelta = currentScrollY - lastScrollY;

            if (currentScrollY < 48 || search.trim().length > 0) {
                isHeaderCollapsed = false;
            } else if (scrollDelta > 10 && currentScrollY > 96) {
                isHeaderCollapsed = true;
            } else if (scrollDelta < -10) {
                isHeaderCollapsed = false;
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    }
</script>

<svelte:window onscroll={handleWindowScroll} />

<div class="min-h-screen bg-[#f5f5f7] text-neutral-900 antialiased pb-36">
    <div
        class={`sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-neutral-200/50 transition-transform duration-250 ease-out ${
            isHeaderCollapsed && !isLoading && categories.length > 1
                ? "-translate-y-full"
                : "translate-y-0"
        }`}
    >
        <div class="max-w-md mx-auto">
            <div>
                <header
                    class="safe-top-offset flex items-center justify-between px-5 pt-4 pb-3"
                >
                    <div class="flex items-center gap-3.5 min-w-0">
                        <button
                            onclick={() => history.back()}
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50 border border-neutral-200/50 text-neutral-700 active:scale-95 transition-all"
                            aria-label="Go back"
                        >
                            <ArrowLeftIcon class="h-4 w-4" />
                        </button>
                        <div class="min-w-0">
                            <h1
                                class="text-xl font-bold tracking-tight text-neutral-900 truncate"
                            >
                                {items[0]?.outletname
                                    ? cleanString(items[0].outletname)
                                    : isLoading
                                      ? "Loading Menu"
                                      : "Outlet Store"}
                            </h1>
                            <p
                                class="mt-0.5 text-xs font-medium text-neutral-400"
                            >
                                Counter {params.shop_no}
                            </p>
                        </div>
                    </div>
                </header>

                <div class="px-5 pb-3">
                    <div
                        class="flex items-center gap-2.5 rounded-2xl border border-neutral-200/70 bg-neutral-100/80 px-3.5 py-3 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-950/5"
                    >
                        <SearchMdIcon class="h-4 w-4 text-neutral-400" />
                        <input
                            bind:value={search}
                            onfocus={() => (isHeaderCollapsed = false)}
                            placeholder="Search menu items..."
                            class="w-full bg-transparent text-sm font-medium outline-none placeholder:text-neutral-400 text-neutral-800"
                        />
                    </div>
                </div>
            </div>

            {#if !isLoading && categories.length > 1}
                <nav
                    class="flex gap-2 overflow-x-auto px-5 pb-3 no-scrollbar mask-gradient"
                    aria-label="Menu categories"
                >
                    {#each categories as category}
                        <button
                            onclick={() => (selectedCategory = category)}
                            class={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-all shrink-0 ${
                                selectedCategory === category
                                    ? "bg-neutral-950 text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-700"
                            }`}
                        >
                            {category === "All" ? "All" : cleanString(category)}
                        </button>
                    {/each}
                </nav>
            {/if}
        </div>
    </div>

    <main class="max-w-md mx-auto px-5 mt-5">
        {#if isLoading}
            <div class="space-y-3">
                {#each Array(4) as _}
                    <div
                        class="rounded-3xl border border-neutral-200/50 bg-white p-4.5 space-y-4 animate-pulse"
                    >
                        <div class="flex justify-between items-start">
                            <div class="space-y-2 w-2/3">
                                <div
                                    class="h-3 bg-neutral-200/70 rounded-full w-1/3"
                                ></div>
                                <div
                                    class="h-5 bg-neutral-200/70 rounded-lg w-4/5"
                                ></div>
                            </div>
                            <div
                                class="h-6 w-16 bg-neutral-200/70 rounded-full"
                            ></div>
                        </div>
                        <div
                            class="h-9 w-20 bg-neutral-200/70 rounded-xl self-end ml-auto"
                        ></div>
                    </div>
                {/each}
            </div>
        {:else if filteredItems.length === 0}
            <div
                class="text-center py-20 px-4 bg-white rounded-3xl border border-neutral-200/50 shadow-sm"
            >
                <div
                    class="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-50 border border-neutral-100 mx-auto text-neutral-400"
                >
                    <ShoppingBag01Icon class="h-4 w-4" />
                </div>
                <h3 class="mt-3.5 text-sm font-bold text-neutral-800">
                    No matching dishes
                </h3>
                <p
                    class="mt-1 text-xs text-neutral-400 font-medium max-w-[220px] mx-auto"
                >
                    Try another dish name or switch categories.
                </p>
            </div>
        {:else}
            <div class="space-y-3">
                {#each filteredItems as item}
                    {@const cartItem = cart.items.find(
                        (entry) =>
                            entry.id === item.id &&
                            entry.outletid === item.outletid,
                    )}
                    {#if item.available_qty > 0}
                        <article
                            class="overflow-hidden rounded-3xl border border-neutral-200/60 bg-white p-4 flex gap-4 items-start shadow-[0_8px_24px_rgba(0,0,0,0.025)] transition-all duration-200 hover:border-neutral-300"
                        >
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="max-w-full rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-500 truncate"
                                    >
                                        {cleanString(item.categoryname)}
                                    </span>
                                </div>

                                <h3
                                    class="mt-2 text-[15px] font-bold tracking-tight text-neutral-900 leading-snug"
                                >
                                    {itemTitle(item.itemname)}
                                </h3>

                                <div class="flex items-center gap-2 pt-2">
                                    <div
                                        class="text-base font-black tracking-tight text-neutral-900 tabular-nums"
                                    >
                                        ₹{item.amount}
                                    </div>
                                    <span
                                        class="text-[10px] text-neutral-300 font-medium"
                                        >•</span
                                    >
                                    <span
                                        class={`text-[10px] font-bold ${item.available_qty <= 5 ? "text-rose-500" : "text-neutral-400"}`}
                                    >
                                        {item.available_qty <= 5
                                            ? `Only ${item.available_qty} left`
                                            : `${item.available_qty} available`}
                                    </span>
                                </div>
                            </div>

                            <div class="shrink-0 self-center">
                                {#if cartItem}
                                    <div
                                        class="flex items-center gap-2.5 rounded-xl bg-neutral-950 p-1 text-white shadow-sm shadow-neutral-900/10"
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
                                                    outletname:
                                                        item.outletname,
                                                    shopno: Number(
                                                        params.shop_no,
                                                    ),
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
                                                shopno: Number(params.shop_no),
                                                available_qty: Math.min(
                                                    MAX_QTY,
                                                    item.available_qty,
                                                ),
                                            })}
                                        class="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-900 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.96]"
                                    >
                                        Add
                                    </button>
                                {/if}
                            </div>
                        </article>
                    {/if}
                {/each}
            </div>
        {/if}
    </main>

    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>

<style>
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .mask-gradient {
        -webkit-mask-image: linear-gradient(
            to right,
            black 88%,
            transparent 100%
        );
        mask-image: linear-gradient(to right, black 88%, transparent 100%);
    }
</style>
