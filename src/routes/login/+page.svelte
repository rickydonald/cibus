<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";
    import { getSafeRedirectPath } from "$lib/auth-redirect";
    import { isGuestUserId } from "$lib/password-reset";
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { slide } from "svelte/transition";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        EyeIcon,
        EyeOffIcon,
    } from "@lucide/svelte";

    let showPassword = $state(false);
    let redirectTo = $derived(
        getSafeRedirectPath(page.url.searchParams.get("redirect"), ""),
    );

    const justRegistered = page.url.searchParams.get("registered") === "1";
    const guestPending = page.url.searchParams.get("guestPending") === "1";

    let userId = $state(
        page.url.searchParams.get("userId")?.toUpperCase() ?? "",
    );
    let password = $state("");
    let error = $state("");
    const isGuestAccount = $derived(isGuestUserId(userId));

    let isLoginButtonDisabled = $state(true);
    let isLoginLoading = $state(false);

    $effect(() => {
        if (userId.length <= 0 || password.length <= 0) {
            error = "";
            isLoginLoading = false;
            isLoginButtonDisabled = true;
            return;
        }

        error = "";
        isLoginLoading = false;
        isLoginButtonDisabled = false;
    });

    async function handleLogin() {
        isLoginLoading = true;
        clearCachedEatRightProfile();

        const login = await fetch("/api/v1/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, password }),
        });

        const res = await login.json();
        if (!login.ok || res.error) {
            error = res.error ?? "Unable to connect EatRight.";
            isLoginLoading = false;
            return;
        }

        await goto(redirectTo || getSafeRedirectPath(res.redirectUrl));
    }

    function constructForgotPasswordUrl(): string {
        if (userId.length >= 3 && userId !== null) {
            return "/forgot-password?userId=" + userId;
        }
        return "/forgot-password";
    }
</script>

<AuthShell>
    <h1 class="auth-title font-medium text-center">Welcome back.</h1>
    <!-- <p class="auth-subtitle">
        Sign in to start your next order.
    </p> -->

    {#if justRegistered}
        <div class="auth-alert-success mt-5" transition:slide={{ duration: 260 }}>
            <CircleCheckIcon size="16" class="shrink-0" />
            {guestPending
                ? "Guest account created — go to the Foodcourt Manager to activate it before signing in."
                : "Account created — sign in with your new ID."}
        </div>
    {/if}

    <form
        class="mt-7 flex flex-col gap-5"
        onsubmit={(event) => {
            event.preventDefault();
            if (!isLoginButtonDisabled && !isLoginLoading) handleLogin();
        }}
    >
        <div>
            <label class="auth-label" for="user-id">User ID</label>
            <input
                type="text"
                bind:value={userId}
                placeholder="Dept. number or staff ID"
                id="user-id"
                autocomplete="username"
                autocapitalize="characters"
                required
                class="auth-input font-semibold uppercase"
            />
        </div>

        <div>
            <div class="auth-label">
                <label for="password">Password</label>
                {#if !isGuestAccount}
                    <a
                        href={constructForgotPasswordUrl()}
                        class="text-xs font-semibold text-ink-muted transition-colors hover:text-primary"
                        >Forgot password?</a
                    >
                {/if}
            </div>
            <div class="relative">
                <input
                    type={showPassword ? "text" : "password"}
                    bind:value={password}
                    placeholder="Enter your password"
                    id="password"
                    autocomplete="current-password"
                    required
                    class="auth-input pr-13"
                />
                <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-2xl text-ink-faint transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                    aria-label={showPassword
                        ? "Hide password"
                        : "Show password"}
                >
                    {#if showPassword}
                        <EyeOffIcon size="19" strokeWidth="1.8" />
                    {:else}
                        <EyeIcon size="19" strokeWidth="1.8" />
                    {/if}
                </button>
            </div>
        </div>

        {#if error}
            <div
                role="alert"
                class="auth-alert-danger"
                transition:slide={{ duration: 240 }}
            >
                {error}
            </div>
        {/if}

        <button
            type="submit"
            class="btn-auth group mt-1"
            disabled={isLoginButtonDisabled || isLoginLoading}
        >
            {#if isLoginLoading}
                <Spinner />
                <span>Signing in…</span>
            {:else}
                <span>Sign in</span>
                <ArrowRightIcon
                    size="18"
                    strokeWidth="2.2"
                    class="transition-transform duration-200 group-hover:translate-x-0.5"
                />
            {/if}
        </button>
    </form>

    {#snippet footer()}
        <p class="text-center text-sm text-ink-muted">
            New to Eat Right?
            <a href="/register" class="auth-link">Create an account</a>
        </p>
    {/snippet}
</AuthShell>
