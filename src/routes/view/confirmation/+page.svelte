<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { page } from "$app/state";
    import { ArrowLeftIcon } from "@untitled-theme/icons-svelte";
    import { CheckIcon, ReceiptTextIcon } from "@lucide/svelte";
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

    function statusTextClass(status: string) {
        const normalized = status.toUpperCase();
        if (normalized === "PAID" || normalized === "CONFIRMED") {
            return "text-success";
        }
        if (normalized === "PENDING") {
            return "text-warning";
        }
        if (normalized === "CANCELLED") {
            return "text-danger";
        }
        return "text-ink-muted";
    }

    // Torn-paper sawtooth along the receipt's bottom edge
    const teethPoints = `0,0 ${Array.from(
        { length: 24 },
        (_, i) => `${i * 20 + 10},12 ${i * 20 + 20},0`,
    ).join(" ")}`;

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
    <div class="px-4 pb-12 pt-4 max-w-md mx-auto">
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
                        <div class="px-6 pt-7 pb-2 space-y-4">
                            <div
                                class="h-3 w-24 mx-auto animate-pulse rounded bg-line/60"
                            ></div>
                            <div
                                class="h-16 w-36 mx-auto animate-pulse rounded-2xl bg-line/50"
                            ></div>
                            <div
                                class="h-4 w-40 mx-auto animate-pulse rounded bg-line/60"
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
                <!-- Receipts -->
                {#each orders as order, i}
                    <article
                        class="[filter:drop-shadow(0_1px_2px_rgb(26_30_38/0.05))_drop-shadow(0_14px_28px_rgb(26_30_38/0.10))]"
                        in:fly={{ y: 24, duration: 380, delay: 120 + i * 90 }}
                    >
                        <div class="rounded-t-xl bg-surface px-6 pt-7 pb-6">
                            <!-- Receipt header -->
                            <header class="text-center">
                                <p
                                    class="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint"
                                >
                                    Eat Right · Campus Food Court
                                </p>
                                <h2
                                    class="mt-1.5 text-lg font-bold tracking-tight text-ink"
                                >
                                    {order.outlet_name}
                                </h2>
                                {#if order.delivered === "Y"}
                                    <span
                                        class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-success"
                                    >
                                        <CheckIcon size={12} strokeWidth={3} />
                                        Delivered
                                    </span>
                                {:else}
                                    <span
                                        class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-warning"
                                    >
                                        <span
                                            class="h-1.5 w-1.5 animate-pulse rounded-full bg-warning"
                                        ></span>
                                        Preparing
                                    </span>
                                {/if}
                            </header>

                            <!-- Pickup code -->
                            <div
                                class="mt-5 rounded-2xl border-2 border-dashed border-line-strong px-4 py-4 text-center"
                            >
                                <p class="section-label">Pickup Code</p>
                                <p
                                    class="mt-1.5 font-geist-mono text-[44px] leading-none tracking-[0.16em] mr-[-0.16em] text-ink font-bold!"
                                >
                                    {pickupCode(order.order_no)}
                                </p>
                                <p
                                    class="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint"
                                >
                                    Show this code at the counter
                                </p>
                            </div>

                            <!-- Items -->
                            <div
                                class="mt-6 border-t border-dashed border-line-strong pt-4"
                            >
                                <div
                                    class="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint"
                                >
                                    <span>Item</span>
                                    <span>Amount</span>
                                </div>
                                <div class="mt-1.5">
                                    {#each order.items as item}
                                        <div class="py-2">
                                            <div
                                                class="flex items-baseline gap-2"
                                            >
                                                <span
                                                    class="shrink-0 font-geist-mono text-xs text-ink-muted tabular-nums"
                                                    >{item.qty}×</span
                                                >
                                                <span
                                                    class="min-w-0 truncate text-sm font-semibold text-ink"
                                                    >{item.item_name}</span
                                                >
                                                <span
                                                    class="flex-1 border-b border-dotted border-line-strong"
                                                ></span>
                                                <span
                                                    class="shrink-0 font-geist-mono text-sm text-ink tabular-nums font-semibold"
                                                    >₹{Number(
                                                        item.total,
                                                    ).toFixed(2)}</span
                                                >
                                            </div>
                                            <p
                                                class="mt-0.5 pl-6 text-[11px] font-medium text-ink-faint tabular-nums"
                                            >
                                                ₹{Number(item.price).toFixed(2)}
                                                each
                                                <span
                                                    class={`ml-1 text-[9px] font-bold uppercase tracking-wider ${statusTextClass(item.status)}`}
                                                    >{item.status}</span
                                                >
                                            </p>
                                        </div>
                                    {/each}
                                </div>
                            </div>

                            <!-- Total -->
                            <div
                                class="mt-2 border-t border-dashed border-line-strong pt-4"
                            >
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2.5">
                                        <span
                                            class="text-sm font-bold uppercase tracking-wide text-ink"
                                            >Total</span
                                        >
                                        <span
                                            class={`inline-block -rotate-3 rounded-md border-2 border-current px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${statusTextClass(order.payment_status)}`}
                                        >
                                            {order.payment_status}
                                        </span>
                                    </div>
                                    <p
                                        class="font-mono font-semibold text-xl text-ink tabular-nums"
                                    >
                                        ₹{Number(order.grand_total).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <!-- Barcode / order reference -->
                            <button
                                class="mt-5 block w-full border-t border-dashed border-line-strong pt-5 text-center transition-opacity active:opacity-60"
                                onclick={() => copyOrderNo(order.order_no)}
                                aria-label="Copy order reference"
                            >
                                <div
                                    class="receipt-barcode mx-auto w-4/5 text-ink"
                                ></div>
                                <p
                                    class="mt-2 break-all font-geist-mono text-[11px] tracking-[0.2em] text-ink-muted"
                                >
                                    {order.order_no}
                                </p>
                                <p
                                    class={`mt-1 text-[9px] font-bold uppercase tracking-[0.16em] ${copiedOrderNo === order.order_no ? "text-success" : "text-ink-faint"}`}
                                >
                                    {copiedOrderNo === order.order_no
                                        ? "Copied to clipboard"
                                        : "Tap to copy"}
                                </p>
                            </button>

                            <p
                                class="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint"
                            >
                                · Thank you · Eat well ·
                            </p>
                        </div>
                        <!-- Torn edge -->
                        <svg
                            class="block w-full text-surface"
                            viewBox="0 0 480 12"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                        >
                            <polygon points={teethPoints} fill="currentColor" />
                        </svg>
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
