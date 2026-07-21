<script lang="ts">
    import { onMount } from "svelte";
    import { ArrowLeftIcon } from "@untitled-theme/icons-svelte";
    import {
        CheckIcon,
        CopyIcon,
        EyeIcon,
        EyeOffIcon,
        InfoIcon,
        KeyRoundIcon,
        LogOutIcon,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";
    import {
        clearCachedEatRightProfile,
        getCachedEatRightProfile,
        type CachedEatRightProfile,
    } from "$lib/client/eatright-profile";
    import { clearPendingPayment } from "$lib/client/pending-payment";
    import { clearPendingOrderCheckout } from "$lib/client/pending-order-checkout";
    import { cart } from "$lib/stores/cart.svelte";
    import { goto } from "$app/navigation";
    import { normalizePersonName } from "$lib/utils/person-name";

    let profile = $state<CachedEatRightProfile | null>(null);
    let copiedUserId = $state(false);

    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let showCurrent = $state(false);
    let showNew = $state(false);
    let formError = $state("");
    let formMessage = $state("");
    let isUpdatingPassword = $state(false);

    onMount(() => {
        profile = getCachedEatRightProfile();
    });

    const displayName = $derived(
        normalizePersonName(profile?.name, {
            casing: "title",
            part: "full",
            includeHonorifics: true,
        }),
    );

    const initials = $derived.by(() => {
        if (!displayName) return "?";
        return displayName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("");
    });

    async function copyUserId() {
        if (!profile?.userid) return;
        try {
            await navigator.clipboard.writeText(profile.userid);
            copiedUserId = true;
            toast.success("User ID copied");
            setTimeout(() => (copiedUserId = false), 2000);
        } catch {
            toast.error("Unable to copy User ID");
        }
    }

    function validatePasswordForm(): string | null {
        if (!currentPassword) return "Enter your current password.";
        if (newPassword.length < 6) {
            return "New password must be at least 6 characters.";
        }
        if (newPassword.length > 128) {
            return "New password must be 128 characters or fewer.";
        }
        if (newPassword === currentPassword) {
            return "New password must be different from the current one.";
        }
        if (newPassword !== confirmPassword) {
            return "New passwords don't match.";
        }
        return null;
    }

    async function handleChangePassword(event: SubmitEvent) {
        event.preventDefault();
        if (isUpdatingPassword) return;

        formError = "";
        formMessage = "";

        const validationError = validatePasswordForm();
        if (validationError) {
            formError = validationError;
            return;
        }

        isUpdatingPassword = true;
        try {
            const response = await fetch("/api/v1/account/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = (await response.json().catch(() => null)) as {
                error?: string;
                message?: string;
            } | null;

            if (!response.ok) {
                formError = data?.error ?? "Unable to update your password.";
                return;
            }

            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
            showCurrent = false;
            showNew = false;
            formMessage = data?.message ?? "Password updated successfully.";
            toast.success(formMessage);
        } catch {
            formError =
                "Unable to update your password. Check your connection and try again.";
        } finally {
            isUpdatingPassword = false;
        }
    }

    let isSigningOut = $state(false);

    async function signOut() {
        if (isSigningOut) return;
        isSigningOut = true;
        try {
            await fetch("/api/v1/disconnect", { method: "POST" });
            clearPendingOrderCheckout(cart.userId);
            clearPendingPayment();
            cart.disconnect();
            clearCachedEatRightProfile();
            await goto("/login");
        } catch {
            toast.error("Unable to sign out. Please try again.");
            isSigningOut = false;
        }
    }
</script>

<div class="min-h-screen text-ink antialiased">
    <!-- Header -->
    <div class="page-header">
        <div
            class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto lg:max-w-lg"
        >
            <button
                onclick={() => history.back()}
                class="icon-btn"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-4 w-4" />
            </button>

            <div>
                <h1 class="text-lg font-bold tracking-tight text-ink">
                    Settings
                </h1>
                <p class="text-xs font-medium text-ink-muted">
                    Your account details
                </p>
            </div>
        </div>
    </div>

    <div class="px-4 pb-12 pt-4 max-w-md mx-auto space-y-5 lg:max-w-lg">
        <!-- Profile -->
        <section class="card overflow-hidden">
            <div class="flex items-center gap-4 px-5 pt-5 pb-4">
                <div
                    class="grid h-14 w-14 shrink-0 place-items-center rounded-circle bg-primary-soft text-lg font-bold text-primary"
                >
                    {initials}
                </div>
                <div class="min-w-0">
                    <h2
                        class="truncate text-lg font-bold tracking-tight text-ink"
                    >
                        {displayName || "--"}
                    </h2>
                    <p class="mt-0.5 text-xs font-medium text-ink-muted">
                        Eat Right account
                    </p>
                </div>
            </div>

            <div class="divide-y divide-line/70 border-t border-line">
                <div class="flex items-center gap-3 px-5 py-3.5">
                    <KeyRoundIcon size={16} class="shrink-0 text-ink-faint" />
                    <div class="min-w-0 flex-1">
                        <p class="section-label">User ID</p>
                        <p
                            class="mt-0.5 truncate font-mono text-sm font-semibold text-ink tracking-wider"
                        >
                            {profile?.userid || "--"}
                        </p>
                    </div>
                    {#if profile?.userid}
                        <button
                            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-muted transition-colors hover:text-primary"
                            onclick={copyUserId}
                            aria-label="Copy User ID"
                        >
                            {#if copiedUserId}
                                <CheckIcon
                                    size={14}
                                    strokeWidth={2.5}
                                    class="text-success"
                                />
                            {:else}
                                <CopyIcon size={14} />
                            {/if}
                        </button>
                    {/if}
                </div>
            </div>
        </section>

        <!-- Change Password -->
        <section class="card p-5">
            <h2 class="text-base font-bold tracking-tight text-ink">
                Change password
            </h2>
            <p class="mt-1 text-xs font-medium text-ink-muted">
                Use at least 6 characters. You'll sign in with the new password
                next time.
            </p>

            <form
                class="mt-5 flex flex-col gap-4"
                onsubmit={handleChangePassword}
            >
                <div class="flex flex-col gap-1.5">
                    <label
                        for="current-password"
                        class="pl-1 text-sm font-medium text-ink-muted"
                    >
                        Current password
                    </label>
                    <div class="relative">
                        <input
                            id="current-password"
                            type={showCurrent ? "text" : "password"}
                            bind:value={currentPassword}
                            placeholder="Enter your current password"
                            autocomplete="current-password"
                            class="field-input pr-12"
                            disabled={isUpdatingPassword}
                        />
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink"
                            onclick={() => (showCurrent = !showCurrent)}
                            aria-label={showCurrent
                                ? "Hide current password"
                                : "Show current password"}
                        >
                            {#if showCurrent}
                                <EyeOffIcon size={16} />
                            {:else}
                                <EyeIcon size={16} />
                            {/if}
                        </button>
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label
                        for="new-password"
                        class="pl-1 text-sm font-medium text-ink-muted"
                    >
                        New password
                    </label>
                    <div class="relative">
                        <input
                            id="new-password"
                            type={showNew ? "text" : "password"}
                            bind:value={newPassword}
                            placeholder="At least 6 characters"
                            autocomplete="new-password"
                            maxlength={128}
                            class="field-input pr-12"
                            disabled={isUpdatingPassword}
                        />
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink"
                            onclick={() => (showNew = !showNew)}
                            aria-label={showNew
                                ? "Hide new password"
                                : "Show new password"}
                        >
                            {#if showNew}
                                <EyeOffIcon size={16} />
                            {:else}
                                <EyeIcon size={16} />
                            {/if}
                        </button>
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label
                        for="confirm-password"
                        class="pl-1 text-sm font-medium text-ink-muted"
                    >
                        Confirm new password
                    </label>
                    <input
                        id="confirm-password"
                        type={showNew ? "text" : "password"}
                        bind:value={confirmPassword}
                        placeholder="Re-enter the new password"
                        autocomplete="new-password"
                        maxlength={128}
                        class="field-input"
                        disabled={isUpdatingPassword}
                    />
                </div>

                {#if formError}
                    <div
                        class="rounded-xl border border-danger/10 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                    >
                        {formError}
                    </div>
                {/if}

                {#if formMessage}
                    <div
                        class="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-primary-soft px-4 py-3 text-sm font-medium text-primary"
                    >
                        <InfoIcon size={16} class="mt-0.5 shrink-0" />
                        <span>{formMessage}</span>
                    </div>
                {/if}

                <button
                    type="submit"
                    class="btn-primary mt-1 h-12 text-sm"
                    disabled={isUpdatingPassword}
                >
                    {isUpdatingPassword
                        ? "Updating password..."
                        : "Update password"}
                </button>
            </form>
        </section>

        <!-- Sign out -->
        <section class="card flex flex-col gap-4 p-5">
            <div class="min-w-0">
                <h2 class="text-base font-bold tracking-tight text-ink">
                    Sign out
                </h2>
                <p class="mt-1 text-xs font-medium text-ink-muted">
                    You'll need your User ID and password to sign in back to Eat
                    Right.
                </p>
            </div>
            <button
                class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-danger/15 bg-danger-soft px-4 text-sm font-semibold text-danger transition-all hover:bg-danger hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45"
                onclick={signOut}
                disabled={isSigningOut}
            >
                <LogOutIcon size={16} />
                {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
        </section>
    </div>
</div>
