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
        ReceiptCheckIcon,
    } from "@untitled-theme/icons-svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { cart, MAX_QTY } from "$lib/stores/cart.svelte";
    import {
        getPendingPayment,
        setPendingPayment,
    } from "$lib/client/pending-payment";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import helpers from "$lib/helpers";
    import { fly, fade } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import {
        MAX_WALLET_BALANCE,
        walletLimitMessage,
        wouldExceedWalletLimit,
    } from "$lib/wallet";
    import {
        createCheckoutCartSnapshot,
        matchesCheckoutCartSnapshot,
    } from "$lib/checkout-cart-snapshot";

    const PENDING_CHECKOUT_RECHARGE_KEY = "eatright:pending_checkout_recharge";
    const PENDING_CHECKOUT_MAX_AGE_MS = 10 * 60 * 1000;

    type PendingCheckoutRecharge = {
        amount: number;
        baselineBalance: number;
        cartSnapshot: string;
        createdAt: number;
        orderId?: string;
    };

    let isPlacingOrder = $state(false);
    let isRecharging = $state(false);
    let isWalletLoading = $state(true);
    let isConfirmOpen = $state(false);
    let error = $state("");
    let success = $state("");
    let paymentMessage = $state("");
    let walletBalance = $state<number | null>(null);

    const hasInsufficientBalance = $derived(
        walletBalance !== null && cart.totalAmount > walletBalance,
    );
    const rechargeShortfall = $derived(
        walletBalance === null
            ? 0
            : Number(Math.max(cart.totalAmount - walletBalance, 0).toFixed(2)),
    );
    const checkoutRechargeExceedsWalletLimit = $derived(
        walletBalance !== null &&
            wouldExceedWalletLimit(walletBalance, rechargeShortfall),
    );
    const balanceAfterOrder = $derived(
        walletBalance === null
            ? null
            : Number(Math.max(walletBalance - cart.totalAmount, 0).toFixed(2)),
    );
    const walletCoveragePercent = $derived(
        walletBalance === null || cart.totalAmount <= 0
            ? 0
            : Math.min(
                  100,
                  Math.max(0, (walletBalance / cart.totalAmount) * 100),
              ),
    );
    const walletSpendPercent = $derived(
        walletBalance === null || walletBalance <= 0
            ? 0
            : Math.min(
                  100,
                  Math.max(0, (cart.totalAmount / walletBalance) * 100),
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
        const params = new URLSearchParams(window.location.search);
        const payment = params.get("payment");
        const callbackMessage = params.get("payment_message");
        const orderId = params.get("order_id");

        // A recharge was started but the gateway never redirected back to
        // this app (e.g. local dev) — resume verification on the callback
        // page instead.
        if (!payment && !orderId) {
            const pending = getPendingPayment();
            if (pending && pending.returnPath === "/view/cart") {
                await goto(
                    `/view/wallet/callback?order_id=${encodeURIComponent(pending.orderId)}&return=${encodeURIComponent(pending.returnPath)}`,
                );
                return;
            }
        }
        let verifiedStatus: string | null = null;
        if (orderId) {
            try {
                const response = await fetchEatRight(
                    `/api/v1/wallet/payment-status?order_id=${encodeURIComponent(orderId)}`,
                );
                const data = await response.json();
                if (response.ok) verifiedStatus = data.status;
            } catch {
                error = "Unable to verify the returned payment.";
            }
        }
        const balance = await getWalletBalance();
        if (payment === "success" && verifiedStatus === "SUCCESS") {
            await resumePendingCheckout(balance, orderId);
        } else if (payment) {
            clearPendingCheckoutRecharge();
            error = callbackMessage || "Wallet recharge failed or was cancelled.";
            toast.error(error);
        }
        if (payment) {
            history.replaceState({}, "", window.location.pathname);
        }
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
    ): string {
        const cartSnapshot = createCheckoutCartSnapshot(cart.items);
        if (!browser) return cartSnapshot;

        localStorage.setItem(
            PENDING_CHECKOUT_RECHARGE_KEY,
            JSON.stringify({
                amount,
                baselineBalance,
                cartSnapshot,
                createdAt: Date.now(),
            } satisfies PendingCheckoutRecharge),
        );

        return cartSnapshot;
    }

    function bindPendingCheckoutRechargeToOrder(orderId: string): boolean {
        if (!browser || !orderId) return false;

        try {
            const raw = localStorage.getItem(PENDING_CHECKOUT_RECHARGE_KEY);
            if (!raw) return false;

            const pending = JSON.parse(raw) as PendingCheckoutRecharge;
            if (
                typeof pending.cartSnapshot !== "string" ||
                typeof pending.createdAt !== "number"
            ) {
                clearPendingCheckoutRecharge();
                return false;
            }

            localStorage.setItem(
                PENDING_CHECKOUT_RECHARGE_KEY,
                JSON.stringify({ ...pending, orderId }),
            );
            return true;
        } catch {
            clearPendingCheckoutRecharge();
            return false;
        }
    }

    function clearPendingCheckoutRecharge() {
        if (!browser) return;
        localStorage.removeItem(PENDING_CHECKOUT_RECHARGE_KEY);
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

        if (wouldExceedWalletLimit(currentBalance, amount)) {
            error = walletLimitMessage(currentBalance);
            return;
        }

        isRecharging = true;
        const checkoutCartSnapshot = savePendingCheckoutRecharge(
            amount,
            currentBalance,
        );
        try {
            const response = await fetchEatRight("/api/v1/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    confirmAmount: amount,
                    returnPath: "/view/cart",
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode))
                    return;

                clearPendingCheckoutRecharge();
                error =
                    data.error ?? data.message ?? "Unable to start recharge.";
                isRecharging = false;
                return;
            }

            if (data.status === "redirect" && data.url) {
                if (
                    typeof data.orderId === "string" &&
                    bindPendingCheckoutRechargeToOrder(data.orderId)
                ) {
                    setPendingPayment(data.orderId, "/view/cart");
                } else {
                    // The recharge can continue, but without a verifiable
                    // payment ID it must never auto-submit the cart.
                    clearPendingCheckoutRecharge();
                }
                window.location.assign(data.url);
                return;
            }

            if (data.status === "success") {
                walletBalance = Number(walletBalance ?? 0) + amount;
                clearPendingCheckoutRecharge();
                isRecharging = false;
                if (
                    matchesCheckoutCartSnapshot(
                        checkoutCartSnapshot,
                        cart.items,
                    )
                ) {
                    paymentMessage = "Wallet recharged. Placing your order...";
                    toast.success("Wallet recharged. Placing order...");
                    await placeOrder({ skipBalanceCheck: true });
                } else {
                    isConfirmOpen = true;
                    paymentMessage =
                        "Wallet recharged. Review your updated cart before placing the order.";
                    toast.info(
                        "Cart changed. Review it before placing your order.",
                    );
                }
                return;
            }

            clearPendingCheckoutRecharge();
            error = data.message ?? "Unable to start recharge.";
            isRecharging = false;
        } catch {
            clearPendingCheckoutRecharge();
            error = "Unable to reach EatRight wallet.";
            isRecharging = false;
        }
    }

    async function resumePendingCheckout(
        balance: number | null,
        returnedOrderId: string | null,
    ) {
        if (!browser) return;

        const pending = localStorage.getItem(PENDING_CHECKOUT_RECHARGE_KEY);
        if (!pending) return;

        try {
            const saved = JSON.parse(pending) as Partial<PendingCheckoutRecharge>;

            const isFresh =
                typeof saved.createdAt === "number" &&
                Date.now() - saved.createdAt < PENDING_CHECKOUT_MAX_AGE_MS;
            const isExpectedPayment =
                typeof saved.orderId === "string" &&
                saved.orderId === returnedOrderId;
            const isSameCart =
                typeof saved.cartSnapshot === "string" &&
                matchesCheckoutCartSnapshot(saved.cartSnapshot, cart.items);

            if (!isFresh || !isExpectedPayment || cart.items.length === 0) {
                clearPendingCheckoutRecharge();
                return;
            }

            if (!isSameCart) {
                clearPendingCheckoutRecharge();
                isConfirmOpen = true;
                paymentMessage =
                    "Wallet recharged, but your cart changed during payment.";
                error =
                    "Review the updated cart and confirm it again. No order was placed automatically.";
                toast.info(
                    "Cart changed. Review it before placing your order.",
                );
                return;
            }

            if (balance !== null && balance >= cart.totalAmount) {
                paymentMessage = "Wallet recharged. Placing your order...";
                toast.success("Wallet recharged. Placing order...");
                clearPendingCheckoutRecharge();
                await placeOrder({ skipBalanceCheck: true });
                return;
            }

            clearPendingCheckoutRecharge();
            isConfirmOpen = true;
            error = "The gateway reported success, but the wallet balance was not updated.";
        } catch {
            clearPendingCheckoutRecharge();
        }
    }
