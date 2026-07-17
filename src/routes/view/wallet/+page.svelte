<script lang="ts">
    import {
        ArrowDownLeftIcon,
        ArrowUpRightIcon,
        MinusIcon,
    } from "@lucide/svelte";
    import { XCloseIcon } from "@untitled-theme/icons-svelte";
    import {
        cacheEatRightProfile,
        getCachedEatRightProfile,
        type CachedEatRightProfile,
    } from "$lib/client/eatright-profile";
    import { onMount } from "svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { toast } from "svelte-sonner";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { goto } from "$app/navigation";
    import {
        getPendingPayment,
        setPendingPayment,
    } from "$lib/client/pending-payment";

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

    const MIN_RECHARGE = 1;
    const MAX_RECHARGE = 1000;

    // Whole rupees only: strip non-digits, drop leading zeros, cap at
    // 4 digits and clamp anything above the recharge ceiling.
    function sanitizeAmount(raw: string) {
        let digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);
        if (digits && Number(digits) > MAX_RECHARGE) {
            digits = String(MAX_RECHARGE);
        }
        return digits;
    }

    function handleAmountInput(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const clean = sanitizeAmount(input.value);
        amount = clean;
        // Keep the DOM in sync even when the sanitized value is unchanged
        // (e.g. a rejected fifth digit would otherwise stay visible).
        input.value = clean;
    }

    const amountValue = $derived(Number(amount));
    const isAmountValid = $derived(
        amount !== "" &&
            amountValue >= MIN_RECHARGE &&
            amountValue <= MAX_RECHARGE,
    );

    async function loadWallet(options: { preserveError?: boolean } = {}) {
        isLoading = true;
        if (!options.preserveError) error = "";

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
            profile = cacheEatRightProfile(accountData.name, accountData.userid) ?? profile;
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

    async function rechargeWallet() {
        error = "";
        message = "";
        const depositAmount = Number(amount);

        if (!amount) {
            error = "Enter the recharge amount.";
            return;
        }

        if (
            !Number.isInteger(depositAmount) ||
            depositAmount < MIN_RECHARGE ||
            depositAmount > MAX_RECHARGE
        ) {
            error = `Recharge amount must be between ₹${MIN_RECHARGE} and ₹${MAX_RECHARGE}.`;
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetchEatRight("/api/v1/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: depositAmount,
                    confirmAmount: depositAmount,
                    returnPath: "/view/wallet",
                }),
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode))
                    return;
                error =
                    data.error ?? data.message ?? "Unable to start recharge.";
                isSubmitting = false;
                return;
            }

            if (data.status === "redirect" && data.url) {
                if (data.orderId) {
                    setPendingPayment(data.orderId, "/view/wallet");
                }
                window.location.assign(data.url);
                return;
            }

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
            error = "Unable to reach EatRight wallet.";
            isSubmitting = false;
        }
    }

    onMount(async () => {
        profile = getCachedEatRightProfile();
        const params = new URLSearchParams(window.location.search);
        const payment = params.get("payment");
        const paymentMessage = params.get("payment_message");
        const orderId = params.get("order_id");

        // A recharge was started but the gateway never redirected back to
        // this app (e.g. local dev) — resume verification on the callback
        // page instead.
        // if (!payment && !orderId) {
        //     const pending = getPendingPayment();
        //     if (pending) {
        //         await goto(
        //             `/view/wallet/callback?order_id=${encodeURIComponent(pending.orderId)}&return=${encodeURIComponent(pending.returnPath)}`,
        //         );
        //         return;
        //     }
        // }

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

        if (payment === "success" && verifiedStatus === "SUCCESS") {
            message = paymentMessage || "Payment completed successfully!";
            toast.success(message, { duration: 3000 });
            amount = "";
        } else if (payment) {
            error = paymentMessage || "Payment failed or was cancelled.";
            toast.error(error, { duration: 3000 });
        }

        if (payment) {
            history.replaceState({}, "", window.location.pathname);
        }
        await loadWallet({
            preserveError:
                !!payment &&
                !(payment === "success" && verifiedStatus === "SUCCESS"),
        });
    });
</script>

