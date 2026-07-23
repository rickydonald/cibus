<script lang="ts">
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { withViewTransition } from "$lib/view-transition";
    import {
        isGuestUserId,
        normalizePasswordResetOtp,
        normalizePasswordResetUserId,
        validateResetPassword,
    } from "$lib/password-reset";
    import { slide } from "svelte/transition";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        EyeIcon,
        EyeOffIcon,
    } from "@lucide/svelte";
    import { onMount } from "svelte";

    type ResetStep = "account" | "otp" | "password" | "complete";

    let step = $state<ResetStep>("account");
    let userId = $state("");
    let otp = $state("");
    let resetToken = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let showPassword = $state(false);
    let showConfirmation = $state(false);
    let error = $state("");
    let message = $state("");
    let isSubmitting = $state(false);
    let resendSeconds = $state(0);

    const stepIndex = $derived(step === "account" ? 0 : step === "otp" ? 1 : 2);

    async function requestOtp() {
        error = "";
        message = "";
        const normalizedUserId = normalizePasswordResetUserId(userId);
        if (!normalizedUserId) {
            error = "Enter a valid user ID.";
            return;
        }
        if (isGuestUserId(normalizedUserId)) {
            error = "Password reset is not available for guest accounts.";
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetch("/api/v1/password/forgot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: normalizedUserId }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                error = data.error ?? "Unable to send the OTP.";
                return;
            }

            userId = normalizedUserId;
            otp = "";
            resendSeconds = 90;
            const nextMessage =
                data.message ??
                "Check your registered mobile number for the OTP.";
            if (step === "account") {
                withViewTransition(() => {
                    step = "otp";
                    message = nextMessage;
                });
            } else {
                message = nextMessage;
            }
        } catch {
            error = "Unable to reach the password reset service.";
        } finally {
            isSubmitting = false;
        }
    }

    async function verifyOtp() {
        error = "";
        const normalizedOtp = normalizePasswordResetOtp(otp);
        if (normalizedOtp.length !== 6) {
            error = "Enter the six-digit OTP.";
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetch("/api/v1/password/forgot/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, otp: normalizedOtp }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok || data.error || !data.resetToken) {
                error = data.error ?? "Unable to verify the OTP.";
                return;
            }

            resetToken = data.resetToken;
            otp = "";
            withViewTransition(() => {
                message = "OTP verified. Choose your new password.";
                step = "password";
            });
        } catch {
            error = "Unable to reach the OTP verification service.";
        } finally {
            isSubmitting = false;
        }
    }

    async function resetPassword() {
        error = "";
        const passwordError = validateResetPassword(
            newPassword,
            confirmPassword,
        );
        if (passwordError) {
            error = passwordError + ".";
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetch("/api/v1/password/forgot/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    resetToken,
                    newPassword,
                    confirmPassword,
                }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                error = data.error ?? "Unable to reset your password.";
                return;
            }

            resetToken = "";
            newPassword = "";
            confirmPassword = "";
            withViewTransition(() => {
                message = data.message ?? "Password reset successfully.";
                step = "complete";
            });
        } catch {
            error = "Unable to reach the password reset service.";
        } finally {
            isSubmitting = false;
        }
    }

    async function resendOtp() {
        if (resendSeconds > 0 || isSubmitting) return;
        await requestOtp();
    }

    function backToAccount() {
        withViewTransition(() => {
            step = "account";
            otp = "";
            error = "";
            message = "";
        });
    }

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("userId");

        if (slug) {
            userId = slug;
        }
    });

    $effect(() => {
        otp = normalizePasswordResetOtp(otp);
    });

    $effect(() => {
        if (resendSeconds <= 0) return;
        const timer = window.setTimeout(() => (resendSeconds -= 1), 1000);
        return () => window.clearTimeout(timer);
    });
</script>

