<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";
    import { getSafeRedirectPath } from "$lib/auth-redirect";
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        ArrowRightIcon,
        EyeIcon,
        EyeOffIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";

    let showPassword = $state(false);
    let redirectTo = $derived(
        getSafeRedirectPath(page.url.searchParams.get("redirect"), ""),
    );

    let userId = $state("");
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

<svelte:head>
    <title>Sign in · Eat Right</title>
    <meta
        name="description"
        content="Sign in to your Loyola College Eat Right account."
    />
</svelte:head>

<main
    class="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]"
>
    <section
        class="relative hidden min-h-screen overflow-hidden bg-primary px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14"
    >
        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.13),transparent_30%),radial-gradient(circle_at_90%_85%,rgba(255,255,255,0.08),transparent_32%)]"
        ></div>
        <div
            class="absolute -right-32 top-1/4 h-80 w-80 rounded-circle border border-white/10"
        ></div>
        <div
            class="absolute -right-20 top-1/3 h-52 w-52 rounded-circle border border-white/10"
        ></div>

        <div class="relative flex items-center gap-3">
            <div
                class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white"
            >
                <img
                    src={LoyolaCollegeLogo}
                    alt="Loyola College"
                    class="h-16 w-auto object-contain"
                />
            </div>
            <div>
                <p class="text-lg font-bold tracking-tight">Eat Right</p>
                <p
                    class="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55"
                >
                    Loyola College
                </p>
            </div>
        </div>

        <div class="relative max-w-xl pb-8">
            <p
                class="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-white/55"
            >
                Your campus food court
            </p>
            <h1
                class="max-w-lg text-5xl font-bold leading-[1.06] tracking-[-0.04em] xl:text-6xl"
            >
                Good food,<br />without the queue.
            </h1>
            <p class="mt-6 max-w-md text-base leading-7 text-white/65">
                Browse the day’s menu, order ahead, and pay directly from your
                campus wallet.
            </p>
        </div>

        <div class="relative flex items-center gap-3 text-sm text-white/60">
            <span>Designed by Rockfort Labs.</span>
        </div>
    </section>

    <section
        class="flex min-h-screen items-center justify-center px-5 py-[max(2rem,var(--safe-area-inset-top))] sm:px-10 lg:px-12"
    >
        <div class="w-full max-w-md">
            <div class="mb-3 flex items-center justify-between lg:hidden">
                <div class="flex items-center gap-3">
                    <img
                        src={LoyolaCollegeLogo}
                        alt="Loyola College"
                        class="h-30 w-auto object-contain"
                    />
                    <!-- <div class="h-7 w-px bg-line-strong"></div> -->
                    <!-- <span class="text-lg font-bold tracking-tight text-primary">
                        Eat Right
                    </span> -->
                </div>
            </div>

            <div class="mb-8">
                <p class="section-label mb-3">Welcome back</p>
                <h2
                    class="text-[2rem] font-bold leading-tight tracking-[-0.035em] text-ink sm:text-4xl"
                >
                    Sign in to <span class="text-primary">Eat Right.</span>
                </h2>
                <!-- <p class="mt-2.5 text-[15px] leading-6 text-ink-muted">
                    Use the same details you use for your campus food court account.
                </p> -->
            </div>

            <form
                class="flex flex-col gap-5"
                onsubmit={(event) => {
                    event.preventDefault();
                    if (!isLoginButtonDisabled && !isLoginLoading)
                        handleLogin();
                }}
            >
                <div class="flex flex-col gap-2">
                    <label
                        for="user-id"
                        class="pl-1 text-sm font-semibold text-ink"
                        >User ID</label
                    >
                    <input
                        type="text"
                        bind:value={userId}
                        placeholder="Department number, faculty or staff ID"
                        id="user-id"
                        autocomplete="username"
                        autocapitalize="characters"
                        required
                        class="field-input h-14 uppercase"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-3 px-1">
                        <label
                            for="password"
                            class="text-sm font-semibold text-ink"
                            >Password</label
                        >
                        <a
                            href="/forgot-password"
                            class="text-xs font-semibold text-primary hover:underline"
                            >Forgot password?</a
                        >
                    </div>
                    <div class="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            bind:value={password}
                            placeholder="Enter your password"
                            id="password"
                            autocomplete="current-password"
                            required
                            class="field-input h-14 pr-14"
                        />
                        <button
                            type="button"
                            onclick={() => (showPassword = !showPassword)}
                            class="absolute inset-y-0 right-1 flex w-12 items-center justify-center rounded-xl text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
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
                    class="btn-primary mt-1 h-14 w-full px-5 text-sm"
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
            </form>

            <div class="mt-8 flex items-center gap-3">
                <div class="h-px flex-1 bg-line"></div>
                <span class="text-xs font-medium text-ink-faint"
                    >New to Eat Right?</span
                >
                <div class="h-px flex-1 bg-line"></div>
            </div>

            <a href="/register" class="btn-quiet mt-5 h-13 w-full text-sm"
                >Create an account</a
            >
        </div>
    </section>
</main>
