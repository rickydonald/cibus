<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";
    import { getSafeRedirectPath } from "$lib/auth-redirect";
    import AuthShell from "$lib/components/custom/AuthShell.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        ArrowRightIcon,
        CircleCheckIcon,
        EyeIcon,
        EyeOffIcon,
        LockIcon,
        UserIcon,
    } from "@lucide/svelte";

    let showPassword = $state(false);
    let redirectTo = $derived(
        getSafeRedirectPath(page.url.searchParams.get("redirect"), ""),
    );

    const justRegistered = page.url.searchParams.get("registered") === "1";

    let userId = $state(
        page.url.searchParams.get("userId")?.toUpperCase() ?? "",
    );
    let password = $state("");
    let error = $state("");

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
</script>

<AuthShell>
    <div class="mt-5 text-center">
        <h1 class="text-[1.65rem] font-bold tracking-[-0.03em] text-ink">
            Sign in
        </h1>
        <p class="mt-1 text-[13px] font-medium text-ink-muted">
            Your campus food court
        </p>
    </div>

    {#if justRegistered}
        <div
            class="mt-5 flex items-center gap-2.5 rounded-2xl border border-success/15 bg-success-soft px-4 py-3 text-[13px] font-medium leading-5 text-success"
        >
            <CircleCheckIcon size="16" class="shrink-0" />
            Account created — sign in with your new ID.
        </div>
    {/if}

    <form
        class="mt-6 flex flex-col gap-4"
        onsubmit={(event) => {
            event.preventDefault();
            if (!isLoginButtonDisabled && !isLoginLoading) handleLogin();
        }}
    >
        <!-- fused field group -->
        <div
            class="overflow-hidden rounded-2xl border border-line bg-canvas transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
        >
            <div class="relative">
                <label for="user-id" class="sr-only">User ID</label>
                <span
                    class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                >
                    <UserIcon size="18" strokeWidth="1.8" />
                </span>
                <input
                    type="text"
                    bind:value={userId}
                    placeholder="User ID (Dept. Number, Staff ID)"
                    id="user-id"
                    autocomplete="username"
                    autocapitalize="characters"
                    required
                    class="h-14 w-full bg-transparent pl-12.5 pr-4 text-base font-medium uppercase text-ink outline-none placeholder:text-sm placeholder:normal-case placeholder:text-ink-faint"
                />
            </div>

            <div class="mx-4.5 h-px bg-line"></div>

            <div class="relative">
                <label for="password" class="sr-only">Password</label>
                <span
                    class="pointer-events-none absolute inset-y-0 left-4.5 flex items-center text-ink-faint"
                >
                    <LockIcon size="18" strokeWidth="1.8" />
                </span>
                <input
                    type={showPassword ? "text" : "password"}
                    bind:value={password}
                    placeholder="Password"
                    id="password"
                    autocomplete="current-password"
                    required
                    class="h-14 w-full bg-transparent pl-12.5 pr-14 text-base font-medium text-ink outline-none placeholder:text-sm placeholder:text-ink-faint"
                />
                <button
                    type="button"
                    onclick={() => (showPassword = !showPassword)}
                    class="absolute inset-y-0 right-1 flex w-12 items-center justify-center text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
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
                class="rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3.5 text-sm font-medium leading-5 text-danger"
            >
                {error}
            </div>
        {/if}

        <button
            type="submit"
            class="btn-primary h-14 w-full px-5 text-sm bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] shadow-[0_10px_24px_-10px_rgba(19,126,193,0.65)]"
            disabled={isLoginButtonDisabled || isLoginLoading}
        >
            {#if isLoginLoading}
                <Spinner />
            {/if}
            <span>{isLoginLoading ? "Signing in…" : "Sign in"}</span>
            {#if !isLoginLoading}
                <ArrowRightIcon size="18" strokeWidth="2" />
            {/if}
        </button>

        <a
            href="/forgot-password"
            class="mx-auto mt-1 px-2 text-xs font-semibold text-ink-muted transition-colors hover:text-primary"
            >Forgot password?</a
        >
    </form>

    {#snippet footer()}
        <p class="text-sm text-white/60">
            New here?
            <a
                href="/register"
                class="font-bold text-white underline-offset-4 hover:underline"
                >Create an account</a
            >
        </p>
    {/snippet}
</AuthShell>
