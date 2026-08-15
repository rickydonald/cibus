<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import {
        cacheEatRightProfile,
        clearCachedEatRightProfile,
    } from "$lib/client/eatright-profile";
    import {
        authenticateWithPasskey,
        getPasskeyErrorMessage,
        supportsPasskeys,
    } from "$lib/client/passkeys";
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
        KeyRoundIcon,
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
    let passkeyError = $state("");
    const isGuestAccount = $derived(isGuestUserId(userId));

    let isLoginLoading = $state(false);
    let isPasskeyLoginLoading = $state(false);
    let passkeysSupported = $state(false);
    const isAuthBusy = $derived(isLoginLoading || isPasskeyLoginLoading);
    const isLoginButtonDisabled = $derived(
        !userId.trim() || !password || isAuthBusy,
    );

    onMount(() => {
        passkeysSupported = supportsPasskeys();
    });

    $effect(() => {
        userId;
        password;
        error = "";
    });

    async function handleLogin() {
        if (isAuthBusy || isLoginButtonDisabled) return;
        isLoginLoading = true;
        error = "";
        passkeyError = "";
        clearCachedEatRightProfile();

        try {
            const login = await fetch("/api/v1/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, password }),
                cache: "no-store",
            });

            const res = await login.json().catch(() => null);
            if (!login.ok || res?.error) {
                error = res?.error ?? "Unable to connect Eat Right.";
                return;
            }

            cacheEatRightProfile(res?.name, res?.userid);
            await goto(redirectTo || getSafeRedirectPath(res?.redirectUrl));
        } catch {
            error = "Unable to sign in. Check your connection and try again.";
        } finally {
            isLoginLoading = false;
        }
    }

    async function handlePasskeyLogin() {
        if (isAuthBusy) return;
        isPasskeyLoginLoading = true;
        passkeyError = "";
        error = "";
        clearCachedEatRightProfile();

        try {
            const result = await authenticateWithPasskey();
            cacheEatRightProfile(result.name, result.userid);
            await goto(redirectTo || "/view/home");
        } catch (passkeyFailure) {
            passkeyError = getPasskeyErrorMessage(
                passkeyFailure,
                "authenticate",
            );
        } finally {
            isPasskeyLoginLoading = false;
        }
    }

    function constructForgotPasswordUrl(): string {
        if (userId.length >= 3 && userId !== null) {
            return "/forgot-password?userId=" + userId;
        }
        return "/forgot-password";
    }
</script>

<AuthShell>
    <h1 class="auth-title font-medium text-center mb-5">Welcome back.</h1>
    <!-- <p class="auth-subtitle">
        Sign in to start your next order.
    </p> -->

    {#if justRegistered}
        <div
            class="auth-alert-success mt-5"
            transition:slide={{ duration: 260 }}
        >
            <CircleCheckIcon size="16" class="shrink-0" />
            {guestPending
                ? "Guest account created — go to the Foodcourt Manager to activate it before signing in."
                : "Account created — sign in with your new ID."}
        </div>
    {/if}

    <form
        class="{passkeysSupported ? 'mt-4' : 'mt-7'} flex flex-col gap-5"
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
                disabled={isAuthBusy}
            />
        </div>

        <div>
            <div class="auth-label">
                <label for="password">Password</label>
                {#if !isGuestAccount}
                    <a
                        href={constructForgotPasswordUrl()}
                        class="text-xs font-semibold text-ink-muted transition-colors hover:text-primary-ink"
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
                    disabled={isAuthBusy}
                />
                <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-2xl text-ink-faint transition-colors hover:text-primary-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                    disabled={isAuthBusy}
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

    {#if passkeysSupported}
        <div
            class="flex items-center gap-3 py-1 mt-6"
            role="separator"
            aria-label="Or use your password"
        >
            <span class="h-px flex-1 bg-line"></span>
        </div>

        <div class="mt-5 flex flex-col gap-3">
            <button
                type="button"
                class="btn-quiet h-13.5 w-full text-sm"
                onclick={handlePasskeyLogin}
                disabled={isAuthBusy}
                aria-describedby="passkey-signin-hint"
            >
                {#if isPasskeyLoginLoading}
                    <Spinner size={17} />
                    <span>Waiting for your passkey…</span>
                {:else}
                    <KeyRoundIcon size={18} strokeWidth={2.1} />
                    <span>Sign in with a passkey</span>
                {/if}
            </button>
            {#if passkeyError}
                <div
                    role="alert"
                    class="auth-alert-danger"
                    transition:slide={{ duration: 240 }}
                >
                    {passkeyError}
                </div>
            {/if}
        </div>
    {/if}

    {#snippet footer()}
        <p class="text-center text-sm text-ink-muted">
            New to Eat Right?
            <a href="/register" class="auth-link">Create an account</a>
        </p>
    {/snippet}
</AuthShell>
