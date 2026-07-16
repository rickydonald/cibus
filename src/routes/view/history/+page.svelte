<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import {
        CheckIcon,
        ChevronRightIcon,
        ClockIcon,
        ReceiptIcon,
        RefreshCw01Icon,
        XCloseIcon,
    } from "@untitled-theme/icons-svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { onMount } from "svelte";
    import {
        confirmationUrl,
        orderState,
        orderTime,
        parseOrderDate,
        type EatRightOrder,
    } from "$lib/utils/orders";

    type OrderFilter = "all" | "active" | "delivered" | "cancelled";

    let orders = $state<EatRightOrder[]>([]);
    let isLoading = $state(true);
    let error = $state("");
    let activeFilter = $state<OrderFilter>("all");

    const FILTERS: { id: OrderFilter; label: string }[] = [
        { id: "all", label: "All" },
        { id: "active", label: "Active" },
        { id: "delivered", label: "Delivered" },
        { id: "cancelled", label: "Cancelled" },
    ];

    const STATE_VISUALS = {
        cancelled: {
            icon: XCloseIcon,
            chip: "bg-danger-soft text-danger",
            text: "text-danger",
            label: "Cancelled",
            filter: "cancelled",
        },
        delivered: {
            icon: CheckIcon,
            chip: "bg-success-soft text-success",
            text: "text-success",
            label: "Delivered",
            filter: "delivered",
        },
        "payment-pending": {
            icon: ClockIcon,
            chip: "bg-warning-soft text-warning",
            text: "text-warning",
            label: "Payment pending",
            filter: "active",
        },
        preparing: {
            icon: ClockIcon,
            chip: "bg-primary-soft text-primary",
            text: "text-primary",
            label: "Preparing",
            filter: "active",
        },
    } as const;

    function orderVisual(order: EatRightOrder) {
        return STATE_VISUALS[orderState(order)];
    }

    function dayLabel(date: Date): string {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString())
            return "Yesterday";

        return new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "short",
            ...(date.getFullYear() !== today.getFullYear() && {
                year: "numeric",
            }),
        }).format(date);
    }

    function orderMeta(order: EatRightOrder): string {
        return [orderTime(order), order.order_no].filter(Boolean).join(" · ");
    }

    const filteredOrders = $derived(
        activeFilter === "all"
            ? orders
            : orders.filter(
                  (order) => orderVisual(order).filter === activeFilter,
              ),
    );

    const orderGroups = $derived.by(() => {
        const sorted = filteredOrders
            .map((order, index) => ({
                order,
                index,
                time: parseOrderDate(order.created_on)?.getTime() ?? null,
            }))
            .sort((a, b) => {
                if (a.time === null && b.time === null) return a.index - b.index;
                if (a.time === null) return 1;
                if (b.time === null) return -1;
                return b.time - a.time;
            });

        const groups: { label: string; orders: EatRightOrder[] }[] = [];
        for (const entry of sorted) {
            const date = parseOrderDate(entry.order.created_on);
            const label = date ? dayLabel(date) : "Earlier";
            const last = groups[groups.length - 1];
            if (last?.label === label) {
                last.orders.push(entry.order);
            } else {
                groups.push({ label, orders: [entry.order] });
            }
        }
        return groups;
    });

    function splitPrice(value: number | string | null) {
        const num = Number(value);
        if (!Number.isFinite(num)) return { main: "--", decimal: "00" };
        const [main, decimal] = num.toFixed(2).split(".");
        return { main, decimal };
    }

    function openOrder(order: EatRightOrder) {
        goto(confirmationUrl(order));
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
    <div class="px-5 pt-5 max-w-md mx-auto lg:max-w-2xl">
        <!-- Page header -->
        <div class="flex items-center justify-between px-1">
            <div class="min-w-0">
                <h1 class="text-xl font-bold tracking-tight text-ink">
                    Order History
                </h1>
                <p class="text-xs font-medium text-ink-muted mt-0.5">
                    {#if isLoading}
                        Fetching your past orders...
                    {:else if orders.length > 0}
                        {orders.length}
                        {orders.length === 1 ? "order" : "orders"} placed so far
                    {:else}
                        Every order you place lands here
                    {/if}
                </p>
            </div>
            <button
                class="icon-btn"
                aria-label="Refresh order history"
                onclick={getOrders}
                disabled={isLoading}
            >
                {#if isLoading}
                    <Spinner size={20} class="text-ink-muted" />
                {:else}
                    <RefreshCw01Icon class="h-5 w-5 text-ink-muted" />
                {/if}
            </button>
        </div>

        {#if isLoading}
            <!-- Skeleton mirrors the grouped list below -->
            <div class="mt-6">
                <div class="ml-4 h-3 w-20 animate-pulse rounded bg-line"></div>
                <div class="card mt-2 overflow-hidden rounded-[22px]">
                    {#each Array(4) as _, i}
                        {#if i > 0}
                            <div
                                class="ml-[4.25rem] border-t border-line/60"
                            ></div>
                        {/if}
                        <div class="flex items-center gap-3.5 p-4">
                            <div
                                class="h-10 w-10 shrink-0 animate-pulse rounded-circle bg-canvas"
                            ></div>
                            <div class="flex-1 space-y-2">
                                <div
                                    class="h-3.5 w-2/3 animate-pulse rounded bg-canvas"
                                ></div>
                                <div
                                    class="h-3 w-1/3 animate-pulse rounded bg-canvas"
                                ></div>
                            </div>
                            <div
                                class="h-4 w-14 animate-pulse rounded bg-canvas"
                            ></div>
                        </div>
                    {/each}
                </div>
            </div>
        {:else if error}
            <div
                class="flex min-h-[55vh] flex-col items-center justify-center text-center px-4"
            >
                <div
                    class="grid h-14 w-14 place-items-center rounded-circle bg-danger-soft text-danger"
                >
                    <XCloseIcon class="h-6 w-6" />
                </div>
                <h2 class="mt-4 text-base font-bold text-ink">
                    Could not load orders
                </h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-ink-muted leading-relaxed"
                >
                    {error}
                </p>
                <button
                    class="btn-primary mt-5 rounded-circle px-6 py-2.5 text-xs"
                    onclick={getOrders}
                >
                    Try Again
                </button>
            </div>
        {:else if orders.length === 0}
            <div
                class="flex min-h-[55vh] flex-col items-center justify-center text-center px-4"
            >
                <div
                    class="grid h-14 w-14 place-items-center rounded-circle bg-primary-soft text-primary"
                >
                    <ReceiptIcon class="h-6 w-6" />
                </div>
                <h2 class="mt-4 text-base font-bold text-ink">No orders yet</h2>
                <p
                    class="mt-1 max-w-xs text-xs font-medium text-ink-muted leading-relaxed"
                >
                    Your EatRight orders will appear here automatically after
                    checkout.
                </p>
                <button
                    class="btn-primary mt-5 rounded-circle px-6 py-2.5 text-xs"
                    onclick={() => goto("/view/home")}
                >
                    Browse Outlets
                </button>
            </div>
        {:else}
            <!-- Status filter -->
            <div class="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-1">
                {#each FILTERS as filter}
                    <button
                        type="button"
                        onclick={() => (activeFilter = filter.id)}
                        class={`h-8 shrink-0 rounded-circle px-4 text-xs font-semibold transition-all active:scale-95 ${
                            activeFilter === filter.id
                                ? "bg-primary text-white"
                                : "border border-line bg-surface text-ink-muted hover:bg-canvas"
                        }`}
                    >
                        {filter.label}
                    </button>
                {/each}
            </div>

            {#if filteredOrders.length === 0}
                <div
                    class="card mt-4 rounded-[22px] p-8 text-center text-xs font-medium text-ink-faint"
                >
                    No {activeFilter} orders yet.
                </div>
            {:else}
                {#each orderGroups as group}
                    <section class="mt-6">
                        <h2 class="section-label pl-4">{group.label}</h2>

                        <div class="card mt-2 overflow-hidden rounded-[22px]">
                            {#each group.orders as order, i (order.order_no)}
                                {@const price = splitPrice(order.grand_total)}
                                {@const visual = orderVisual(order)}
                                {#if i > 0}
                                    <div
                                        class="ml-[4.25rem] border-t border-line/60"
                                    ></div>
                                {/if}
                                <button
                                    class="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-canvas/60 active:bg-canvas"
                                    onclick={() => openOrder(order)}
                                >
                                    <span
                                        class={`grid h-10 w-10 shrink-0 place-items-center rounded-circle ${visual.chip}`}
                                    >
                                        <visual.icon
                                            class="h-[18px] w-[18px]"
                                        />
                                    </span>

                                    <div class="min-w-0 flex-1">
                                        <h3
                                            class="truncate text-sm font-semibold leading-snug text-ink"
                                        >
                                            {order.outletname}
                                        </h3>
                                        <p
                                            class="mt-0.5 truncate text-[11px] font-medium text-ink-faint"
                                        >
                                            {orderMeta(order)}
                                        </p>
                                    </div>

                                    <div class="shrink-0 text-right">
                                        <p
                                            class="text-sm font-bold tabular-nums text-ink"
                                        >
                                            ₹{price.main}<span
                                                class="font-normal text-ink-muted"
                                                >.{price.decimal}</span
                                            >
                                        </p>
                                        <p
                                            class={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${visual.text}`}
                                        >
                                            {visual.label}
                                        </p>
                                    </div>

                                    <ChevronRightIcon
                                        class="h-4 w-4 shrink-0 text-ink-faint"
                                    />
                                </button>
                            {/each}
                        </div>
                    </section>
                {/each}
            {/if}
        {/if}
    </div>
</div>
