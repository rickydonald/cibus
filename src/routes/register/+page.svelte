<script lang="ts">
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import RegistrationSwitch from "$lib/components/custom/RegistrationSwitch.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        MessagesSquareIcon,
        ShieldCheckIcon,
        UserIcon,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";

    let userType = $state<"student" | "staff" | "guest">("student");
    let showOtpSheet = $state<boolean>(false);
    let otp = $state("");
    let identifier = $state("");
    let mobileNumber = $state("");
    let error = $state("");
    let otpError = $state("");
    let isSubmitting = $state(false);
    let isVerifying = $state(false);
    let resendSeconds = $state(0);
    let registrationComplete = $state(false);
    let registeredUserId = $state("");
    let passwordHint = $state<string | null>(null);

    const otpLength = $derived(userType === "guest" ? 4 : 6);

    const identifierField = $derived.by(() => {
        if (userType === "staff")
            return {
                id: "staff-id",
                label: "Faculty / Staff ID",
                placeholder: "Staff ID",
                hint: "Use the ID issued to you by the college.",
                uppercase: true,
            };
        if (userType === "guest")
            return {
                id: "guest-name",
                label: "Full name",
                placeholder: "Full name (e.g. Ricky Donald)",
                hint: "Tell us your name to create a guest account.",
                uppercase: false,
            };
        return {
            id: "dept-no",
            label: "Department number",
            placeholder: "Dept. Number (e.g. 25-PCS-018)",
            hint: "Use the department number on your student ID.",
            uppercase: true,
        };
    });

    function selectUserType(value: "student" | "staff" | "guest") {
        userType = value;
        identifier = "";
        otp = "";
        error = "";
        otpError = "";
        registrationComplete = false;
        showOtpSheet = false;
    }

    function validateForm(): string | null {
        const cleanIdentifier = identifier.trim();
        if (userType === "guest") {
            if (cleanIdentifier.length < 2) return "Enter your full name.";
        } else if (
            !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,49}$/.test(cleanIdentifier)
        ) {
            return "Enter a valid college ID.";
        }
        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
            return "Enter a valid 10-digit Indian mobile number.";
        }
        return null;
    }

    async function handleRegister() {
        error = "";
        otpError = "";
        const validationError = validateForm();
        if (validationError) {
            error = validationError;
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetch("/api/v1/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userType,
                    identifier: identifier.trim(),
                    mobile: mobileNumber,
                }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                error = data.error ?? "Unable to send the OTP.";
                return;
            }

            otp = "";
            registrationComplete = false;
            showOtpSheet = true;
            resendSeconds = 30;
        } catch {
            error = "Unable to reach the registration service.";
        } finally {
            isSubmitting = false;
        }
    }

    async function verifyNumber() {
        otpError = "";
        if (otp.length !== otpLength) {
            otpError = `Enter the ${otpLength}-digit OTP.`;
            return;
        }

        isVerifying = true;
        try {
            const response = await fetch("/api/v1/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userType,
                    identifier: identifier.trim(),
                    mobile: mobileNumber,
                    otp,
                }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                otpError = data.error ?? "Unable to verify the OTP.";
                return;
            }

            registeredUserId = data.userId ?? identifier.trim().toUpperCase();
            passwordHint = data.passwordHint ?? null;
            registrationComplete = true;
            otp = "";
        } catch {
            otpError = "Unable to reach the verification service.";
        } finally {
            isVerifying = false;
        }
    }

    async function resendOtp() {
        error = "";
        await handleRegister();
        if (error) {
            otpError = error;
            error = "";
        }
    }

    async function continueToLogin() {
        await goto(
            `/login?registered=1&userId=${encodeURIComponent(registeredUserId)}`,
        );
    }

    $effect(() => {
        otp = otp.replace(/[^0-9]/g, "").slice(0, otpLength);
        mobileNumber = mobileNumber.replace(/[^0-9]/g, "").slice(0, 10);
    });

    $effect(() => {
        if (resendSeconds <= 0) return;
        const timer = window.setTimeout(() => (resendSeconds -= 1), 1000);
        return () => window.clearTimeout(timer);
    });
</script>

<svelte:head>
    <title>Create account · Eat Right</title>
    <meta
        name="description"
        content="Create your Loyola College Eat Right account."
    />
</svelte:head>

