<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Constants } from "$lib/constants";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";
    import Spinner from "$lib/components/custom/Spinner.svelte";

    let showPassword: boolean = $state(false);
    let redirectTo = $derived(page.url.searchParams.get("redirect") ?? "");

    let userId: string = $state("");
    let password: string = $state("");
    let error: string = $state("");

    let isLoginButtonDisabled: boolean = $state(true);
    let isLoginLoading: boolean = $state(false);

    $effect(() => {
        if (userId.length <= 0 || password.length <= 0) {
            error = "";
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
                {Constants._SITE.NAME}
            </h1>
            <p class="mt-1 text-base text-ink-muted">
                Sign in to order from the food court
            </p>
        </div>

        <!-- Login Form -->
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => {
                e.preventDefault();
                if (!isLoginButtonDisabled && !isLoginLoading) handleLogin();
            }}
        >
            <!-- Login Form: User ID Input -->
            <div class="flex w-full flex-col gap-1.5">
                <label
                    for="user-id"
                    class="pl-1 text-sm font-medium text-ink-muted"
                >
                    User ID
                </label>
                <input
                    type="text"
                    bind:value={userId}
                    placeholder="Department Number/Faculty ID/Staff ID"
                    id="user-id"
                    required
                    class="field-input uppercase"
                />
            </div>

            <!-- Login Form: Password Input -->
            <div class="relative flex w-full flex-col gap-1.5">
                <label
                    for="password"
                    class="pl-1 text-sm font-medium text-ink-muted"
                >
                    Password
                </label>
                <input
                    type={showPassword ? "text" : "password"}
                    bind:value={password}
                    placeholder="Enter your Password"
                    id="password"
                    required
                    class="field-input pr-16"
                />
                <!-- Login Form: Password Visibility Button -->
                <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute bottom-3.5 right-3 rounded-lg px-2 py-1 text-[13px] font-semibold text-primary"
                >
                    {showPassword ? "Hide" : "Show"}
                </button>
            </div>

            {#if error}
                <div
                    class="rounded-xl border border-danger/10 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                >
                    {error}
                </div>
            {/if}

            <!-- Login Form: Submit Button -->
            <button
                type="submit"
                class="btn-primary mt-1 h-12 w-full text-sm"
                disabled={isLoginButtonDisabled || isLoginLoading}
            >
                {#if isLoginLoading}
                    <Spinner />
                {/if}
                <span>{isLoginLoading ? "Signing in..." : "Sign in"}</span>
            </button>

            <a
                href="/register"
                class="mt-3 pl-1 text-sm text-ink-muted"
            >
                Don't have an account?
                <span
                    class="font-semibold text-primary underline underline-offset-4"
                >
                    Register Now
                </span>
            </a>
        </form>
    </div>
</div>