<div class="min-h-screen text-ink antialiased">
    <div class="px-4 max-w-md mx-auto pt-4 lg:max-w-lg">
        <!-- Balance hero -->
        <section
            class="relative overflow-hidden rounded-[28px] bg-[#1c212b] text-white shadow-float"
        >
            <div
                class="absolute inset-0 bg-[radial-gradient(85%_70%_at_50%_-15%,rgba(96,146,204,0.28),transparent_70%)]"
            ></div>
            <div
                class="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10"
            ></div>

            <div
                class="relative z-10 flex flex-col items-center px-6 py-9 text-center"
            >
                <p
                    class="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45"
                >
                    Total Balance
                </p>

                {#if isLoading}
                    <div
                        class="mt-3 h-13 w-44 animate-pulse rounded-2xl bg-white/10"
                    ></div>
                {:else}
                    <div class="mt-3 flex items-baseline tabular-nums">
                        <span class="mr-1.5 text-2xl font-medium text-white/50"
                            >₹</span
                        >
                        <h1
                            class="text-[52px] font-bold leading-none tracking-tight"
                        >
                            {formatMain(displayBalance.main)}
                        </h1>
                        <span class="text-xl font-medium text-white/40"
                            >.{displayBalance.decimal}</span
                        >
                    </div>
                {/if}

                <div
                    class="mt-5 flex max-w-full min-w-0 items-center gap-2 rounded-circle bg-white/8 px-4 py-1.5 ring-1 ring-inset ring-white/10 font-mono!"
                >
                    <span
                        class="min-w-0 flex-1 truncate text-xs font-semibold text-white/85 tracking-widest"
                        title={profile?.name ?? "Eat Right user"}
                    >
                        {profile?.name ?? "Eat Right user"}
                    </span>
                    {#if profile?.userid}
                        <span
                            class="h-1 w-1 shrink-0 rounded-circle bg-white/30"
                        ></span>
                        <span
                            class="shrink-0 text-xs font-medium text-white/55 tabular-nums tracking-widest"
                        >
                            {profile.userid}
                        </span>
                    {/if}
                </div>
            </div>
        </section>

        <!-- Add money -->
        <section class="mt-6">
            <h2 class="section-label pl-4">Add Money</h2>

            <div class="card mt-2 rounded-[22px] p-5">
                <div class="flex items-center justify-between px-1">
                    <label
                        for="money_input"
                        class="text-xs font-semibold text-ink-muted"
                    >
                        Enter amount
                    </label>
                    <span class="text-[11px] font-medium text-ink-faint">
                        ₹{MIN_RECHARGE} – ₹{MAX_RECHARGE.toLocaleString(
                            "en-IN",
                        )}
                    </span>
                </div>

                <label
                    for="money_input"
                    class="mt-2 flex cursor-text items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3.5 transition-all focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/15"
                >
                    <span class="text-2xl font-semibold text-ink-faint">₹</span>
                    <input
                        id="money_input"
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        maxlength="4"
                        value={amount}
                        oninput={handleAmountInput}
                        disabled={isSubmitting}
                        class="w-full bg-transparent text-2xl font-bold tracking-tight text-ink outline-none tabular-nums placeholder:text-ink-faint/50 disabled:opacity-50"
                        placeholder="0"
                    />
                    {#if amount}
                        <button
                            type="button"
                            aria-label="Clear amount"
                            tabindex="-1"
                            onclick={() => (amount = "")}
                            disabled={isSubmitting}
                            class="grid h-6 w-6 shrink-0 place-items-center rounded-circle bg-line/70 text-ink-muted transition-colors hover:bg-line-strong"
                        >
                            <XCloseIcon class="h-3.5 w-3.5" />
                        </button>
                    {/if}
                </label>

                <div class="mt-3 grid grid-cols-4 gap-2">
                    {#each [20, 50, 100, 200] as value}
                        <button
                            type="button"
                            onclick={() => quickSelect(value)}
                            disabled={isSubmitting}
                            class={`h-9 rounded-circle text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
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
                        class="btn-primary h-12 w-full rounded-circle text-sm"
                        onclick={rechargeWallet}
                        disabled={isSubmitting || !isAmountValid}
                    >
                        {#if isSubmitting}
                            <Spinner />
                        {/if}

                        <span>
                            {#if isSubmitting}
                                Starting Payment...
                            {:else if isAmountValid}
                                Add ₹{amountValue.toLocaleString("en-IN")}
                            {:else}
                                Add Money
                            {/if}
                        </span>
                    </button>
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
                                class="h-9 w-9 shrink-0 animate-pulse rounded-circle bg-canvas"
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
                                class={`grid h-9 w-9 shrink-0 place-items-center rounded-circle ${visual.chip}`}
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