<AuthShell>
    <div class="mt-5 text-center">
        <h1 class="text-[1.65rem] font-bold tracking-[-0.03em] text-ink">
            Create account
        </h1>
        <p class="mt-1 text-[13px] font-medium text-ink-muted">
            Verify your number, and you're in
        </p>
    </div>

    <div class="mt-6">
        <RegistrationSwitch value={userType} onChange={selectUserType} />
    </div>

    <form
        class="mt-4 flex flex-col gap-4"
        onsubmit={(event) => {
            event.preventDefault();
            void handleRegister();
        }}
    >
        <!-- fused field group -->
        <div
            class="overflow-hidden rounded-2xl border border-line bg-canvas transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
        >
            <div class="relative">
                <label for={identifierField.id} class="sr-only"
                    >{identifierField.label}</label
                >
                <span
                    class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                >
                    <UserIcon size="18" strokeWidth="1.8" />
                </span>
                {#key identifierField.id}
                    <input
                        type="text"
                        placeholder={identifierField.placeholder}
                        id={identifierField.id}
                        autocomplete={userType === "guest" ? "name" : "off"}
                        autocapitalize={identifierField.uppercase
                            ? "characters"
                            : "words"}
                        bind:value={identifier}
                        disabled={isSubmitting}
                        required
                        class="h-14 w-full bg-transparent pl-12.5 pr-4 text-base font-medium text-ink outline-none placeholder:text-sm placeholder:normal-case placeholder:text-ink-faint {identifierField.uppercase
                            ? 'uppercase'
                            : ''}"
                    />
                {/key}
            </div>

            <div class="mx-4.5 h-px bg-line"></div>

            <div class="relative">
                <label for="mobile" class="sr-only">Mobile number</label>
                <span
                    class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-sm font-semibold text-ink-muted"
                    >+91</span
                >
                <input
                    type="tel"
                    inputmode="numeric"
                    autocomplete="tel-national"
                    placeholder="Mobile number"
                    id="mobile"
                    bind:value={mobileNumber}
                    disabled={isSubmitting}
                    minlength="10"
                    maxlength="10"
                    required
                    class="h-14 w-full bg-transparent pl-13 pr-4 text-base font-medium tabular-nums text-ink outline-none placeholder:text-sm placeholder:text-ink-faint"
                />
            </div>
        </div>

        <p
            class="flex items-center justify-center gap-1.5 text-xs leading-5 text-ink-faint"
        >
            <ShieldCheckIcon size="14" strokeWidth="1.8" class="shrink-0" />
            {identifierField.hint} We'll text you a code.
        </p>

        {#if error}
            <p
                class="rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3 text-sm leading-5 text-danger"
                role="alert"
            >
                {error}
            </p>
        {/if}

        <button
            type="submit"
            disabled={isSubmitting}
            class="btn-primary h-14 w-full px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
        >
            {#if isSubmitting}
                <Spinner />
            {/if}
            <span>{isSubmitting ? "Sending code…" : "Continue"}</span>
            {#if !isSubmitting}
                <ArrowRightIcon size="18" strokeWidth="2" />
            {/if}
        </button>
    </form>

    {#snippet footer()}
        <p class="text-sm text-white/60">
            Already have an account?
            <a
                href="/login"
                class="font-bold text-white underline-offset-4 hover:underline"
                >Sign in</a
            >
        </p>
        <p class="mx-auto mt-3 max-w-xs text-xs leading-5 text-white/40">
            By continuing, you agree to use Eat Right responsibly on campus.
        </p>
    {/snippet}
</AuthShell>

{#if showOtpSheet}
    <div
        class="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
    >
        <button
            class="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-sm"
            type="button"
            aria-label="Close verification dialog"
            onclick={() => {
                if (!isVerifying && !registrationComplete) showOtpSheet = false;
            }}
        ></button>
        <div
            class="relative w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 shadow-float"
            role="dialog"
            aria-modal="true"
            aria-labelledby="otp-title"
        >
            {#if registrationComplete}
                <div
                    class="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-success-soft text-success"
                >
                    <CircleCheckIcon size="21" />
                </div>
                <h2
                    id="otp-title"
                    class="text-xl font-bold tracking-tight text-ink"
                >
                    Account created
                </h2>
                <p class="mt-2 text-sm leading-6 text-ink-muted">
                    Your Eat Right account is ready with User ID
                </p>
                <div
                    class="mt-4 rounded-2xl border border-line bg-canvas px-4 py-3 text-center font-mono text-base font-bold tracking-wide text-ink"
                >
                    {registeredUserId}
                </div>
                <p class="mt-3 text-xs leading-5 text-ink-faint">
                    {#if passwordHint === "LAST_4_DIGITS"}
                        Your initial password is the last four digits of your
                        mobile number.
                    {:else}
                        Your login credentials have been sent to your mobile
                        number.
                    {/if}
                </p>
                <button
                    type="button"
                    class="btn-primary mt-5 h-13 w-full text-sm"
                    onclick={() => void continueToLogin()}
                >
                    Continue to sign in
                </button>
            {:else}
                <div
                    class="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary"
                >
                    <MessagesSquareIcon size="22" />
                </div>
                <h2
                    id="otp-title"
                    class="text-xl font-bold tracking-tight text-ink"
                >
                    Check your SMS
                </h2>
                <p class="mt-2 text-sm leading-6 text-ink-muted">
                    Enter the {otpLength}-digit code sent to +91 {mobileNumber}.
                </p>
                <input
                    bind:value={otp}
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength={otpLength}
                    placeholder={"X".repeat(otpLength)}
                    aria-label="One-time verification code"
                    disabled={isVerifying}
                    class="font-bold field-input mt-5 h-14 text-center font-mono text-xl tracking-[0.35em] tabular-nums"
                />
                {#if otpError}
                    <p
                        class="mt-3 text-sm text-center leading-5 text-danger"
                        role="alert"
                    >
                        {otpError}
                    </p>
                {/if}
                <button
                    type="button"
                    class="btn-primary mt-4 h-13 w-full text-sm"
                    disabled={otp.length !== otpLength || isVerifying}
                    onclick={() => void verifyNumber()}
                >
                    {#if isVerifying}
                        <Spinner />
                    {/if}
                    <span>{isVerifying ? "Verifying…" : "Verify number"}</span>
                </button>
                <button
                    type="button"
                    class="mt-2 h-11 w-full text-sm font-semibold text-primary disabled:text-ink-faint"
                    disabled={resendSeconds > 0 || isSubmitting || isVerifying}
                    onclick={() => void resendOtp()}
                >
                    {resendSeconds > 0
                        ? `Resend code in ${resendSeconds}s`
                        : isSubmitting
                          ? "Sending…"
                          : "Resend code"}
                </button>
                <button
                    type="button"
                    class="h-11 w-full text-sm font-semibold text-ink-muted"
                    disabled={isVerifying}
                    onclick={() => {
                        showOtpSheet = false;
                        otp = "";
                        otpError = "";
                    }}>Cancel</button
                >
            {/if}
        </div>
    </div>
{/if}
