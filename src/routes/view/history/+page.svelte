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
        PLACED: "bg-primary-soft text-primary border-primary/10",
        PAID: "bg-success-soft text-success border-success/10",
        PENDING: "bg-warning-soft text-warning border-warning/10",
        CANCELLED: "bg-danger-soft text-danger border-danger/10",
    };

    function getStatusStyle(status: string) {
        return (
            STATUS_THEMES[status.toUpperCase()] ??
            "bg-canvas text-ink-muted border-line"
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

            orders = Array.isArray(data.orders)
                ? data.orders
                : Array.isArray(data)
                  ? data
                  : [];
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

<div class="min-h-screen text-ink antialiased">
    <div class="px-4 max-w-md mx-auto">
        {#if isLoading}
            <div class="space-y-4 pt-4">
                {#each Array(4) as _}
                    <div class="card p-5 space-y-4">
                        <div class="flex justify-between items-start">
                            <div class="space-y-2 w-2/3">
                                <div
                                    class="h-4 w-full animate-pulse rounded bg-canvas"
                                ></div>
                                <div
                                    class="h-3 w-1/2 animate-pulse rounded bg-canvas"
                                ></div>
                            </div>
                            <div
                                class="h-6 w-16 animate-pulse rounded bg-canvas"
                            ></div>
                        </div>
                        <div
                            class="h-10 w-full animate-pulse rounded-xl bg-canvas"
                        ></div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <h2 class="text-base font-bold text-ink">
                    Could not load orders
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-ink-muted leading-relaxed"
                >
                    {error}
                </p>
                <button
                    class="btn-primary mt-5 rounded-xl px-5 py-2.5 text-xs"
                    onclick={getOrders}
                >
                    Try Again
                </button>
            </div>
        {:else if orders.length === 0}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <h2 class="text-base font-bold text-ink">No orders yet</h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-ink-muted leading-relaxed"
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
                        class="card w-full p-5 text-left hover:border-line-strong transition-all duration-200 group block relative overflow-hidden"
                        onclick={() =>
                            goto(
                                `/view/confirmation?order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`,
                            )}
                    >
                        <!-- Upper Section: Brand Metadata and Financial Total -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0">
                                <h2
                                    class="truncate text-lg font-bold tracking-tight text-ink"
                                >
                                    {order.outletname}
                                </h2>
                                <p
                                    class="text-[11px] font-medium text-ink-faint mt-0.5"
                                >
                                    {order.created_on}
                                </p>
                            </div>

                            <div class="text-right whitespace-nowrap shrink-0">
                                <p
                                    class="text-xl font-black tracking-tight text-ink tabular-nums"
                                >
                                    &#8377;{price.main}.<span
                                        class="text-xs font-normal text-ink-muted"
                                        >{price.decimal}</span
                                    >
                                </p>
                            </div>
                        </div>

                        <!-- Mid Section: Micro Badge Tokens -->
                        <div class="mt-3.5 flex flex-wrap gap-1.5">
                            <span
                                class={`chip ${getStatusStyle(order.order_status)}`}
                            >
                                {order.order_status}
                            </span>
                            <span
                                class={`chip ${getStatusStyle(order.payment_status)}`}
                            >
                                {order.payment_status}
                            </span>
                            <span
                                class={`chip ${order.delivered === "Y" ? "bg-success-soft text-success border-success/10" : "bg-canvas text-ink-muted border-line"}`}
                            >
                                {order.delivered === "Y"
                                    ? "Delivered"
                                    : "Preparing"}
                            </span>
                        </div>

                        <!-- Lower Tray: Order System Details and Action Trigger -->
                        <div
                            class="mt-4 rounded-2xl bg-canvas px-4 py-3 border border-line flex items-center justify-between gap-3 group-hover:bg-primary-soft/50 transition-colors"
                        >
                            <div class="min-w-0">
                                <p
                                    class="text-[9px] font-bold uppercase tracking-widest text-ink-faint"
                                >
                                    Order Reference
                                </p>
                                <p
                                    class="mt-0.5 break-all font-mono text-xs text-ink-muted font-medium"
                                >
                                    {order.order_no}
                                </p>
                            </div>
                            <span
                                class="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors group-hover:bg-primary-strong"
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
