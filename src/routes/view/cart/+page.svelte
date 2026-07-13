<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import {
        ArrowLeftIcon,
        Wallet02Icon,
        ShoppingCart01Icon,
        CheckCircleIcon,
        AlertCircleIcon,
        RefreshCw01Icon,
    } from "@untitled-theme/icons-svelte";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import { onDestroy, onMount } from "svelte";
    import { browser } from "$app/environment";
    import helpers from "$lib/helpers";
    import { fly, fade } from "svelte/transition";
    import { toast } from "svelte-sonner";

    const PENDING_CHECKOUT_RECHARGE_KEY = "eatright:pending_checkout_recharge";

    let isPlacingOrder = $state(false);
    let isRecharging = $state(false);
    let isPollingRecharge = $state(false);
    let isWalletLoading = $state(true);
    let isConfirmOpen = $state(false);
    let error = $state("");
    let success = $state("");
    let paymentMessage = $state("");
    let walletBalance = $state<number | null>(null);
    let paymentTabRef: Window | null = null;
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let absoluteTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentPollDelay = 2500;
    let isBalanceCheckActive = false;

    const hasInsufficientBalance = $derived(
        walletBalance !== null && cart.totalAmount > walletBalance,
    );
    const balanceAfterOrder = $derived(
        walletBalance === null ? null : walletBalance - cart.totalAmount,
    );
    const rechargeShortfall = $derived(
        walletBalance === null
            ? 0
            : Number(Math.max(cart.totalAmount - walletBalance, 0).toFixed(2)),
    );

    // How much of the wallet the order will consume, for the balance bar (0-100, capped)
    const balanceUsagePercent = $derived(
        walletBalance === null || walletBalance <= 0
            ? 100
            : Math.min(
                  100,
                  Math.round((cart.totalAmount / walletBalance) * 100),
              ),
    );

    const grouped = $derived(
        Object.groupBy(cart.items, (item) => item.outletname),
    );

    function formatAmount(amount: number | null) {
        if (amount === null || Number.isNaN(amount)) return "--";
        return amount.toFixed(2);
    }

    async function getWalletBalance(): Promise<number | null> {
        isWalletLoading = true;
        error = "";

        try {
            const response = await fetchEatRight("/api/v1/account/show");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return null;
                }

                error = data.error ?? "Unable to load wallet balance.";
                return null;
            }

            walletBalance = Number(data.walletBalance ?? 0);
            return walletBalance;
        } catch {
            error = "Unable to load wallet balance.";
            return null;
        } finally {
            isWalletLoading = false;
        }
    }

    onMount(async () => {
        const balance = await getWalletBalance();
        await resumePendingCheckout(balance);
    });

    onDestroy(() => {
        cleanUpRechargeCycle({ closePopup: false });
    });

    function openOrderConfirmation() {
        error = "";
        success = "";

        if (isWalletLoading) {
            error = "Checking wallet balance. Please wait.";
            return;
        }

        if (hasInsufficientBalance) {
            isConfirmOpen = true;
            return;
        }

        isConfirmOpen = true;
    }

    async function placeOrder(options: { skipBalanceCheck?: boolean } = {}) {
        if (isPlacingOrder || cart.items.length === 0) return;
        if (!options.skipBalanceCheck && hasInsufficientBalance) {
            error = "Insufficient EatRight wallet balance.";
            isConfirmOpen = false;
            return;
        }

        isPlacingOrder = true;
        error = "";
        success = "";

        try {
            const response = await fetchEatRight("/api/v1/order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cart: cart.items,
                    grandTotal: cart.totalAmount,
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }

                error = data.error ?? "Unable to place your order.";
                return;
            }

            cart.clear();
            clearPendingCheckoutRecharge();
            isConfirmOpen = false;
            await goto(data.redirectUrl ?? "/view/history");
        } catch {
            error = "Unable to reach EatRight. Please try again.";
        } finally {
            isPlacingOrder = false;
        }
    }

    function getRechargeAmount() {
        return Number(rechargeShortfall.toFixed(2));
    }

    function savePendingCheckoutRecharge(
        amount: number,
        baselineBalance: number,
    ) {
        if (!browser) return;

        localStorage.setItem(
            PENDING_CHECKOUT_RECHARGE_KEY,
            JSON.stringify({
                amount,
                baselineBalance,
                cartTotal: cart.totalAmount,
                createdAt: Date.now(),
            }),
        );
    }

    function clearPendingCheckoutRecharge() {
        if (!browser) return;
        localStorage.removeItem(PENDING_CHECKOUT_RECHARGE_KEY);
    }

    function cleanUpRechargeCycle(options: { closePopup?: boolean } = {}) {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        if (absoluteTimeoutId) clearTimeout(absoluteTimeoutId);

        pollTimeoutId = null;
        absoluteTimeoutId = null;
        isPollingRecharge = false;
        isRecharging = false;
        isBalanceCheckActive = false;
        currentPollDelay = 2500;

        if (browser) {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityCheck,
            );

            if (options.closePopup !== false) {
                try {
                    if (paymentTabRef && !paymentTabRef.closed) {
                        paymentTabRef.close();
                    }
                } catch {
                    // Ignore cross-origin popup access errors.
                }
            }
        }

        paymentTabRef = null;
    }

    async function checkRechargeAndPlaceOrder() {
        if (!isPollingRecharge || isBalanceCheckActive) return;

        isBalanceCheckActive = true;
        try {
            const balance = await getWalletBalance();

            if (
                balance !== null &&
                cart.items.length > 0 &&
                balance >= cart.totalAmount
            ) {
                cleanUpRechargeCycle();
                clearPendingCheckoutRecharge();
                walletBalance = balance;
                paymentMessage = "Wallet recharged. Placing your order...";
                toast.success("Wallet recharged. Placing order...");
                await placeOrder({ skipBalanceCheck: true });
                return;
            }
        } finally {
            isBalanceCheckActive = false;
        }

        if (isPollingRecharge) {
            currentPollDelay = Math.min(currentPollDelay + 1000, 6000);
            pollTimeoutId = setTimeout(
                checkRechargeAndPlaceOrder,
                currentPollDelay,
            );
        }
    }

    function handleVisibilityCheck() {
        if (document.visibilityState === "visible" && isPollingRecharge) {
            if (pollTimeoutId) clearTimeout(pollTimeoutId);
            checkRechargeAndPlaceOrder();
        }
    }

    function startRechargePolling() {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        if (absoluteTimeoutId) clearTimeout(absoluteTimeoutId);

        isPollingRecharge = true;
        currentPollDelay = 2500;
        paymentMessage =
            "Complete the wallet recharge. Your order will be placed automatically.";

        if (browser) {
            document.addEventListener(
                "visibilitychange",
                handleVisibilityCheck,
            );
        }

        pollTimeoutId = setTimeout(
            checkRechargeAndPlaceOrder,
            currentPollDelay,
        );
        absoluteTimeoutId = setTimeout(() => {
            if (!isPollingRecharge) return;
            cleanUpRechargeCycle();
            error =
                "Recharge timed out. Please check your wallet balance and try placing the order again.";
        }, 120000);
    }

    async function startCheckoutRecharge() {
        const amount = getRechargeAmount();
        const currentBalance = Number(walletBalance ?? 0);

        error = "";
        paymentMessage = "";

        if (!Number.isFinite(amount) || amount <= 0) {
            error =
                "Wallet balance is enough now. Try placing the order again.";
            return;
        }

        if (amount > 1000) {
            error =
                "Remaining balance is above ₹1000. Please add money from the wallet page.";
            return;
        }

        isRecharging = true;
        savePendingCheckoutRecharge(amount, currentBalance);
        paymentTabRef = window.open("", "tpsl_payment");

        try {
            const response = await fetchEatRight("/api/v1/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    confirmAmount: amount,
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                paymentTabRef?.close();
                if (await redirectIfEatRightConnectRequired(data.errorCode))
                    return;

                clearPendingCheckoutRecharge();
                error =
                    data.error ?? data.message ?? "Unable to start recharge.";
                isRecharging = false;
                return;
            }

            if (data.status === "redirect" && data.url) {
                if (paymentTabRef) {
                    paymentTabRef.location.href = data.url;
                    startRechargePolling();
                } else {
                    window.location.href = data.url;
                }
                return;
            }

            paymentTabRef?.close();

            if (data.status === "success") {
                paymentMessage = "Wallet recharged. Placing your order...";
                toast.success("Wallet recharged. Placing order...");
                walletBalance = Number(walletBalance ?? 0) + amount;
                clearPendingCheckoutRecharge();
                await placeOrder({ skipBalanceCheck: true });
                return;
            }

            clearPendingCheckoutRecharge();
            error = data.message ?? "Unable to start recharge.";
            isRecharging = false;
        } catch {
            paymentTabRef?.close();
            clearPendingCheckoutRecharge();
            error = "Unable to reach EatRight wallet.";
            isRecharging = false;
        }
    }

    async function resumePendingCheckout(balance: number | null) {
        if (!browser) return;

        const pending = localStorage.getItem(PENDING_CHECKOUT_RECHARGE_KEY);
        if (!pending) return;

        try {
            const saved = JSON.parse(pending) as {
                cartTotal?: number;
                createdAt?: number;
            };

            const isFresh =
                typeof saved.createdAt === "number" &&
                Date.now() - saved.createdAt < 10 * 60 * 1000;

            if (!isFresh || cart.items.length === 0) {
                clearPendingCheckoutRecharge();
                return;
            }

            if (balance !== null && balance >= cart.totalAmount) {
                paymentMessage = "Wallet recharged. Placing your order...";
                toast.success("Wallet recharged. Placing order...");
                clearPendingCheckoutRecharge();
                await placeOrder({ skipBalanceCheck: true });
                return;
            }

            if (typeof saved.cartTotal === "number") {
                isConfirmOpen = true;
                paymentMessage = "Waiting for wallet recharge to complete.";
                startRechargePolling();
            }
        } catch {
            clearPendingCheckoutRecharge();
        }
    }