</script>

<div class="min-h-screen text-ink antialiased">
    <!-- Header Bar -->
    <div class="page-header">
        <div
            class="safe-top-offset flex items-center gap-3 px-5 py-4 max-w-md mx-auto lg:max-w-lg"
        >
            <button
                onclick={() => history.back()}
                class="icon-btn"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-5 w-5 text-ink-muted" />
            </button>

            <div class="flex-1">
                <h1 class="text-2xl font-bold tracking-tight text-ink">Cart</h1>
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
                        class="h-9 w-24 animate-pulse rounded-circle bg-line"
                        aria-label="Verifying balance"
                    ></div>
                {:else}
                    <a
                        href="/view/wallet"
                        class="flex items-center gap-1.5 rounded-circle px-3 py-1.5 bg-surface border border-line shadow-card hover:border-primary/30 transition-all"
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
        class="px-5 pt-4 max-w-md mx-auto lg:max-w-lg"
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
                    class="mb-4 flex h-20 w-20 items-center justify-center rounded-circle bg-surface border border-line shadow-card"
                >
                    <ShoppingCart01Icon class="h-9 w-9 text-ink-faint" />
                </div>
                <h2 class="text-lg font-semibold tracking-tight text-ink">
                    Your cart is empty
                </h2>
                <p class="mt-1 max-w-xs text-sm text-ink-muted leading-relaxed">
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
            class="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-[0_-8px_24px_rgba(26,30,38,0.04)] lg:left-64"
            style="padding-right: var(--safe-area-inset-right); padding-bottom: var(--safe-area-inset-bottom); padding-left: var(--safe-area-inset-left);"
        >
            <div
                class="bg-surface p-5 pb-8 shadow-[0_-8px_32px_rgba(33,32,28,0.08)] border-t border-line max-w-md mx-auto sm:rounded-t-4xl lg:max-w-lg"
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
                        {:else if isRecharging}
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
            class="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-order-title"
            in:fade={{ duration: 150 }}
            out:fade={{ duration: 150 }}
        >
            <button
                class="absolute inset-0 cursor-default"
                onclick={() => {
                    isConfirmOpen = false;
                }}
                aria-label="Dismiss modal"
            ></button>

            <div
                class="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-line bg-surface shadow-float sm:rounded-[32px]"
                in:fly={{ duration: 220, y: 80 }}
                out:fly={{ duration: 160, y: 80 }}
            >
                <div class="flex justify-center pt-3 sm:hidden">
                    <div class="h-1 w-10 rounded-circle bg-line"></div>
                </div>

                <div
                    class="overflow-y-auto px-6 pb-5 pt-5 text-center sm:px-8 sm:pt-8"
                >
                    <div
                        class="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl {hasInsufficientBalance
                            ? 'bg-warning-soft text-warning'
                            : 'bg-primary-soft text-primary'}"
                    >
                        {#if hasInsufficientBalance}
                            <Wallet02Icon class="h-5 w-5" />
                        {:else}
                            <ReceiptCheckIcon class="h-5 w-5" />
                        {/if}
                    </div>

                    <div class="mt-4">
                        <h2
                            id="confirm-order-title"
                            class="text-2xl font-bold tracking-[-0.03em] text-ink"
                        >
                            {hasInsufficientBalance
                                ? "Add money to place order"
                                : "Review your payment"}
                        </h2>
                    </div>

                    <div
                        class="mt-6 overflow-hidden rounded-3xl border border-line bg-canvas/65 text-left"
                    >
                        <div class="px-5 pb-5 pt-5 text-center">
                            <p
                                class="text-[10px] font-bold uppercase tracking-[0.18em] {hasInsufficientBalance
                                    ? 'text-warning'
                                    : 'text-primary'}"
                            >
                                {hasInsufficientBalance
                                    ? "Amount Short"
                                    : "Order total"}
                            </p>
                            <p
                                class="mt-1 font-mono text-[42px] font-semibold leading-none tracking-[-0.06em] text-ink tabular-nums"
                            >
                                ₹{formatAmount(
                                    hasInsufficientBalance
                                        ? rechargeShortfall
                                        : cart.totalAmount,
                                )}
                            </p>
                        </div>

                        <div class="border-t border-line bg-surface px-5 py-4">
                            <div class="divide-y divide-line/80">
                                <div
                                    class="flex items-center justify-between py-2"
                                >
                                    <span
                                        class="text-xs font-medium text-ink-muted"
                                        >Wallet balance</span
                                    >
                                    <span
                                        class="font-mono text-sm font-semibold tracking-tight text-ink tabular-nums"
                                    >
                                        ₹{formatAmount(walletBalance)}
                                    </span>
                                </div>
                                <div
                                    class="flex items-center justify-between py-2"
                                >
                                    <span
                                        class="text-xs font-medium text-ink-muted"
                                        >Order total</span
                                    >
                                    <span
                                        class="font-mono text-sm font-semibold tracking-tight text-ink tabular-nums"
                                    >
                                        − ₹{formatAmount(cart.totalAmount)}
                                    </span>
                                </div>
                                <div
                                    class="flex items-center justify-between pt-3"
                                >
                                    <span class="text-sm font-bold text-ink">
                                        {hasInsufficientBalance
                                            ? "Still needed"
                                            : "Balance left"}
                                    </span>
                                    <span
                                        class="font-mono text-base font-semibold tracking-tight tabular-nums {hasInsufficientBalance
                                            ? 'text-warning'
                                            : 'text-success'}"
                                    >
                                        {hasInsufficientBalance
                                            ? "+ "
                                            : ""}₹{formatAmount(
                                            hasInsufficientBalance
                                                ? rechargeShortfall
                                                : balanceAfterOrder,
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {#if paymentMessage}
                        <div
                            class="mt-4 flex items-center gap-2.5 rounded-2xl border border-success/10 bg-success-soft px-4 py-3 text-left text-xs font-medium leading-relaxed text-success"
                        >
                            <CheckCircleIcon class="h-4 w-4 shrink-0" />
                            <span>{paymentMessage}</span>
                        </div>
                    {/if}

                    {#if error}
                        <div
                            class="mt-4 flex items-start gap-2.5 rounded-2xl border border-danger/10 bg-danger-soft px-4 py-3 text-left text-xs font-medium leading-relaxed text-danger"
                        >
                            <AlertCircleIcon class="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    {/if}
                </div>

                <div
                    class="shrink-0 border-t border-line bg-surface px-6 pt-4"
                    style="padding-bottom: max(env(safe-area-inset-bottom), 24px)"
                >
                    {#if hasInsufficientBalance}
                        <button
                            class="btn-primary h-13 w-full rounded-2xl px-4 text-sm shadow-sm"
                            onclick={startCheckoutRecharge}
                            disabled={isRecharging || checkoutRechargeExceedsWalletLimit}
                        >
                            {#if isRecharging}
                                <Spinner />
                                Opening payment…
                            {:else}
                                {#if checkoutRechargeExceedsWalletLimit}
                                    Wallet limit is ₹{MAX_WALLET_BALANCE.toLocaleString("en-IN")}
                                {:else}
                                    Add ₹{formatAmount(rechargeShortfall)} & place order
                                {/if}
                            {/if}
                        </button>
                    {:else}
                        <button
                            class="btn-primary h-13 w-full rounded-2xl px-4 text-sm shadow-sm"
                            onclick={() => placeOrder()}
                            disabled={isPlacingOrder}
                        >
                            {#if isPlacingOrder}
                                <Spinner />
                                Placing order…
                            {:else}
                               Place Order
                            {/if}
                        </button>
                    {/if}

                    <button
                        class="mt-2 h-10 w-full text-sm font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
                        onclick={() => {
                            isConfirmOpen = false;
                        }}
                        disabled={isPlacingOrder}
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
