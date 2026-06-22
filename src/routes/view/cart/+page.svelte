<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import {
        ArrowLeftIcon,
        Wallet02Icon,
        ShoppingCart01Icon,
    } from "@untitled-theme/icons-svelte";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onMount } from "svelte";
    import helpers from "$lib/helpers";
    import { fly } from "svelte/transition";
    import { toast } from "svelte-sonner";

    let isPlacingOrder = $state(false);
    let isWalletLoading = $state(true);
    let isConfirmOpen = $state(false);
    let error = $state("");
    let success = $state("");
    let walletBalance = $state<number | null>(null);

    const hasInsufficientBalance = $derived(
        walletBalance !== null && cart.totalAmount > walletBalance,
    );
    const balanceAfterOrder = $derived(
        walletBalance === null ? null : walletBalance - cart.totalAmount,
    );

    const grouped = $derived(
        Object.groupBy(cart.items, (item) => item.outletname),
    );

    function formatAmount(amount: number | null) {
        if (amount === null || Number.isNaN(amount)) return "--";
        return amount.toFixed(2);
    }

    async function getWalletBalance() {
        isWalletLoading = true;
        error = "";

        try {
            const response = await fetchEatRight("/api/v1/account/show");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }

                error = data.error ?? "Unable to load wallet balance.";
                return;
            }

            walletBalance = Number(data.walletBalance ?? 0);
        } catch {
            error = "Unable to load wallet balance.";
        } finally {
            isWalletLoading = false;
        }
    }

    onMount(() => {
        getWalletBalance();
    });

    function openOrderConfirmation() {
        error = "";
        success = "";

        if (isWalletLoading) {
            error = "Checking wallet balance. Please wait.";
            return;
        }

        if (hasInsufficientBalance) {
            toast.error("Insufficient EatRight wallet balance");
            error = "Insufficient EatRight wallet balance.";
            return;
        }

        isConfirmOpen = true;
    }

    async function placeOrder() {
        if (isPlacingOrder || cart.items.length === 0) return;
        if (hasInsufficientBalance) {
            error = "Insufficient EatRight wallet balance.";
            isConfirmOpen = false;
            return;
        }

        isPlacingOrder = true;
        error = "";
        success = "";

        try {
            const response = await fetchEatRight("/api/v1/order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cart: cart.items,
                    grandTotal: cart.totalAmount,
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }

                error = data.error ?? "Unable to place your order.";
                return;
            }

            cart.clear();
            isConfirmOpen = false;
            await goto(data.redirectUrl ?? "/view/history");
        } catch {
            error = "Unable to reach EatRight. Please try again.";
        } finally {
            isPlacingOrder = false;
        }
    }
</script>

