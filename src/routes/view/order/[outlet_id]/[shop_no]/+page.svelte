<script lang="ts">
    import type { PageProps } from "./$types";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";

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

    async function getItems() {
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

<div class="min-h-screen bg-[#f5f5f7]">
    <!-- Header -->
    <div
        class="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur-2xl"
    >
        <div class="safe-top-offset flex items-center-safe gap-3 px-6 pb-5">
            <button onclick={() => history.back()}>
                <ArrowLeftIcon class="h-5 w-5" />
            </button>
            <h1 class="mt-1 text-[26px] font-bold leading-none">
                {items[0]?.outletname ?? "Loading..."}
            </h1>
        </div>
    </div>

    <!-- Search -->
    <div class="px-5 pt-5">
        <div
            class="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
        >
            <SearchMdIcon class="h-5 w-5 text-neutral-400" />

            <input
                bind:value={search}
                placeholder="Search food..."
                class="w-full bg-transparent outline-none"
            />
        </div>
    </div>

    <!-- Categories -->
    <!-- <div class="mt-5 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
        {#each categories as category}
            <button
                onclick={() => (selectedCategory = category)}
                class={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    selectedCategory === category
                        ? "bg-black text-white"
                        : "bg-white text-neutral-600"
                }`}
            >
                {category
                    .replace("-YAMUNA KITCHEN", "")
                    .replace("-YAMUNA'S KITCHEN", "")}
            </button>
        {/each}
    </div> -->

    <!-- Menu -->
    <div class="mt-4 px-5 pb-32">
        <div class="space-y-4">
            {#each filteredItems as item}
                {@const cartItem = cart.items.find(
                    (i) => i.id === item.id && i.outletid === item.outletid,
                )}
                {#if item.available_qty != 0}
                    <div
                        class="overflow-hidden rounded-[30px] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
                    >
                        <div class="flex gap-4">
                            <div class="min-w-0 flex-1">
                                <p
                                    class="text-xs uppercase tracking-wider text-neutral-500"
                                >
                                    {item.categoryname
                                        .replace("-YAMUNA KITCHEN", "")
                                        .replace("-YAMUNA'S KITCHEN", "")}
                                </p>

                                <h3
                                    class="mt-1 text-lg font-semibold tracking-[-0.02em]"
                                >
                                    {item.itemname.split(" - ")[0]}
                                </h3>

                                <div
                                    class="mt-3 flex items-center justify-between"
                                >
                                    <div>
                                        <p
                                            class="text-2xl font-bold tracking-tighter"
                                        >
                                            ₹{item.amount}
                                        </p>

                                        <p class="text-sm text-neutral-500">
                                            {item.available_qty} left
                                        </p>
                                    </div>

                                    <div>
                                        {#if cartItem}
                                            <div
                                                class="flex items-center gap-4 rounded-full bg-black px-4 py-2 text-white"
                                            >
                                                <button
                                                    class="text-lg"
                                                    onclick={() =>
                                                        cart.remove(
                                                            item.id,
                                                            item.outletid,
                                                        )}
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
                                                            itemname:
                                                                item.itemname,
                                                            amount: item.amount,
                                                            outletid:
                                                                item.outletid,
                                                            outletname:
                                                                item.outletname,
                                                            shopno: Number(
                                                                params.shop_no,
                                                            ),
                                                            available_qty:
                                                                Math.min(
                                                                    MAX_QTY,
                                                                    item.available_qty,
                                                                ),
                                                        })}
                                                    disabled={cartItem.qty >=
                                                        Math.min(
                                                            MAX_QTY,
                                                            item.available_qty,
                                                        )}
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
                                                        outletname:
                                                            item.outletname,
                                                        shopno: Number(
                                                            params.shop_no,
                                                        ),
                                                        available_qty:
                                                            Math.min(
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
                {/if}
            {/each}
        </div>
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

                    <span>
                        {cart.totalItems} items
                    </span>
                </div>

                <div class="font-semibold">
                    ₹{cart.totalAmount}
                </div>
            </a>
        </div>
    {/if}
</div>
