<script lang="ts">
    import {
        CheckIcon,
        ChevronRightIcon,
        XCloseIcon,
    } from "@untitled-theme/icons-svelte";
    import { onMount } from "svelte";
    import { fetchEatRight } from "$lib/utils/eatright-client";
    import {
        confirmationUrl,
        isActiveOrder,
        orderState,
        parseOrderDate,
        type EatRightOrder,
    } from "$lib/utils/orders";
    import { createVisibilityPoller } from "$lib/utils/visibility-poller";

    const DISMISSED_ORDER_KEY = "eatright:dismissed-current-order";

    let { stacked = false, onActiveChange } = $props<{
        stacked?: boolean;
        onActiveChange?: (active: boolean) => void;
    }>();

    let activeOrders = $state<EatRightOrder[]>([]);
    let dismissed = $state(false);
    let deliveredOrder = $state<EatRightOrder | null>(null);
    let deliveredNoticeTimer: ReturnType<typeof setTimeout> | undefined;

    const current = $derived(activeOrders[0]);
    const displayedOrder = $derived(current ?? deliveredOrder ?? undefined);
    const isDeliveredNotice = $derived(Boolean(deliveredOrder && !current));
    const extraCount = $derived(Math.max(activeOrders.length - 1, 0));
    const isPaymentPending = $derived(
        current ? orderState(current) === "payment-pending" : false,
    );
    const bottomOffset = $derived(
        stacked
            ? "calc(var(--bottom-nav-height) + 6rem)"
            : "calc(var(--bottom-nav-height) + 0.75rem)",
    );

    $effect(() => {
        onActiveChange?.(Boolean(displayedOrder && !dismissed));
    });

    function dismissCurrentOrder() {
        if (displayedOrder) {
            sessionStorage.setItem(
                DISMISSED_ORDER_KEY,
                displayedOrder.order_no,
            );
        }
        dismissed = true;
    }

    async function loadActiveOrders(showDeliveredNotice = false) {
        try {
            const response = await fetchEatRight("/api/v1/orders");
            const data = await response.json();
            if (!response.ok || data.error) return;

            const orders: EatRightOrder[] = Array.isArray(data.orders)
                ? data.orders
                : Array.isArray(data)
                  ? data
                  : [];

            const active = orders
                .filter(isActiveOrder)
                .sort(
                    (a, b) =>
                        (parseOrderDate(b.created_on)?.getTime() ?? 0) -
                        (parseOrderDate(a.created_on)?.getTime() ?? 0),
                );

            if (showDeliveredNotice && activeOrders.length > 0) {
                const delivered = activeOrders
                    .map((previous) =>
                        orders.find(
                            (order) => order.order_no === previous.order_no,
                        ),
                    )
                    .find(
                        (order) => order && orderState(order) === "delivered",
                    );

                if (delivered && active.length === 0 && !dismissed) {
                    deliveredOrder = delivered;
                    clearTimeout(deliveredNoticeTimer);
                    deliveredNoticeTimer = setTimeout(() => {
                        deliveredOrder = null;
                    }, 8_000);
                }
            }

            activeOrders = active;
            if (active.length > 0) deliveredOrder = null;
            dismissed = Boolean(
                active[0] &&
                    sessionStorage.getItem(DISMISSED_ORDER_KEY) ===
                        active[0].order_no,
            );
        } catch {
            // ignore — banner is optional
        }
    }

    onMount(() => {
        void loadActiveOrders();
        const poller = createVisibilityPoller({
            intervalMs: 30_000,
            shouldPoll: () => activeOrders.length > 0,
            poll: () => loadActiveOrders(true),
        });

        return () => {
            poller.stop();
            clearTimeout(deliveredNoticeTimer);
        };
    });
</script>

{#if displayedOrder && !dismissed}
    <div
        class="fixed left-0 right-0 z-40 px-5 transition-[bottom] duration-300 lg:hidden"
        style:bottom={bottomOffset}
    >
        <!-- Slim dark pill — same bright-on-dark tints as the app toasts -->
        <div
            class="mx-auto flex h-12 w-full max-w-sm items-center rounded-circle bg-ink/95 pl-4 pr-1.5 text-white shadow-float ring-1 ring-inset ring-white/10 backdrop-blur-xl"
        >
            <a
                href={confirmationUrl(displayedOrder)}
                class="flex h-full min-w-0 flex-1 items-center gap-2.5"
                aria-label={`${isDeliveredNotice ? "Delivered" : isPaymentPending ? "Payment pending" : "Preparing"} order from ${displayedOrder.outletname}`}
            >
                {#if isDeliveredNotice}
                    <span
                        class="grid h-5 w-5 shrink-0 place-items-center rounded-circle bg-[#65c18c]/20 text-[#7ad9a3]"
                    >
                        <CheckIcon class="h-3 w-3" />
                    </span>
                {:else}
                    <span class="relative flex h-2 w-2 shrink-0">
                        <span
                            class="absolute inset-0 animate-ping rounded-circle {isPaymentPending
                                ? 'bg-[#e8bd66]/50'
                                : 'bg-[#6db3e8]/50'}"
                        ></span>
                        <span
                            class="relative h-2 w-2 rounded-circle {isPaymentPending
                                ? 'bg-[#e8bd66]'
                                : 'bg-[#6db3e8]'}"
                        ></span>
                    </span>
                {/if}

                <p
                    class="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight"
                >
                    {displayedOrder.outletname}
                </p>
                <span
                    class="font-medium text-[13px] {isDeliveredNotice
                        ? 'text-[#7ad9a3]'
                        : isPaymentPending
                          ? 'text-[#e8bd66]'
                          : 'text-white/50'}"
                >
                    {isDeliveredNotice
                        ? "Delivered"
                        : isPaymentPending
                          ? "Payment pending"
                          : "Preparing"}{!isDeliveredNotice && extraCount > 0
                        ? ` · +${extraCount}`
                        : ""}
                </span>
            </a>

            <button
                type="button"
                class="ml-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-circle text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 active:bg-white/15"
                onclick={dismissCurrentOrder}
                aria-label="Dismiss current order shortcut"
            >
                <XCloseIcon class="h-4 w-4" />
            </button>
        </div>
    </div>
{/if}
