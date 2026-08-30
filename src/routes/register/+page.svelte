<script lang="ts">
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import RegistrationSwitch from "$lib/components/custom/RegistrationSwitch.svelte";
    import { ArrowLeftIcon, ArrowRightIcon, BadgeCheckIcon, ShieldCheckIcon, SmartphoneIcon } from "@lucide/svelte";

    let userType: "student" | "staff" | "guest" = $state("student");
    let showOtpSheet = $state(false);
    let otp = $state("");
    let mobileNumber = $state("");

    const accountCopy = $derived.by(() => {
        if (userType === "staff") return "Use the ID issued to you by the college.";
        if (userType === "guest") return "Tell us your name to create a guest account.";
        return "Use the department number on your student ID.";
    });

    function handleRegister() {
        showOtpSheet = true;
    }

    $effect(() => {
        otp = otp.replace(/[^0-9]/g, "");
        mobileNumber = mobileNumber.replace(/[^0-9]/g, "").slice(0, 10);
    });
</script>

<svelte:head>
    <title>Create account · Eat Right</title>
    <meta name="description" content="Create your Loyola College Eat Right account." />
</svelte:head>

<main class="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(480px,0.95fr)_minmax(0,1.05fr)]">
    <section class="flex min-h-screen items-center justify-center px-5 py-[max(2rem,var(--safe-area-inset-top))] sm:px-10 lg:px-12">
        <div class="w-full max-w-md py-4 lg:py-10">
            <div class="mb-9 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src={LoyolaCollegeLogo} alt="Loyola College" class="h-11 w-auto object-contain" />
                    <div class="h-7 w-px bg-line"></div>
                    <span class="text-sm font-extrabold tracking-tight text-ink">Eat Right</span>
                </div>
                <a href="/login" class="flex h-10 items-center gap-2 border border-line bg-surface px-3.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink transition-colors active:bg-ink active:text-white lg:hidden">
                    <ArrowLeftIcon size="14" strokeWidth="2.6" /> Sign in
                </a>
            </div>

            <div class="mb-7">
                <p class="section-label mb-3">Get started</p>
                <h1 class="text-[2rem] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-4xl">Create your account</h1>
                <p class="mt-3 text-[15px] leading-6 text-ink-muted">Choose how you’re joining, then verify your mobile number.</p>
            </div>

            <RegistrationSwitch value={userType} onChange={(value) => (userType = value)} />

            <form
                class="mt-7 flex flex-col gap-5"
                onsubmit={(event) => {
                    event.preventDefault();
                    handleRegister();
                }}
            >
                <div class="flex flex-col gap-2">
                    {#if userType === "guest"}
                        <label for="guest-name" class="section-label text-ink">Full name</label>
                        <input type="text" placeholder="e.g. Ricky Donald" id="guest-name" autocomplete="name" required class="field-input h-14" />
                    {:else if userType === "staff"}
                        <label for="staff-id" class="section-label text-ink">Faculty / Staff ID</label>
                        <input type="text" placeholder="e.g. LC-1024" id="staff-id" autocapitalize="characters" required class="field-input h-14 uppercase" />
                    {:else}
                        <label for="dept-no" class="section-label text-ink">Department number</label>
                        <input type="text" placeholder="e.g. 25-PCS-018" id="dept-no" autocapitalize="characters" required class="field-input h-14 uppercase" />
                    {/if}
                    <p class="text-xs leading-5 text-ink-faint">{accountCopy}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="mobile" class="section-label text-ink">Mobile number</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center border-r border-line px-3.5 text-sm font-extrabold text-ink">+91</span>
                        <input
                            type="tel"
                            inputmode="numeric"
                            autocomplete="tel-national"
                            placeholder="98765 43210"
                            id="mobile"
                            bind:value={mobileNumber}
                            minlength="10"
                            maxlength="10"
                            pattern="[0-9]{10}"
                            required
                            class="field-input h-14 pl-[4.5rem] tabular-nums"
                        />
                    </div>
                    <p class="flex items-center gap-1.5 text-xs leading-5 text-ink-faint">
                        <ShieldCheckIcon size="14" strokeWidth="2.2" /> We’ll send a one-time verification code.
                    </p>
                </div>

                <!-- Commit action: paccha completes the task on this screen. -->
                <button type="submit" class="np-elevate mt-1 block w-full cursor-pointer border-0 bg-transparent p-0" style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)">
                    <span class="np-face flex h-14 items-center justify-center gap-2.5 text-sm font-extrabold uppercase tracking-[0.14em]">
                        <span>Continue</span>
                        <ArrowRightIcon size="17" strokeWidth="2.6" />
                    </span>
                </button>
            </form>

            <p class="mt-8 text-center text-sm text-ink-muted">
                Already have an account?
                <a href="/login" class="font-extrabold text-ink underline decoration-accent-edge decoration-2 underline-offset-4">Sign in</a>
            </p>
        </div>
    </section>

    <!-- Brand panel: flat black, hard grid, one accent rule. -->
    <section class="relative hidden min-h-screen overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div class="pointer-events-none absolute inset-0 opacity-[0.07]" style="background-image:linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px);background-size:48px 48px"></div>

        <a href="/login" class="relative flex w-fit items-center gap-2 border border-white/25 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/75 transition-colors hover:bg-white hover:text-ink">
            <ArrowLeftIcon size="14" strokeWidth="2.6" /> Back to sign in
        </a>

        <div class="relative max-w-lg pb-6">
            <p class="mb-6 text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/50">One account, less waiting</p>
            <h2 class="text-5xl font-extrabold leading-[1.04] tracking-[-0.04em] xl:text-6xl">Lunch plans,<br /><span class="text-accent">sorted.</span></h2>
            <div class="mt-10 grid max-w-md gap-2.5">
                <div class="flex items-center gap-4 border border-white/20 p-4">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center bg-accent text-ink"><SmartphoneIcon size="18" strokeWidth="2.4" /></div>
                    <div><p class="text-[13px] font-extrabold uppercase tracking-[0.1em]">Order from anywhere</p><p class="mt-1 text-xs text-white/55">Pick up when it’s ready.</p></div>
                </div>
                <div class="flex items-center gap-4 border border-white/20 p-4">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center bg-purple text-white"><BadgeCheckIcon size="18" strokeWidth="2.4" /></div>
                    <div><p class="text-[13px] font-extrabold uppercase tracking-[0.1em]">Built for campus</p><p class="mt-1 text-xs text-white/55">Students, staff, faculty, and guests.</p></div>
                </div>
            </div>
        </div>

        <p class="relative text-xs leading-5 text-white/45">By continuing, you agree to use Eat Right responsibly on campus.</p>
    </section>
