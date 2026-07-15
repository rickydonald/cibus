<script lang="ts">
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import RegistrationSwitch from "$lib/components/custom/RegistrationSwitch.svelte";
    import {
        ArrowLeftIcon,
        ArrowRightIcon,
        CircleCheckIcon,
        MessagesSquareIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";
    import { goto } from "$app/navigation";
    import { DateTime } from "luxon";

    let userType = $state<"student" | "staff" | "guest">("student");
    let showOtpSheet = $state(false);
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

    function getFoodGreet(): string {
        const currentHour = DateTime.now().setZone("Asia/Kolkata").hour;

        if (currentHour >= 5 && currentHour < 11) return "Breakfast plans,";
        if (currentHour >= 11 && currentHour < 15) return "Lunch plans,";
        if (currentHour >= 15 && currentHour < 19) return "Evening snacks,";
        return "Dinner plans,";
    }

    const foodGreet = getFoodGreet();

    const otpLength = $derived(userType === "guest" ? 4 : 6);

    const accountCopy = $derived.by(() => {
        if (userType === "staff")
            return "Use the ID issued to you by the college.";
        if (userType === "guest")
            return "Tell us your name to create a guest account.";
        return "Use the department number on your student ID.";
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

<main
    class="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(480px,0.95fr)_minmax(0,1.05fr)]"
>
    <section
        class="flex min-h-screen items-center justify-center px-5 py-[max(2rem,var(--safe-area-inset-top))] sm:px-10 lg:px-12"
    >
        <div class="w-full max-w-md py-4 lg:py-10">
            <div class="mb-9 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img
                        src={LoyolaCollegeLogo}
                        alt="Loyola College"
                        class="h-11 w-auto object-contain"
                    />
                    <div class="h-7 w-px bg-line-strong"></div>
                    <span class="text-sm font-bold tracking-tight text-primary"
                        >Eat Right</span
                    >
                </div>
                <a
                    href="/login"
                    class="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ink-muted transition-colors hover:text-primary lg:hidden"
                >
                    <ArrowLeftIcon size="15" /> Sign in
                </a>
            </div>

            <div class="mb-7">
                <p class="section-label mb-3">Get started</p>
                <h1
                    class="text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink sm:text-4xl"
                >
                    Create your account
                </h1>
                <p class="mt-2.5 text-[15px] leading-6 text-ink-muted">
                    Choose how you’re joining, then verify your mobile number.
                </p>
            </div>

            <RegistrationSwitch value={userType} onChange={selectUserType} />

            <form
                class="mt-7 flex flex-col gap-5"
                onsubmit={(event) => {
                    event.preventDefault();
                    void handleRegister();
                }}
            >
                <div class="flex flex-col gap-2">
                    {#if userType === "guest"}
                        <label
                            for="guest-name"
                            class="pl-1 text-sm font-semibold text-ink"
                            >Full name</label
                        >
                        <input
                            type="text"
                            placeholder="e.g. Ricky Donald"
                            id="guest-name"
                            autocomplete="name"
                            bind:value={identifier}
                            disabled={isSubmitting}
                            required
                            class="field-input h-14"
                        />
                    {:else if userType === "staff"}
                        <label
                            for="staff-id"
                            class="pl-1 text-sm font-semibold text-ink"
                            >Faculty / Staff ID</label
                        >
                        <input
                            type="text"
                            placeholder="e.g. RDR028"
                            id="staff-id"
                            autocapitalize="characters"
                            bind:value={identifier}
                            disabled={isSubmitting}
                            required
                            class="field-input h-14 uppercase"
                        />
                    {:else}
                        <label
                            for="dept-no"
                            class="pl-1 text-sm font-semibold text-ink"
                            >Department number</label
                        >
                        <input
                            type="text"
                            placeholder="e.g. 25-PCS-018"
                            id="dept-no"
                            autocapitalize="characters"
                            bind:value={identifier}
                            disabled={isSubmitting}
                            required
                            class="field-input h-14 uppercase"
                        />
                    {/if}
                    <p class="pl-1 text-xs leading-5 text-ink-faint">
                        {accountCopy}
                    </p>
                </div>

                <div class="flex flex-col gap-2">
                    <label
                        for="mobile"
                        class="pl-1 text-sm font-semibold text-ink"
                        >Mobile number</label
                    >
                    <div class="relative">
                        <span
                            class="absolute inset-y-0 left-4 flex items-center border-r border-line pr-3 text-sm font-semibold text-ink-muted"
                            >+91</span
                        >
                        <input
                            type="tel"
                            inputmode="numeric"
                            autocomplete="tel-national"
                            placeholder="98765 43210"
                            id="mobile"
                            bind:value={mobileNumber}
                            disabled={isSubmitting}
                            minlength="10"
                            maxlength="10"
                            required
                            class="field-input h-14 pl-[4.5rem] tabular-nums"
                        />
                    </div>
                    <p
                        class="flex items-center gap-1.5 pl-1 text-xs leading-5 text-ink-faint"
                    >
                        <ShieldCheckIcon size="14" strokeWidth="1.8" /> We’ll send
                        a one-time verification code.
                    </p>
                </div>

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
                    class="btn-primary mt-1 h-14 w-full px-5 text-sm"
                >
                    <span>{isSubmitting ? "Sending code…" : "Continue"}</span>
                    <ArrowRightIcon size="18" strokeWidth="2" />
                </button>
            </form>
        </div>
    </section>

    <section
        class="relative hidden min-h-screen overflow-hidden bg-primary px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14"
    >
        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.13),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_32%)]"
        ></div>
        <div
            class="absolute -left-28 top-1/4 h-72 w-72 rounded-full border border-white/10"
        ></div>
        <div
            class="absolute -left-16 top-1/3 h-44 w-44 rounded-full border border-white/10"
        ></div>

        <a
            href="/login"
            class="relative flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold text-white/75 transition-colors hover:bg-white/12 hover:text-white"
        >
            <ArrowLeftIcon size="15" /> Back to sign in
        </a>

        <div class="relative max-w-lg pb-6">
            <p
                class="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-white/55"
            >
                One account, less waiting
            </p>
            <h2
                class="text-5xl font-bold leading-[1.06] tracking-[-0.04em] xl:text-6xl"
            >
                {foodGreet}<br />sorted.
            </h2>
            <!-- <div class="mt-9 grid max-w-md gap-3">
                <div
                    class="flex items-center gap-4 rounded-2xl border border-white/12 bg-white/7 p-4"
                >
                    <div
                        class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
                    >
                        <SmartphoneIcon size="19" />
                    </div>
                    <div>
                        <p class="text-sm font-semibold">Order from anywhere</p>
                        <p class="mt-0.5 text-xs text-white/55">
                            Pick up when it’s ready.
                        </p>
                    </div>
                </div>
                <div
                    class="flex items-center gap-4 rounded-2xl border border-white/12 bg-white/7 p-4"
                >
                    <div
                        class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
                    >
                        <BadgeCheckIcon size="19" />
                    </div>
                    <div>
                        <p class="text-sm font-semibold">Built for campus</p>
                        <p class="mt-0.5 text-xs text-white/55">
                            Students, staff, faculty, and guests.
                        </p>
                    </div>
                </div>
            </div> -->
        </div>

        <p class="relative text-xs leading-5 text-white/45">
            By continuing, you agree to use Eat Right responsibly on campus.
        </p>
    </section>
</main>

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
                    {isVerifying ? "Verifying…" : "Verify number"}
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
