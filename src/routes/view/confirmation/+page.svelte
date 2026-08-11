<script lang="ts">
    import { goto, replaceState } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { page } from "$app/state";
    import OrderPlacedOverlay from "$lib/components/custom/OrderPlacedOverlay.svelte";
    import {
        CheckIcon,
        DownloadIcon,
        ReceiptTextIcon,
        RefreshCwIcon,
        TimerOffIcon,
    } from "@lucide/svelte";
    import { XCloseIcon } from "@untitled-theme/icons-svelte";
    import InstallSheet from "$lib/components/custom/InstallSheet.svelte";
    import { install } from "$lib/client/install.svelte";
    import { toast } from "svelte-sonner";
    import { scale } from "svelte/transition";
    import { onMount } from "svelte";
    import JsBarcode from "jsbarcode";
    import {
        createVisibilityPoller,
        type VisibilityPoller,
    } from "$lib/utils/visibility-poller";
    import { normalizeStoreName } from "$lib/utils/display-text";
    import { contentReveal, slideDown } from "$lib/utils/transitions";
    import {
        ORDER_TIME_ZONE,
        isActiveOrder,
        orderState,
        parseOrderDate,
    } from "$lib/utils/orders";

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
        created_on?: string | null;
        delivereddate: string | null;
        orderid: number;
        payment_status: string;
        // Only the order list reports this reliably; it is merged in below.
        order_status?: string | null;
        outletid: number;
        delivered: string;
        grand_total: number;
        outlet_name: string;
        items: OrderItem[];
    };

    type OrderHistoryEntry = {
        order_no: string;
        created_on?: string | null;
        delivered?: string;
        order_status?: string | null;
        payment_status?: string | null;
    };

    let orders = $state<OrderDetails[]>([]);
    let isLoading = $state(true);
    let error = $state("");
    let copiedOrderNo = $state("");
    let isStatusRefreshing = $state(false);
    let lastStatusCheck = $state<Date | null>(null);
    let liveStatusUnavailable = $state(false);
    let statusPoller: VisibilityPoller | null = null;

    // Only a fresh checkout hands this over (see the cart's placeOrder). It is
    // read once at init so the veil is up before the first paint, then cleared
    // from the history entry in onMount so a refresh or a trip back through
    // history goes straight to the receipt.
    const checkoutSummary = page.state.orderPlaced;
    const arrivedFromCheckout = Boolean(checkoutSummary);
    let isCelebrating = $state(arrivedFromCheckout);

    // Once the veil lifts, the receipt drops in from above and its sections
    // cascade. Arriving any other way keeps the plain crossfade.
    function dropDelay(step: number) {
        return arrivedFromCheckout ? step * 85 : 0;
    }

    function pickupCode(orderNo: string) {
        const match = orderNo.match(/(\d{3})$/);
        return match?.[1] ?? orderNo.slice(-3);
    }

    function isDelivered(order: OrderDetails) {
        return orderState(order) === "delivered";
    }

    function isCancelled(order: OrderDetails) {
        return orderState(order) === "cancelled";
    }

    // A cancelled order keeps its receipt for the record, but nothing on it
    // is actionable any more — no pickup code, no live proof, no polling.
    function isVoided(order: OrderDetails) {
        return isCancelled(order) || isDelivered(order);
    }

    function formatOrderDate(value?: string | null) {
        if (!value) return "Date unavailable";
        const date = parseOrderDate(value);
        if (!date) return "Date unavailable";

        return new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: ORDER_TIME_ZONE,
        }).format(date);
    }

    function orderBarcode(node: SVGSVGElement, orderNo: string) {
        function render(value: string) {
            JsBarcode(node, value, {
                format: "CODE128",
                displayValue: false,
                height: 40,
                width: 1.5,
                margin: 0,
                background: "transparent",
                lineColor: "currentColor",
            });
        }

        render(orderNo);

        return {
            update: render,
        };
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
        orders.length > 0 && orders.every(isDelivered),
    );

    const hasActiveOrders = $derived(orders.some(isActiveOrder));

    const anyCancelled = $derived(orders.some(isCancelled));

    // A cancelled counter was never charged, so it must not inflate the
    // combined total shown across a multi-counter checkout.
    const chargedOrders = $derived(
        orders.filter((order) => !isCancelled(order)),
    );

    const totalPaid = $derived(
        chargedOrders.reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0),
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
            const historyPromise = fetchEatRight("/api/v1/orders")
                .then(async (response) => {
                    if (!response.ok) return [];
                    const data = await response.json();
                    return Array.isArray(data.orders)
                        ? (data.orders as OrderHistoryEntry[])
                        : [];
                })
                .catch(() => [] as OrderHistoryEntry[]);

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

            const history = await historyPromise;
            const historyByOrderNo = new Map(
                history.map((order) => [order.order_no, order]),
            );

            orders = responses.flat().map((order) => {
                const listed = historyByOrderNo.get(order.order_no);
                return {
                    ...order,
                    created_on:
                        order.created_on ?? listed?.created_on ?? null,
                    // getOrderDetails.jsp does not always carry order_status,
                    // so a cancellation may only be visible on the list.
                    order_status: order.order_status ?? listed?.order_status,
                };
            });
            lastStatusCheck = new Date();
            liveStatusUnavailable = false;
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Unable to load order details.";
        } finally {
            isLoading = false;
        }
    }

    async function hydrateDeliveredOrders(orderNos: Set<string>) {
        const hydrated = new Map<string, OrderDetails>();

        await Promise.all(
            orders
                .filter((order) => orderNos.has(order.order_no))
                .map(async (order) => {
                    try {
                        const response = await fetchEatRight(
                            `/api/v1/order/details?order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`,
                        );
                        if (!response.ok) return;
                        const data = await response.json();
                        const detail = Array.isArray(data.orders)
                            ? (data.orders[0] as OrderDetails | undefined)
                            : undefined;
                        if (detail) hydrated.set(order.order_no, detail);
                    } catch {
                        // The delivered flag is already current. Its timestamp
                        // can wait until the next full page load.
                    }
                }),
        );

        if (hydrated.size > 0) {
            orders = orders.map((order) => {
                const detail = hydrated.get(order.order_no);
                // Both fields were merged in from the order list and are not
                // reliably present on a details response — keep them.
                return detail
                    ? {
                          ...detail,
                          created_on: order.created_on,
                          order_status: detail.order_status ?? order.order_status,
                      }
                    : order;
            });
        }
    }

    async function refreshOrderStatus() {
        try {
            // One small list request covers every counter in a multi-outlet
            // order; full receipt data is not repeatedly downloaded.
            const response = await fetchEatRight("/api/v1/orders");
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error ?? "Unable to refresh order status");
            }

            const latestOrders: OrderHistoryEntry[] = Array.isArray(data.orders)
                ? data.orders
                : Array.isArray(data)
                  ? data
                  : [];
            const latestByOrderNo = new Map(
                latestOrders.map((order) => [order.order_no, order]),
            );
            const newlyDelivered = new Set<string>();
            const newlyCancelled = new Set<string>();

            orders = orders.map((order) => {
                const latest = latestByOrderNo.get(order.order_no);
                if (!latest) return order;

                const next: OrderDetails = {
                    ...order,
                    delivered:
                        latest.delivered?.toUpperCase() ?? order.delivered,
                    order_status: latest.order_status ?? order.order_status,
                    payment_status:
                        latest.payment_status ?? order.payment_status,
                };

                const nextState = orderState(next);
                if (orderState(order) === nextState) return order;

                if (nextState === "delivered") {
                    newlyDelivered.add(order.order_no);
                } else if (nextState === "cancelled") {
                    newlyCancelled.add(order.order_no);
                }
                return next;
            });

            lastStatusCheck = new Date();
            liveStatusUnavailable = false;

            if (newlyCancelled.size > 0) {
                toast.error(
                    newlyCancelled.size === 1
                        ? "Your order was cancelled"
                        : `${newlyCancelled.size} orders were cancelled`,
                );
            }

            if (newlyDelivered.size > 0) {
                // Fetch details just once at the transition so the delivery
                // timestamp appears without polling the heavier endpoint.
                await hydrateDeliveredOrders(newlyDelivered);
                toast.success(
                    newlyDelivered.size === 1
                        ? "Your order has been delivered"
                        : `${newlyDelivered.size} orders have been delivered`,
                );
            }
        } catch (err) {
            liveStatusUnavailable = true;
            throw err;
        }
    }

    async function manuallyRefreshStatus() {
        if (isStatusRefreshing) return;
        isStatusRefreshing = true;
        try {
            if (statusPoller) {
                await statusPoller.refresh();
            } else {
                await refreshOrderStatus();
            }
            if (liveStatusUnavailable) {
                toast.error("Could not refresh order status");
            }
        } finally {
            isStatusRefreshing = false;
        }
    }

    // Live proof for the counter staff: a screenshot freezes the clock
    // and countdown, and a screen recording shows a stale time. The code
    // is only shown during a 5-minute live window; after that the viewer
    // must tap to restart it, so a code on screen is always fresh.
    const PREVIEW_TTL_MS = 5 * 60 * 1000;

    let now = $state(new Date());
    let previewDeadline = $state(Date.now() + PREVIEW_TTL_MS);

    const liveClock = $derived(
        new Intl.DateTimeFormat("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        }).format(now),
    );

    const lastCheckedLabel = $derived.by(() => {
        if (!lastStatusCheck) return "Checking status";
        const seconds = Math.max(
            0,
            Math.floor((now.getTime() - lastStatusCheck.getTime()) / 1000),
        );
        if (seconds < 10) return "Checked just now";
        if (seconds < 60) return `Checked ${seconds}s ago`;
        return `Checked ${Math.floor(seconds / 60)}m ago`;
    });

    const previewRemainingMs = $derived(
        Math.max(previewDeadline - now.getTime(), 0),
    );
    const isPreviewExpired = $derived(previewRemainingMs <= 0);
    const isPreviewEnding = $derived(previewRemainingMs < 60_000);
    const previewCountdown = $derived.by(() => {
        const totalSeconds = Math.ceil(previewRemainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    });
    const previewProgress = $derived(
        (previewRemainingMs / PREVIEW_TTL_MS) * 100,
    );

    function restartPreview() {
        previewDeadline = Date.now() + PREVIEW_TTL_MS;
    }

    let installSheetOpen = $state(false);
    let showInstallNudge = $state(false);

    onMount(() => {
        if (arrivedFromCheckout) replaceState("", {});

        // Only on a genuinely fresh order — never when this receipt is
        // reopened from history.
        if (arrivedFromCheckout && install.shouldNudge) {
            showInstallNudge = true;
            install.countNudge();
        }

        void loadOrderDetails();
        statusPoller = createVisibilityPoller({
            intervalMs: 30_000,
            shouldPoll: () => !isLoading && hasActiveOrders,
            poll: refreshOrderStatus,
        });
        const clockTimer = setInterval(() => (now = new Date()), 1000);
        return () => {
            clearInterval(clockTimer);
            statusPoller?.stop();
            statusPoller = null;
        };
    });
</script>

{#if isCelebrating && checkoutSummary}
    <OrderPlacedOverlay
        total={checkoutSummary.total}
        counters={checkoutSummary.counters}
        items={checkoutSummary.items}
        ready={!isLoading}
        onDone={() => (isCelebrating = false)}
    />
{/if}

<div class="min-h-screen text-ink antialiased">
    <div class="px-4 pb-12 pt-4 max-w-md mx-auto">
        {#if isCelebrating}
            <!-- Held back so the receipt starts its drop as the veil lifts,
                 rather than having already landed behind it. -->
        {:else if isLoading}
            <!-- Skeleton Ticket -->
            <div class="space-y-5 pt-4">
                <div class="flex flex-col items-center pt-4 pb-2">
                    <div
                        class="h-14 w-14 animate-pulse rounded-circle bg-line/60"
                    ></div>
                    <div
                        class="mt-4 h-5 w-40 animate-pulse rounded-circle bg-line/60"
                    ></div>
                    <div
                        class="mt-2 h-3 w-56 animate-pulse rounded-circle bg-line/50"
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
                in:contentReveal={{ duration: 500 }}
            >
                <div
                    class="h-12 w-12 rounded-circle bg-danger-soft flex items-center justify-center text-danger mb-3"
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
                {#each orders as order, index (order.order_no)}
                    {@const cancelled = isCancelled(order)}
                    <article
                        class={`filter-[drop-shadow(0_1px_2px_rgb(26_30_38/0.05))_drop-shadow(0_14px_28px_rgb(26_30_38/0.10))] transition-opacity ${isVoided(order) ? "opacity-75 grayscale" : ""}`}
                        in:slideDown={{ delay: dropDelay(index) }}
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
                                    {normalizeStoreName(order.outlet_name)}
                                </h2>
                                <p
                                    class="mt-1 font-geist-mono text-[11px] font-semibold text-ink-muted"
                                >
                                    Ordered {formatOrderDate(order.created_on)}
                                </p>
                                {#if cancelled}
                                    <span
                                        class="mt-2 inline-flex items-center gap-1.5 rounded-circle bg-danger-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-danger"
                                    >
                                        <XCloseIcon class="h-3 w-3" />
                                        Cancelled
                                    </span>
                                {:else if isDelivered(order)}
                                    <span
                                        class="mt-2 inline-flex items-center gap-1.5 rounded-circle bg-line px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted"
                                    >
                                        <CheckIcon size={12} strokeWidth={3} />
                                        Delivered
                                    </span>
                                    {#if order.delivereddate}
                                        <p
                                            class="mt-1.5 text-[10px] font-medium text-ink-faint"
                                        >
                                            Delivered {formatOrderDate(
                                                order.delivereddate,
                                            )}
                                        </p>
                                    {/if}
                                {:else}
                                    <span
                                        class="mt-2 inline-flex items-center gap-1.5 rounded-circle bg-warning-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-warning"
                                    >
                                        <span
                                            class="h-1.5 w-1.5 animate-pulse rounded-circle bg-warning"
                                        ></span>
                                        Preparing
                                    </span>
                                {/if}
                            </header>

                            <!-- Pickup code -->
                            <div
                                class={`mt-5 overflow-hidden rounded-2xl border-2 border-dashed text-center ${cancelled ? "border-danger/25 bg-danger-soft px-4 py-4" : isDelivered(order) ? "border-line bg-canvas px-4 py-4" : isPreviewExpired ? "border-line-strong bg-canvas px-4 py-5" : "border-line-strong bg-surface"}`}
                            >
                                {#if cancelled}
                                    <XCloseIcon
                                        class="mx-auto h-7 w-7 text-danger"
                                    />
                                    <p
                                        class="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-danger"
                                    >
                                        Cancelled
                                    </p>
                                    <!-- <p
                                        class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-danger/70"
                                    >
                                        This order will not be prepared
                                    </p> -->
                                {:else if isDelivered(order)}
                                    <CheckIcon
                                        class="mx-auto text-ink-faint"
                                        size={28}
                                        strokeWidth={2.5}
                                    />
                                    <p
                                        class="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-ink-muted"
                                    >
                                        Delivered
                                    </p>
                                    <p
                                        class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint"
                                    >
                                        This pickup code is no longer valid
                                    </p>
                                {:else if isPreviewExpired}
                                    <div
                                        role="status"
                                        in:scale={{
                                            duration: 180,
                                            start: 0.97,
                                        }}
                                    >
                                        <span
                                            class="mx-auto flex h-11 w-11 items-center justify-center rounded-circle border border-line bg-surface text-ink-muted shadow-card"
                                        >
                                            <TimerOffIcon
                                                size={20}
                                                strokeWidth={2.25}
                                            />
                                        </span>
                                        <p
                                            class="mt-3 text-sm font-bold text-ink"
                                        >
                                            Live preview expired
                                        </p>
                                        <p
                                            class="mx-auto mt-1 max-w-[16rem] text-[11px] font-medium leading-relaxed text-ink-muted"
                                        >
                                            Open a fresh preview when you are
                                            ready to collect your order.
                                        </p>
                                        <button
                                            class="btn-primary mx-auto mt-4 min-h-11 w-full max-w-[16rem] px-4 py-2.5 text-xs"
                                            onclick={restartPreview}
                                        >
                                            <RefreshCwIcon
                                                size={15}
                                                strokeWidth={2.5}
                                            />
                                            Show code for another 5 minutes
                                        </button>
                                    </div>
                                {:else}
                                    <div class="px-4 pb-4 pt-5">
                                        <p class="section-label">Pickup Code</p>
                                        <p
                                            class="mt-1.5 mr-[-0.16em] font-geist-mono text-[44px] font-bold! leading-none tracking-[0.16em] text-ink"
                                        >
                                            {pickupCode(order.order_no)}
                                        </p>
                                        <p
                                            class="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint"
                                        >
                                            Show this live code at the counter
                                        </p>
                                    </div>

                                    <!-- Live proof controls sit below the code so
                                         the pickup number stays the primary focus. -->
                                    <div
                                        class="border-t border-dashed border-line bg-canvas px-4 pb-3 pt-3"
                                    >
                                        <div
                                            class="flex items-center justify-between gap-3 text-left"
                                        >
                                            <div
                                                class="flex min-w-0 items-center gap-2.5"
                                            >
                                                <div class="min-w-0">
                                                    <p
                                                        class={`text-[10px] font-bold uppercase tracking-[0.13em] ${isPreviewEnding ? "text-warning" : "text-success"}`}
                                                    >
                                                        Live Preview
                                                    </p>
                                                    <p
                                                        class="mt-0.5 font-geist-mono text-[13px] font-bold text-ink-muted tabular-nums"
                                                    >
                                                        {liveClock}
                                                    </p>
                                                </div>
                                            </div>

                                            <div class="shrink-0 text-right">
                                                <p
                                                    class="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint"
                                                >
                                                    Code hides in
                                                </p>
                                                <p
                                                    class={`mt-0.5 font-geist-mono text-[26px] font-bold leading-none tracking-tight tabular-nums ${isPreviewEnding ? "text-warning" : "text-ink"}`}
                                                    aria-label={`${previewCountdown} remaining`}
                                                >
                                                    {previewCountdown}
                                                </p>
                                            </div>
                                        </div>

                                        <div
                                            class="mt-3 h-1 overflow-hidden rounded-circle bg-line"
                                            role="progressbar"
                                            aria-label="Live preview time remaining"
                                            aria-valuemin="0"
                                            aria-valuemax="300"
                                            aria-valuenow={Math.ceil(
                                                previewRemainingMs / 1000,
                                            )}
                                        >
                                            <div
                                                class={`h-full rounded-circle transition-[width] duration-1000 ease-linear ${isPreviewEnding ? "bg-warning" : "bg-success"}`}
                                                style={`width: ${previewProgress}%`}
                                            ></div>
                                        </div>
                                    </div>
                                {/if}
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
                                                <!-- <span
                                                    class={`ml-1 text-[9px] font-bold uppercase tracking-wider ${statusTextClass(item.status)}`}
                                                    >{item.status}</span
                                                > -->
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

                            <!-- Barcode / order reference. A cancelled order
                                 keeps its reference but drops the barcode —
                                 there is nothing left to scan at a counter. -->
                            <button
                                class="mt-5 block w-full border-t border-dashed border-line-strong pt-5 text-center transition-opacity"
                                aria-label="Copy order reference"
                            >
                                {#if !cancelled}
                                    <svg
                                        use:orderBarcode={order.order_no}
                                        class="mx-auto h-10 w-4/5 text-ink"
                                        role="img"
                                        aria-label={`Barcode for order ${order.order_no}`}
                                    ></svg>
                                {/if}
                                <p
                                    class="mt-2 break-all font-geist-mono text-[11px] tracking-[0.2em] text-ink-muted font-semibold"
                                >
                                    {order.order_no}
                                </p>
                            </button>

                            <p
                                class="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint"
                            >
                                {cancelled
                                    ? "· Order cancelled ·"
                                    : "· Thank you · Eat well ·"}
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

                <!-- Combined Total (multi-counter checkout). Counts only the
                     counters actually charged, so a cancelled one drops out. -->
                {#if chargedOrders.length > 1}
                    <div
                        class="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3.5 shadow-card"
                        in:slideDown={{ delay: dropDelay(orders.length) }}
                    >
                        <span class="text-sm font-semibold text-ink-muted">
                            Total across {chargedOrders.length} counters
                        </span>
                        <span class="text-lg font-bold text-ink tabular-nums">
                            ₹{splitPrice(totalPaid).main}.<span
                                class="text-sm font-normal text-ink-muted"
                                >{splitPrice(totalPaid).decimal}</span
                            >
                        </span>
                    </div>
                {/if}

                <!-- Add to home screen — asked here because the order just
                     proved the app works, and only until it's acted on. -->
                {#if showInstallNudge && !anyCancelled}
                    <div
                        class="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card"
                        in:slideDown={{
                            delay: dropDelay(
                                orders.length +
                                    (chargedOrders.length > 1 ? 1 : 0),
                            ),
                        }}
                    >
                        <span
                            class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary-soft text-primary"
                        >
                            <DownloadIcon size={18} />
                        </span>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-semibold tracking-tight text-ink"
                            >
                                Order faster next time
                            </p>
                            <p
                                class="mt-0.5 text-xs font-medium leading-4 text-ink-muted"
                            >
                                Add Eat Right to your home screen.
                            </p>
                        </div>
                        <button
                            type="button"
                            class="btn-primary h-9 shrink-0 px-3.5 text-xs"
                            onclick={() => (installSheetOpen = true)}
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            class="grid h-8 w-8 shrink-0 place-items-center rounded-circle text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
                            aria-label="Dismiss"
                            onclick={() => {
                                install.dismiss();
                                showInstallNudge = false;
                            }}
                        >
                            <XCloseIcon class="h-4 w-4" />
                        </button>
                    </div>
                {/if}

                <!-- Actions -->
                <div
                    class="grid grid-cols-2 gap-3 pt-1"
                    in:slideDown={{
                        delay: dropDelay(
                            orders.length + (chargedOrders.length > 1 ? 1 : 0),
                        ),
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

<InstallSheet bind:open={installSheetOpen} />