<AuthShell>
    {#if step !== "complete"}
        <div class="mb-5 flex items-center gap-1.5" aria-hidden="true">
            {#each Array(3) as _, i}
                <div
                    class="h-1 rounded-circle transition-all duration-300 {i ===
                    stepIndex
                        ? 'w-7 bg-primary'
                        : i < stepIndex
                          ? 'w-2.5 bg-primary/35'
                          : 'w-2.5 bg-line-strong'}"
                ></div>
            {/each}
        </div>
    {/if}

    <h1 class="auth-title">
        {#if step === "account"}
            Reset your password.
        {:else if step === "otp"}
            Check your messages.
        {:else if step === "password"}
            Choose a new password.
        {:else}
            Password updated.
        {/if}
    </h1>
    <p class="auth-subtitle">
        {#if step === "account"}
            We'll text a one-time code to your registered mobile number.
        {:else if step === "otp"}
            Enter the six-digit code we sent to your number — it expires in 10
            minutes.
        {:else if step === "password"}
            Pick something memorable. This session expires in 5 minutes.
        {:else}
            You can now sign in with your new password.
        {/if}
    </p>

    <!--
        Intro-only: these banners are removed by step changes that run
        inside a view transition, where a Svelte outro would freeze
        mid-flight. The view transition crossfade covers their exit.
    -->
    {#if message && step !== "complete"}
        <div class="auth-alert-success mt-5" in:slide={{ duration: 260 }}>
            <CircleCheckIcon size="16" class="shrink-0" />
            {message}
        </div>
    {/if}

    {#if error}
        <div
            role="alert"
            class="auth-alert-danger mt-5"
            in:slide={{ duration: 240 }}
        >
            {error}
        </div>
    {/if}

    {#if step === "account"}
        <form
            class="mt-7 flex flex-col gap-5"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) requestOtp();
            }}
        >
            <div>
                <label class="auth-label" for="reset-user-id">User ID</label>
                <input
                    id="reset-user-id"
                    type="text"
                    bind:value={userId}
                    autocomplete="username"
                    autocapitalize="characters"
                    placeholder="Dept. number or staff ID"
                    class="auth-input font-semibold uppercase"
                    required
                />
            </div>

            <button
                type="submit"
                class="btn-auth group"
                disabled={isSubmitting}
            >
                {#if isSubmitting}
                    <Spinner />
                    <span>Sending code…</span>
                {:else}
                    <span>Send code</span>
                    <ArrowRightIcon
                        size="18"
                        strokeWidth="2.2"
                        class="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                {/if}
            </button>
        </form>
    {:else if step === "otp"}
        <form
            class="mt-7 flex flex-col gap-5"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) verifyOtp();
            }}
        >
            <div>
                <label class="auth-label" for="reset-otp">One-time code</label>
                <input
                    id="reset-otp"
                    type="text"
                    bind:value={otp}
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    placeholder="••••••"
                    class="auth-code-input"
                    required
                />
            </div>

            <button
                type="submit"
                class="btn-auth"
                disabled={isSubmitting || otp.length !== 6}
            >
                {#if isSubmitting}
                    <Spinner />
                    <span>Verifying…</span>
                {:else}
                    <span>Verify code</span>
                {/if}
            </button>

            <div
                class="flex items-center justify-between gap-4 px-1 text-xs font-semibold"
            >
                <button
                    type="button"
                    class="text-ink-muted transition-colors hover:text-primary disabled:opacity-50"
                    disabled={resendSeconds > 0 || isSubmitting}
                    onclick={resendOtp}
                >
                    {resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Resend code"}
                </button>
                <button
                    type="button"
                    class="text-ink-muted transition-colors hover:text-primary"
                    onclick={backToAccount}
                >
                    Change user ID
                </button>
            </div>
        </form>
    {:else if step === "password"}
        <form
            class="mt-7 flex flex-col gap-5"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) resetPassword();
            }}
        >
            <div>
                <label class="auth-label" for="new-password">New password</label
                >
                <div class="relative">
                    <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        bind:value={newPassword}
                        placeholder="At least 6 characters"
                        autocomplete="new-password"
                        minlength="6"
                        maxlength="128"
                        class="auth-input pr-13"
                        required
                    />
                    <button
                        type="button"
                        class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-2xl text-ink-faint transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                        onclick={() => (showPassword = !showPassword)}
                        aria-label={showPassword
                            ? "Hide password"
                            : "Show password"}
                    >
                        {#if showPassword}
                            <EyeOffIcon size="19" strokeWidth="1.8" />
                        {:else}
                            <EyeIcon size="19" strokeWidth="1.8" />
                        {/if}
                    </button>
                </div>
            </div>

            <div>
                <label class="auth-label" for="confirm-password"
                    >Confirm password</label
                >
                <div class="relative">
                    <input
                        id="confirm-password"
                        type={showConfirmation ? "text" : "password"}
                        bind:value={confirmPassword}
                        placeholder="Repeat the new password"
                        autocomplete="new-password"
                        minlength="6"
                        maxlength="128"
                        class="auth-input pr-13"
                        required
                    />
                    <button
                        type="button"
                        class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-2xl text-ink-faint transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                        onclick={() => (showConfirmation = !showConfirmation)}
                        aria-label={showConfirmation
                            ? "Hide password confirmation"
                            : "Show password confirmation"}
                    >
                        {#if showConfirmation}
                            <EyeOffIcon size="19" strokeWidth="1.8" />
                        {:else}
                            <EyeIcon size="19" strokeWidth="1.8" />
                        {/if}
                    </button>
                </div>
            </div>

            <button
                type="submit"
                class="btn-auth"
                disabled={isSubmitting}
            >
                {#if isSubmitting}
                    <Spinner />
                    <span>Updating…</span>
                {:else}
                    <span>Reset password</span>
                {/if}
            </button>
        </form>
    {:else}
        <div class="mt-7">
            <div class="auth-alert-success">
                <CircleCheckIcon size="16" class="shrink-0" />
                {message}
            </div>
            <a href="/login" class="btn-auth group mt-5">
                <span>Return to sign in</span>
                <ArrowRightIcon
                    size="18"
                    strokeWidth="2.2"
                    class="transition-transform duration-200 group-hover:translate-x-0.5"
                />
            </a>
        </div>
    {/if}

    {#snippet footer()}
        <p class="text-center text-sm text-ink-muted">
            Remembered it?
            <a href="/login" class="auth-link">Sign in</a>
        </p>
    {/snippet}
</AuthShell>
