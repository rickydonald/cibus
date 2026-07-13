<script lang="ts">
    import { Constants } from "$lib/constants";
    import RegistrationSwitch from "$lib/components/custom/RegistrationSwitch.svelte";

    let userType: "student" | "staff" | "guest" = $state("student");
    let showOtpSheet = $state(false);
    let otp = $state("");
    let mobileNumber = $state("");

    async function handleregister() {
        showOtpSheet = true;
    }

    function handleVerifyOtp() {
        showOtpSheet = false;
        otp = "";
    }

    function handleCancelOtp() {
        showOtpSheet = false;
        otp = "";
    }

    $effect(() => {
        otp = otp.replace(/[^0-9]/g, "");
    });
</script>

<div
    class="flex min-h-screen flex-col items-center justify-center px-6 py-16 antialiased"
>
    <div class="w-full max-w-md">
        <!-- Brand -->
        <div class="mb-8">
            <div
                class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white"
            >
                {Constants._SITE.NAME.charAt(0)}
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-ink">
                Create an Account
            </h1>
            <p class="mt-1 text-base text-ink-muted">
                Join {Constants._SITE.NAME} to order from the food court
            </p>
        </div>

        <!-- Segmented Switch -->
        <RegistrationSwitch
            value={userType}
            onChange={(value) => (userType = value)}
        />

        <!-- Register Form -->
        <div class="mt-6 flex flex-col gap-4">
            {#if userType === "guest"}
                <div class="flex w-full flex-col gap-1.5">
                    <label
                        for="guest-name"
                        class="pl-1 text-sm font-medium text-ink-muted"
                        >Name</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. Ricky Donald"
                        id="guest-name"
                        required
                        class="field-input"
                    />
                </div>
            {:else if userType === "staff"}
                <div class="flex w-full flex-col gap-1.5">
                    <label
                        for="staff-id"
                        class="pl-1 text-sm font-medium text-ink-muted"
                        >Faculty/Staff ID</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. 25-PCS-018"
                        id="staff-id"
                        required
                        class="field-input"
                    />
                </div>
            {:else}
                <div class="flex w-full flex-col gap-1.5">
                    <label
                        for="dept-no"
                        class="pl-1 text-sm font-medium text-ink-muted"
                        >Department Number</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. 25-PCS-018"
                        id="dept-no"
                        required
                        class="field-input uppercase"
                    />
                </div>
            {/if}
            <div class="flex w-full flex-col gap-1.5">
                <label
                    for="mobile"
                    class="pl-1 text-sm font-medium text-ink-muted"
                    >Mobile Number</label
                >
                <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    id="mobile"
                    bind:value={mobileNumber}
                    required
                    class="field-input"
                />
            </div>
            <button
                onclick={handleregister}
                class="btn-primary mt-1 h-12 w-full text-sm"
            >
                Continue
            </button>
            <a href="/login" class="mt-3 pl-1 text-sm text-ink-muted">
                Already Registered?
                <span
                    class="font-semibold text-primary underline underline-offset-4"
                >
                    Sign in
                </span>
            </a>
        </div>
    </div>
</div>

<!-- OTP Verification Bottom Sheet -->
