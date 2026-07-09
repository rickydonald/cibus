<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import LoyolaLogo from "$lib/assets/logos/loyola-logo.webp";
    import { Constants } from "$lib/constants";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";

    let showPassword: boolean = $state(false);
    let redirectTo = $derived(page.url.searchParams.get("redirect") ?? "");

    let userId: string = $state("");
    let password: string = $state("");
    let error: string = $state("");

    let isLoginButtonDisabled: boolean = $state(true);
    let isLoginLoading: boolean = $state(false);

    $effect(() => {
        if (userId.length <= 0 || password.length <= 0) {
            error = "User ID and Password is required!";
            isLoginLoading = false;
            isLoginButtonDisabled = true;
            return;
        } else {
            error = "";
            isLoginLoading = false;
            isLoginButtonDisabled = false;
            return;
        }
    });

    async function handleLogin() {
        isLoginLoading = true;
        clearCachedEatRightProfile();

        const login = await fetch("/api/v1/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId,
                password,
            }),
        });

        const res = await login.json();
        if (!login.ok || res.error) {
            error = res.error ?? "Unable to connect EatRight.";
            isLoginLoading = false;
            return;
        }

        await goto(redirectTo || res.redirectUrl);
    }
</script>

<div
    class="flex flex-col items-center justify-center-safe min-h-[80vh] px-8 pt-16"
>
    <div class="text-left w-full! flex flex-col">
        <!-- <img
            src={LoyolaLogo}
            alt="Loyola College Logo"
            width="88"
            class="pl-[12px]!"
        /> -->
        <h1 class="text-4xl font-bold mb-2 text-neutral-800 pl-[12px]!">
            {Constants._SITE.NAME}.
        </h1>
        <p class="text-base text-gray-500 pl-[12px]!">
            Sign in to your account
        </p>
        <!-- Login Form -->
        <div class="flex flex-col gap-4 mt-5">
            <!-- Login Form: User ID Input -->
            <div class="flex flex-col items-start justify-center gap-1 w-full">
                <label for="user-id" class="text-sm text-gray-600">
                    User ID
                </label>
                <input
                    type="text"
                    bind:value={userId}
                    placeholder="Department Number/Faculty ID/Staff ID"
                    id="user-id"
                    required
                    class="login-form-input uppercase"
                />
            </div>
            <!-- Login Form: Password Input -->
            <div
                class="flex flex-col items-start justify-center gap-1 w-full relative"
            >
                <label for="password" class="text-sm text-gray-600">
                    Password
                </label>
                <input
                    type={showPassword ? "text" : "password"}
                    bind:value={password}
                    placeholder="Enter your Password"
                    id="password"
                    required
                    class="login-form-input"
                />
                <!-- Login Form: Password Visibility Button -->
                <button
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute right-2 bottom-2 text-neutral-500 text-[13px] font-medium p-2 disabled:opacity-60"
                >
                    {showPassword ? "Hide" : "Show"}
                </button>
            </div>
            <!-- Login Form: Submit Button -->
            <button
                onclick={handleLogin}
                class="w-full bg-blue-500 text-white p-2.5 mt-1 rounded-[12px] disabled:opacity-60"
                disabled={isLoginButtonDisabled || isLoginLoading}
            >
                {isLoginLoading ? "Signing in..." : "Sign in"}
            </button>
            <!-- <a href="/forgot-password" class="text-sm text-gray-500"
                >Forgot password?</a
            > -->
            <a href="/register" class="text-sm text-gray-500 mt-3 pl-[12px]!">
                Don't have an account?
                <span class="text-blue-500 underline underline-offset-5">
                    Register Now
                </span>
            </a>
        </div>
    </div>
</div>

<style>
    .login-page {
        background: radial-gradient(
            circle at top right,
            #ffffff 0%,
            #f0efef 40%
        );
    }

    label {
        padding-left: 12px;
    }
    .login-form-input {
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
