<script lang="ts">
    import type { PageProps } from "./$types";
    import { cart, MAX_QTY } from "$lib/store/cart.svelte";
    import { onMount } from "svelte";
    import {
        ArrowLeftIcon,
        SearchMdIcon,
        ShoppingBag01Icon,
    } from "@untitled-theme/icons-svelte";
    import Stepper from "$lib/components/ui/Stepper.svelte";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
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
            const response = await fetch(
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

<div class="min-h-screen pb-36 text-ink antialiased">
    <!-- Sticky chrome. Opaque, not translucent: a backdrop blur is the soft
         device NeoPop replaces, and it muddies the hard rules underneath. -->
    <div
        class={`sticky top-0 z-30 border-b border-line bg-surface transition-transform duration-150 ease-out ${
            isHeaderCollapsed && !isLoading && categories.length > 1
                ? "-translate-y-full"
                : "translate-y-0"
        }`}
    >
        <div class="mx-auto max-w-md">
            <header class="safe-top-offset flex items-center justify-between px-5 pt-4 pb-3">
                <div class="flex min-w-0 items-center gap-3.5">
                    <button onclick={() => history.back()} class="icon-btn h-9 w-9" aria-label="Go back">
                        <ArrowLeftIcon class="h-4 w-4" />
                    </button>
                    <div class="min-w-0">
                        <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                            Counter {params.shop_no}
                        </p>
                        <h1 class="mt-0.5 truncate text-lg font-extrabold tracking-tight text-ink">
                            {items[0]?.outletname
                                ? cleanString(items[0].outletname)
                                : isLoading
                                  ? "Loading menu"
                                  : "Outlet Store"}
                        </h1>
                    </div>
                </div>
            </header>

            <div class="px-5 pb-3">
                <div class="flex items-center gap-2.5 border border-line bg-canvas px-3.5 py-3 transition-colors focus-within:border-accent-edge focus-within:bg-surface">
                    <SearchMdIcon class="h-4 w-4 text-ink-faint" />
                    <input
                        bind:value={search}
                        onfocus={() => (isHeaderCollapsed = false)}
                        placeholder="Search menu items"
                        class="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-faint"
                    />
                </div>
            </div>

            {#if !isLoading && categories.length > 1}
                <nav class="no-scrollbar mask-gradient flex gap-2 overflow-x-auto px-5 pb-3" aria-label="Menu categories">
                    {#each categories as category}
                        <button
                            onclick={() => (selectedCategory = category)}
                            class={`shrink-0 whitespace-nowrap border px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] transition-colors ${
                                selectedCategory === category
                                    ? "border-ink bg-ink text-white"
                                    : "border-hairline bg-surface text-ink-muted active:border-ink"
                            }`}
                        >
                            {category === "All" ? "All" : cleanString(category)}
                        </button>
                    {/each}
                </nav>
            {/if}
        </div>
    </div>

    <main class="mx-auto mt-5 max-w-md px-5">
        {#if isLoading}
            <div class="border border-hairline bg-surface">
                {#each Array(4) as _, i}
                    <div class="animate-pulse space-y-3 p-4 {i > 0 ? 'border-t border-hairline' : ''}">
                        <div class="h-2.5 w-1/3 bg-canvas"></div>
                        <div class="h-4 w-4/5 bg-canvas"></div>
                        <div class="flex items-center justify-between pt-1">
                            <div class="h-5 w-16 bg-canvas"></div>
                            <div class="h-9 w-20 bg-canvas"></div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if filteredItems.length === 0}
            <div class="border border-hairline bg-surface px-4 py-20 text-center">
                <div class="mx-auto flex h-12 w-12 items-center justify-center bg-ink text-accent">
                    <ShoppingBag01Icon class="h-5 w-5" />
                </div>
                <h3 class="mt-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">
                    No matching dishes
                </h3>
                <p class="mx-auto mt-2 max-w-[220px] text-xs text-ink-faint">
                    Try another dish name or switch categories.
                </p>
            </div>
        {:else}
            <!-- One bordered block, hairline-separated rows. Flat, so the cart
                 tray stays the only raised object on the screen. -->
            <div class="border border-hairline bg-surface">
                {#each filteredItems.filter((x) => x.available_qty > 0) as item, i}
                    {@const cartItem = cart.items.find(
                        (entry) => entry.id === item.id && entry.outletid === item.outletid,
                    )}
                    {@const limit = Math.min(MAX_QTY, item.available_qty)}
                    <article class="flex items-start gap-4 p-4 {i > 0 ? 'border-t border-hairline' : ''}">
                        <div class="min-w-0 flex-1">
                            <span class="inline-block max-w-full truncate bg-canvas px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
                                {cleanString(item.categoryname)}
                            </span>

                            <h3 class="mt-2.5 text-[15px] font-extrabold leading-snug tracking-tight text-ink">
                                {itemTitle(item.itemname)}
                            </h3>

                            <div class="flex items-center gap-2.5 pt-2.5">
                                <div class="text-base font-extrabold tabular-nums tracking-tight text-ink">
                                    ₹{item.amount}
                                </div>
                                <span class="h-3 w-px bg-hairline"></span>
                                <span
                                    class={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${item.available_qty <= 5 ? "text-tang-edge" : "text-ink-faint"}`}
                                >
                                    {item.available_qty <= 5
                                        ? `Only ${item.available_qty} left`
                                        : `${item.available_qty} available`}
                                </span>
                            </div>
                        </div>

                        <div class="shrink-0 self-center">
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
                                                shopno: Number(params.shop_no),
                                                available_qty: limit,
                                            });
                                        } else {
                                            cart.remove(item.id, item.outletid);
                                        }
                                    }}
                                    onremove={() => cart.remove(item.id, item.outletid)}
                                />
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
                                            available_qty: limit,
                                        })}
                                    class="flex h-9 items-center justify-center border border-line bg-accent px-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink transition-transform active:translate-x-px active:translate-y-px"
                                >
                                    Add
                                </button>
                            {/if}
                        </div>
                    </article>
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
        -webkit-mask-image: linear-gradient(to right, black 88%, transparent 100%);
        mask-image: linear-gradient(to right, black 88%, transparent 100%);
    }
</style>
