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
    import Spinner from "$lib/components/custom/Spinner.svelte";

    type VerifyState = "verifying" | "success" | "failed" | "pending";

    // The gateway can take a moment to settle (and in local dev its
    // return redirect never reaches this app), so poll a few times
    // before settling on "pending".
    const POLL_INTERVAL_MS = 4000;
    const MAX_AUTO_POLLS = 8;
    const CONTINUE_DELAY_MS = 1200;
    let pollCount = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let continueTimer: ReturnType<typeof setTimeout> | null = null;

    // Responsepayload.jsp uses `orderid`; keep accepting `order_id` for
    // callbacks and pending-payment links created by older app versions.
    const orderId =
        page.url.searchParams.get("orderid") ??
        page.url.searchParams.get("order_id") ??
        "";
    const gatewayStatus = page.url.searchParams.get("status") ?? "";
    const returnPath =
        page.url.searchParams.get("return") === "/view/cart"
            ? "/view/cart"
            : "/view/wallet";

    let verifyState = $state<VerifyState>("verifying");
    let balance = $state<string | null>(null);
    let verifiedAmount = $state<string | null>(null);
    let message = $state<string | null>(null);

    function continuationUrl() {
        const params = new URLSearchParams({
            payment: "success",
            order_id: orderId,
        });
        return `${returnPath}?${params.toString()}`;
    }

    function continueAfterSuccess() {
        if (continueTimer) clearTimeout(continueTimer);
        return goto(continuationUrl());
    }

    function scheduleContinuation() {
        if (continueTimer) return;
        continueTimer = setTimeout(
            () => void continueAfterSuccess(),
            CONTINUE_DELAY_MS,
        );
    }

    function scheduleAutoPoll() {
        if (pollCount >= MAX_AUTO_POLLS) return;
        pollCount += 1;
        pollTimer = setTimeout(() => verifyPayment(true), POLL_INTERVAL_MS);
    }

    async function verifyPayment(isAutoPoll = false) {
        if (!orderId) {
            // Query-string status is supplied by the browser redirect and is
            // not sufficient proof that wallet crediting completed.
            message = "The payment returned without an order ID, so it could not be verified.";
            verifyState = "pending";
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
            const transactionAmount = Number(data.transaction?.amount);
            verifiedAmount = Number.isFinite(transactionAmount)
                ? transactionAmount.toFixed(2)
                : null;

            if (data.status === "SUCCESS") {
                verifyState = "success";
                clearPendingPayment();
                scheduleContinuation();
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
            if (continueTimer) clearTimeout(continueTimer);
        };
    });
</script>

<div class="min-h-screen text-ink antialiased flex items-center justify-center px-5">
    <div class="card w-full max-w-md p-6 text-center">
        {#if verifyState === "verifying"}
            <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft border border-primary/10"
            >
                <Spinner size={24} class="text-primary" />
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
                {#if verifiedAmount}₹{verifiedAmount} has been added to your wallet.{:else}Your
                    wallet has been recharged.{/if}
            </p>
            <p class="mt-1 text-[11px] text-ink-faint">
                Continuing automatically…
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
                Your money was not added. If it was deducted, please visit the Food Court Manager.
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
                onclick={() =>
                    verifyState === "success"
                        ? continueAfterSuccess()
                        : goto(returnPath)}
            >
                {verifyState === "success"
                    ? "Continue"
                    : returnPath === "/view/cart"
                    ? "Back to Cart"
                    : "Go to Wallet"}
            </button>
        {/if}
    </div>
</div>
