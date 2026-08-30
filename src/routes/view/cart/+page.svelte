<script lang="ts">
    import { goto } from "$app/navigation";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
    import {
        ArrowLeftIcon,
        Wallet02Icon,
        ShoppingCart01Icon,
        CheckCircleIcon,
        AlertCircleIcon,
        RefreshCw01Icon,
        ReceiptCheckIcon,
    } from "@untitled-theme/icons-svelte";
    import { cart, MAX_QTY } from "$lib/store/cart.svelte";
    import { onDestroy, onMount } from "svelte";
    import { browser } from "$app/environment";
    import helpers from "$lib/helpers";
    import Stepper from "$lib/components/ui/Stepper.svelte";
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
    const rechargeShortfall = $derived(
        walletBalance === null
            ? 0
            : Number(Math.max(cart.totalAmount - walletBalance, 0).toFixed(2)),
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
            const response = await fetch("/api/v1/account/show");
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
            const response = await fetch("/api/v1/order", {
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
            const response = await fetch("/api/v1/wallet", {
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
    <!-- Header -->
    <div class="page-header">
        <div class="safe-top-offset mx-auto flex max-w-md items-center gap-3 px-5 py-4">
            <button onclick={() => history.back()} class="icon-btn" aria-label="Go back">
                <ArrowLeftIcon class="h-4 w-4" />
            </button>

            <div class="min-w-0 flex-1">
                <p class="section-label">
                    {cart.totalItems}
                    {cart.totalItems === 1 ? "item" : "items"} selected
                </p>
                <h1 class="mt-1 text-xl font-extrabold tracking-tight text-ink">Cart</h1>
            </div>

            {#if isWalletLoading}
                <div class="h-9 w-24 animate-pulse bg-hairline" aria-label="Verifying balance"></div>
            {:else}
                <a
                    href="/view/wallet"
                    class="flex shrink-0 items-center gap-2 border border-line bg-surface px-3 py-2 transition-colors active:bg-ink active:text-white"
                >
                    <Wallet02Icon class="h-4 w-4" />
                    <span class="text-[13px] font-extrabold tabular-nums">
                        ₹{formatAmount(walletBalance)}
                    </span>
                </a>
            {/if}
        </div>
    </div>

    <div class="mx-auto max-w-md px-5 pt-4" style="padding-bottom: max(env(safe-area-inset-bottom), 168px)">
        {#if error}
            <div
                class="mb-4 flex items-start gap-2.5 border-l-3 border-danger bg-danger-soft px-4 py-3 text-[13px] font-bold text-danger"
                in:fly={{ duration: 120, y: -8 }}
            >
                <AlertCircleIcon class="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
            </div>
        {/if}

        {#if cart.items.length === 0}
            <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <div class="mb-5 flex h-16 w-16 items-center justify-center bg-ink">
                    <ShoppingCart01Icon class="h-7 w-7 text-accent" />
                </div>
                <h2 class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">
                    Your cart is empty
                </h2>
                <p class="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
                    Browse the available food counters to fill your tray.
                </p>
                <a
                    href="/view/home"
                    class="np-elevate mt-7 inline-flex w-fit"
                    style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                >
                    <span class="np-face flex h-[50px] items-center justify-center px-[30px] text-sm font-extrabold uppercase tracking-[0.14em]">
                        Browse counters
                    </span>
                </a>
            </div>
        {:else}
            {#each Object.entries(grouped) as [outlet, items]}
                {@const outletItems = items ?? []}
                <div class="mb-4 border border-hairline bg-surface">
                    <!-- Outlet header. Black strip, so each group reads as its own ticket. -->
                    <div class="flex items-center gap-3 bg-ink px-4 py-3.5 text-white">
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-white">
                            <img
                                src={helpers.mapStoreIcon(String(outletItems[0].shopno))}
                                alt={outlet}
                                class="h-7 w-7 object-contain"
                            />
                        </div>
                        <div class="min-w-0 flex-1">
                            <h2 class="truncate text-[14px] font-extrabold tracking-tight">
                                {outlet}
                            </h2>
                            <p class="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                                Counter {outletItems[0].shopno} • {outletItems.length}
                                {outletItems.length === 1 ? "item" : "items"}
                            </p>
                        </div>
                        <!-- Destructive action: pink owns clear/remove app-wide. -->
                        <button
                            onclick={() => {
                                cart.removeByOutlet(outlet);
                                toast.success("Cleared " + outlet);
                            }}
                            class="shrink-0 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-pink transition-colors active:bg-pink active:text-white"
                        >
                            Clear
                        </button>
                    </div>

                    <div>
                        {#each outletItems as item, i}
                            <div class="flex items-center gap-3 px-4 py-3.5 {i > 0 ? 'border-t border-hairline' : ''}">
                                <div class="min-w-0 flex-1">
                                    <h3 class="pr-1 text-[13px] font-extrabold leading-snug wrap-break-word text-ink">
                                        {item.itemname}
                                    </h3>
                                    <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] tabular-nums text-ink-faint">
                                        ₹{item.amount} each
                                    </p>
                                </div>

                                <Stepper
                                    value={item.qty}
                                    max={Math.min(MAX_QTY, item.available_qty ?? MAX_QTY)}
                                    onchange={(next) => {
                                        if (next > item.qty) {
                                            cart.add({
                                                id: item.id,
                                                itemname: item.itemname,
                                                amount: item.amount,
                                                outletid: item.outletid,
                                                outletname: item.outletname,
                                                shopno: item.shopno,
                                                available_qty: item.available_qty ?? MAX_QTY,
                                            });
                                        } else {
                                            cart.remove(item.id, item.outletid);
                                        }
                                    }}
                                    onremove={() => cart.remove(item.id, item.outletid)}
                                />

                                <div class="w-16 shrink-0 text-right text-[13px] font-extrabold tabular-nums text-ink">
                                    ₹{item.amount * item.qty}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Order bar. The commit action of the whole app, so it carries the extrusion. -->
    {#if cart.items.length > 0}
        <div
            class="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-line bg-surface"
            style="padding-right: var(--safe-area-inset-right); padding-bottom: var(--safe-area-inset-bottom); padding-left: var(--safe-area-inset-left);"
        >
            <div class="mx-auto flex max-w-md items-center justify-between gap-4 p-5">
                <div class="shrink-0">
                    <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                        To pay • {cart.totalItems}
                        {cart.totalItems === 1 ? "item" : "items"}
                    </p>
                    <h3 class="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                        ₹{cart.totalAmount}
                    </h3>
                </div>

                <button
                    class="np-elevate flex-1 cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40"
                    style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                    onclick={openOrderConfirmation}
                    disabled={isPlacingOrder || isWalletLoading || isRecharging}
                >
                    <span class="np-face flex h-[50px] items-center justify-center px-4 text-[13px] font-extrabold uppercase tracking-[0.13em]">
                        {#if isPlacingOrder}
                            Placing order
                        {:else if isRecharging || isPollingRecharge}
                            Processing
                        {:else}
                            Review order
                        {/if}
                    </span>
                </button>
            </div>
        </div>
    {/if}

    <!-- Confirmation sheet -->
    {#if isConfirmOpen}
        <div
            class="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 sm:items-center sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-order-title"
            in:fade={{ duration: 120 }}
            out:fade={{ duration: 120 }}
        >
            <button
                class="absolute inset-0 cursor-default"
                onclick={() => {
                    if (!isPollingRecharge) isConfirmOpen = false;
                }}
                aria-label="Dismiss modal"
            ></button>

            <div
                class="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden border-2 border-line bg-surface"
                in:fly={{ duration: 180, y: 60 }}
                out:fly={{ duration: 140, y: 60 }}
            >
                <div class="overflow-y-auto px-6 pb-5 pt-6 text-center sm:px-8">
                    <div
                        class="mx-auto flex h-12 w-12 items-center justify-center {hasInsufficientBalance
                            ? 'bg-sun text-ink'
                            : 'bg-accent text-ink'}"
                    >
                        {#if hasInsufficientBalance}
                            <Wallet02Icon class="h-5 w-5" />
                        {:else}
                            <ReceiptCheckIcon class="h-5 w-5" />
                        {/if}
                    </div>

                    <h2
                        id="confirm-order-title"
                        class="mt-5 text-2xl font-extrabold tracking-[-0.03em] text-ink"
                    >
                        {hasInsufficientBalance
                            ? "Add money to place order"
                            : "Review your payment"}
                    </h2>

                    <div class="mt-6 border border-line text-left">
                        <!-- The figure that matters, on black so it carries. -->
                        <div class="bg-ink px-5 py-6 text-center">
                            <p
                                class="text-[10px] font-extrabold uppercase tracking-[0.2em] {hasInsufficientBalance
                                    ? 'text-sun'
                                    : 'text-accent'}"
                            >
                                {hasInsufficientBalance ? "Amount short" : "Order total"}
                            </p>
                            <p class="mt-2 font-mono text-[42px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">
                                ₹{formatAmount(
                                    hasInsufficientBalance ? rechargeShortfall : cart.totalAmount,
                                )}
                            </p>
                        </div>

                        <div class="bg-surface px-5 py-4">
                            <div class="flex items-center justify-between py-2">
                                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Wallet balance</span>
                                <span class="font-mono text-sm font-extrabold tabular-nums text-ink">
                                    ₹{formatAmount(walletBalance)}
                                </span>
                            </div>
                            <div class="flex items-center justify-between border-t border-hairline py-2">
                                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Order total</span>
                                <span class="font-mono text-sm font-extrabold tabular-nums text-ink">
                                    − ₹{formatAmount(cart.totalAmount)}
                                </span>
                            </div>
                            <div class="flex items-center justify-between border-t border-line pt-3">
                                <span class="text-[12px] font-extrabold uppercase tracking-[0.12em] text-ink">
                                    {hasInsufficientBalance ? "Still needed" : "Balance left"}
                                </span>
                                <span
                                    class="font-mono text-base font-extrabold tabular-nums {hasInsufficientBalance
                                        ? 'text-sun-deep'
                                        : 'text-mint-deep'}"
                                >
                                    {hasInsufficientBalance ? "+ " : ""}₹{formatAmount(
                                        hasInsufficientBalance ? rechargeShortfall : balanceAfterOrder,
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {#if paymentMessage}
                        <div class="mt-4 flex items-center gap-2.5 border-l-3 border-mint-edge bg-mint-soft px-4 py-3 text-left text-xs font-bold leading-relaxed text-mint-deep">
                            {#if isPollingRecharge}
                                <RefreshCw01Icon class="h-4 w-4 shrink-0 animate-spin" />
                            {:else}
                                <CheckCircleIcon class="h-4 w-4 shrink-0" />
                            {/if}
                            <span>{paymentMessage}</span>
                        </div>
                    {/if}

                    {#if error}
                        <div class="mt-4 flex items-start gap-2.5 border-l-3 border-danger bg-danger-soft px-4 py-3 text-left text-xs font-bold leading-relaxed text-danger">
                            <AlertCircleIcon class="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    {/if}
                </div>

                <div
                    class="shrink-0 border-t border-line bg-surface px-6 pt-4"
                    style="padding-bottom: max(env(safe-area-inset-bottom), 24px)"
                >
                    {#if hasInsufficientBalance}
                        <!-- Money action: purple owns anything that moves funds. -->
                        <button
                            class="np-elevate block w-full cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40"
                            style="--np-face:var(--color-purple);--np-ink:#ffffff;--np-edge-right:var(--color-purple-edge);--np-edge-bottom:var(--color-purple-deep)"
                            onclick={startCheckoutRecharge}
                            disabled={isRecharging || isPollingRecharge || rechargeShortfall > 1000}
                        >
                            <span class="np-face flex h-[50px] items-center justify-center gap-2 px-4 text-[13px] font-extrabold uppercase tracking-[0.12em]">
                                {#if isPollingRecharge}
                                    <RefreshCw01Icon class="h-4 w-4 animate-spin" />
                                    Waiting for recharge
                                {:else if isRecharging}
                                    Opening payment
                                {:else}
                                    Add ₹{formatAmount(rechargeShortfall)} & place order
                                {/if}
                            </span>
                        </button>
                    {:else}
                        <button
                            class="np-elevate block w-full cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40"
                            style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                            onclick={() => placeOrder()}
                            disabled={isPlacingOrder}
                        >
                            <span class="np-face flex h-[50px] items-center justify-center gap-2 px-4 text-[13px] font-extrabold uppercase tracking-[0.12em]">
                                {#if isPlacingOrder}
                                    <RefreshCw01Icon class="h-4 w-4 animate-spin" />
                                    Placing order
                                {:else}
                                    Pay ₹{formatAmount(cart.totalAmount)} & place order
                                {/if}
                            </span>
                        </button>
                    {/if}

                    <button
                        class="mt-2.5 h-11 w-full text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint transition-colors active:text-ink disabled:opacity-40"
                        onclick={() => {
                            if (isPollingRecharge) {
                                cleanUpRechargeCycle();
                                clearPendingCheckoutRecharge();
                            }
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
