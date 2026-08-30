<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { clearCachedEatRightProfile } from "$lib/client/eatright-profile";
    import LoyolaCollegeLogo from "$lib/assets/logos/loyola-logo.webp";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import {
        ArrowRightIcon,
        EyeIcon,
        EyeOffIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";

    let showPassword = $state(false);
    let redirectTo = $derived(page.url.searchParams.get("redirect") ?? "");

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

        await goto(redirectTo || res.redirectUrl);
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
    <!--
      Desktop brand panel. Flat black with a single accent rule and a hard
      grid — no radial gradients or blurred rings, which are the exact devices
      NeoPop replaces with geometry.
    -->
    <section
        class="relative hidden min-h-screen overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14"
    >
        <div
            class="pointer-events-none absolute inset-0 opacity-[0.07]"
            style="background-image:linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px);background-size:48px 48px"
        ></div>

        <div class="relative flex items-center gap-3">
            <div class="flex h-14 w-14 items-center justify-center bg-white">
                <img
                    src={LoyolaCollegeLogo}
                    alt="Loyola College"
                    class="h-12 w-auto object-contain"
                />
            </div>
            <div>
                <p class="text-sm font-extrabold tracking-tight">Eat Right</p>
                <p
                    class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50"
                >
                    Loyola College
                </p>
            </div>
        </div>

        <div class="relative max-w-xl pb-8">
            <p
                class="mb-6 text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/50"
            >
                Your campus food court
            </p>
            <h1
                class="max-w-lg text-5xl font-extrabold leading-[1.04] tracking-[-0.04em] xl:text-6xl"
            >
                Good food,<br />without <span class="text-accent">the queue.</span>
            </h1>
            <p class="mt-7 max-w-md text-base leading-7 text-white/60">
                Browse the day’s menu, order ahead, and pay directly from your
                campus wallet.
            </p>
            <div class="mt-8 h-1 w-24 bg-accent"></div>
        </div>

        <div
            class="relative flex items-center gap-2.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/50"
        >
            <ShieldCheckIcon size="16" strokeWidth="2.4" />
            <span>Secure access through your Eat Right account</span>
        </div>
    </section>

    <section
        class="flex min-h-screen items-center justify-center px-5 py-[max(2rem,var(--safe-area-inset-top))] sm:px-10 lg:px-12"
    >
        <div class="w-full max-w-md">
            <div class="mb-10 flex items-center justify-between lg:hidden">
                <div class="flex items-center gap-3">
                    <img
                        src={LoyolaCollegeLogo}
                        alt="Loyola College"
                        class="h-14 w-auto object-contain"
                    />
                    <div class="h-8 w-px bg-line"></div>
                    <span
                        class="text-lg font-extrabold tracking-tight text-ink"
                    >
                        Eat Right
                    </span>
                </div>
            </div>

            <div class="mb-9">
                <p class="section-label mb-3">Welcome back</p>
                <h2
                    class="text-[2rem] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-4xl"
                >
                    Sign in to Eat Right
                </h2>
                <p class="mt-3 text-[15px] leading-6 text-ink-muted">
                    Use the same details you use for your campus food court
                    account.
                </p>
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
                    <label for="user-id" class="section-label text-ink"
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
                    <label for="password" class="section-label text-ink"
                        >Password</label
                    >
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
                            class="absolute inset-y-0 right-0 flex w-13 items-center justify-center border-l border-line text-ink-muted transition-colors active:bg-ink active:text-white"
                            aria-label={showPassword
                                ? "Hide password"
                                : "Show password"}
                        >
                            {#if showPassword}
                                <EyeOffIcon size="18" strokeWidth="2.2" />
                            {:else}
                                <EyeIcon size="18" strokeWidth="2.2" />
                            {/if}
                        </button>
                    </div>
                </div>

                {#if error}
                    <div
                        role="alert"
                        class="border-l-3 border-danger bg-danger-soft px-4 py-3.5 text-[13px] font-bold leading-5 text-danger"
                    >
                        {error}
                    </div>
                {/if}

                <!-- Commit action: paccha owns the action that completes the task. -->
                <button
                    type="submit"
                    class="np-elevate mt-1 block w-full cursor-pointer border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40"
                    style="--np-face:var(--color-accent);--np-ink:var(--color-ink);--np-edge-right:var(--color-accent-edge);--np-edge-bottom:var(--color-accent-deep)"
                    disabled={isLoginButtonDisabled || isLoginLoading}
                >
                    <span
                        class="np-face flex h-14 items-center justify-center gap-2.5 text-sm font-extrabold uppercase tracking-[0.14em]"
                    >
                        {#if isLoginLoading}
                            <Spinner />
                        {/if}
                        <span>{isLoginLoading ? "Signing in" : "Sign in"}</span>
                        {#if !isLoginLoading}
                            <ArrowRightIcon size="17" strokeWidth="2.6" />
                        {/if}
                    </span>
                </button>
            </form>

            <div class="mt-9 flex items-center gap-4">
                <div class="h-px flex-1 bg-hairline"></div>
                <span class="section-label">New to Eat Right?</span>
                <div class="h-px flex-1 bg-hairline"></div>
            </div>

            <a
                href="/register"
                class="np-elevate mt-5 block w-full"
                style="--np-face:var(--color-surface);--np-ink:var(--color-ink);--np-edge-right:var(--color-np-white-50);--np-edge-bottom:var(--color-np-black-50)"
            >
                <span
                    class="np-face flex h-14 items-center justify-center border border-line text-sm font-extrabold uppercase tracking-[0.14em]"
                >
                    Create an account
                </span>
            </a>
        </div>
    </section>
</main>
