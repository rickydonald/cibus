<script lang="ts">
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        normalizePasswordResetOtp,
        normalizePasswordResetUserId,
        validateResetPassword,
    } from "$lib/password-reset";
    import {
        ArrowLeftIcon,
        ArrowRightIcon,
        CircleCheckIcon,
        EyeIcon,
        EyeOffIcon,
        MessagesSquareIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";

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

    async function requestOtp() {
        error = "";
        message = "";
        const normalizedUserId = normalizePasswordResetUserId(userId);
        if (!normalizedUserId) {
            error = "Enter a valid user ID.";
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
            step = "otp";
            resendSeconds = 90;
            message = data.message ?? "Check your registered mobile number for the OTP.";
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
            message = "OTP verified. Choose your new password.";
            step = "password";
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
            message = data.message ?? "Password reset successfully.";
            step = "complete";
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

    $effect(() => {
        otp = normalizePasswordResetOtp(otp);
    });

    $effect(() => {
        if (resendSeconds <= 0) return;
        const timer = window.setTimeout(() => (resendSeconds -= 1), 1000);
        return () => window.clearTimeout(timer);
    });
</script>

<svelte:head>
    <title>Reset password · Eat Right</title>
    <meta
        name="description"
        content="Reset your Loyola College Eat Right password with an OTP."
    />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-canvas px-5 py-10">
    <div class="w-full max-w-md">
        <div class="mb-8 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <img
                    src={LoyolaCollegeLogo}
                    alt="Loyola College"
                    class="h-12 w-auto object-contain"
                />
                <div class="h-7 w-px bg-line-strong"></div>
                <span class="text-sm font-bold text-primary">Eat Right</span>
            </div>
            {#if step !== "complete"}
                <a
                    href="/login"
                    class="flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-primary"
                >
                    <ArrowLeftIcon size="15" /> Sign in
                </a>
            {/if}
        </div>

        <section class="card rounded-[30px] p-6 shadow-card sm:p-8">
            <div
                class="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl {step ===
                'complete'
                    ? 'bg-success-soft text-success'
                    : 'bg-primary-soft text-primary'}"
            >
                {#if step === "account"}
                    <MessagesSquareIcon size="23" />
                {:else if step === "complete"}
                    <CircleCheckIcon size="25" />
                {:else}
                    <ShieldCheckIcon size="23" />
                {/if}
            </div>

            <p class="section-label mb-2">
                {step === "complete" ? "All done" : "Account recovery"}
            </p>
            <h1 class="text-3xl font-bold tracking-[-0.035em] text-ink">
                {#if step === "account"}
                    Forgot your password?
                {:else if step === "otp"}
                    Enter your OTP
                {:else if step === "password"}
                    Set a new password
                {:else}
                    Password updated
                {/if}
            </h1>
            <p class="mt-2 text-sm leading-6 text-ink-muted">
                {#if step === "account"}
                    Enter your user ID. We’ll send a six-digit code to the registered mobile number.
                {:else if step === "otp"}
                    If the account is eligible, a code was sent to its registered mobile number. It expires in 10 minutes.
                {:else if step === "password"}
                    The verified reset session expires in five minutes.
                {:else}
                    You can now sign in using your new password.
                {/if}
            </p>

            {#if message && step !== "complete"}
                <div class="mt-5 rounded-2xl border border-success/15 bg-success-soft px-4 py-3 text-sm font-medium text-success">
                    {message}
                </div>
            {/if}

            {#if error}
                <div role="alert" class="mt-5 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    {error}
                </div>
            {/if}

            {#if step === "account"}
                <form
                    class="mt-6 flex flex-col gap-5"
                    onsubmit={(event) => {
                        event.preventDefault();
                        if (!isSubmitting) requestOtp();
                    }}
                >
                    <div class="flex flex-col gap-2">
                        <label for="reset-user-id" class="pl-1 text-sm font-semibold text-ink">User ID</label>
                        <input
                            id="reset-user-id"
                            type="text"
                            bind:value={userId}
                            autocomplete="username"
                            autocapitalize="characters"
                            placeholder="Department number, faculty or staff ID"
                            class="field-input h-14 uppercase"
                            required
                        />
                    </div>
                    <button type="submit" class="btn-primary h-14 w-full" disabled={isSubmitting}>
                        {#if isSubmitting}<Spinner />{/if}
                        {isSubmitting ? "Sending OTP…" : "Send OTP"}
                        {#if !isSubmitting}<ArrowRightIcon size="18" />{/if}
                    </button>
                </form>
            {:else if step === "otp"}
                <form
                    class="mt-6 flex flex-col gap-5"
                    onsubmit={(event) => {
                        event.preventDefault();
                        if (!isSubmitting) verifyOtp();
                    }}
                >
                    <div class="flex flex-col gap-2">
                        <label for="reset-otp" class="pl-1 text-sm font-semibold text-ink">Six-digit OTP</label>
                        <input
                            id="reset-otp"
                            type="text"
                            bind:value={otp}
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="6"
                            placeholder="000000"
                            class="field-input h-14 text-center font-mono text-xl tracking-[0.35em]"
                            required
                        />
                    </div>
                    <button type="submit" class="btn-primary h-14 w-full" disabled={isSubmitting || otp.length !== 6}>
                        {#if isSubmitting}<Spinner />{/if}
                        {isSubmitting ? "Verifying…" : "Verify OTP"}
                    </button>
                    <div class="flex items-center justify-between gap-4 text-xs font-semibold">
                        <button
                            type="button"
                            class="text-ink-muted hover:text-primary disabled:opacity-50"
                            disabled={resendSeconds > 0 || isSubmitting}
                            onclick={resendOtp}
                        >
                            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
                        </button>
                        <button
                            type="button"
                            class="text-ink-muted hover:text-primary"
                            onclick={() => {
                                step = "account";
                                otp = "";
                                error = "";
                                message = "";
                            }}
                        >
                            Change user ID
                        </button>
                    </div>
                </form>
            {:else if step === "password"}
                <form
                    class="mt-6 flex flex-col gap-5"
                    onsubmit={(event) => {
                        event.preventDefault();
                        if (!isSubmitting) resetPassword();
                    }}
                >
                    <div class="flex flex-col gap-2">
                        <label for="new-password" class="pl-1 text-sm font-semibold text-ink">New password</label>
                        <div class="relative">
                            <input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                bind:value={newPassword}
                                autocomplete="new-password"
                                minlength="6"
                                maxlength="128"
                                class="field-input h-14 pr-14"
                                required
                            />
                            <button type="button" class="absolute inset-y-0 right-1 flex w-12 items-center justify-center text-ink-muted" onclick={() => (showPassword = !showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                                {#if showPassword}<EyeOffIcon size="19" />{:else}<EyeIcon size="19" />{/if}
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="confirm-password" class="pl-1 text-sm font-semibold text-ink">Confirm password</label>
                        <div class="relative">
                            <input
                                id="confirm-password"
                                type={showConfirmation ? "text" : "password"}
                                bind:value={confirmPassword}
                                autocomplete="new-password"
                                minlength="6"
                                maxlength="128"
                                class="field-input h-14 pr-14"
                                required
                            />
                            <button type="button" class="absolute inset-y-0 right-1 flex w-12 items-center justify-center text-ink-muted" onclick={() => (showConfirmation = !showConfirmation)} aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"}>
                                {#if showConfirmation}<EyeOffIcon size="19" />{:else}<EyeIcon size="19" />{/if}
                            </button>
                        </div>
                    </div>
                    <button type="submit" class="btn-primary h-14 w-full" disabled={isSubmitting}>
                        {#if isSubmitting}<Spinner />{/if}
                        {isSubmitting ? "Updating…" : "Reset password"}
                    </button>
                </form>
            {:else}
                <div class="mt-6">
                    <div class="rounded-2xl border border-success/15 bg-success-soft px-4 py-3 text-sm font-medium text-success">
                        {message}
                    </div>
                    <a href="/login" class="btn-primary mt-5 flex h-14 w-full items-center justify-center gap-2">
                        Return to sign in <ArrowRightIcon size="18" />
                    </a>
                </div>
            {/if}
        </section>
    </div>
</main>
