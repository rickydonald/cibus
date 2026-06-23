<script lang="ts">
    import { ArrowLeftIcon, XCircleIcon } from "@untitled-theme/icons-svelte";
    import { onMount, onDestroy } from "svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/env";

    type WalletTransaction = {
        date: string;
        amount: number;
        balance: number;
        sort_time: number;
        type: "CREDIT" | "DEBIT" | "Aborted" | string;
        remarks: string;
    };

    let walletBalance = $state<string | null>(null);
    let transactions = $state<WalletTransaction[]>([]);
    let amount = $state("");
    let isLoading = $state(true);
    let isSubmitting = $state(false);
    let error = $state("");
    let message = $state("");

    function splitPrice(value: number | string | null) {
        const num = Number(value);
        if (!Number.isFinite(num)) return { main: "--", decimal: "00" };
        const [main, decimal] = num.toFixed(2).split(".");
        return { main, decimal };
    }

    let displayBalance = $derived(splitPrice(walletBalance));

    const TRANSACTION_THEMES: Record<string, string> = {
        CREDIT: "text-emerald-600 font-bold",
        DEBIT: "text-neutral-900 font-bold",
        ABORTED: "text-neutral-400 line-through font-medium",
    };

    function transactionStyle(type: string) {
        return (
            TRANSACTION_THEMES[type.toUpperCase()] ??
            "text-neutral-500 font-medium"
        );
    }

    function quickSelect(val: number) {
        amount = val.toString();
    }

    async function loadWallet() {
        isLoading = true;
        error = "";

        try {
            const [accountResponse, walletResponse] = await Promise.all([
                fetchEatRight("/api/v1/account/show"),
                fetchEatRight("/api/v1/wallet"),
            ]);

            const accountData = await accountResponse.json();
            const walletData = await walletResponse.json();

            if (!accountResponse.ok || accountData.error) {
                if (
                    await redirectIfEatRightConnectRequired(
                        accountData.errorCode,
                    )
                )
                    return;
                error = accountData.error ?? "Unable to load wallet balance.";
                return;
            }

            if (!walletResponse.ok || walletData.error) {
                if (
                    await redirectIfEatRightConnectRequired(
                        walletData.errorCode,
                    )
                )
                    return;
                error =
                    walletData.error ?? "Unable to load wallet transactions.";
                return;
            }

            walletBalance = accountData.walletBalance ?? "0.00";
            transactions = Array.isArray(walletData.transactions)
                ? walletData.transactions.sort(
                      (a: any, b: any) =>
                          Number(b.sort_time ?? 0) - Number(a.sort_time ?? 0),
                  )
                : [];
        } catch {
            error = "Unable to load wallet.";
        } finally {
            isLoading = false;
        }
    }

    let paymentTabRef: Window | null = null;
    let isPolling = $state(false);

    // Polling Control Machine Properties
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let absoluteTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isFetchFlightActive = false;
    let currentBaselineBalance = 0;
    let currentPollDelay = 2500;

    async function checkPaymentStatus() {
        // Halt processing if cycle is terminated or an existing query flight is ongoing
        if (!isPolling || isFetchFlightActive) return;

        isFetchFlightActive = true;
        try {
            const res = await fetchEatRight("/api/v1/account/show");
            const data = await res.json();

            if (res.ok && !data.error && isPolling) {
                const newBalance = Number(data.walletBalance ?? 0);
                if (newBalance > currentBaselineBalance) {
                    cleanUpPaymentCycle();
                    walletBalance = data.walletBalance;
                    message = "Payment completed successfully!";
                    amount = "";
                    await loadWallet();
                    return;
                }
            }
        } catch {
            // Silently swallow network exceptions during transit drops
        } finally {
            isFetchFlightActive = false;
        }

        // Schedule next poll interval step with incremental backoff delay ceiling at 6s
        if (isPolling) {
            currentPollDelay = Math.min(currentPollDelay + 1000, 6000);
            pollTimeoutId = setTimeout(checkPaymentStatus, currentPollDelay);
        }
    }

    // Instantly checks balance the microsecond user refocuses back to our app tab
    function handleVisibilityCheck() {
        if (document.visibilityState === "visible" && isPolling) {
            // Clear planned timer to avoid double concurrent runs
            if (pollTimeoutId) clearTimeout(pollTimeoutId);
            checkPaymentStatus();
        }
    }

    function startPolling(baselineBalance: number) {
        // Clear any stale timers without closing the popup
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        if (absoluteTimeoutId) clearTimeout(absoluteTimeoutId);
        pollTimeoutId = null;
        absoluteTimeoutId = null;

        isPolling = true;
        currentBaselineBalance = baselineBalance;
        currentPollDelay = 2500; // Fast initial trigger cadence
        message = "Processing payment...";

        // Register window visual state hook listeners
        document.addEventListener("visibilitychange", handleVisibilityCheck);

        // Fire off initial check sequence line
        pollTimeoutId = setTimeout(checkPaymentStatus, currentPollDelay);

        // Absolute hard boundary global timeout fallback guard (2 minutes)
        absoluteTimeoutId = setTimeout(() => {
            if (isPolling) {
                cleanUpPaymentCycle();
                error = "Payment window timed out. Please check your balance.";
            }
        }, 120000);
    }

    function cancelPayment() {
        cleanUpPaymentCycle();
        error = "Payment initialized was cancelled by user.";
        toast.error("Payment cancelled");
    }

    function cleanUpPaymentCycle() {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        if (absoluteTimeoutId) clearTimeout(absoluteTimeoutId);

        pollTimeoutId = null;
        absoluteTimeoutId = null;
        isPolling = false;
        isSubmitting = false;
        isFetchFlightActive = false;
        message = "";

        if (browser) {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityCheck,
            );

            try {
                if (paymentTabRef && !paymentTabRef.closed) {
                    paymentTabRef.close();
                }
            } catch {
                // Protection against cross-origin context locks
            }
        }
        paymentTabRef = null;
        if (browser) {
            localStorage.removeItem("eatright:pending_payment");
        }
    }

    async function rechargeWallet() {
        error = "";
        message = "";
        const depositAmount = Number(amount);

        if (!amount) {
            error = "Enter the recharge amount.";
            return;
        }

        if (
            !Number.isFinite(depositAmount) ||
            depositAmount < 1 ||
            depositAmount > 1000
        ) {
            error = "Recharge amount must be between ₹1 and ₹1000.";
            return;
        }

        isSubmitting = true;
        const currentBalance = Number(walletBalance ?? 0);
        paymentTabRef = window.open("", "tpsl_payment");

        try {
            const response = await fetchEatRight("/api/v1/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: depositAmount,
                    confirmAmount: depositAmount,
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                paymentTabRef?.close();
                if (await redirectIfEatRightConnectRequired(data.errorCode))
                    return;
                error =
                    data.error ?? data.message ?? "Unable to start recharge.";
                isSubmitting = false;
                return;
            }

            if (data.status === "redirect" && data.url) {
                if (paymentTabRef) {
                    paymentTabRef.location.href = data.url;
                    startPolling(currentBalance);
                } else {
                    localStorage.setItem(
                        "eatright:pending_payment",
                        JSON.stringify({
                            balance: currentBalance,
                            amount: depositAmount,
                        }),
                    );
                    window.location.href = data.url;
                }
                return;
            }

            paymentTabRef?.close();

            if (data.status === "success") {
                message = data.message ?? "Recharge updated.";
                amount = "";
                isSubmitting = false;
                toast.success(message, { duration: 3000 });
                await loadWallet();
                return;
            }

            error = data.message ?? "Unable to start recharge.";
            isSubmitting = false;
        } catch {
            paymentTabRef?.close();
            error = "Unable to reach EatRight wallet.";
            isSubmitting = false;
        }
    }

    onMount(() => {
        const pending = localStorage.getItem("eatright:pending_payment");
        if (pending) {
            try {
                const { balance } = JSON.parse(pending);
                fetchEatRight("/api/v1/account/show").then(async (res) => {
                    const data = await res.json();
                    if (res.ok && !data.error) {
                        const newBalance = Number(data.walletBalance ?? 0);
                        if (newBalance > Number(balance)) {
                            message = "Payment completed successfully!";
                            toast.success(message, { duration: 3000 });
                            walletBalance = data.walletBalance;
                        }
                    }
                    await loadWallet();
                });
            } catch {
                // ignore
            } finally {
                localStorage.removeItem("eatright:pending_payment");
            }
        } else {
            loadWallet();
        }
    });

    onDestroy(() => {
        cleanUpPaymentCycle();
    });
