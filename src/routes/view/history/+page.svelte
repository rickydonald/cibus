<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { ArrowLeftIcon } from "@untitled-theme/icons-svelte";
    import { onMount } from "svelte";

    type EatRightOrder = {
        order_no: string;
        order_status: string;
        created_on: string;
        payment_status: string;
        outletid: string;
        delivered: string;
        grand_total: number;
        outletname: string;
    };

    let orders = $state<EatRightOrder[]>([]);
    let isLoading = $state(true);
    let error = $state("");

    const STATUS_THEMES: Record<string, string> = {
        PLACED: "bg-blue-50 text-blue-700 border-blue-200/40",
        PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
        PENDING: "bg-amber-50 text-amber-700 border-amber-200/40",
        CANCELLED: "bg-rose-50 text-rose-700 border-rose-200/40",
    };

    function getStatusStyle(status: string) {
        return (
            STATUS_THEMES[status.toUpperCase()] ??
            "bg-neutral-50 text-neutral-600 border-neutral-200/40"
        );
    }

    function splitPrice(value: number | string | null) {
        const num = Number(value);
        if (!Number.isFinite(num)) return { main: "--", decimal: "00" };
        const [main, decimal] = num.toFixed(2).split(".");
        return { main, decimal };
    }

    async function getOrders() {
        isLoading = true;
        error = "";

        try {
            const response = await fetchEatRight("/api/v1/orders");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }

                error = data.error ?? "Unable to load order history.";
                return;
            }

            orders = Array.isArray(data.orders) ? data.orders : [];
        } catch {
            error = "Unable to load order history.";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        getOrders();
    });
</script>

<div class="min-h-screen bg-[#F4F5F7] text-neutral-900 antialiased font-sans">
    <!-- Header -->
    <div
        class="sticky top-0 z-20 bg-[#F4F5F7]/80 backdrop-blur-md border-b border-neutral-200/30"
    >
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => history.back()}
                class="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-neutral-200/80 shadow-sm active:scale-95 transition-transform"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-4 w-4 text-neutral-700" />
            </button>

            <div>
                <h1 class="text-lg font-bold tracking-tight text-neutral-900">
                    Order History
                </h1>
                <p class="text-xs text-neutral-500 font-medium">
                    EatRight orders
                </p>
            </div>
        </div>
    </div>

    <div class="px-4 pb-12 max-w-md mx-auto">
        {#if isLoading}
            <div class="space-y-4 pt-4">
                {#each Array(4) as _}
                    <div
                        class="rounded-3xl border border-neutral-200/50 bg-white p-5 shadow-sm space-y-4"
                    >
                        <div class="flex justify-between items-start">
                            <div class="space-y-2 w-2/3">
                                <div
                                    class="h-4 w-full animate-pulse rounded bg-neutral-100"
                                ></div>
                                <div
                                    class="h-3 w-1/2 animate-pulse rounded bg-neutral-100"
                                ></div>
                            </div>
                            <div
                                class="h-6 w-16 animate-pulse rounded bg-neutral-100"
                            ></div>
                        </div>
                        <div
                            class="h-10 w-full animate-pulse rounded-xl bg-neutral-50"
                        ></div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <h2 class="text-base font-bold text-neutral-800">
                    Could not load orders
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-neutral-500 leading-relaxed"
                >
                    {error}
                </p>
                <button
                    class="mt-5 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95 transition-transform"
                    onclick={getOrders}
                >
                    Try Again
                </button>
            </div>
        {:else if orders.length === 0}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <h2 class="text-base font-bold text-neutral-800">
                    No orders yet
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-neutral-500 leading-relaxed"
                >
                    Your EatRight orders will appear here automatically after
                    checkout.
                </p>
            </div>
        {:else}
            <div class="space-y-4 pt-4">
                {#each orders as order}
                    {@const price = splitPrice(order.grand_total)}
                    <button
                        class="w-full rounded-3xl border border-neutral-200/50 bg-white p-5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-neutral-300/80 transition-all duration-200 group block relative overflow-hidden"
                        onclick={() =>
                            goto(
                                `/view/confirmation?order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`,
                            )}
                    >
                        <!-- Upper Section: Brand Metadata and Financial Total -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0">
                                <h2
                                    class="truncate text-lg font-bold tracking-tight text-neutral-900"
                                >
                                    {order.outletname}
                                </h2>
                                <p
                                    class="text-[11px] font-medium text-neutral-400 mt-0.5"
                                >
                                    {order.created_on}
                                </p>
                            </div>

                            <div class="text-right whitespace-nowrap shrink-0">
                                <p
                                    class="text-xl font-black tracking-tight text-neutral-900 tabular-nums"
                                >
                                    &#8377;{price.main}.<span
                                        class="text-xs font-normal text-neutral-500"
                                        >{price.decimal}</span
                                    >
                                </p>
                            </div>
                        </div>

                        <!-- Mid Section: Micro Badge Tokens -->
                        <div class="mt-3.5 flex flex-wrap gap-1.5">
                            <span
                                class={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(order.order_status)}`}
                            >
                                {order.order_status}
                            </span>
                            <span
                                class={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(order.payment_status)}`}
                            >
                                {order.payment_status}
                            </span>
                            <span
                                class={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${order.delivered === "Y" ? "bg-emerald-50 text-emerald-700 border-emerald-200/40" : "bg-neutral-50 text-neutral-600 border-neutral-200/40"}`}
                            >
                                {order.delivered === "Y"
                                    ? "Delivered"
                                    : "In Transit"}
                            </span>
                        </div>

                        <!-- Lower Tray: Order System Details and Action Trigger -->
                        <div
                            class="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 border border-neutral-100/60 flex items-center justify-between gap-3 group-hover:bg-neutral-100/40 transition-colors"
                        >
                            <div class="min-w-0">
                                <p
                                    class="text-[9px] font-bold uppercase tracking-widest text-neutral-400"
                                >
                                    Order Reference
                                </p>
                                <p
                                    class="mt-0.5 break-all font-mono text-xs text-neutral-600 font-medium"
                                >
                                    {order.order_no}
                                </p>
                            </div>
                            <span
                                class="shrink-0 rounded-xl bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white transition-colors group-hover:bg-neutral-850"
                            >
                                View
                            </span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>
