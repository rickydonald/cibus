<script lang="ts">
    import { XCircleIcon } from "@untitled-theme/icons-svelte";
    import {
        ArrowDownLeftIcon,
        ArrowUpRightIcon,
        MinusIcon,
    } from "@lucide/svelte";
    import {
        cacheEatRightProfileFromUser,
        getCachedEatRightProfile,
        type CachedEatRightProfile,
    } from "$lib/client/eatright-profile";
    import { onMount, onDestroy } from "svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/env";
    import Spinner from "$lib/components/custom/Spinner.svelte";

    type WalletTransaction = {
        date: string;
        amount: number;
        balance: number;
        sort_time: number;
        type: "CREDIT" | "DEBIT" | "Aborted" | string;
        remarks: string;
    };

    let walletBalance = $state<string | null>(null);
    let profile = $state<CachedEatRightProfile | null>(null);
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

    function formatMain(main: string) {
        const num = Number(main);
        return Number.isFinite(num) ? num.toLocaleString("en-IN") : main;
    }

    function txVisual(type: string) {
        const normalized = type.toUpperCase();
        if (normalized === "CREDIT") {
            return {
                icon: ArrowDownLeftIcon,
                chip: "bg-success-soft text-success",
                amount: "font-semibold text-success",
                sign: "+",
            };
        }
        if (normalized === "DEBIT") {
            return {
                icon: ArrowUpRightIcon,
                chip: "bg-danger-soft text-danger",
                amount: "font-semibold text-ink",
                sign: "−",
            };
        }
        return {
            icon: MinusIcon,
            chip: "bg-canvas text-ink-faint",
            amount: "font-medium text-ink-faint line-through",
            sign: "",
        };
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
            profile = cacheEatRightProfileFromUser(accountData.user) ?? profile;
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
        profile = getCachedEatRightProfile();
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

<div class="min-h-screen text-ink antialiased">
    <div class="px-4 pb-nav max-w-md mx-auto pt-4">
        <!-- Balance card: campus food-court card -->
        <section
            class="relative aspect-[1.586/1] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#25415f] via-[#1a3452] to-[#101d2e] text-white shadow-float"
        >
            <div
                class="absolute inset-0 bg-[radial-gradient(circle_at_20%_-25%,rgba(255,255,255,0.12),transparent_55%)]"
            ></div>

            <div class="relative z-10 flex h-full flex-col p-6">
                <div>
                    <p
                        class="text-[15px] font-bold leading-tight tracking-tight"
                    >
                        Eat Right
                    </p>
                    <p
                        class="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/50"
                    >
                        Campus Food Court
                    </p>
                </div>

                <div class="mt-auto">
                    {#if isLoading}
                        <div
                            class="h-10 w-40 animate-pulse rounded-xl bg-white/15"
                        ></div>
                    {:else}
                        <p
                            class="text-[9px] font-bold uppercase tracking-[0.22em] text-white/50"
                        >
                            Balance
                        </p>
                        <div class="mt-1 flex items-baseline tabular-nums">
                            <span class="mr-1 text-xl font-medium text-white/60"
                                >₹</span
                            >
                            <h1
                                class="text-4xl font-bold leading-none tracking-tight"
                            >
                                {formatMain(displayBalance.main)}
                            </h1>
                            <span class="text-lg font-medium text-white/50"
                                >.{displayBalance.decimal}</span
                            >
                        </div>
                    {/if}

                    <div
                        class="mt-4 flex items-baseline justify-between gap-3 font-geist-mono text-[10px] tracking-[0.18em] text-white/55 uppercase"
                    >
                        <span class="truncate"
                            >{profile?.name ?? "Loyola College"}</span
                        >
                        {#if profile?.deptNo}
                            <span class="shrink-0">{profile.deptNo}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </section>

        <!-- Add money -->
        <section class="mt-6">
            <h2 class="section-label pl-4">Add Money</h2>

            <div class="card mt-2 rounded-[22px] p-5">
                <div class="flex items-baseline justify-center py-2">
                    <span class="mr-0.5 text-3xl font-semibold text-ink-faint"
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
                        class="bg-transparent text-4xl font-bold tracking-tight text-ink outline-none tabular-nums placeholder:text-ink-faint/40 disabled:opacity-50"
                        style={`width: ${Math.max(String(amount ?? "").length, 1) + 0.75}ch`}
                        placeholder="0"
                    />
                </div>

                <div class="mt-3 flex justify-center gap-2">
                    {#each [20, 50, 100] as value}
                        <button
                            type="button"
                            onclick={() => quickSelect(value)}
                            disabled={isSubmitting || isPolling}
                            class={`h-9 rounded-full px-5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                                Number(amount) === value
                                    ? "bg-primary text-white"
                                    : "bg-primary-soft text-primary hover:bg-primary/15"
                            }`}
                        >
                            ₹{value}
                        </button>
                    {/each}
                </div>

                <div class="mt-5 flex flex-col gap-2">
                    <button
                        type="button"
                        class="btn-primary h-12 w-full rounded-full text-sm"
                        onclick={rechargeWallet}
                        disabled={isSubmitting || isPolling}
                    >
                        {#if isSubmitting || isPolling}
                            <Spinner />
                        {/if}

                        <span>
                            {#if isPolling}
                                Waiting for Payment...
                            {:else if isSubmitting}
                                Starting Payment...
                            {:else}
                                Add Money
                            {/if}
                        </span>
                    </button>

                    {#if isSubmitting || isPolling}
                        <button
                            onclick={cancelPayment}
                            class="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger-soft text-sm font-semibold text-danger transition hover:bg-danger/10 active:scale-[0.99]"
                        >
                            <XCircleIcon class="h-4 w-4" />
                            Cancel Transaction
                        </button>
                    {/if}
                </div>

                {#if error || message}
                    <p
                        class={`mt-4 text-center text-xs font-medium leading-relaxed ${error ? "text-danger" : "text-success"}`}
                    >
                        {error || message}
                    </p>
                {/if}
            </div>
        </section>

        <!-- Recent activity -->
        <section class="mt-6">
            <h2 class="section-label pl-4">Recent Activity</h2>

            {#if isLoading}
                <div class="card mt-2 overflow-hidden rounded-[22px]">
                    {#each Array(3) as _, i}
                        {#if i > 0}
                            <div
                                class="ml-[4.25rem] border-t border-line/60"
                            ></div>
                        {/if}
                        <div class="flex items-center gap-3.5 p-4">
                            <div
                                class="h-9 w-9 shrink-0 animate-pulse rounded-full bg-canvas"
                            ></div>
                            <div class="flex-1 space-y-2">
                                <div
                                    class="h-3.5 w-2/3 animate-pulse rounded bg-canvas"
                                ></div>
                                <div
                                    class="h-3 w-1/3 animate-pulse rounded bg-canvas"
                                ></div>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else if transactions.length === 0}
                <div
                    class="card mt-2 rounded-[22px] p-8 text-center text-xs font-medium text-ink-faint"
                >
                    No transactions recorded yet.
                </div>
            {:else}
                <div class="card mt-2 overflow-hidden rounded-[22px]">
                    {#each transactions as tx, i}
                        {@const parsedAmount = splitPrice(tx.amount)}
                        {@const parsedBalance = splitPrice(tx.balance)}
                        {@const visual = txVisual(tx.type)}
                        {#if i > 0}
                            <div
                                class="ml-[4.25rem] border-t border-line/60"
                            ></div>
                        {/if}
                        <article class="flex items-center gap-3.5 p-4">
                            <span
                                class={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${visual.chip}`}
                            >
                                <visual.icon size={16} strokeWidth={2.25} />
                            </span>

                            <div class="min-w-0 flex-1">
                                <h3
                                    class="truncate text-sm font-semibold leading-snug text-ink"
                                >
                                    {tx.remarks}
                                </h3>
                                <p
                                    class="mt-0.5 text-[11px] font-medium text-ink-faint"
                                >
                                    {tx.date}
                                </p>
                            </div>

                            <div class="shrink-0 text-right">
                                <p
                                    class={`text-sm tabular-nums ${visual.amount}`}
                                >
                                    {visual.sign}₹{parsedAmount.main}.{parsedAmount.decimal}
                                </p>
                                <p
                                    class="mt-0.5 text-[10px] font-medium tabular-nums text-ink-faint"
                                >
                                    Bal ₹{parsedBalance.main}.{parsedBalance.decimal}
                                </p>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </section>
    </div>
</div>