</main>

{#if showOtpSheet}
    <div class="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
        <button class="absolute inset-0 cursor-default bg-ink/50" type="button" aria-label="Close verification dialog" onclick={() => (showOtpSheet = false)}></button>
        <!-- The dialog is the focal object while open, so it takes the extrusion. -->
        <div class="np-elevate np-static relative w-full max-w-sm" style="--np-face:var(--color-surface);--np-ink:var(--color-ink);--np-edge-right:var(--color-np-white-50);--np-edge-bottom:var(--color-np-black-50)" role="dialog" aria-modal="true" aria-labelledby="otp-title">
            <div class="np-face border border-line p-6">
                <div class="mb-5 flex h-11 w-11 items-center justify-center bg-accent text-ink"><SmartphoneIcon size="19" strokeWidth="2.4" /></div>
                <h2 id="otp-title" class="text-xl font-extrabold tracking-tight text-ink">Check your phone</h2>
                <p class="mt-2 text-sm leading-6 text-ink-muted">Enter the 6-digit code sent to +91 {mobileNumber}.</p>
                <input bind:value={otp} type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="One-time verification code" class="field-input mt-5 h-14 text-center font-mono text-xl tracking-[0.35em] tabular-nums" />
                <button type="button" class="np-elevate mt-4 block w-full cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40" style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)" disabled={otp.length !== 6} onclick={() => { showOtpSheet = false; otp = ""; }}>
                    <span class="np-face flex h-[50px] items-center justify-center text-sm font-extrabold uppercase tracking-[0.14em]">Verify number</span>
                </button>
                <button type="button" class="mt-2.5 h-11 w-full text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint" onclick={() => { showOtpSheet = false; otp = ""; }}>Cancel</button>
            </div>
        </div>
    </div>
{/if}
