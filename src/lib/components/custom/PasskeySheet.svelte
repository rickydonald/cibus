<script lang="ts">
    import { onMount, tick } from "svelte";
    import { Sheet } from "@ricky-donald/hades";
    import { flip } from "svelte/animate";
    import { fade, fly } from "svelte/transition";
    import { cubicOut, quintOut } from "svelte/easing";
    import { prefersReducedMotion } from "svelte/motion";
    import {
        ArrowLeftIcon,
        CheckIcon,
        FingerprintPatternIcon,
        KeyRoundIcon,
        PlusIcon,
        RefreshCwIcon,
        TriangleAlertIcon,
        Trash2Icon,
        XIcon,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
    import {
        MAX_PASSKEYS_PER_ACCOUNT,
        PasskeyApiError,
        formatPasskeyDate,
        formatPasskeyDateCompact,
        getPasskeyErrorMessage,
        listPasskeys,
        registerPasskey,
        revokePasskey,
        supportsPasskeys,
        type PasskeySummary,
    } from "$lib/client/passkeys";

    let {
        open = $bindable(false),
        isGuestAccount = false,
    }: {
        open?: boolean;
        isGuestAccount?: boolean;
    } = $props();

    let passkeys = $state<PasskeySummary[]>([]);
    let passkeysSupported = $state(false);
    let isLoading = $state(false);
    let hasLoaded = $state(false);
    let loadError = $state("");

    /**
     * The sheet is a two-step stack rather than one screen that grows panels.
     * Setup replaces the list instead of being wedged above the footer, which
     * is what used to resize the sheet — and drag its title — mid-interaction.
     */
    let step = $state<"list" | "add">("list");
    /** 1 pushes the new step in from the right, -1 pops it back from the left. */
    let stepDirection = $state<1 | -1>(1);

    let passkeyName = $state("My device");
    let registrationPassword = $state("");
    let registrationError = $state("");
    let isRegistering = $state(false);

    let passkeyToRevoke = $state<PasskeySummary | null>(null);
    let revokePassword = $state("");
    let revokeError = $state("");
    let isRevoking = $state(false);

    /** Briefly marks the row that just appeared so the eye lands on the change. */
    let justAddedId = $state<string | null>(null);
    let justAddedTimer: ReturnType<typeof setTimeout> | undefined;

    const isBusy = $derived(isRegistering || isRevoking);
    const mutationDisabled = $derived(isLoading || isBusy);
    const showSkeleton = $derived(isLoading && !hasLoaded && !loadError);
    /**
     * Only gate on a list we actually have. Treating an unloaded list as "at
     * the limit" would disable setup for someone whose list request failed.
     */
    const atPasskeyLimit = $derived(
        hasLoaded && passkeys.length >= MAX_PASSKEYS_PER_ACCOUNT,
    );
    const canAddPasskey = $derived(
        passkeysSupported && !showSkeleton && !atPasskeyLimit,
    );

    let refreshRequestId = 0;
    /**
     * A refresh that collides with a mutation must not clobber the optimistic
     * result, but dropping it outright leaves the sheet claiming the account has
     * no passkeys. Remember it instead and reconcile once the mutation settles.
     */
    let refreshQueued = false;
    let passkeyNameInput = $state<HTMLInputElement | null>(null);
    let revokePasswordInput = $state<HTMLInputElement | null>(null);
    let addPasskeyButton = $state<HTMLButtonElement | null>(null);
    let savedPasskeysHeading = $state<HTMLHeadingElement | null>(null);
    let revokeReturnFocus: HTMLElement | null = null;

    /*
     * Motion
     *
     * The sheet chrome itself already carries a velocity-projected drag and a
     * long iOS-style settle. Everything that animates *inside* it borrows the
     * same curve so the two read as one movement. `quintOut` is the closest
     * built-in to the sheet's cubic-bezier(0.32, 0.72, 0, 1); exits use the
     * shorter `cubicOut` so leaving never feels slower than arriving.
     */
    const ENTER_MS = 340;
    const EXIT_MS = 220;
    const STEP_MS = 300;
    const STAGGER_MS = 45;
    /** Beyond this the stagger stops reading as cascade and starts as lag. */
    const MAX_STAGGERED_ROWS = 6;

    const reduced = $derived(prefersReducedMotion.current);

    function rowDelay(index: number): number {
        if (reduced) return 0;
        return Math.min(index, MAX_STAGGERED_ROWS) * STAGGER_MS;
    }

    /**
     * Height-and-fade for panels that push their siblings. Reduced motion keeps
     * the information change but drops the vestibular part, so the panel simply
     * cross-fades in place.
     */
    function collapse(
        node: HTMLElement,
        { duration = ENTER_MS, delay = 0 }: { duration?: number; delay?: number } = {},
    ) {
        if (reduced) {
            return { duration: 140, delay, css: (t: number) => `opacity:${t}` };
        }

        const style = getComputedStyle(node);
        const height = Number.parseFloat(style.height) || 0;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const marginTop = Number.parseFloat(style.marginTop) || 0;
        const marginBottom = Number.parseFloat(style.marginBottom) || 0;

        return {
            duration,
            delay,
            easing: duration <= EXIT_MS ? cubicOut : quintOut,
            css: (t: number) =>
                `overflow:hidden;` +
                `height:${t * height}px;` +
                `padding-top:${t * paddingTop}px;` +
                `padding-bottom:${t * paddingBottom}px;` +
                `margin-top:${t * marginTop}px;` +
                `margin-bottom:${t * marginBottom}px;` +
                // Opacity leads the height so content is legible before the
                // box has finished making room for it.
                `opacity:${Math.min(1, t * 1.9)};`,
        };
    }

    /** Removal reads as the row being taken away, not just hidden. */
    function dismissRow(node: HTMLElement) {
        const shrink = collapse(node, { duration: reduced ? 140 : EXIT_MS });
        if (reduced) return shrink;
        return {
            ...shrink,
            css: (t: number, u: number) =>
                `${shrink.css(t)}transform:translateX(${u * 14}px) scale(${0.97 + t * 0.03});`,
        };
    }

    const flipConfig = $derived(
        reduced ? { duration: 0 } : { duration: 380, easing: quintOut },
    );

    /**
     * A short double tap on commit. Kept under reduced motion — touch is a
     * separate sense, not motion — and only fired for outcomes worth feeling.
     */
    function haptic(pattern: number | number[]) {
        try {
            navigator.vibrate?.(pattern);
        } catch {
            // Vibration is unsupported or blocked by policy.
        }
    }

    onMount(() => {
        passkeysSupported = supportsPasskeys();
        return () => clearTimeout(justAddedTimer);
    });

    function markJustAdded(id: string) {
        clearTimeout(justAddedTimer);
        justAddedId = id;
        justAddedTimer = setTimeout(() => (justAddedId = null), 1600);
    }

    async function redirectIfSessionExpired(error: unknown): Promise<boolean> {
        return error instanceof PasskeyApiError
            ? redirectIfEatRightConnectRequired(error.errorCode)
            : false;
    }

    async function refreshPasskeys() {
        // Starting a mutation before the list has loaded must not cost the load
        // itself — the sheet would then claim the account has no passkeys.
        if (isBusy) {
            refreshQueued = true;
            return;
        }
        if (isLoading) return;

        const requestId = ++refreshRequestId;
        refreshQueued = false;
        isLoading = true;
        loadError = "";
        try {
            const refreshedPasskeys = await listPasskeys();
            if (requestId !== refreshRequestId) return;
            if (isBusy) {
                refreshQueued = true;
                return;
            }

            passkeys = refreshedPasskeys;
            hasLoaded = true;
        } catch (error) {
            if (requestId !== refreshRequestId) return;
            if (await redirectIfSessionExpired(error)) return;
            if (requestId !== refreshRequestId) return;
            loadError = getPasskeyErrorMessage(error, "list");
        } finally {
            if (requestId === refreshRequestId) isLoading = false;
        }
    }

    function resetSensitiveFields() {
        refreshRequestId += 1;
        refreshQueued = false;
        isLoading = false;
        registrationPassword = "";
        revokePassword = "";
        registrationError = "";
        revokeError = "";
        step = "list";
        stepDirection = 1;
        passkeyToRevoke = null;
        revokeReturnFocus = null;
        clearTimeout(justAddedTimer);
        justAddedId = null;
    }

    function activeElement(): HTMLElement | null {
        return document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    }

    function focusStableControl(preferred: HTMLElement | null = null) {
        if (preferred?.isConnected && !preferred.matches(":disabled")) {
            preferred.focus();
            return;
        }
        if (addPasskeyButton?.isConnected && !addPasskeyButton.disabled) {
            addPasskeyButton.focus();
            return;
        }
        savedPasskeysHeading?.focus();
    }

    async function beginRegistration() {
        if (mutationDisabled || atPasskeyLimit) return;

        revokeReturnFocus = null;
        passkeyToRevoke = null;
        revokePassword = "";
        revokeError = "";
        registrationError = "";
        passkeyName = "My device";
        stepDirection = 1;
        step = "add";
        await tick();
        passkeyNameInput?.focus();
        passkeyNameInput?.select();
    }

    async function cancelRegistration() {
        if (isRegistering) return;

        registrationPassword = "";
        registrationError = "";
        stepDirection = -1;
        step = "list";
        await tick();
        focusStableControl();
    }

    async function beginRevoke(passkey: PasskeySummary) {
        if (mutationDisabled) return;

        revokeReturnFocus = activeElement();
        registrationPassword = "";
        registrationError = "";
        passkeyToRevoke = passkey;
        revokePassword = "";
        revokeError = "";
        await tick();
        revokePasswordInput?.focus();
    }

    async function cancelRevoke() {
        if (isRevoking) return;

        const returnFocus = revokeReturnFocus;
        revokePassword = "";
        revokeError = "";
        passkeyToRevoke = null;
        revokeReturnFocus = null;
        await tick();
        focusStableControl(returnFocus);
    }

    async function handleRegistration(event: SubmitEvent) {
        event.preventDefault();
        if (mutationDisabled) return;

        registrationError = "";
        const name = passkeyName.trim();
        if (!name) {
            registrationError = "Give this passkey a name so you can recognise it later.";
            return;
        }
        if (name.length > 64) {
            registrationError = "Passkey names must be 64 characters or fewer.";
            return;
        }
        if (!registrationPassword) {
            registrationError = "Enter your current password to confirm it's you.";
            return;
        }

        let succeeded = false;
        isRegistering = true;
        try {
            const request = registerPasskey({
                currentPassword: registrationPassword,
                name,
            });
            registrationPassword = "";
            const passkey = await request;
            passkeys = [
                passkey,
                ...passkeys.filter((item) => item.id !== passkey.id),
            ];
            stepDirection = -1;
            step = "list";
            succeeded = true;
            markJustAdded(passkey.id);
            haptic([12, 44, 20]);
            toast.success("Passkey added — you can use it the next time you sign in");
        } catch (error) {
            if (await redirectIfSessionExpired(error)) return;
            registrationError = getPasskeyErrorMessage(error, "register");
        } finally {
            registrationPassword = "";
            isRegistering = false;
            if (succeeded) {
                await tick();
                focusStableControl();
            }
            if (refreshQueued) void refreshPasskeys();
        }
    }

    async function handleRevoke(event: SubmitEvent) {
        event.preventDefault();
        if (mutationDisabled || !passkeyToRevoke) return;

        revokeError = "";
        if (!revokePassword) {
            revokeError = "Enter your current password to remove this passkey.";
            return;
        }

        const selected = passkeyToRevoke;
        let succeeded = false;
        isRevoking = true;
        try {
            const request = revokePasskey({
                credentialId: selected.id,
                currentPassword: revokePassword,
            });
            revokePassword = "";
            await request;
            passkeys = passkeys.filter((passkey) => passkey.id !== selected.id);
            passkeyToRevoke = null;
            revokeReturnFocus = null;
            succeeded = true;
            haptic(18);
            toast.success(`${selected.name} removed`);
        } catch (error) {
            if (await redirectIfSessionExpired(error)) return;
            revokeError = getPasskeyErrorMessage(error, "revoke");
        } finally {
            revokePassword = "";
            isRevoking = false;
            if (succeeded) {
                await tick();
                focusStableControl();
            }
            if (refreshQueued) void refreshPasskeys();
        }
    }

    const passkeyCountLabel = $derived(
        passkeys.length === 0
            ? "No passkeys yet"
            : `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"} active`,
    );

    /*
     * The two steps share one grid cell, so running both halves at once puts
     * two dense screens on top of each other and the midpoint reads as muddy.
     * The outgoing screen leaves first and the incoming one follows it in —
     * sequential, so there is never a frame with both fully visible.
     */
    const stepEnter = $derived({
        x: reduced ? 0 : 22 * stepDirection,
        duration: reduced ? 160 : STEP_MS,
        delay: reduced ? 90 : 130,
        easing: quintOut,
        opacity: 0,
    });
    const stepExit = $derived({
        x: reduced ? 0 : -18 * stepDirection,
        duration: reduced ? 90 : 150,
        easing: cubicOut,
        opacity: 0,
    });
</script>

<Sheet
    bind:open
    title="Passkeys"
    showClose
    maxHeight="auto" 
    dismissible={!isBusy}
    onopen={refreshPasskeys}
    onclose={resetSensitiveFields}
    style="--hades-padding-top: 20px"
>
    <div class="no-scrollbar px-2">
        <div class="steps">
            {#if step === "list"}
                <div class="step" in:fly={stepEnter} out:fly={stepExit}>
                    <div class="flex flex-col gap-4 pb-1">
                        <div
                            class="assurance flex items-center gap-3.5 rounded-3xl border border-line bg-canvas px-4 py-3.5"
                        >
                            <span
                                class="chip grid h-11 w-11 shrink-0 place-items-center rounded-circle bg-primary-soft text-primary-ink"
                            >
                                <FingerprintPatternIcon size={21} strokeWidth={1.9} />
                            </span>
                            <!--
                                Leads with the thing that changes and backs it
                                with the thing people want reassurance about,
                                rather than two reassurances.
                            -->
                            <div class="min-w-0">
                                <p
                                    class="text-[13px] font-bold leading-5 tracking-tight text-ink"
                                    aria-live="polite"
                                >
                                    {hasLoaded ? passkeyCountLabel : "Faster, safer sign-in"}
                                </p>
                                <p
                                    class="mt-0.5 text-[11.5px] font-medium leading-4 text-ink-muted"
                                >
                                    Your biometrics never leave this device
                                </p>
                            </div>
                        </div>

                        {#if showSkeleton}
                            <section aria-busy="true" aria-live="polite">
                                <div class="flex items-center gap-2 px-1 pb-2">
                                    <h3 class="section-label">Your passkey</h3>
                                </div>
                                <div
                                    class="overflow-hidden rounded-3xl border border-line bg-surface"
                                >
                                    {#each [0, 1, 2] as row (row)}
                                        <div
                                            class="flex items-center gap-3 px-4 py-3.5 {row > 0
                                                ? 'border-t border-line'
                                                : ''}"
                                            style="--skeleton-delay: {row * 130}ms"
                                        >
                                            <span
                                                class="skeleton h-10 w-10 shrink-0 rounded-xl"
                                            ></span>
                                            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                                                <span
                                                    class="skeleton h-3 rounded-circle"
                                                    style="width: {58 - row * 12}%"
                                                ></span>
                                                <span
                                                    class="skeleton h-2.5 rounded-circle"
                                                    style="width: {40 - row * 6}%"
                                                ></span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                                <span class="sr-only">Loading your passkeys…</span>
                            </section>
                        {:else if loadError && !hasLoaded}
                            <div
                                role="alert"
                                class="flex flex-col items-center gap-3 rounded-3xl border border-danger/15 bg-danger-soft px-5 py-6 text-center"
                            >
                                <span
                                    class="grid h-11 w-11 place-items-center rounded-circle bg-danger/10 text-danger"
                                >
                                    <TriangleAlertIcon size={20} />
                                </span>
                                <p class="text-[13px] font-medium leading-5 text-danger">
                                    {loadError}
                                </p>
                                <button
                                    type="button"
                                    class="btn-quiet h-10 px-4 text-xs"
                                    onclick={refreshPasskeys}
                                    disabled={mutationDisabled}
                                >
                                    <RefreshCwIcon size={15} />
                                    Try again
                                </button>
                            </div>
                        {:else}
                            {#if loadError}
                                <div
                                    role="alert"
                                    class="flex items-center justify-between gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3"
                                    transition:collapse
                                >
                                    <p class="text-xs font-semibold leading-5 text-ink">
                                        {loadError}
                                    </p>
                                    <button
                                        type="button"
                                        class="shrink-0 text-xs font-bold text-warning transition-colors hover:text-ink"
                                        onclick={refreshPasskeys}
                                        disabled={mutationDisabled}
                                    >
                                        Retry
                                    </button>
                                </div>
                            {/if}

                            {#if !passkeysSupported}
                                <div
                                    class="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3.5"
                                >
                                    <TriangleAlertIcon
                                        size={17}
                                        class="mt-0.5 shrink-0 text-warning"
                                    />
                                    <p class="text-[12.5px] font-semibold leading-5 text-ink">
                                        This browser can't create passkeys. Open Eat Right
                                        in an up-to-date Safari, Chrome, Edge, or Firefox
                                        browser to add one. You can still remove saved
                                        passkeys here.
                                    </p>
                                </div>
                            {/if}

                            <section aria-labelledby="saved-passkeys-heading">
                                <div class="flex items-center justify-between gap-3 px-1 pb-2">
                                    <h3
                                        id="saved-passkeys-heading"
                                        class="section-label"
                                        tabindex="-1"
                                        bind:this={savedPasskeysHeading}
                                    >
                                        Your passkey
                                    </h3>
                                    {#if isLoading}
                                        <span
                                            class="flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint"
                                            aria-live="polite"
                                            transition:fade={{ duration: 150 }}
                                        >
                                            <Spinner size={13} /> Refreshing
                                        </span>
                                    {/if}
                                </div>

                                {#if passkeys.length === 0}
                                    <div
                                        class="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-canvas px-6 py-9 text-center"
                                    >
                                        <span
                                            class="empty-chip grid h-12 w-12 place-items-center rounded-circle bg-primary-soft text-primary-ink"
                                        >
                                            <KeyRoundIcon size={21} />
                                        </span>
                                        <h4
                                            class="mt-3.5 text-sm font-bold tracking-tight text-ink"
                                        >
                                            No passkeys yet
                                        </h4>
                                        <p
                                            class="mt-1.5 max-w-64 text-xs font-medium leading-5 text-ink-muted"
                                        >
                                            Add one for a faster sign-in without typing your
                                            user ID or password.
                                        </p>
                                    </div>
                                {:else}
                                    <div
                                        class="overflow-hidden rounded-3xl border border-line bg-surface"
                                    >
                                        {#each passkeys as passkey, index (passkey.id)}
                                            {@const addedDate = formatPasskeyDateCompact(
                                                passkey.createdAt,
                                            )}
                                            {@const lastUsedDate = formatPasskeyDateCompact(
                                                passkey.lastUsedAt,
                                            )}
                                            {@const exactDate = formatPasskeyDate(
                                                passkey.lastUsedAt ?? passkey.createdAt,
                                            )}
                                            {@const confirming =
                                                passkeyToRevoke?.id === passkey.id}
                                            <div
                                                class="row-group"
                                                class:is-new={justAddedId === passkey.id}
                                                class:is-confirming={confirming}
                                                animate:flip={flipConfig}
                                                in:fly|global={{
                                                    y: reduced ? 0 : 12,
                                                    duration: reduced ? 160 : ENTER_MS,
                                                    delay: rowDelay(index),
                                                    easing: quintOut,
                                                }}
                                                out:dismissRow
                                            >
                                                <div
                                                    class="flex items-center gap-3 px-4 py-3.5 {index >
                                                    0
                                                        ? 'border-t border-line'
                                                        : ''}"
                                                >
                                                    <span class="row-chip">
                                                        {#if confirming}
                                                            <Trash2Icon size={17} />
                                                        {:else}
                                                            <KeyRoundIcon size={18} />
                                                        {/if}
                                                    </span>
                                                    <!--
                                                        The name owns the full width; sync
                                                        state and date share the line
                                                        beneath. Badges beside the name
                                                        truncated exactly the string people
                                                        identify a key by.
                                                    -->
                                                    <div class="min-w-0 flex-1">
                                                        <h4
                                                            class="truncate text-sm font-bold tracking-tight text-ink"
                                                        >
                                                            {passkey.name}
                                                        </h4>
                                                        <p
                                                            class="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-muted"
                                                        >
                                                            {#if passkey.backupEligible && passkey.backupState}
                                                                <span
                                                                    class="flex shrink-0 items-center gap-1 rounded-circle bg-success-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success"
                                                                    title="This passkey is backed up by your passkey provider"
                                                                >
                                                                    <CheckIcon
                                                                        size={9}
                                                                        strokeWidth={3}
                                                                    /> Synced
                                                                </span>
                                                            {:else}
                                                                <span
                                                                    class="shrink-0"
                                                                    title="This passkey only works on the device that created it"
                                                                >
                                                                    This device
                                                                </span>
                                                            {/if}
                                                            <span
                                                                class="shrink-0 text-line-strong"
                                                                >·</span
                                                            >
                                                            <span
                                                                class="truncate"
                                                                title={exactDate ?? undefined}
                                                            >
                                                                {#if lastUsedDate}
                                                                    Used {lastUsedDate}
                                                                {:else if addedDate}
                                                                    Added {addedDate}
                                                                {:else}
                                                                    Ready to use
                                                                {/if}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        class="row-action grid h-9 w-9 shrink-0 place-items-center rounded-circle text-ink-faint"
                                                        onclick={() =>
                                                            confirming
                                                                ? cancelRevoke()
                                                                : beginRevoke(passkey)}
                                                        disabled={mutationDisabled &&
                                                            !confirming}
                                                        aria-expanded={confirming}
                                                        aria-label={confirming
                                                            ? `Keep ${passkey.name}`
                                                            : `Remove ${passkey.name}`}
                                                    >
                                                        {#if confirming}
                                                            <XIcon size={17} />
                                                        {:else}
                                                            <Trash2Icon size={16} />
                                                        {/if}
                                                    </button>
                                                </div>

                                                <!--
                                                    Confirmation lives inside the row it
                                                    acts on. A panel further down the sheet
                                                    would make the user re-check which
                                                    passkey they picked.
                                                -->
                                                {#if confirming}
                                                    <form
                                                        class="flex flex-col gap-3 border-t border-danger/15 bg-danger-soft px-4 py-4"
                                                        onsubmit={handleRevoke}
                                                        transition:collapse
                                                    >
                                                        <p
                                                            class="text-xs font-medium leading-5 text-ink-muted"
                                                        >
                                                            <span
                                                                class="font-bold text-danger"
                                                                >Remove this passkey?</span
                                                            >
                                                            It stops working immediately and
                                                            your password takes over. You can
                                                            set up a new one straight after.
                                                        </p>

                                                        <div class="flex flex-col gap-1.5">
                                                            <label
                                                                for="revoke-passkey-password"
                                                                class="pl-1 text-[11px] font-semibold text-ink-muted"
                                                            >
                                                                Current password
                                                            </label>
                                                            <input
                                                                id="revoke-passkey-password"
                                                                type="password"
                                                                bind:value={revokePassword}
                                                                placeholder={isGuestAccount
                                                                    ? "Last 4 digits of your mobile number"
                                                                    : "Enter your current password"}
                                                                autocomplete="current-password"
                                                                class="field-input"
                                                                disabled={isLoading ||
                                                                    isRevoking}
                                                                bind:this={revokePasswordInput}
                                                                required
                                                            />
                                                        </div>

                                                        {#if revokeError}
                                                            <p
                                                                role="alert"
                                                                class="text-xs font-semibold leading-5 text-danger"
                                                                transition:collapse={{
                                                                    duration: EXIT_MS,
                                                                }}
                                                            >
                                                                {revokeError}
                                                            </p>
                                                        {/if}

                                                        <div class="grid grid-cols-2 gap-2">
                                                            <button
                                                                type="button"
                                                                class="btn-quiet h-11 text-xs"
                                                                onclick={cancelRevoke}
                                                                disabled={isRevoking}
                                                            >
                                                                Keep it
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                class="btn-danger h-11 text-xs"
                                                                disabled={isLoading ||
                                                                    isRevoking}
                                                            >
                                                                {#if isRevoking}
                                                                    <Spinner size={15} /> Removing…
                                                                {:else}
                                                                    Remove
                                                                {/if}
                                                            </button>
                                                        </div>
                                                    </form>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}

                                <!--
                                    The footer action is disabled at the limit,
                                    so say why and say what to do instead — a
                                    dead control with no explanation is a
                                    dead end.
                                -->
                                {#if atPasskeyLimit}
                                    <p
                                        class="mt-2.5 px-1 text-[11.5px] font-medium leading-4 text-ink-faint"
                                        transition:collapse={{ duration: EXIT_MS }}
                                    >
                                        Your account can have one passkey. Remove this one
                                        to set up a different device.
                                    </p>
                                {/if}
                            </section>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="step" in:fly={stepEnter} out:fly={stepExit}>
                    <form
                        id="passkey-add-form"
                        class="flex flex-col gap-4 pb-1"
                        onsubmit={handleRegistration}
                    >
                        <!--
                            Setup is its own step with its own back control, so
                            the sheet's own title never has to change and the
                            two screens stay the same size.
                        -->
                        <div class="flex items-start gap-3">
                            <button
                                type="button"
                                class="icon-btn h-9 w-9"
                                onclick={cancelRegistration}
                                disabled={isRegistering}
                                aria-label="Back to saved passkeys"
                            >
                                <ArrowLeftIcon size={17} />
                            </button>
                            <div class="min-w-0 flex-1 pt-0.5">
                                <h3 class="text-[15px] font-bold tracking-tight text-ink">
                                    Add a passkey
                                </h3>
                                <p class="mt-1 text-xs font-medium leading-5 text-ink-muted">
                                    Name it so you can recognise it later, then confirm
                                    your password.
                                </p>
                            </div>
                        </div>

                        {#if isRegistering}
                            <div
                                class="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-canvas px-6 py-10 text-center"
                                in:fade={{ duration: 200, delay: 80 }}
                            >
                                <span class="pulse grid h-16 w-16 place-items-center">
                                    <FingerprintPatternIcon
                                        size={28}
                                        strokeWidth={1.8}
                                        class="text-primary-ink"
                                    />
                                </span>
                                <p class="text-sm font-bold tracking-tight text-ink">
                                    Follow your device's prompt
                                </p>
                                <p
                                    class="max-w-60 text-xs font-medium leading-5 text-ink-muted"
                                >
                                    Approve with your fingerprint, face, or PIN to finish
                                    setting up “{passkeyName.trim() || "this passkey"}”.
                                </p>
                            </div>
                        {:else}
                            <!--
                                No exit transition: the fields and the waiting
                                panel would otherwise occupy the step at the same
                                time and its scroll extent would lurch.
                            -->
                            <div class="flex flex-col gap-3.5">
                                <div class="flex flex-col gap-1.5">
                                    <label
                                        for="passkey-name"
                                        class="pl-1 text-[11px] font-semibold text-ink-muted"
                                    >
                                        Passkey name
                                    </label>
                                    <input
                                        id="passkey-name"
                                        type="text"
                                        bind:value={passkeyName}
                                        placeholder="e.g. My iPhone"
                                        autocomplete="off"
                                        maxlength={64}
                                        class="field-input"
                                        disabled={isLoading || isRegistering}
                                        bind:this={passkeyNameInput}
                                        required
                                    />
                                </div>

                                <div class="flex flex-col gap-1.5">
                                    <label
                                        for="register-passkey-password"
                                        class="pl-1 text-[11px] font-semibold text-ink-muted"
                                    >
                                        Current password
                                    </label>
                                    <input
                                        id="register-passkey-password"
                                        type="password"
                                        bind:value={registrationPassword}
                                        placeholder={isGuestAccount
                                            ? "Last 4 digits of your mobile number"
                                            : "Enter your current password"}
                                        autocomplete="current-password"
                                        class="field-input"
                                        disabled={isLoading || isRegistering}
                                        required
                                    />
                                    <p
                                        class="pl-1 text-[11px] font-medium leading-4 text-ink-faint"
                                    >
                                        Confirms it's really you before a new key is
                                        trusted.
                                    </p>
                                </div>

                                {#if registrationError}
                                    <p
                                        role="alert"
                                        class="rounded-2xl border border-danger/15 bg-danger-soft px-3.5 py-2.5 text-xs font-semibold leading-5 text-danger"
                                        transition:collapse={{ duration: EXIT_MS }}
                                    >
                                        {registrationError}
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    </form>
                </div>
            {/if}
        </div>
    </div>

    <!--
        One decisive action per step, always in the same place. Cancelling is the
        back control at the top of the setup step, so the footer never has to
        offer two competing choices.
    -->
    {#snippet footer()}
        <div class="relative h-12">
            {#if step === "add"}
                <button
                    type="submit"
                    form="passkey-add-form"
                    class="btn-primary absolute inset-0 h-12 w-full text-sm"
                    disabled={isLoading || isRegistering}
                    in:fade={{ duration: reduced ? 0 : 180 }}
                >
                    {#if isRegistering}
                        <Spinner size={16} /> Setting up…
                    {:else}
                        Create passkey
                    {/if}
                </button>
            {:else}
                <button
                    type="button"
                    class="btn-primary absolute inset-0 h-12 w-full text-sm"
                    onclick={beginRegistration}
                    disabled={mutationDisabled || !canAddPasskey}
                    bind:this={addPasskeyButton}
                    in:fade={{ duration: reduced ? 0 : 180 }}
                >
                    <PlusIcon size={17} />
                    Add a passkey
                </button>
            {/if}
        </div>
    {/snippet}
</Sheet>

<style>
    /*
     * The stage is the only scroller in the sheet. Its height is fixed, so the
     * panel's content height — and therefore the sheet's own height and the
     * position of its title — is constant no matter which step is showing or
     * how many passkeys the account has.
     */
    .stage {
        height: clamp(16rem, 46dvh, 27rem);
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
    }

    /*
     * Both steps share one grid cell so the outgoing and incoming screens
     * overlap during the push instead of stacking and doubling the height.
     */
    .steps {
        display: grid;
        min-height: 100%;
    }

    .steps > .step {
        grid-area: 1 / 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        /* Opaque, so a step in transit never shows the other one through it. */
        background: var(--color-surface);
    }

    /*
     * Rows press with a background fill rather than a scale so a tapped row
     * never detaches from the group it shares a card with.
     */
    .row-group {
        background: var(--color-surface);
        transition: background-color 240ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .row-group.is-confirming {
        background: color-mix(in srgb, var(--color-danger-soft) 45%, transparent);
    }

    /* One-shot wash marking the passkey that was just created. */
    .row-group.is-new {
        animation: row-arrive 1600ms cubic-bezier(0.32, 0.72, 0, 1) both;
    }

    @keyframes row-arrive {
        0%,
        30% {
            background: var(--color-primary-soft);
        }
        100% {
            background: var(--color-surface);
        }
    }

    .row-chip {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        flex-shrink: 0;
        border-radius: 0.75rem;
        border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
        background: var(--color-primary-soft);
        color: var(--color-primary-ink);
        transition:
            background-color 240ms cubic-bezier(0.32, 0.72, 0, 1),
            border-color 240ms cubic-bezier(0.32, 0.72, 0, 1),
            color 240ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .is-confirming .row-chip {
        border-color: color-mix(in srgb, var(--color-danger) 18%, transparent);
        background: color-mix(in srgb, var(--color-danger) 10%, transparent);
        color: var(--color-danger);
    }

    /* Feedback on press, not on release. */
    .row-action {
        transition:
            background-color 160ms ease,
            color 160ms ease,
            transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .row-action:hover:not(:disabled) {
        background: var(--color-danger-soft);
        color: var(--color-danger);
    }

    .row-action:active:not(:disabled) {
        transform: scale(0.9);
    }

    .row-action:focus-visible {
        outline: 2px solid var(--color-danger);
        outline-offset: 2px;
    }

    .row-action:disabled {
        pointer-events: none;
        opacity: 0.45;
    }

    .is-confirming .row-action {
        color: var(--color-danger);
        background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }

    .btn-danger {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border-radius: 1rem;
        background: var(--color-danger);
        font-weight: 600;
        color: #fff;
        transition:
            filter 160ms ease,
            transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .btn-danger:hover:not(:disabled) {
        filter: brightness(0.95);
    }

    .btn-danger:active:not(:disabled) {
        transform: scale(0.98);
    }

    .btn-danger:disabled {
        pointer-events: none;
        opacity: 0.45;
    }

    .assurance .chip {
        transition:
            background-color 260ms cubic-bezier(0.32, 0.72, 0, 1),
            color 260ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .pulse {
        position: relative;
        border-radius: 9999px;
        background: var(--color-primary-soft);
    }

    .pulse::before,
    .pulse::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        border: 1.5px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
        animation: ripple 2200ms cubic-bezier(0.32, 0.72, 0, 1) infinite;
    }

    .pulse::after {
        animation-delay: 1100ms;
    }

    @keyframes ripple {
        0% {
            transform: scale(1);
            opacity: 0.9;
        }
        100% {
            transform: scale(1.75);
            opacity: 0;
        }
    }

    .empty-chip {
        animation: settle-in 620ms cubic-bezier(0.32, 0.72, 0, 1) both;
    }

    @keyframes settle-in {
        from {
            transform: scale(0.7);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    /* Skeleton rows hold the list's real geometry so nothing jumps on arrival. */
    .skeleton {
        position: relative;
        overflow: hidden;
        background: color-mix(in srgb, var(--color-line) 70%, transparent);
    }

    .skeleton::after {
        content: "";
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, #fff 75%, transparent),
            transparent
        );
        animation: shimmer 1500ms ease-in-out infinite;
        animation-delay: var(--skeleton-delay, 0ms);
    }

    @keyframes shimmer {
        to {
            transform: translateX(100%);
        }
    }

    /*
     * Reduced motion keeps every state change and every colour cue — it only
     * drops the parts that move, loop, or pulse.
     */
    @media (prefers-reduced-motion: reduce) {
        .row-group.is-new {
            animation-duration: 1200ms;
        }

        .pulse::before,
        .pulse::after,
        .skeleton::after {
            animation: none;
        }

        .pulse::before,
        .pulse::after {
            display: none;
        }

        .empty-chip {
            animation: none;
        }

        .row-action:active:not(:disabled),
        .btn-danger:active:not(:disabled) {
            transform: none;
        }
    }
</style>
