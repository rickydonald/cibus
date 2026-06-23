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
    import { fade, fly } from "svelte/transition";

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

    function cleanString(str: string) {
        return str
            .replace(/-YAMUNA\s*KITCHEN/gi, "")
            .replace(/-YAMUNA'S\s*KITCHEN/gi, "")
            .trim();
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
        ...new Set(items.map((i) => i.categoryname)),
    ]);

    const filteredItems = $derived(
        items.filter((item) => {
            const matchesSearch = item.itemname
                .toLowerCase()
                .includes(search.toLowerCase());

            const matchesCategory =
                selectedCategory === "All" ||
                item.categoryname === selectedCategory;

            return matchesSearch && matchesCategory;
        }),
    );
</script>

<div
    class="min-h-screen bg-[#F6F6F9] text-neutral-900 antialiased  pb-36"
>
    <div
        class="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-neutral-200/40 shadow-[0_2px_12px_rgba(0,0,0,0.015)]"
    >
        <div class="max-w-md mx-auto">
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
                            class="text-lg font-extrabold tracking-tight text-neutral-900 truncate"
                        >
                            {items[0]?.outletname ??
                                (isLoading
                                    ? "Loading Menu..."
                                    : "Outlet Store")}
                        </h1>
                    </div>
                </div>
            </header>
            <div class="px-5 pb-3">
                <div
                    class="flex items-center gap-2.5 rounded-xl bg-neutral-100/80 px-3.5 py-2.5 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-950/5"
                >
                    <SearchMdIcon class="h-4 w-4 text-neutral-400" />
                    <input
                        bind:value={search}
                        placeholder="Search menu items..."
                        class="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-neutral-400 text-neutral-800"
                    />
                </div>
            </div>

            {#if !isLoading && categories.length > 1}
                <nav
                    class="flex gap-1 overflow-x-auto px-4 pb-2.5 no-scrollbar mask-gradient"
                    aria-label="Menu categories"
                >
                    {#each categories as category}
                        <button
                            onclick={() => (selectedCategory = category)}
                            class={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all relative shrink-0 ${
                                selectedCategory === category
                                    ? "text-neutral-950"
                                    : "text-neutral-400 hover:text-neutral-600"
                            }`}
                        >
                            {cleanString(category)}
                            {#if selectedCategory === category}
                                <div
                                    class="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-neutral-950 rounded-full"
                                ></div>
                            {/if}
                        </button>
                    {/each}
                </nav>
            {/if}
        </div>
    </div>

    <main class="max-w-md mx-auto px-5 mt-5">
        {#if isLoading}
            <div class="space-y-4">
                {#each Array(3) as _}
                    <div
                        class="rounded-2xl border border-neutral-200/50 bg-white p-5 space-y-4 animate-pulse"
                    >
                        <div class="flex justify-between items-start">
                            <div class="space-y-2 w-2/3">
                                <div
                                    class="h-3 bg-neutral-200/60 rounded w-1/4"
                                ></div>
                                <div
                                    class="h-5 bg-neutral-200/60 rounded w-3/4"
                                ></div>
                            </div>
                            <div
                                class="h-5 w-14 bg-neutral-200/60 rounded-full"
                            ></div>
                        </div>
                        <div
                            class="h-8 w-20 bg-neutral-200/60 rounded-lg self-end ml-auto"
                        ></div>
                    </div>
                {/each}
            </div>
        {:else if filteredItems.length === 0}
            <!-- Empty State Illustration Box -->
            <div
                class="text-center py-20 px-4 bg-white rounded-2xl border border-neutral-200/40 shadow-sm"
            >
                <div
                    class="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-50 border border-neutral-100 mx-auto text-neutral-400"
                >
                    <ShoppingBag01Icon class="h-4 w-4" />
                </div>
                <h3 class="mt-3.5 text-xs font-bold text-neutral-800">
                    No matching dishes
                </h3>
                <p
                    class="mt-1 text-[11px] text-neutral-400 font-medium max-w-[200px] mx-auto"
                >
                    We couldn't find items matching your dynamic filter terms.
                </p>
            </div>
        {:else}
            <div class="space-y-4">
                {#each filteredItems as item}
                    {@const cartItem = cart.items.find(
                        (i) => i.id === item.id && i.outletid === item.outletid,
                    )}
                    {#if item.available_qty > 0}
                        <article
                            class="overflow-hidden rounded-2xl border border-neutral-200/50 bg-white p-4.5 flex gap-4 items-start shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.04)] hover:border-neutral-300"
                        >
                            <div class="min-w-0 flex-1 space-y-1">
                                <div class="flex items-center gap-1.5">
                                    <span
                                        class="text-[9px] font-bold uppercase tracking-wider text-neutral-400 truncate"
                                    >
                                        {cleanString(item.categoryname)}
                                    </span>
                                </div>

                                <h3
                                    class="text-[15px] font-bold tracking-tight text-neutral-900 leading-tight"
                                >
                                    {item.itemname.split(" - ")[0]}
                                </h3>

                                <div class="flex items-center gap-2 pt-1.5">
                                    <div
                                        class="text-base font-black tracking-tight text-neutral-900"
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
                                        class="flex items-center gap-2.5 rounded-lg bg-neutral-900 p-1 text-white shadow-sm shadow-neutral-900/10"
                                    >
                                        <button
                                            class="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white transition-all active:scale-90"
                                            onclick={() =>
                                                cart.remove(
                                                    item.id,
                                                    item.outletid,
                                                )}
                                            aria-label="Remove item"
                                        >
                                            <MinusIcon class="h-2.5 w-2.5" />
                                        </button>

                                        <span
                                            class="font-bold text-xs min-w-[12px] text-center tabular-nums"
                                        >
                                            {cartItem.qty}
                                        </span>

                                        <button
                                            class="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white transition-all active:scale-90 disabled:opacity-20"
                                            onclick={() =>
                                                cart.add({
                                                    id: item.id,
                                                    itemname: item.itemname,
                                                    amount: item.amount,
                                                    outletid: item.outletid,
                                                    outletname: item.outletname,
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
                                            <PlusIcon class="h-2.5 w-2.5" />
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
                                        class="rounded-lg border border-neutral-200 bg-white px-4 py-1.5 text-xs font-bold text-neutral-900 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.96]"
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

    <!-- Floating Actions Container Dynamic Layout Anchor -->
    {#if cart.totalItems > 0}
        <FloatingCartBar />
    {/if}
</div>

<style>
    /* Premium UX global layout scrollbar masks resets */
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

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    .animate-slide-up {
        animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
</style>