</script>

<div class="min-h-screen text-ink antialiased">
    <!-- Header Bar -->
    <div class="page-header">
        <div
            class="safe-top-offset flex items-center gap-3 px-5 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => history.back()}
                class="icon-btn"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-5 w-5 text-ink-muted" />
            </button>

            <div class="flex-1">
                <h1 class="text-2xl font-bold tracking-tight text-ink">
                    Cart
                </h1>
                <p
                    class="text-xs text-ink-muted font-medium uppercase tracking-wider mt-0.5"
                >
                    {cart.totalItems}
                    {cart.totalItems === 1 ? "item" : "items"} selected
                </p>
            </div>

            <div class="flex items-center gap-2">
                {#if isWalletLoading}
                    <div
                        class="h-9 w-24 animate-pulse rounded-full bg-line"
                        aria-label="Verifying balance"
                    ></div>
                {:else}
                    <a
                        href="/view/wallet"
                        class="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-surface border border-line shadow-card hover:border-primary/30 transition-all"
                    >
                        <Wallet02Icon class="h-4 w-4 text-primary" />
                        <span
                            class="text-sm font-semibold text-ink tabular-nums"
                        >
                            ₹{formatAmount(walletBalance)}
                        </span>
                    </a>
                {/if}
            </div>
        </div>
    </div>

    <!-- Scroll Container -->
    <div
        class="px-5 pt-4 max-w-md mx-auto"
        style="padding-bottom: max(env(safe-area-inset-bottom), 160px)"
    >
        {#if error}
            <div
                class="mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/10 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                in:fly={{ duration: 150, y: -8 }}
            >
                <AlertCircleIcon class="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
            </div>
        {/if}

        {#if cart.items.length === 0}
            <div
                class="flex min-h-[60vh] flex-col items-center justify-center text-center"
            >
                <div
                    class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface border border-line shadow-card"
                >
                    <ShoppingCart01Icon class="h-9 w-9 text-ink-faint" />
                </div>
                <h2 class="text-lg font-semibold tracking-tight text-ink">
                    Your cart is empty
                </h2>
                <p
                    class="mt-1 max-w-xs text-sm text-ink-muted leading-relaxed"
                >
                    Browse the available food counters to fill your tray.
                </p>
                <a href="/view/home" class="btn-primary mt-5 px-5 py-3 text-sm">
                    Browse Counters
                </a>
            </div>
        {:else}
            {#each Object.entries(grouped) as [outlet, items]}
                {@const outletItems = items ?? []}
                <div class="card mb-4 overflow-hidden rounded-[28px]">
                    <!-- Brand Section Header -->
                    <div class="border-b border-line bg-canvas/60 px-4 py-3.5">
                        <div class="flex items-center gap-3">
                            <div
                                class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft border border-primary/10"
                            >
                                <img
                                    src={helpers.mapStoreIcon(
                                        String(
                                            cart.items.find(
                                                (item) =>
                                                    item.shopno ===
                                                    outletItems[0].shopno,
                                            )?.shopno,
                                        ),
                                    )}
                                    alt={outlet}
                                    class="h-8 w-8 object-contain"
                                />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h2
                                    class="text-base font-semibold tracking-tight text-ink truncate"
                                >
                                    {outlet}
                                </h2>
                                <p
                                    class="text-xs text-ink-muted font-medium uppercase tracking-wider mt-0.5"
                                >
                                    Counter {outletItems[0].shopno} • {outletItems.length}
                                    {outletItems.length === 1
                                        ? "item"
                                        : "items"}
                                </p>
                            </div>
                            <button
                                onclick={() => {
                                    cart.removeByOutlet(outlet);
                                    toast.success("Cleared " + outlet);
                                }}
                                class="text-[11px] font-semibold text-danger hover:bg-danger-soft transition-colors shrink-0 px-2.5 py-1.5 rounded-lg"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <!-- Individual Menu List Rows -->
                    <div class="divide-y divide-line/70 px-4">
                        {#each outletItems as item}
                            <div class="flex items-center gap-3 py-3.5">
                                <div class="min-w-0 flex-1">
                                    <h3
                                        class="text-sm font-semibold text-ink leading-snug wrap-break-word pr-1"
                                    >
                                        {item.itemname}
                                    </h3>
                                    <p
                                        class="mt-0.5 text-xs text-ink-muted font-medium tabular-nums"
                                    >
                                        ₹{item.amount} each
                                    </p>
                                </div>

                                <!-- Incremental Engine Pill Container -->
                                <div
                                    class="flex h-8 shrink-0 items-center rounded-xl border border-line bg-canvas p-0.5 shadow-2xs"
                                >
                                    <button
                                        class="flex h-7 w-7 items-center justify-center text-sm font-semibold text-ink-muted hover:text-primary rounded-lg active:bg-surface transition-colors"
                                        onclick={() =>
                                            cart.remove(item.id, item.outletid)}
                                    >
                                        −
                                    </button>

                                    <span
                                        class="w-6 text-center text-xs font-semibold text-ink tabular-nums"
                                    >
                                        {item.qty}
                                    </span>

                                    <button
                                        class="flex h-7 w-7 items-center justify-center text-sm font-semibold text-ink-muted hover:text-primary rounded-lg active:bg-surface disabled:opacity-20 transition-colors"
                                        onclick={() =>
                                            cart.add({
                                                id: item.id,
                                                itemname: item.itemname,
                                                amount: item.amount,
                                                outletid: item.outletid,
                                                outletname: item.outletname,
                                                shopno: item.shopno,
                                                available_qty:
                                                    item.available_qty ??
                                                    MAX_QTY,
                                            })}
                                        disabled={item.qty >=
                                            Math.min(
                                                MAX_QTY,
                                                item.available_qty ?? MAX_QTY,
                                            )}
                                    >
                                        +
                                    </button>
                                </div>

                                <div
                                    class="w-16 shrink-0 text-right text-sm font-semibold text-ink tabular-nums"
                                >
                                    ₹{item.amount * item.qty}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Order Bar Summary Footer -->
    {#if cart.items.length > 0}
        <div
            class="fixed bottom-0 left-0 right-0 z-40 bg-linear-to-t from-canvas via-canvas to-transparent pt-6"
            style="padding-bottom: max(env(safe-area-inset-bottom), 0px)"
        >
            <div
                class="bg-surface p-5 pb-8 shadow-[0_-8px_32px_rgba(33,32,28,0.08)] border-t border-line max-w-md mx-auto sm:rounded-t-4xl"
            >
                <div class="flex items-center justify-between gap-4">
                    <div class="shrink-0 mr-3">
                        <p
                            class="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint"
                        >
                            To Pay • {cart.totalItems}
                            {cart.totalItems === 1 ? "item" : "items"}
                        </p>
                        <h3
                            class="text-2xl font-bold tracking-tight text-ink tabular-nums mt-0.5"
                        >
                            ₹{cart.totalAmount}
                        </h3>
                    </div>

                    <button
                        class="btn-primary flex-1 rounded-4xl py-3.5 text-sm shadow-md shadow-primary/20"
                        onclick={openOrderConfirmation}
                        disabled={isPlacingOrder ||
                            isWalletLoading ||
                            isRecharging}
                    >
                        {#if isPlacingOrder}
                            Placing Order...
                        {:else if isRecharging || isPollingRecharge}
                            Processing...
                        {:else}
                            Review Order
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Order Confirmation Sheet -->
    {#if isConfirmOpen}
        <div
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            in:fade={{ duration: 150 }}
            out:fade={{ duration: 150 }}
        >
            <button
                class="absolute inset-0 cursor-default"
                onclick={() => {
                    if (!isPollingRecharge) isConfirmOpen = false;
                }}
                aria-label="Dismiss modal"
            ></button>

            <div
                class="relative w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-surface shadow-2xl border border-line max-h-[88vh] flex flex-col"
                in:fly={{ duration: 220, y: 80 }}
                out:fly={{ duration: 160, y: 80 }}
            >
                <!-- Grab handle -->
                <div class="flex justify-center pt-3 sm:hidden">
                    <div class="h-1 w-10 rounded-full bg-line"></div>
                </div>

                <div class="px-6 pt-4 pb-2 shrink-0">
                    <h2 class="text-xl font-bold tracking-tight text-ink">
                        Confirm your order
                    </h2>
                </div>

                <!-- Scrollable body -->
                <div class="overflow-y-auto px-6 pb-2">
                    <!-- Total -->
                    <div class="mt-3 flex items-center justify-between px-1">
                        <span class="text-sm font-semibold text-ink"
                            >Order total</span
                        >
                        <span class="text-lg font-bold text-ink tabular-nums">
                            ₹{cart.totalAmount}
                        </span>
                    </div>

                    <!-- Wallet balance visualization -->
                    <div class="mt-4 rounded-2xl border border-line p-4">
                        <div class="flex items-center gap-2 mb-3">
                            <Wallet02Icon class="h-4 w-4 text-primary" />
                            <span
                                class="text-xs font-semibold uppercase tracking-wider text-ink-muted"
                            >
                                Wallet balance
                            </span>
                        </div>

                        <div
                            class="flex items-center justify-between text-sm mb-2"
                        >
                            <span class="text-ink-muted font-medium"
                                >Current</span
                            >
                            <span class="font-semibold text-ink tabular-nums">
                                ₹{formatAmount(walletBalance)}
                            </span>
                        </div>

                        <div
                            class="flex items-center justify-between text-sm mt-3"
                        >
                            <span class="text-ink-muted font-medium">
                                {hasInsufficientBalance
                                    ? "Balance needed"
                                    : "Balance after order"}
                            </span>
                            <span
                                class={`font-bold tabular-nums ${hasInsufficientBalance ? "text-danger" : "text-success"}`}
                            >
                                {#if hasInsufficientBalance}
                                    ₹{formatAmount(rechargeShortfall)} short
                                {:else}
                                    ₹{formatAmount(balanceAfterOrder)}
                                {/if}
                            </span>
                        </div>
                    </div>

                    {#if hasInsufficientBalance}
                        <div
                            class="mt-3 flex items-start gap-2.5 rounded-2xl bg-warning-soft border border-warning/10 px-4 py-3 text-xs font-medium text-warning leading-relaxed"
                        >
                            <AlertCircleIcon class="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                Add ₹{formatAmount(rechargeShortfall)} to your wallet
                                and this order will be placed automatically once
                                the recharge succeeds.
                            </span>
                        </div>
                    {/if}

                    {#if paymentMessage}
                        <div
                            class="mt-3 flex items-center gap-2.5 rounded-2xl bg-success-soft border border-success/10 px-4 py-3 text-xs font-medium text-success leading-relaxed"
                        >
                            {#if isPollingRecharge}
                                <RefreshCw01Icon
                                    class="h-4 w-4 shrink-0 animate-spin"
                                />
                            {:else}
                                <CheckCircleIcon class="h-4 w-4 shrink-0" />
                            {/if}
                            <span>{paymentMessage}</span>
                        </div>
                    {/if}

                    {#if error}
                        <div
                            class="mt-3 flex items-start gap-2.5 rounded-2xl bg-danger-soft border border-danger/10 px-4 py-3 text-xs font-medium text-danger leading-relaxed"
                        >
                            <AlertCircleIcon class="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    {/if}
                </div>

                <!-- Actions -->
                <div
                    class="px-6 pt-4 pb-6 mt-1 border-t border-line shrink-0"
                    style="padding-bottom: max(env(safe-area-inset-bottom), 24px)"
                >
                    <div class="grid grid-cols-2 gap-3">
                        <button
                            class="btn-quiet rounded-xl py-3 px-4 text-sm font-medium text-ink-muted"
                            onclick={() => {
                                if (isPollingRecharge) {
                                    cleanUpRechargeCycle();
                                    clearPendingCheckoutRecharge();
                                }
                                isConfirmOpen = false;
                            }}
                            disabled={isPlacingOrder}
                        >
                            Cancel
                        </button>

                        {#if hasInsufficientBalance}
                            <button
                                class="btn-primary rounded-xl py-3 px-4 text-sm shadow-sm"
                                onclick={startCheckoutRecharge}
                                disabled={isRecharging ||
                                    isPollingRecharge ||
                                    rechargeShortfall > 1000}
                            >
                                {#if isPollingRecharge}
                                    <RefreshCw01Icon
                                        class="h-4 w-4 animate-spin"
                                    />
                                    Waiting...
                                {:else if isRecharging}
                                    Opening...
                                {:else}
                                    Add ₹{formatAmount(rechargeShortfall)}
                                {/if}
                            </button>
                        {:else}
                            <button
                                class="btn-primary rounded-xl py-3 px-4 text-sm shadow-sm"
                                onclick={() => placeOrder()}
                                disabled={isPlacingOrder}
                            >
                                {isPlacingOrder
                                    ? "Ordering..."
                                    : "Confirm & pay"}
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