</script>

<div class="min-h-screen bg-[#F4F5F7] text-neutral-900 antialiased">
    <div
        class="sticky top-0 z-20 bg-[#F4F5F7]/80 backdrop-blur-md border-b border-neutral-200/30"
    >
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
        >
            <button
                onclick={() => history.back()}
                class="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-neutral-200/80 shadow-sm active:scale-95 transition-transform"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-4 w-4 text-neutral-700" />
            </button>

            <div>
                <h1 class="text-lg font-bold tracking-tight text-neutral-900">
                    Manage Wallet
                </h1>
                <p class="text-xs text-neutral-500 font-medium">
                    EatRight balance
                </p>
            </div>
        </div>
    </div>

    <div class="px-4 pb-12 max-w-md mx-auto space-y-5 pt-4">
        <section
            class="overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative"
        >
            <div
                class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-white/5 blur-xl"
            ></div>
            <div>
                <p
                    class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400"
                >
                    Available Balance
                </p>
                {#if isLoading}
                    <div
                        class="mt-2 h-10 w-36 animate-pulse rounded-xl bg-white/10"
                    ></div>
                {:else}
                    <h2
                        class="flex items-baseline text-5xl font-bold tracking-tight text-white tabular-nums"
                    >
                        <span
                            class="text-neutral-300 text-4xl mr-0.5 font-normal"
                            >₹</span
                        >
                        <span>{displayBalance.main}.</span>
                        <span class="text-3xl font-medium text-neutral-300"
                            >{displayBalance.decimal}</span
                        >
                    </h2>
                {/if}
            </div>
        </section>

        <section
            class="rounded-3xl border border-neutral-200/50 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
        >
            <h2
                class="text-sm font-bold pl-1 text-neutral-400 uppercase tracking-wider"
            >
                Recharge Wallet
            </h2>

            <div class="mt-4 space-y-3">
                <div class="relative flex items-center">
                    <span
                        class="absolute left-4 text-lg font-bold text-neutral-400"
                        >₹</span
                    >
                    <input
                        id="money_input"
                        type="number"
                        min="1"
                        max="1000"
                        step="0.01"
                        inputmode="decimal"
                        bind:value={amount}
                        disabled={isSubmitting || isPolling}
                        class="w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-9 pr-4 py-3.5 text-base font-bold outline-none focus:border-neutral-900 focus:bg-white transition-all tracking-wide disabled:opacity-50"
                        placeholder="0.00"
                    />
                </div>

                <div class="flex gap-2">
                    {#each [20, 50, 100] as value}
                        <button
                            onclick={() => quickSelect(value)}
                            disabled={isSubmitting || isPolling}
                            class="flex-1 rounded-xl border border-neutral-200/80 bg-white py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50 active:scale-95 disabled:opacity-50"
                        >
                            + ₹{value}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="flex flex-col gap-2 mt-5">
                <button
                    class="w-full rounded-2xl bg-neutral-900 py-4 font-bold text-sm text-white shadow-sm transition disabled:opacity-40 active:scale-[0.99]"
                    onclick={rechargeWallet}
                    disabled={isSubmitting}
                >
                    {isPolling
                        ? "Waiting for Payment..."
                        : isSubmitting
                          ? "Starting Payment..."
                          : "Add Money"}
                </button>

                {#if isSubmitting || isPolling}
                    <button
                        onclick={cancelPayment}
                        class="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-200/60 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100/80 transition active:scale-[0.99]"
                    >
                        <XCircleIcon class="h-4 w-4" />
                        Cancel Transaction
                    </button>
                {/if}
            </div>

            {#if error || message}
                <div
                    class={`mt-4 rounded-xl px-4 py-3 text-xs font-semibold leading-relaxed border ${error ? "bg-rose-50 border-rose-500/10 text-rose-700" : "bg-emerald-50 border-emerald-500/10 text-emerald-700"}`}
                >
                    {error || message}
                </div>
            {/if}
        </section>

        <section class="space-y-3">
            <h2
                class="text-sm font-bold pl-5 text-neutral-400 uppercase tracking-wider"
            >
                Transaction History
            </h2>

            {#if isLoading}
                <div class="space-y-3">
                    {#each Array(3) as _}
                        <div
                            class="rounded-2xl border border-neutral-200/50 bg-white p-5 shadow-sm space-y-2"
                        >
                            <div
                                class="h-4 w-2/3 animate-pulse rounded bg-neutral-100"
                            ></div>
                            <div
                                class="h-3 w-1/3 animate-pulse rounded bg-neutral-100"
                            ></div>
                        </div>
                    {/each}
                </div>
            {:else if transactions.length === 0}
                <div
                    class="rounded-2xl border border-neutral-200/50 bg-white p-8 text-center text-xs font-medium text-neutral-400 shadow-sm"
                >
                    No transactions recorded yet.
                </div>
            {:else}
                <div
                    class="rounded-3xl border border-neutral-200/50 bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] divide-y divide-neutral-100"
                >
                    {#each transactions as tx}
                        {@const parsedAmount = splitPrice(tx.amount)}
                        {@const parsedBalance = splitPrice(tx.balance)}
                        <article
                            class="p-5 flex items-start justify-between gap-4 bg-white hover:bg-neutral-50/50 transition"
                        >
                            <div class="min-w-0 space-y-0.5">
                                <h3
                                    class="font-semibold text-neutral-900 text-sm leading-snug break-words"
                                >
                                    {tx.remarks}
                                </h3>
                                <p
                                    class="text-[11px] text-neutral-400 font-medium"
                                >
                                    {tx.date}
                                </p>
                                <p
                                    class="text-[10px] text-neutral-400 font-mono pt-1"
                                >
                                    Bal: ₹{parsedBalance.main}.<span
                                        class="text-[9px]"
                                        >{parsedBalance.decimal}</span
                                    >
                                </p>
                            </div>

                            <div class="text-right whitespace-nowrap shrink-0">
                                <span
                                    class={`text-base tracking-tight ${transactionStyle(tx.type)}`}
                                >
                                    {tx.type.toUpperCase() === "DEBIT"
                                        ? "-"
                                        : "+"} ₹{parsedAmount.main}.<span
                                        class="text-xs font-normal"
                                        >{parsedAmount.decimal}</span
                                    >
                                </span>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </section>
    </div>
</div>

<style>
    :global(body) {
        background: #f5f5f7;
    }

    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
</style>
