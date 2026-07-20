<script lang="ts">
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        normalizePasswordResetOtp,
        normalizePasswordResetUserId,
        validateResetPassword,
    } from "$lib/password-reset";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        EyeIcon,
        EyeOffIcon,
        LockIcon,
        UserIcon,
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

    const stepIndex = $derived(
        step === "account" ? 0 : step === "otp" ? 1 : 2,
    );

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
            message =
                data.message ??
                "Check your registered mobile number for the OTP.";
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

<AuthShell>
    <div class="mt-5 text-center">
        <h1 class="text-[1.65rem] font-bold tracking-[-0.03em] text-ink">
            {#if step === "account"}
                Reset password
            {:else if step === "otp"}
                Enter the code
            {:else if step === "password"}
                New password
            {:else}
                All done
            {/if}
        </h1>
        <p class="mt-1 text-[13px] font-medium text-ink-muted">
            {#if step === "account"}
                We'll text a code to your registered number
            {:else if step === "otp"}
                The code expires in 10 minutes
            {:else if step === "password"}
                This session expires in 5 minutes
            {:else}
                Your password has been updated
            {/if}
        </p>
    </div>

    {#if step !== "complete"}
        <!-- step progress dots -->
        <div
            class="mt-4 flex items-center justify-center gap-1.5"
            aria-hidden="true"
        >
            {#each Array(3) as _, i}
                <div
                    class="h-1.5 rounded-circle transition-all duration-300 {i ===
                    stepIndex
                        ? 'w-6 bg-primary'
                        : 'w-1.5 bg-line-strong'}"
                ></div>
            {/each}
        </div>
    {/if}

    {#if message && step !== "complete"}
        <div
            class="mt-5 flex items-center gap-2.5 rounded-2xl border border-success/15 bg-success-soft px-4 py-3 text-[13px] font-medium leading-5 text-success"
        >
            <CircleCheckIcon size="16" class="shrink-0" />
            {message}
        </div>
    {/if}

    {#if error}
        <div
            role="alert"
            class="mt-5 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3 text-sm font-medium leading-5 text-danger"
        >
            {error}
        </div>
    {/if}

    {#if step === "account"}
        <form
            class="mt-6 flex flex-col gap-4"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) requestOtp();
            }}
        >
            <div
                class="rounded-2xl border border-line bg-canvas transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            >
                <div class="relative">
                    <label for="reset-user-id" class="sr-only">User ID</label>
                    <span
                        class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                    >
                        <UserIcon size="18" strokeWidth="1.8" />
                    </span>
                    <input
                        id="reset-user-id"
                        type="text"
                        bind:value={userId}
                        autocomplete="username"
                        autocapitalize="characters"
                        placeholder="User ID (Dept. Number, Staff ID)"
                        class="h-14 w-full bg-transparent pl-12.5 pr-4 text-base font-medium uppercase text-ink outline-none placeholder:text-sm placeholder:normal-case placeholder:text-ink-faint"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                class="btn-primary h-14 w-full px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
                disabled={isSubmitting}
            >
                {#if isSubmitting}<Spinner />{/if}
                <span>{isSubmitting ? "Sending OTP…" : "Send OTP"}</span>
                {#if !isSubmitting}<ArrowRightIcon size="18" strokeWidth="2" />{/if}
            </button>
        </form>
    {:else if step === "otp"}
        <form
            class="mt-6 flex flex-col gap-4"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) verifyOtp();
            }}
        >
            <div
                class="rounded-2xl border border-line bg-canvas transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            >
                <label for="reset-otp" class="sr-only">Six-digit OTP</label>
                <input
                    id="reset-otp"
                    type="text"
                    bind:value={otp}
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    placeholder="000000"
                    class="h-14 w-full bg-transparent px-4 text-center font-mono text-xl font-bold tracking-[0.35em] tabular-nums text-ink outline-none placeholder:text-ink-faint"
                    required
                />
            </div>

            <button
                type="submit"
                class="btn-primary h-14 w-full px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
                disabled={isSubmitting || otp.length !== 6}
            >
                {#if isSubmitting}<Spinner />{/if}
                <span>{isSubmitting ? "Verifying…" : "Verify OTP"}</span>
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
                        : "Resend OTP"}
                </button>
                <button
                    type="button"
                    class="text-ink-muted transition-colors hover:text-primary"
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
            class="mt-6 flex flex-col gap-4"
            onsubmit={(event) => {
                event.preventDefault();
                if (!isSubmitting) resetPassword();
            }}
        >
            <!-- fused field group -->
            <div
                class="overflow-hidden rounded-2xl border border-line bg-canvas transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            >
                <div class="relative">
                    <label for="new-password" class="sr-only"
                        >New password</label
                    >
                    <span
                        class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                    >
                        <LockIcon size="18" strokeWidth="1.8" />
                    </span>
                    <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        bind:value={newPassword}
                        placeholder="New password"
                        autocomplete="new-password"
                        minlength="6"
                        maxlength="128"
                        class="h-14 w-full bg-transparent pl-12.5 pr-14 text-base font-medium text-ink outline-none placeholder:text-sm placeholder:text-ink-faint"
                        required
                    />
                    <button
                        type="button"
                        class="absolute inset-y-0 right-1 flex w-12 items-center justify-center text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
                        onclick={() => (showPassword = !showPassword)}
                        aria-label={showPassword
                            ? "Hide password"
                            : "Show password"}
                    >
                        {#if showPassword}<EyeOffIcon
                                size="19"
                                strokeWidth="1.8"
                            />{:else}<EyeIcon size="19" strokeWidth="1.8" />{/if}
                    </button>
                </div>

                <div class="mx-4.5 h-px bg-line"></div>

                <div class="relative">
                    <label for="confirm-password" class="sr-only"
                        >Confirm password</label
                    >
                    <span
                        class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                    >
                        <LockIcon size="18" strokeWidth="1.8" />
                    </span>
                    <input
                        id="confirm-password"
                        type={showConfirmation ? "text" : "password"}
                        bind:value={confirmPassword}
                        placeholder="Confirm password"
                        autocomplete="new-password"
                        minlength="6"
                        maxlength="128"
                        class="h-14 w-full bg-transparent pl-12.5 pr-14 text-base font-medium text-ink outline-none placeholder:text-sm placeholder:text-ink-faint"
                        required
                    />
                    <button
                        type="button"
                        class="absolute inset-y-0 right-1 flex w-12 items-center justify-center text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
                        onclick={() => (showConfirmation = !showConfirmation)}
                        aria-label={showConfirmation
                            ? "Hide password confirmation"
                            : "Show password confirmation"}
                    >
                        {#if showConfirmation}<EyeOffIcon
                                size="19"
                                strokeWidth="1.8"
                            />{:else}<EyeIcon size="19" strokeWidth="1.8" />{/if}
                    </button>
                </div>
            </div>

            <button
                type="submit"
                class="btn-primary h-14 w-full px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
                disabled={isSubmitting}
            >
                {#if isSubmitting}<Spinner />{/if}
                <span>{isSubmitting ? "Updating…" : "Reset password"}</span>
            </button>
        </form>
    {:else}
        <div class="mt-6">
            <div
                class="flex items-center gap-2.5 rounded-2xl border border-success/15 bg-success-soft px-4 py-3 text-[13px] font-medium leading-5 text-success"
            >
                <CircleCheckIcon size="16" class="shrink-0" />
                {message}
            </div>
            <a
                href="/login"
                class="btn-primary mt-4 flex h-14 w-full items-center justify-center gap-2 px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
            >
                Return to sign in <ArrowRightIcon size="18" strokeWidth="2" />
            </a>
        </div>
    {/if}

    {#snippet footer()}
        <p class="text-sm text-white/60">
            Remembered it?
            <a
                href="/login"
                class="font-bold text-white underline-offset-4 hover:underline"
                >Sign in</a
            >
        </p>
    {/snippet}
</AuthShell>
