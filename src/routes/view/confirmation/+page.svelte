<script lang="ts">
    import { goto } from "$app/navigation";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
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
        // Follows the app-wide role table: mint = done, sun = pending,
        // pink = cancelled.
        if (normalized === "PAID" || normalized === "CONFIRMED") {
            return "text-mint-deep";
        }
        if (normalized === "PENDING") {
            return "text-sun-deep";
        }
        if (normalized === "CANCELLED") {
            return "text-pink-edge";
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
                    const response = await fetch(
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
    <div class="mx-auto max-w-md px-5 pb-12 pt-4">
        {#if isLoading}
            <div class="space-y-5 pt-4">
                <div class="flex flex-col items-center pb-2 pt-4">
                    <div class="h-14 w-14 animate-pulse bg-hairline"></div>
                    <div class="mt-4 h-5 w-40 animate-pulse bg-hairline"></div>
                    <div class="mt-2 h-3 w-56 animate-pulse bg-hairline"></div>
                </div>
                <div class="border border-hairline bg-surface">
                    <div class="space-y-4 px-6 pb-2 pt-7">
                        <div class="mx-auto h-3 w-24 animate-pulse bg-hairline"></div>
                        <div class="mx-auto h-16 w-36 animate-pulse bg-hairline"></div>
                        <div class="mx-auto h-4 w-40 animate-pulse bg-hairline"></div>
                    </div>
                    <div class="space-y-3 p-6">
                        {#each Array(3) as _}
                            <div class="flex justify-between gap-4">
                                <div class="h-4 w-2/3 animate-pulse bg-canvas"></div>
                                <div class="h-4 w-12 animate-pulse bg-canvas"></div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {:else if error}
            <div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
                <div class="mb-5 flex h-14 w-14 items-center justify-center bg-danger text-white">
                    <span class="text-2xl font-extrabold">!</span>
                </div>
                <h2 class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">
                    Could not load details
                </h2>
                <p class="mt-2 max-w-xs text-xs text-ink-muted">{error}</p>
                <button
                    class="np-elevate mt-6 block w-full max-w-xs cursor-pointer border-0 bg-transparent p-0"
                    style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                    onclick={loadOrderDetails}
                >
                    <span class="np-face flex h-[50px] items-center justify-center text-sm font-extrabold uppercase tracking-[0.14em]">
                        Try again
                    </span>
                </button>
            </div>
        {:else}
            <div class="space-y-5 pt-2">
                <!--
                  The receipt keeps its paper metaphor — dashed rules and a torn
                  edge are hard-edged devices, so they survive the translation.
                  The blurred drop-shadow does not; the ticket is held by a hard
                  border instead.
                -->
                {#each orders as order, i}
                    <article in:fly={{ y: 20, duration: 260, delay: 80 + i * 70 }}>
                        <div class="border-2 border-line border-b-0 bg-surface">
                            <!-- Masthead -->
                            <header class="bg-ink px-6 py-5 text-center text-white">
                                <p class="text-[9px] font-extrabold uppercase tracking-[0.26em] text-white/50">
                                    Eat Right · Campus Food Court
                                </p>
                                <h2 class="mt-2 text-lg font-extrabold tracking-tight">
                                    {order.outlet_name}
                                </h2>
                                {#if order.delivered === "Y"}
                                    <span class="mt-3 inline-flex items-center gap-1.5 bg-mint px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink">
                                        <CheckIcon size={11} strokeWidth={3.5} />
                                        Delivered
                                    </span>
                                {:else}
                                    <span class="mt-3 inline-flex items-center gap-1.5 bg-sun px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink">
                                        <span class="h-1.5 w-1.5 animate-pulse bg-ink"></span>
                                        Preparing
                                    </span>
                                {/if}
                            </header>

                            <div class="px-6 pb-6 pt-6">
                                <!--
                                  Pickup code on black so the accent can be used
                                  as type — it has the contrast here that it
                                  lacks on the light canvas.
                                -->
                                <div class="border-2 border-dashed border-line bg-ink px-4 py-5 text-center">
                                    <p class="text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                                        Pickup Code
                                    </p>
                                    <p class="mt-2 mr-[-0.16em] font-geist-mono text-[44px] font-bold! leading-none tracking-[0.16em] text-accent">
                                        {pickupCode(order.order_no)}
                                    </p>
                                    <p class="mt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                                        Show this code at the counter
                                    </p>
                                </div>

                                <!-- Items -->
                                <div class="mt-6 border-t border-dashed border-line pt-4">
                                    <div class="flex items-baseline justify-between text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                                        <span>Item</span>
                                        <span>Amount</span>
                                    </div>
                                    <div class="mt-2">
                                        {#each order.items as item}
                                            <div class="py-2">
                                                <div class="flex items-baseline gap-2">
                                                    <span class="shrink-0 font-geist-mono text-xs font-bold tabular-nums text-ink-muted">{item.qty}×</span>
                                                    <span class="min-w-0 truncate text-[13px] font-extrabold text-ink">{item.item_name}</span>
                                                    <span class="flex-1 border-b border-dotted border-hairline"></span>
                                                    <span class="shrink-0 font-geist-mono text-[13px] font-extrabold tabular-nums text-ink">₹{Number(item.total).toFixed(2)}</span>
                                                </div>
                                                <p class="mt-1 pl-6 text-[10px] font-bold tabular-nums text-ink-faint">
                                                    ₹{Number(item.price).toFixed(2)} each
                                                    <span class={`ml-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] ${statusTextClass(item.status)}`}>{item.status}</span>
                                                </p>
                                            </div>
                                        {/each}
                                    </div>
                                </div>

                                <!-- Total -->
                                <div class="mt-2 border-t border-dashed border-line pt-4">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2.5">
                                            <span class="text-[13px] font-extrabold uppercase tracking-[0.12em] text-ink">Total</span>
                                            <span class={`inline-block -rotate-3 border-2 border-current px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] ${statusTextClass(order.payment_status)}`}>
                                                {order.payment_status}
                                            </span>
                                        </div>
                                        <p class="font-mono text-xl font-extrabold tabular-nums text-ink">
                                            ₹{Number(order.grand_total).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <!-- Reference -->
                                <button
                                    class="mt-5 block w-full border-t border-dashed border-line pt-5 text-center transition-opacity active:opacity-60"
                                    onclick={() => copyOrderNo(order.order_no)}
                                    aria-label="Copy order reference"
                                >
                                    <div class="receipt-barcode mx-auto w-4/5 text-ink"></div>
                                    <p class="mt-2.5 break-all font-geist-mono text-[11px] font-bold tracking-[0.2em] text-ink-muted">
                                        {order.order_no}
                                    </p>
                                    <p class={`mt-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] ${copiedOrderNo === order.order_no ? "text-mint-deep" : "text-ink-faint"}`}>
                                        {copiedOrderNo === order.order_no ? "Copied to clipboard" : "Tap to copy"}
                                    </p>
                                </button>

                                <p class="mt-6 text-center text-[9px] font-extrabold uppercase tracking-[0.26em] text-ink-faint">
                                    · Thank you · Eat well ·
                                </p>
                            </div>
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

                {#if orders.length > 1}
                    <div
                        class="flex items-center justify-between border border-line bg-surface px-5 py-4"
                        in:fly={{ y: 20, duration: 260, delay: 80 + orders.length * 70 }}
                    >
                        <span class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
                            Total across {orders.length} counters
                        </span>
                        <span class="text-lg font-extrabold tabular-nums text-ink">
                            ₹{splitPrice(totalPaid).main}<span class="text-sm text-ink-faint">.{splitPrice(totalPaid).decimal}</span>
                        </span>
                    </div>
                {/if}

                <!-- Actions -->
                <div
                    class="grid grid-cols-2 gap-3 pt-1"
                    in:fly={{ y: 14, duration: 240, delay: 140 + orders.length * 70 }}
                >
                    <button
                        class="np-elevate block w-full cursor-pointer border-0 bg-transparent p-0"
                        style="--np-face:var(--color-surface);--np-ink:var(--color-ink);--np-edge-right:var(--color-np-white-50);--np-edge-bottom:var(--color-np-black-50)"
                        onclick={() => goto("/view/history")}
                    >
                        <span class="np-face flex h-12 items-center justify-center gap-2 border border-line text-[11px] font-extrabold uppercase tracking-[0.12em]">
                            <ReceiptTextIcon size={15} strokeWidth={2.6} />
                            History
                        </span>
                    </button>
                    <button
                        class="np-elevate block w-full cursor-pointer border-0 bg-transparent p-0"
                        style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                        onclick={() => goto("/view/home")}
                    >
                        <span class="np-face flex h-12 items-center justify-center text-[11px] font-extrabold uppercase tracking-[0.12em]">
                            Back to home
                        </span>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>
