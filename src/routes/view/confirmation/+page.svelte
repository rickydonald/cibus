<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { page } from "$app/state";
    import { ArrowLeftIcon } from "@untitled-theme/icons-svelte";
    import { onMount } from "svelte";

    type OrderItem = {
        order_item_id: number;
        total: number;
        item_id: number;
        price: number;
        qty: number;
        item_name: string;
        status: string;
    };

    type OrderDetails = {
        order_no: string;
        delivereddate: string | null;
        orderid: number;
        payment_status: string;
        outletid: number;
        delivered: string;
        grand_total: number;
        outlet_name: string;
        items: OrderItem[];
    };

    let orders = $state<OrderDetails[]>([]);
    let isLoading = $state(true);
    let error = $state("");

    function pickupCode(orderNo: string) {
        const match = orderNo.match(/(\d{3})$/);
        return match?.[1] ?? orderNo.slice(-3);
    }

    function statusClass(status: string) {
        const normalized = status.toUpperCase();
        if (normalized === "PAID" || normalized === "CONFIRMED") {
            return "bg-emerald-50 text-emerald-700 border border-emerald-500/10";
        }
        if (normalized === "PENDING") {
            return "bg-amber-50 text-amber-700 border border-amber-500/10";
        }
        if (normalized === "CANCELLED") {
            return "bg-rose-50 text-rose-700 border border-rose-500/10";
        }
        return "bg-neutral-50 text-neutral-600 border border-neutral-500/10";
    }

    // Bulletproof price formatter to ensure layout separation works flawlessly
    function splitPrice(amount: number) {
        const str = Number(amount).toFixed(2);
        const [main, decimal] = str.split(".");
        return { main, decimal };
    }

    async function loadOrderDetails() {
        isLoading = true;
        error = "";

        const orderNos = page.url.searchParams.getAll("order_no");
        const outletIds = page.url.searchParams.getAll("outletid");

        if (orderNos.length === 0 || outletIds.length === 0) {
            error = "Order details are missing.";
            isLoading = false;
            return;
        }

        try {
            const responses = await Promise.all(
                orderNos.map(async (orderNo, index) => {
                    const outletId = outletIds[index] ?? outletIds[0];
                    const response = await fetchEatRight(
                        `/api/v1/order/details?order_no=${encodeURIComponent(orderNo)}&outletid=${encodeURIComponent(outletId)}`,
                    );
                    const data = await response.json();

                    if (!response.ok || data.error) {
                        if (
                            await redirectIfEatRightConnectRequired(
                                data.errorCode,
                            )
                        ) {
                            return [];
                        }
                        throw new Error(
                            data.error ?? "Unable to load order details.",
                        );
                    }

                    return Array.isArray(data.orders)
                        ? (data.orders as OrderDetails[])
                        : [];
                }),
            );

            orders = responses.flat();
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Unable to load order details.";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadOrderDetails();
    });
</script>

