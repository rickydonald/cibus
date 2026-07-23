<script lang="ts">
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import RegistrationSwitch from "$lib/components/custom/RegistrationSwitch.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { withViewTransition } from "$lib/view-transition";
    import { fade, slide } from "svelte/transition";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";

    type RegisterStep = "details" | "otp" | "done";

    let step = $state<RegisterStep>("details");
    let userType = $state<"student" | "staff" | "guest">("student");
    let otp = $state("");
    let identifier = $state("");
    let mobileNumber = $state("");
    let error = $state("");
    let otpError = $state("");
    let isSubmitting = $state(false);
    let isVerifying = $state(false);
    let resendSeconds = $state(0);
    let registeredUserId = $state("");
    let passwordHint = $state<string | null>(null);
    let activationRequired = $state(false);

    const otpLength = $derived(userType === "guest" ? 4 : 6);

    const identifierField = $derived.by(() => {
        if (userType === "staff")
            return {
                id: "staff-id",
                label: "Faculty / Staff ID",
                placeholder: "Your college-issued ID",
                hint: "Use the ID issued to you by the college.",
                uppercase: true,
            };
        if (userType === "guest")
            return {
                id: "guest-name",
                label: "Full name",
                placeholder: "e.g. Ricky Donald",
                hint: "Tell us your name to create a guest account.",
                uppercase: false,
            };
        return {
            id: "dept-no",
            label: "Department number",
            placeholder: "e.g. 25-PCS-018",
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
        activationRequired = false;
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
            resendSeconds = 30;
            if (step !== "otp") {
                withViewTransition(() => (step = "otp"));
            }
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
            activationRequired = data.activationRequired === true;
            otp = "";
            withViewTransition(() => (step = "done"));
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

    function backToDetails() {
        withViewTransition(() => {
            step = "details";
            otp = "";
            otpError = "";
        });
    }

    async function continueToLogin() {
        await goto(
            `/login?registered=1&userId=${encodeURIComponent(registeredUserId)}${activationRequired ? "&guestPending=1" : ""}`,
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

<AuthShell>
    {#if step === "details"}
        <h1 class="auth-title font-medium text-center">Create your account.</h1>

        <div class="mt-7">
            <RegistrationSwitch value={userType} onChange={selectUserType} />
        </div>

        <form
            class="mt-5 flex flex-col gap-5"
            onsubmit={(event) => {
                event.preventDefault();
                void handleRegister();
            }}
        >
            <div>
                <label class="auth-label" for={identifierField.id}
                    >{identifierField.label}</label
                >
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
                        in:fade={{ duration: 180 }}
                        class="auth-input {identifierField.uppercase
                            ? 'font-semibold uppercase'
                            : ''}"
                    />
                {/key}
            </div>

            <div>
                <label class="auth-label" for="mobile">Mobile number</label>
                <div class="relative">
                    <span
                        class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-[15px] font-semibold text-ink-muted"
                        >+91</span
                    >
                    <input
                        type="tel"
                        inputmode="numeric"
                        autocomplete="tel-national"
                        placeholder="10-digit mobile number"
                        id="mobile"
                        bind:value={mobileNumber}
                        disabled={isSubmitting}
                        minlength="10"
                        maxlength="10"
                        required
                        class="auth-input pl-13 tabular-nums"
                    />
                </div>
            </div>

            <p class="flex items-start gap-2 text-xs leading-5 text-ink-faint">
                <ShieldCheckIcon
                    size="15"
                    strokeWidth="1.8"
                    class="mt-0.5 shrink-0"
                />
                <span
                    >{identifierField.hint} We'll text a one-time code to verify
                    it.</span
                >
            </p>

            {#if error}
                <p
                    class="auth-alert-danger"
                    role="alert"
                    transition:slide={{ duration: 240 }}
                >
                    {error}
                </p>
            {/if}

            <button
                type="submit"
                disabled={isSubmitting}
                class="btn-auth group"
            >
                {#if isSubmitting}
                    <Spinner />
                    <span>Sending code…</span>
                {:else}
                    <span>Continue</span>
                    <ArrowRightIcon
                        size="18"
                        strokeWidth="2.2"
                        class="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                {/if}
            </button>
        </form>
    {:else if step === "otp"}
        <h1 class="auth-title">Verify your number.</h1>
        <p class="auth-subtitle">
            Enter the {otpLength}-digit code we texted to
            <span class="font-semibold text-ink">+91 {mobileNumber}</span>.
        </p>

        <form
            class="mt-7 flex flex-col gap-5"
            onsubmit={(event) => {
                event.preventDefault();
                void verifyNumber();
            }}
        >
            <div>
                <label class="auth-label" for="register-otp"
                    >One-time code</label
                >
                <input
                    id="register-otp"
                    bind:value={otp}
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength={otpLength}
                    placeholder={"•".repeat(otpLength)}
                    disabled={isVerifying}
                    required
                    class="auth-code-input"
                />
            </div>

            {#if otpError}
                <p
                    class="auth-alert-danger"
                    role="alert"
                    transition:slide={{ duration: 240 }}
                >
                    {otpError}
                </p>
            {/if}

            <button
                type="submit"
                class="btn-auth"
                disabled={otp.length !== otpLength || isVerifying}
            >
                {#if isVerifying}
                    <Spinner />
                    <span>Verifying…</span>
                {:else}
                    <span>Verify number</span>
                {/if}
            </button>

            <div
                class="flex items-center justify-between gap-4 px-1 text-xs font-semibold"
            >
                <button
                    type="button"
                    class="text-ink-muted transition-colors hover:text-primary disabled:opacity-50"
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
                    class="text-ink-muted transition-colors hover:text-primary"
                    disabled={isVerifying}
                    onclick={backToDetails}
                >
                    Change details
                </button>
            </div>
        </form>
    {:else}
        <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success"
        >
            <CircleCheckIcon size="22" strokeWidth="2" />
        </div>
        <h1 class="auth-title mt-5">You're all set.</h1>
        <p class="auth-subtitle">
            {activationRequired
                ? "Your guest account was created with the user ID below."
                : "Your Eat Right account is ready. Sign in with the user ID below."}
        </p>

        <div
            class="mt-6 rounded-2xl border border-line bg-canvas px-4 py-4 text-center font-mono text-lg font-bold tracking-widest text-ink"
        >
            {registeredUserId}
        </div>
        <p class="mt-3 text-xs leading-5 text-ink-faint">
            {#if passwordHint === "LAST_4_DIGITS"}
                Your initial password is the last four digits of your mobile
                number.
            {:else}
                Your login credentials have been sent to your mobile number.
            {/if}
        </p>

        {#if activationRequired}
            <div class="auth-alert-warning mt-4">
                Visit the Foodcourt Manager to activate your account before
                signing in.
            </div>
        {/if}

        <button
            type="button"
            class="btn-auth group mt-6"
            onclick={() => void continueToLogin()}
        >
            <span
                >{activationRequired
                    ? "Back to sign in"
                    : "Continue to sign in"}</span
            >
            <ArrowRightIcon
                size="18"
                strokeWidth="2.2"
                class="transition-transform duration-200 group-hover:translate-x-0.5"
            />
        </button>
    {/if}

    {#snippet footer()}
        <p class="text-center text-sm text-ink-muted">
            Already have an account?
            <a href="/login" class="auth-link">Sign in</a>
        </p>
        <p
            class="mx-auto mt-3 max-w-xs text-center text-xs leading-5 text-ink-faint"
        >
            By continuing, you agree to use Eat Right responsibly on campus.
        </p>
    {/snippet}
</AuthShell>
