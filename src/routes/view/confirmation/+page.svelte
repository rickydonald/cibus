<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { page } from "$app/state";
    import { ArrowLeftIcon } from "@untitled-theme/icons-svelte";
    import {
        CircleCheckIcon,
        CheckIcon,
        CopyIcon,
        ReceiptTextIcon,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";
    import { fly, scale } from "svelte/transition";
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
    let copiedOrderNo = $state("");

    function pickupCode(orderNo: string) {
        const match = orderNo.match(/(\d{3})$/);
        return match?.[1] ?? orderNo.slice(-3);
    }

    function statusClass(status: string) {
        const normalized = status.toUpperCase();
        if (normalized === "PAID" || normalized === "CONFIRMED") {
            return "bg-success-soft text-success border border-success/10";
        }
        if (normalized === "PENDING") {
            return "bg-warning-soft text-warning border border-warning/10";
        }
        if (normalized === "CANCELLED") {
            return "bg-danger-soft text-danger border border-danger/10";
        }
        return "bg-canvas text-ink-muted border border-line";
    }

    function splitPrice(amount: number) {
        const str = Number(amount).toFixed(2);
        const [main, decimal] = str.split(".");
        return { main, decimal };
    }

    async function copyOrderNo(orderNo: string) {
        try {
            await navigator.clipboard.writeText(orderNo);
            copiedOrderNo = orderNo;
            toast.success("Order number copied");
            setTimeout(() => {
                if (copiedOrderNo === orderNo) copiedOrderNo = "";
            }, 2000);
        } catch {
            toast.error("Unable to copy order number");
        }
    }

    const allDelivered = $derived(
        orders.length > 0 && orders.every((o) => o.delivered === "Y"),
    );

    const totalPaid = $derived(
        orders.reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0),
    );

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