<div class="min-h-screen bg-[#F4F5F7] text-neutral-900 antialiased font-sans">
    <!-- Header Navigation -->
    <div
        class="sticky top-0 z-20 bg-[#F4F5F7]/80 backdrop-blur-md border-b border-neutral-200/30"
    >
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => goto("/view/home")}
                class="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-neutral-200/80 shadow-sm active:scale-95 transition-transform"
                aria-label="Back to EatRight"
            >
                <ArrowLeftIcon class="h-4 w-4 text-neutral-700" />
            </button>

            <div>
                <h1 class="text-lg font-bold tracking-tight text-neutral-900">
                    Order Placed
                </h1>
                <p class="text-xs text-neutral-500 font-medium">
                    EatRight Confirmation
                </p>
            </div>
        </div>
    </div>

    <div class="px-4 pb-12 max-w-md mx-auto">
        {#if isLoading}
            <div class="space-y-4 pt-4">
                {#each Array(2) as _}
                    <div
                        class="rounded-3xl bg-white border border-neutral-200/50 p-6 shadow-sm space-y-4"
                    >
                        <div
                            class="h-4 w-1/4 animate-pulse rounded bg-neutral-100"
                        ></div>
                        <div
                            class="h-12 w-1/2 mx-auto animate-pulse rounded-xl bg-neutral-100"
                        ></div>
                        <div
                            class="h-4 w-1/3 mx-auto animate-pulse rounded bg-neutral-100"
                        ></div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <div
                    class="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-3"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                        class="w-5 h-5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                        />
                    </svg>
                </div>
                <h2 class="text-base font-bold text-neutral-950">
                    Could not load details
                </h2>
                <p class="mt-1 text-xs text-neutral-500 max-w-xs">{error}</p>
                <button
                    class="mt-5 w-full max-w-xs rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition-transform"
                    onclick={loadOrderDetails}
                >
                    Try Again
                </button>
            </div>
        {:else}
            <div class="space-y-5 pt-4">
                {#each orders as order}
                    <article
                        class="overflow-hidden rounded-3xl bg-white border border-neutral-200/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                    >
                        <!-- Pickup Code Area -->
                        <div
                            class="bg-white pt-6 pb-5 px-6 text-center relative"
                        >
                            <p
                                class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400"
                            >
                                Show this Pickup Code
                            </p>
                            <h2
                                class="mt-3 mb-1 text-6xl font-black text-neutral-950 tracking-wide tabular-nums"
                            >
                                {pickupCode(order.order_no)}
                            </h2>
                            <p
                                class="mt-1.5 text-sm font-semibold text-neutral-600 px-3 py-1 rounded-full inline-block"
                            >
                                {order.outlet_name}
                            </p>

                            <!-- Clean Geometric Ticket Cuts Intermediary Separator -->
                            <div
                                class="absolute -bottom-2 left-0 right-0 flex items-center justify-between pointer-events-none px-0"
                            >
                                <div
                                    class="w-3 h-4 rounded-r-full bg-[#F4F5F7] border border-l-0 border-neutral-200/50"
                                ></div>
                                <div
                                    class="w-full border-b border-dashed border-neutral-300 mx-1"
                                ></div>
                                <div
                                    class="w-3 h-4 rounded-l-full bg-[#F4F5F7] border border-r-0 border-neutral-200/50"
                                ></div>
                            </div>
                        </div>

                        <!-- Info details segment -->
                        <div class="p-6 pt-5">
                            <div class="flex items-start justify-between gap-4">
                                <div class="min-w-0">
                                    <p
                                        class="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400"
                                    >
                                        Order Reference
                                    </p>
                                    <p
                                        class="mt-0.5 break-all font-geist-mono text-xs text-neutral-500 font-medium"
                                    >
                                        {order.order_no}
                                    </p>
                                </div>
                                <div class="text-right whitespace-nowrap">
                                    <p
                                        class="text-2xl font-bold text-neutral-950 leading-none"
                                    >
                                        ₹{splitPrice(order.grand_total)
                                            .main}.<span
                                            class="font-normal text-base text-neutral-500"
                                            >{splitPrice(order.grand_total)
                                                .decimal}</span
                                        >
                                    </p>
                                </div>
                            </div>

                            <!-- Meta Status Pill Rows -->
                            <div class="mt-3.5 flex flex-wrap gap-1.5">
                                <span
                                    class={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusClass(order.payment_status)}`}
                                >
                                    {order.payment_status}
                                </span>
                                <span
                                    class={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${order.delivered === "Y" ? "bg-emerald-50 text-emerald-700 border border-emerald-500/10" : "bg-neutral-50 text-neutral-600 border border-neutral-200/60"}`}
                                >
                                    {order.delivered === "Y"
                                        ? "Delivered"
                                        : "Preparing"}
                                </span>
                            </div>

                            <!-- Receipt Ordered Items -->
                            <div
                                class="mt-6 border-t border-neutral-100 pt-4 space-y-3"
                            >
                                <p
                                    class="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400"
                                >
                                    Items Ordered
                                </p>
                                <div class="divide-y divide-neutral-100">
                                    {#each order.items as item}
                                        <div
                                            class="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                                        >
                                            <div class="min-w-0">
                                                <p
                                                    class="font-semibold text-neutral-900 text-sm leading-snug"
                                                >
                                                    {item.item_name}
                                                </p>
                                                <p
                                                    class="mt-0.5 text-xs text-neutral-400 font-medium"
                                                >
                                                    {item.qty} × ₹{splitPrice(
                                                        item.price,
                                                    ).main}.<span
                                                        class="text-[10px]"
                                                        >{splitPrice(item.price)
                                                            .decimal}</span
                                                    >
                                                </p>
                                            </div>
                                            <div
                                                class="text-right whitespace-nowrap"
                                            >
                                                <p
                                                    class="font-bold text-sm text-neutral-950 leading-tight"
                                                >
                                                    ₹{splitPrice(item.total)
                                                        .main}.<span
                                                        class="font-normal text-xs text-neutral-400"
                                                        >{splitPrice(item.total)
                                                            .decimal}</span
                                                    >
                                                </p>
                                                <span
                                                    class={`mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusClass(item.status)}`}
                                                >
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    </article>
                {/each}

                <button
                    class="w-full rounded-2xl bg-neutral-950 py-3.5 font-bold text-sm text-white shadow-sm active:scale-[0.99] transition-transform mt-3"
                    onclick={() => goto("/view/home")}
                >
                    Back to Home
                </button>
            </div>
        {/if}
    </div>
</div>
