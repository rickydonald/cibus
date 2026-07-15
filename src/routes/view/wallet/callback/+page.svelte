<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import {
        CheckCircleIcon,
        XCircleIcon,
        ClockIcon,
    } from "@untitled-theme/icons-svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import { clearPendingPayment } from "$lib/client/pending-payment";

    type VerifyState = "verifying" | "success" | "failed" | "pending";

    // The gateway can take a moment to settle (and in local dev its
    // return redirect never reaches this app), so poll a few times
    // before settling on "pending".
    const POLL_INTERVAL_MS = 4000;
    const MAX_AUTO_POLLS = 8;
    let pollCount = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const orderId = page.url.searchParams.get("order_id") ?? "";
    const gatewayStatus = page.url.searchParams.get("status") ?? "";
    const amount = page.url.searchParams.get("amount") ?? "";
    const returnPath =
        page.url.searchParams.get("return") === "/view/cart"
            ? "/view/cart"
            : "/view/wallet";

    let verifyState = $state<VerifyState>("verifying");
    let balance = $state<string | null>(null);
    let message = $state<string | null>(null);

    function scheduleAutoPoll() {
        if (pollCount >= MAX_AUTO_POLLS) return;
        pollCount += 1;
        pollTimer = setTimeout(() => verifyPayment(true), POLL_INTERVAL_MS);
    }

    async function verifyPayment(isAutoPoll = false) {
        if (!orderId) {
            verifyState = gatewayStatus === "SUCCESS" ? "success" : "failed";
            clearPendingPayment();
            return;
        }

        if (!isAutoPoll) {
            verifyState = "verifying";
            pollCount = 0;
        }
        try {
            const response = await fetchEatRight(
                `/api/v1/wallet/payment-status?order_id=${encodeURIComponent(orderId)}`,
            );
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }
                message = data.error ?? "Unable to verify payment.";
                verifyState = "pending";
                scheduleAutoPoll();
                return;
            }

            if (typeof data.balance === "number") {
                balance = data.balance.toFixed(2);
            }

            if (data.status === "SUCCESS") {
                verifyState = "success";
                clearPendingPayment();
            } else if (data.status === "FAILURE") {
                verifyState = "failed";
                clearPendingPayment();
            } else if (gatewayStatus === "FAILURE") {
                // Gateway said it failed and we found no credit — trust it.
                verifyState = "failed";
                clearPendingPayment();
            } else {
                verifyState = "pending";
                scheduleAutoPoll();
            }
        } catch (error) {
            console.error(error);
            message = "Unable to verify payment right now.";
            verifyState = "pending";
            scheduleAutoPoll();
        }
    }

    onMount(() => {
        verifyPayment();
        return () => {
            if (pollTimer) clearTimeout(pollTimer);
        };
    });
</script>

<div class="min-h-screen text-ink antialiased flex items-center justify-center px-5">
    <div class="card w-full max-w-md p-6 text-center">
        {#if verifyState === "verifying"}
            <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft border border-primary/10"
            >
                <div
                    class="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary"
                ></div>
            </div>
            <h1 class="mt-4 text-lg font-bold tracking-tight">
                Verifying payment…
            </h1>
            <p class="mt-1 text-xs text-ink-muted">
                Confirming your recharge with the Foodcourt.
            </p>
        {:else if verifyState === "success"}
            <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 border border-success/20 text-success"
            >
                <CheckCircleIcon class="h-7 w-7" />
            </div>
            <h1 class="mt-4 text-lg font-bold tracking-tight">
                Payment successful
            </h1>
            <p class="mt-1 text-xs text-ink-muted">
                {#if amount}₹{amount} has been added to your wallet.{:else}Your
                    wallet has been recharged.{/if}
            </p>
            {#if balance}
                <p class="mt-3 text-sm font-semibold tabular-nums">
                    New balance: ₹{balance}
                </p>
            {/if}
        {:else if verifyState === "failed"}
            <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 border border-danger/20 text-danger"
            >
                <XCircleIcon class="h-7 w-7" />
            </div>
            <h1 class="mt-4 text-lg font-bold tracking-tight">
                Payment failed
            </h1>
            <p class="mt-1 text-xs text-ink-muted">
                Your money was not added. If it was deducted, it will be
                refunded by the payment gateway.
            </p>
        {:else}
            <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 border border-warning/20 text-warning"
            >
                <ClockIcon class="h-7 w-7" />
            </div>
            <h1 class="mt-4 text-lg font-bold tracking-tight">
                Payment pending
            </h1>
            <p class="mt-1 text-xs text-ink-muted">
                {message ??
                    "We couldn't confirm the payment yet. It may take a moment to reflect."}
            </p>
            <p class="mt-1 text-[11px] text-ink-faint">
                Checking again automatically…
            </p>
            <button
                class="mt-4 rounded-xl border border-primary/20 bg-primary-soft px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-[0.96]"
                onclick={() => verifyPayment()}
            >
                Check again
            </button>
        {/if}

        {#if orderId}
            <p class="mt-4 text-[11px] text-ink-faint font-mono">
                Order ID: {orderId}
            </p>
        {/if}

        {#if verifyState !== "verifying"}
            <button
                class="mt-5 w-full rounded-xl bg-primary p-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.99]"
                onclick={() => goto(returnPath)}
            >
                {returnPath === "/view/cart"
                    ? "Back to Cart"
                    : "Go to Wallet"}
            </button>
        {/if}
    </div>
</div>
