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
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
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
                chip: "bg-mint-soft text-mint-deep",
                amount: "font-extrabold text-mint-deep",
                sign: "+",
            };
        }
        if (normalized === "DEBIT") {
            return {
                icon: ArrowUpRightIcon,
                chip: "bg-pink-soft text-pink-edge",
                amount: "font-extrabold text-ink",
                sign: "−",
            };
        }
        return {
            icon: MinusIcon,
            chip: "bg-canvas text-ink-faint border border-hairline",
            amount: "font-bold text-ink-faint line-through",
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
                fetch("/api/v1/account/show"),
                fetch("/api/v1/wallet"),
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
            const res = await fetch("/api/v1/account/show");
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
            const response = await fetch("/api/v1/wallet", {
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
                fetch("/api/v1/account/show").then(async (res) => {
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
    <div class="mx-auto max-w-md px-5 pt-4">
        <!--
          Balance hero — the one raised object on this screen. Black face on the
          light canvas is the hardest contrast available and leaves the accent
          families free to carry the actions below.
        -->
        <section
            class="np-elevate np-static block w-full"
            style="--np-face:var(--color-ink);--np-ink:#ffffff;--np-edge-right:var(--color-np-black-50);--np-edge-bottom:var(--color-np-black-70)"
        >
            <div class="np-face flex flex-col items-center px-6 py-8 text-center">
                <p
                    class="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/45"
                >
                    Total Balance
                </p>

                {#if isLoading}
                    <div class="mt-4 h-12 w-44 animate-pulse bg-white/10"></div>
                {:else}
                    <div class="mt-4 flex items-baseline tabular-nums">
                        <span class="mr-1.5 text-2xl font-bold text-white/40"
                            >₹</span
                        >
                        <h1
                            class="text-[52px] font-extrabold leading-none tracking-tight"
                        >
                            {formatMain(displayBalance.main)}
                        </h1>
                        <span class="text-xl font-bold text-white/40"
                            >.{displayBalance.decimal}</span
                        >
                    </div>
                {/if}

                <!-- Identity strip, set in mono so the staff ID reads as a record -->
                <div
                    class="mt-6 flex min-w-0 max-w-full items-center gap-2.5 border border-white/20 px-4 py-2 font-mono!"
                >
                    <span
                        class="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-white/85"
                        title={profile?.name ?? "Eat Right user"}
                    >
                        {profile?.name ?? "Eat Right user"}
                    </span>
                    {#if profile?.deptNo}
                        <span class="h-1 w-1 shrink-0 bg-white/30"></span>
                        <span
                            class="shrink-0 text-[11px] font-bold tabular-nums tracking-[0.14em] text-white/55"
                        >
                            {profile.deptNo}
                        </span>
                    {/if}
                </div>
            </div>
        </section>

        <!--
          Add money.

          The amount plate is black so the acid green can be used as TYPE here —
          on this dark ground it has the contrast it lacks on the light canvas,
          which is why the figure is the one green thing on the screen.

          Purple owns money actions throughout the app, so the quick-amount
          chips and the commit button both take it; the cancel path takes pink,
          which owns destructive actions.
        -->
        <section class="mt-8">
            <p class="section-label">Add Money</p>

            <div class="mt-2.5 border border-line bg-surface">
                <div class="bg-ink px-5 py-7">
                    <label
                        for="money_input"
                        class="block text-center text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/40"
                    >
                        Enter amount
                    </label>
                    <div class="mt-3 flex items-baseline justify-center">
                        <span class="mr-1 text-3xl font-extrabold text-white/35"
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
                            class="bg-transparent text-[44px] font-extrabold tracking-tight text-accent outline-none tabular-nums placeholder:text-white/20 disabled:opacity-50"
                            style={`width: ${Math.max(String(amount ?? "").length, 1) + 0.75}ch`}
                            placeholder="0"
                        />
                    </div>
                    <p
                        class="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/30"
                    >
                        ₹1 — ₹1000 per recharge
                    </p>
                </div>

                <!-- Quick amounts. Square chips, hard fill on select. -->
                <div class="grid grid-cols-3 border-t border-line">
                    {#each [20, 50, 100] as value, i}
                        {@const selected = Number(amount) === value}
                        <button
                            type="button"
                            onclick={() => quickSelect(value)}
                            disabled={isSubmitting || isPolling}
                            class="h-12 text-[13px] font-extrabold tabular-nums tracking-[0.08em] transition-colors disabled:opacity-40 {i >
                            0
                                ? 'border-l border-line'
                                : ''} {selected
                                ? 'bg-purple text-white'
                                : 'bg-surface text-ink active:bg-purple-soft'}"
                        >
                            ₹{value}
                        </button>
                    {/each}
                </div>

                <div class="border-t border-line p-4">
                    <button
                        type="button"
                        class="np-elevate block w-full cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40"
                        style="--np-face:var(--color-purple);--np-ink:#ffffff;--np-edge-right:var(--color-purple-edge);--np-edge-bottom:var(--color-purple-deep)"
                        onclick={rechargeWallet}
                        disabled={isSubmitting || isPolling}
                    >
                        <span
                            class="np-face flex h-[50px] items-center justify-center gap-2.5 text-sm font-extrabold uppercase tracking-[0.14em]"
                        >
                            {#if isSubmitting || isPolling}
                                <Spinner />
                            {/if}
                            {#if isPolling}
                                Waiting for payment
                            {:else if isSubmitting}
                                Starting payment
                            {:else}
                                Add money
                            {/if}
                        </span>
                    </button>

                    {#if isSubmitting || isPolling}
                        <button
                            onclick={cancelPayment}
                            class="mt-2.5 flex h-11 w-full items-center justify-center gap-2 border border-pink bg-pink-soft text-xs font-extrabold uppercase tracking-[0.14em] text-pink-edge transition-colors active:bg-pink active:text-white"
                        >
                            <XCircleIcon class="h-4 w-4" />
                            Cancel transaction
                        </button>
                    {/if}

                    {#if error || message}
                        <p
                            class="mt-3.5 text-center text-[11px] font-bold leading-relaxed {error
                                ? 'text-danger'
                                : 'text-mint-deep'}"
                        >
                            {error || message}
                        </p>
                    {/if}
                </div>
            </div>
        </section>

        <!-- Recent activity -->
        <section class="mt-8 pb-4">
            <p class="section-label">Recent Activity</p>

            {#if isLoading}
                <div class="mt-2.5 border border-hairline bg-surface">
                    {#each Array(3) as _, i}
                        <div
                            class="flex items-center gap-3.5 p-4 {i > 0
                                ? 'border-t border-hairline'
                                : ''}"
                        >
                            <div
                                class="h-9 w-9 shrink-0 animate-pulse bg-canvas"
                            ></div>
                            <div class="flex-1 space-y-2">
                                <div
                                    class="h-3.5 w-2/3 animate-pulse bg-canvas"
                                ></div>
                                <div
                                    class="h-2.5 w-1/3 animate-pulse bg-canvas"
                                ></div>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else if transactions.length === 0}
                <div
                    class="mt-2.5 border border-hairline bg-surface p-10 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint"
                >
                    No transactions yet
                </div>
            {:else}
                <div class="mt-2.5 border border-hairline bg-surface">
                    {#each transactions as tx, i}
                        {@const parsedAmount = splitPrice(tx.amount)}
                        {@const parsedBalance = splitPrice(tx.balance)}
                        {@const visual = txVisual(tx.type)}
                        <article
                            class="flex items-center gap-3.5 p-4 {i > 0
                                ? 'border-t border-hairline'
                                : ''}"
                        >
                            <span
                                class="grid h-9 w-9 shrink-0 place-items-center {visual.chip}"
                            >
                                <visual.icon size={16} strokeWidth={2.5} />
                            </span>

                            <div class="min-w-0 flex-1">
                                <h3
                                    class="truncate text-[13px] font-extrabold leading-snug tracking-tight text-ink"
                                >
                                    {tx.remarks}
                                </h3>
                                <p
                                    class="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint"
                                >
                                    {tx.date}
                                </p>
                            </div>

                            <div class="shrink-0 text-right">
                                <p class="text-[13px] tabular-nums {visual.amount}">
                                    {visual.sign}₹{parsedAmount.main}.{parsedAmount.decimal}
                                </p>
                                <p
                                    class="mt-1 text-[10px] font-bold tabular-nums tracking-[0.1em] text-ink-faint"
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