<div class="min-h-screen bg-[#f5f5f7] text-neutral-900 antialiased font-sans">
    <!-- Header Bar -->
    <div class="bg-[#f5f5f7]/80 backdrop-blur-xl sticky top-0 z-30 border-b border-neutral-200/40">
        <div class="safe-top-offset flex items-center gap-3 px-5 py-4 max-w-md mx-auto">
            <button
                onclick={() => history.back()}
                class="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-neutral-200/50 shadow-sm active:scale-95 transition-transform"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-5 w-5 text-neutral-600" />
            </button>

            <div class="flex-1">
                <h1 class="text-2xl font-bold tracking-tight text-neutral-900">Cart</h1>
                <p class="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">
                    {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} selected
                </p>
            </div>

            <div class="flex items-center">
                {#if isWalletLoading}
                    <div class="h-9 w-24 animate-pulse rounded-full bg-neutral-200" aria-label="Verifying balance"></div>
                {:else}
                    <a href="/view/wallet" class="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white border border-neutral-200/60 shadow-xs hover:border-neutral-300 transition-colors">
                        <Wallet02Icon class="h-4 w-4 text-neutral-500" />
                        <span class="text-sm font-semibold text-neutral-800 tabular-nums">
                            ₹{formatAmount(walletBalance)}
                        </span>
                    </a>
                {/if}
            </div>
        </div>
    </div>

    <!-- Scroll Container -->
    <div class="px-5 pt-4 max-w-md mx-auto" style="padding-bottom: max(env(safe-area-inset-bottom), 160px)">
        {#if cart.items.length === 0}
            <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <div class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white border border-neutral-200/40 shadow-xs">
                    <ShoppingCart01Icon class="h-9 w-9 text-neutral-300" />
                </div>
                <h2 class="text-lg font-semibold tracking-tight text-neutral-800">Your cart is empty</h2>
                <p class="mt-1 max-w-xs text-sm text-neutral-500 leading-relaxed">
                    Browse the available food counters to fill your tray.
                </p>
            </div>
        {:else}
            {#each Object.entries(grouped) as [outlet, items]}
                {@const outletItems = items ?? []}
                <div class="mb-4 overflow-hidden rounded-[28px] border border-neutral-200/50 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                    <!-- Brand Section Header -->
                    <div class="border-b border-neutral-100 bg-neutral-50/50 px-4 py-3.5">
                        <div class="flex items-center gap-3">
                            <div class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white border border-neutral-200/60">
                                <img
                                    src={helpers.mapStoreIcon(
                                        String(
                                            cart.items.find(
                                                (item) => item.shopno === outletItems[0].shopno,
                                            )?.shopno,
                                        ),
                                    )}
                                    alt={outlet}
                                    class="h-8 w-8 object-contain"
                                />
                            </div>
                            <div class="min-w-0">
                                <h2 class="text-base font-semibold tracking-tight text-neutral-900 truncate">
                                    {outlet}
                                </h2>
                                <p class="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">
                                    Counter {outletItems[0].shopno} • {outletItems.length} {outletItems.length === 1 ? "item" : "items"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Individual Menu List Rows -->
                    <div class="divide-y divide-neutral-100/70 px-4">
                        {#each outletItems as item}
                            <div class="flex items-center gap-3 py-3.5">
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-sm font-medium text-neutral-900 leading-snug break-words pr-1">
                                        {item.itemname}
                                    </h3>
                                    <p class="mt-0.5 text-xs text-neutral-500 font-medium tabular-nums">
                                        ₹{item.amount} each
                                    </p>
                                </div>

                                <!-- Incremental Engine Pill Container -->
                                <div class="flex h-8 shrink-0 items-center rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-0.5 shadow-2xs">
                                    <button
                                        class="flex h-7 w-7 items-center justify-center text-sm font-semibold text-neutral-500 hover:text-neutral-900 rounded-lg active:bg-white transition-colors"
                                        onclick={() => cart.remove(item.id, item.outletid)}
                                    >
                                        −
                                    </button>

                                    <span class="w-6 text-center text-xs font-medium text-neutral-800 tabular-nums">
                                        {item.qty}
                                    </span>

                                    <button
                                        class="flex h-7 w-7 items-center justify-center text-sm font-semibold text-neutral-500 hover:text-neutral-900 rounded-lg active:bg-white disabled:opacity-20 transition-colors"
                                        onclick={() =>
                                            cart.add({
                                                id: item.id,
                                                itemname: item.itemname,
                                                amount: item.amount,
                                                outletid: item.outletid,
                                                outletname: item.outletname,
                                                shopno: item.shopno,
                                                available_qty: item.available_qty ?? MAX_QTY,
                                            })}
                                        disabled={item.qty >= Math.min(MAX_QTY, item.available_qty ?? MAX_QTY)}
                                    >
                                        +
                                    </button>
                                </div>

                                <div class="w-16 shrink-0 text-right text-sm font-semibold text-neutral-900 tabular-nums">
                                    ₹{item.amount * item.qty}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Order Bar Summary Footer -->
    {#if cart.items.length > 0}
        <div
            class="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7] to-transparent pt-6"
            style="padding-bottom: max(env(safe-area-inset-bottom), 0px)"
        >
            <div class="bg-neutral-950 p-5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] border-t border-white/5 max-w-md mx-auto sm:rounded-t-[32px]">
                <div class="flex items-center justify-between gap-4">
                    <div class="shrink-0">
                        <p class="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                            To Pay
                        </p>
                        <h3 class="text-2xl font-bold tracking-tight text-white tabular-nums mt-0.5">
                            ₹{cart.totalAmount}
                        </h3>
                    </div>

                    <button
                        class="flex-1 rounded-2xl bg-white hover:bg-neutral-100 active:scale-[0.99] transition-all py-3.5 font-semibold text-sm text-neutral-950 shadow-md text-center disabled:opacity-40"
                        onclick={openOrderConfirmation}
                        disabled={isPlacingOrder || isWalletLoading}
                    >
                        {#if isPlacingOrder}
                            Placing Order...
                        {:else}
                            Place Order
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Order Confirmation Sheet -->
    {#if isConfirmOpen}
        <div
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            in:fly={{ duration: 200, y: 60 }}
            out:fly={{ duration: 150, y: 60 }}
        >
            <button class="absolute inset-0 cursor-default" onclick={() => (isConfirmOpen = false)} aria-label="Dismiss modal"></button>

            <div class="relative w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl border border-neutral-100">
                <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-neutral-200"></div>

                <h2 class="text-xl font-semibold tracking-tight text-neutral-900">
                    Confirm order
                </h2>

                <div class="mt-5 space-y-3.5 text-sm">
                    <div class="flex items-center justify-between">
                        <span class="text-neutral-500 font-medium">Cart total</span>
                        <span class="font-semibold text-neutral-800 tabular-nums">₹{cart.totalAmount}</span>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="text-neutral-500 font-medium">Wallet balance</span>
                        <span class="font-semibold text-neutral-800 tabular-nums">₹{formatAmount(walletBalance)}</span>
                    </div>

                    <div class="h-px bg-neutral-100 my-1"></div>

                    <div class="flex items-center justify-between">
                        <span class="text-neutral-600 font-medium">Balance after order</span>
                        <span class={`font-bold text-base tabular-nums ${hasInsufficientBalance ? "text-rose-600" : "text-emerald-700"}`}>
                            ₹{formatAmount(balanceAfterOrder)}
                        </span>
                    </div>
                </div>

                {#if hasInsufficientBalance}
                    <div class="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-medium text-rose-700 leading-relaxed">
                        Your wallet does not have enough balance for this cart.
                    </div>
                {/if}

                <div class="mt-6 grid grid-cols-2 gap-3">
                    <button
                        class="rounded-xl border border-neutral-200/80 bg-white py-3 px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-50 active:scale-98 transition"
                        onclick={() => (isConfirmOpen = false)}
                        disabled={isPlacingOrder}
                    >
                        Cancel
                    </button>

                    <button
                        class="rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 active:scale-98 transition py-3 px-4 text-sm font-semibold text-white shadow-sm"
                        onclick={placeOrder}
                        disabled={isPlacingOrder || hasInsufficientBalance}
                    >
                        {isPlacingOrder ? "Ordering..." : "Confirm"}
                    </button>
                </div>
            </div>
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