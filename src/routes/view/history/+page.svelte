<script lang="ts">
    import { goto } from "$app/navigation";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
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

    // Status colour follows the app-wide role table: mint = done,
    // sun = pending/attention, pink = destructive/cancelled, purple = in flight.
    const STATUS_THEMES: Record<string, string> = {
        PLACED: "bg-purple-soft text-purple-edge border-purple/25",
        PAID: "bg-mint-soft text-mint-deep border-mint-edge/40",
        PENDING: "bg-sun-soft text-sun-deep border-sun-edge/40",
        CANCELLED: "bg-pink-soft text-pink-edge border-pink/25",
    };

    function getStatusStyle(status: string) {
        return (
            STATUS_THEMES[status.toUpperCase()] ??
            "bg-canvas text-ink-muted border-hairline"
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
            const response = await fetch("/api/v1/orders");
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
    <div class="mx-auto max-w-md px-5 pt-4">
        <div class="mb-5">
            <p class="section-label">Your activity</p>
            <h1 class="mt-1.5 text-xl font-extrabold tracking-tight text-ink">Orders</h1>
        </div>

        {#if isLoading}
            <div class="space-y-3">
                {#each Array(4) as _}
                    <div class="border border-hairline bg-surface p-5">
                        <div class="flex items-start justify-between gap-4">
                            <div class="w-2/3 space-y-2">
                                <div class="h-4 w-full animate-pulse bg-canvas"></div>
                                <div class="h-2.5 w-1/2 animate-pulse bg-canvas"></div>
                            </div>
                            <div class="h-6 w-16 animate-pulse bg-canvas"></div>
                        </div>
                        <div class="mt-4 h-12 w-full animate-pulse bg-canvas"></div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div class="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
                <div class="mb-5 flex h-14 w-14 items-center justify-center bg-danger text-white">
                    <span class="text-2xl font-extrabold">!</span>
                </div>
                <h2 class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">Could not load orders</h2>
                <p class="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">{error}</p>
                <button
                    class="np-elevate mt-6 inline-flex w-fit cursor-pointer border-0 bg-transparent p-0"
                    style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                    onclick={getOrders}
                >
                    <span class="np-face flex h-10 items-center justify-center px-6 text-[11px] font-extrabold uppercase tracking-[0.14em]">Try again</span>
                </button>
            </div>
        {:else if orders.length === 0}
            <div class="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
                <div class="mb-5 h-14 w-14 bg-ink"></div>
                <h2 class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">No orders yet</h2>
                <p class="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
                    Your EatRight orders will appear here automatically after checkout.
                </p>
            </div>
        {:else}
            <div class="space-y-3 pb-4">
                {#each orders as order}
                    {@const price = splitPrice(order.grand_total)}
                    <button
                        class="group block w-full border border-hairline bg-surface p-5 text-left transition-colors active:bg-canvas"
                        onclick={() =>
                            goto(
                                `/view/confirmation?order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`,
                            )}
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0">
                                <h2 class="truncate text-[15px] font-extrabold tracking-tight text-ink">
                                    {order.outletname}
                                </h2>
                                <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                                    {order.created_on}
                                </p>
                            </div>

                            <div class="shrink-0 whitespace-nowrap text-right">
                                <p class="text-xl font-extrabold tabular-nums tracking-tight text-ink">
                                    &#8377;{price.main}<span class="text-xs text-ink-faint">.{price.decimal}</span>
                                </p>
                            </div>
                        </div>

                        <div class="mt-4 flex flex-wrap gap-1.5">
                            <span class={`chip ${getStatusStyle(order.order_status)}`}>
                                {order.order_status}
                            </span>
                            <span class={`chip ${getStatusStyle(order.payment_status)}`}>
                                {order.payment_status}
                            </span>
                            <span
                                class={`chip ${order.delivered === "Y" ? "bg-mint-soft text-mint-deep border-mint-edge/40" : "bg-canvas text-ink-muted border-hairline"}`}
                            >
                                {order.delivered === "Y" ? "Delivered" : "Preparing"}
                            </span>
                        </div>

                        <!-- Reference strip. Mono, because it is a record you may read aloud. -->
                        <div class="mt-4 flex items-center justify-between gap-3 border border-hairline bg-canvas px-4 py-3">
                            <div class="min-w-0">
                                <p class="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink-faint">
                                    Order reference
                                </p>
                                <p class="mt-1 break-all font-mono text-xs font-bold text-ink">
                                    {order.order_no}
                                </p>
                            </div>
                            <span class="shrink-0 bg-ink px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent">
                                View
                            </span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>