<div class="min-h-screen text-ink antialiased">
    <!-- Header Navigation -->
    <div class="page-header">
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => goto("/view/home")}
                class="icon-btn"
                aria-label="Back to EatRight"
            >
                <ArrowLeftIcon class="h-4 w-4" />
            </button>

            <div>
                <h1 class="text-lg font-bold tracking-tight text-ink">
                    Order Details
                </h1>
                <p class="text-xs text-ink-muted font-medium">
                    Eat Right Confirmation
                </p>
            </div>
        </div>
    </div>

    <div class="px-4 pb-12 max-w-md mx-auto">
        {#if isLoading}
            <!-- Skeleton Ticket -->
            <div class="space-y-5 pt-4">
                <div class="flex flex-col items-center pt-4 pb-2">
                    <div
                        class="h-14 w-14 animate-pulse rounded-full bg-line/60"
                    ></div>
                    <div
                        class="mt-4 h-5 w-40 animate-pulse rounded-full bg-line/60"
                    ></div>
                    <div
                        class="mt-2 h-3 w-56 animate-pulse rounded-full bg-line/50"
                    ></div>
                </div>
                {#each Array(1) as _}
                    <div class="card overflow-hidden">
                        <div class="bg-primary/10 px-6 pt-7 pb-8 space-y-4">
                            <div
                                class="h-3 w-24 mx-auto animate-pulse rounded bg-primary/10"
                            ></div>
                            <div
                                class="h-16 w-36 mx-auto animate-pulse rounded-2xl bg-primary/10"
                            ></div>
                            <div
                                class="h-4 w-40 mx-auto animate-pulse rounded bg-primary/10"
                            ></div>
                        </div>
                        <div class="p-6 space-y-3">
                            {#each Array(3) as _}
                                <div class="flex justify-between gap-4">
                                    <div
                                        class="h-4 w-2/3 animate-pulse rounded bg-canvas"
                                    ></div>
                                    <div
                                        class="h-4 w-12 animate-pulse rounded bg-canvas"
                                    ></div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center px-4"
            >
                <div
                    class="h-12 w-12 rounded-full bg-danger-soft flex items-center justify-center text-danger mb-3"
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
                <h2 class="text-base font-bold text-ink">
                    Could not load details
                </h2>
                <p class="mt-1 text-xs text-ink-muted max-w-xs">{error}</p>
                <button
                    class="btn-primary mt-5 w-full max-w-xs rounded-xl py-3 text-sm"
                    onclick={loadOrderDetails}
                >
                    Try Again
                </button>
            </div>
        {:else}
            <div class="space-y-5 pt-2">
                <!-- Success Hero -->
                <!-- <div
                    class="flex flex-col items-center pt-5 pb-1 text-center"
                    in:scale={{ duration: 350, start: 0.85 }}
                >
                    <div
                        class="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success"
                    >
                        <CircleCheckIcon size={28} strokeWidth={2.2} />
                    </div>
                    <h2 class="mt-3 text-xl font-bold tracking-tight text-ink">
                        {allDelivered ? "Order delivered" : "Order confirmed"}
                    </h2>
                    <p class="mt-1 text-sm font-medium text-ink-muted">
                        {allDelivered
                            ? "Hope you enjoyed your meal!"
                            : orders.length > 1
                              ? "Show each code at its counter to collect"
                              : "Show this code at the counter to collect"}
                    </p>
                </div> -->

                <!-- Pickup Tickets -->
                {#each orders as order, i}
                    <article
                        class="overflow-hidden rounded-[28px] border border-line bg-surface shadow-card"
                        in:fly={{ y: 24, duration: 380, delay: 120 + i * 90 }}
                    >
                        <!-- Navy Ticket Stub -->
                        <div
                            class="relative bg-primary px-6 pt-7 pb-9 text-center text-white"
                        >
                            <div
                                class="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.1),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.05),transparent_40%)]"
                            ></div>

                            <div class="relative z-10">
                                <p
                                    class="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60"
                                >
                                    Pickup Code
                                </p>
                                <p
                                    class="mt-2 text-[64px] font-black leading-none tracking-[0.14em] font-geist-mono! mr-[-0.14em]"
                                >
                                    {pickupCode(order.order_no)}
                                </p>

                                <p
                                    class="mt-3 text-sm font-semibold text-white/90"
                                >
                                    {order.outlet_name}
                                </p>

                                <div
                                    class="mt-3 flex items-center justify-center gap-2"
                                >
                                    {#if order.delivered === "Y"}
                                        <span
                                            class="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
                                        >
                                            <CheckIcon
                                                size={12}
                                                strokeWidth={3}
                                            />
                                            Delivered
                                        </span>
                                    {:else}
                                        <span
                                            class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                                        >
                                            <span
                                                class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"
                                            ></span>
                                            Preparing
                                        </span>
                                    {/if}
                                </div>

                                {#if order.delivered === "Y" && order.delivereddate}
                                    <p
                                        class="mt-2 text-[11px] font-medium text-white/50"
                                    >
                                        Delivered on {order.delivereddate}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        <!-- Perforation -->
                        <div class="relative bg-surface px-6 pb-6 pt-6">
                            <div
                                class="pointer-events-none absolute -top-3 -left-px h-6 w-3 rounded-r-full bg-canvas border border-l-0 border-line"
                            ></div>
                            <div
                                class="pointer-events-none absolute -top-3 -right-px h-6 w-3 rounded-l-full bg-canvas border border-r-0 border-line"
                            ></div>
                            <div
                                class="pointer-events-none absolute -top-px left-5 right-5 border-t-2 border-dashed border-canvas"
                            ></div>

                            <!-- Items -->
                            <p class="section-label">Items</p>
                            <div class="mt-2 divide-y divide-line/70">
                                {#each order.items as item}
                                    <div
                                        class="flex items-start justify-between gap-4 py-3 first:pt-1 last:pb-0"
                                    >
                                        <div
                                            class="flex min-w-0 items-start gap-3"
                                        >
                                            <span
                                                class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-soft text-[11px] font-bold text-primary tabular-nums"
                                            >
                                                {item.qty}
                                            </span>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-sm font-semibold leading-snug text-ink"
                                                >
                                                    {item.item_name}
                                                </p>
                                                <p
                                                    class="mt-0.5 text-xs font-medium text-ink-faint tabular-nums"
                                                >
                                                    ₹{splitPrice(item.price)
                                                        .main}.{splitPrice(
                                                        item.price,
                                                    ).decimal} each
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            class="text-right whitespace-nowrap"
                                        >
                                            <p
                                                class="text-sm font-bold leading-tight text-ink tabular-nums"
                                            >
                                                ₹{splitPrice(item.total)
                                                    .main}.<span
                                                    class="text-xs font-normal text-ink-faint"
                                                    >{splitPrice(item.total)
                                                        .decimal}</span
                                                >
                                            </p>
                                            <span
                                                class={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusClass(item.status)}`}
                                            >
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>
                                {/each}
                            </div>

                            <!-- Bill -->
                            <div
                                class="mt-4 flex items-center justify-between border-t border-line pt-4"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-semibold text-ink"
                                        >Total paid</span
                                    >
                                    <span
                                        class={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusClass(order.payment_status)}`}
                                    >
                                        {order.payment_status}
                                    </span>
                                </div>
                                <p
                                    class="text-xl font-bold leading-none text-ink tabular-nums"
                                >
                                    ₹{splitPrice(order.grand_total)
                                        .main}.<span
                                        class="text-sm font-normal text-ink-muted"
                                        >{splitPrice(order.grand_total)
                                            .decimal}</span
                                    >
                                </p>
                            </div>

                            <!-- Order Reference -->
                            <button
                                class="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-left transition-colors hover:bg-primary-soft/50 active:scale-[0.99]"
                                onclick={() => copyOrderNo(order.order_no)}
                                aria-label="Copy order reference"
                            >
                                <div class="min-w-0">
                                    <p
                                        class="text-[9px] font-bold uppercase tracking-widest text-ink-faint"
                                    >
                                        Order Reference
                                    </p>
                                    <p
                                        class="mt-0.5 break-all font-geist-mono text-xs font-medium text-ink-muted"
                                    >
                                        {order.order_no}
                                    </p>
                                </div>
                                <span
                                    class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-muted"
                                >
                                    {#if copiedOrderNo === order.order_no}
                                        <CheckIcon
                                            size={14}
                                            strokeWidth={2.5}
                                            class="text-success"
                                        />
                                    {:else}
                                        <CopyIcon size={14} />
                                    {/if}
                                </span>
                            </button>
                        </div>
                    </article>
                {/each}

                <!-- Combined Total (multi-counter checkout) -->
                {#if orders.length > 1}
                    <div
                        class="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3.5 shadow-card"
                        in:fly={{
                            y: 24,
                            duration: 380,
                            delay: 120 + orders.length * 90,
                        }}
                    >
                        <span class="text-sm font-semibold text-ink-muted">
                            Total across {orders.length} counters
                        </span>
                        <span class="text-lg font-bold text-ink tabular-nums">
                            ₹{splitPrice(totalPaid).main}.<span
                                class="text-sm font-normal text-ink-muted"
                                >{splitPrice(totalPaid).decimal}</span
                            >
                        </span>
                    </div>
                {/if}

                <!-- Actions -->
                <div
                    class="grid grid-cols-2 gap-3 pt-1"
                    in:fly={{
                        y: 16,
                        duration: 350,
                        delay: 200 + orders.length * 90,
                    }}
                >
                    <button
                        class="btn-quiet py-3.5 text-sm"
                        onclick={() => goto("/view/history")}
                    >
                        <ReceiptTextIcon size={16} />
                        Order History
                    </button>
                    <button
                        class="btn-primary py-3.5 text-sm"
                        onclick={() => goto("/view/home")}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>
