<script lang="ts">
    import LoyolaLogo from "$lib/assets/logos/loyola-logo.webp";
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

<div class="register-page flex flex-col items-center min-h-screen px-8 pt-16">
    <div class="text-center w-full! flex flex-col self-center">
        <img
            src={LoyolaLogo}
            alt="Loyola College Logo"
            class="self-center!"
            width="60"
        />
        <h1 class="text-xl font-medium mb-5 text-neutral-800">
            {Constants._SITE.NAME}.
        </h1>
        <p class="text-xl text-neutral-800 font-bold">Create an Account</p>
        <!-- Segmented Switch -->
        <div class="mt-5">
            <RegistrationSwitch
                value={userType}
                onChange={(value) => (userType = value)}
            />
        </div>
        <!-- Register Form -->
        <div class="flex flex-col items-center justify-center gap-4 mt-5">
            {#if userType === "guest"}
                <div
                    class="flex flex-col items-start justify-center gap-1 w-full"
                >
                    <label for="guest-name" class="text-sm text-gray-600"
                        >Name</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. Ricky Donald"
                        id="guest-name"
                        required
                        class="register-form-input"
                    />
                </div>
            {:else if userType === "staff"}
                <div
                    class="flex flex-col items-start justify-center gap-1 w-full"
                >
                    <label for="staff-id" class="text-sm text-gray-600"
                        >Faculty/Staff ID</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. 25-PCS-018"
                        id="staff-id"
                        required
                        class="register-form-input"
                    />
                </div>
            {:else}
                <div
                    class="flex flex-col items-start justify-center gap-1 w-full"
                >
                    <label for="dept-no" class="text-sm text-gray-600"
                        >Department Number</label
                    >
                    <input
                        type="text"
                        placeholder="e.g. 25-PCS-018"
                        id="dept-no"
                        required
                        class="register-form-input uppercase"
                    />
                </div>
            {/if}
            <div class="flex flex-col items-start justify-center gap-1 w-full">
                <label for="mobile" class="text-sm text-gray-600"
                    >Mobile Number</label
                >
                <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    id="mobile"
                    bind:value={mobileNumber}
                    required
                    class="register-form-input"
                />
            </div>
            <button
                onclick={handleregister}
                class="w-full bg-blue-500 text-white p-2.5 mt-1 rounded-[12px]"
                >Continue</button
            >
            <a href="/login" class="text-sm text-gray-500 mt-3">
                Already Registered?
                <span class="text-blue-500 underline underline-offset-5">
                    Signin
                </span>
            </a>
        </div>
    </div>
</div>

<!-- OTP Verification Bottom Sheet -->

<style>
    .register-page {
        background: radial-gradient(
            circle at top right,
            #ffffff 0%,
            #f0efef 40%
        );
    }

    label {
        padding-left: 12px;
    }
    .register-form-input {
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 16px;
        padding: 26px 12px;
        width: 100%;
        height: 40px;
        font-size: 16px;
        font-weight: 500;
        color: #000000;
        outline: none;
        transition: all 0.3s ease;
        &:focus {
            box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
            outline: none;
        }
        &::placeholder {
            font-size: 13px;
            color: rgb(170, 170, 170);
            text-transform: none;
        }
    }
</style>
