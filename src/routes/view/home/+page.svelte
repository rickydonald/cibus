<script lang="ts">
    import ContentWrapper from "$lib/components/ui/ContentWrapper.svelte";
    import MainContainer from "$lib/components/ui/MainContainer.svelte";
    import { ChevronRightIcon } from "@untitled-theme/icons-svelte";

    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";
    import {
        cacheEatRightProfile,
        getCachedEatRightProfile,
        type CachedEatRightProfile,
    } from "$lib/client/eatright-profile";

    import { cart } from "$lib/store/cart.svelte";

    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import { Settings, WalletIcon } from "@lucide/svelte";
    import helpers from "$lib/helpers";
    import { greetingName } from "$lib/utils/person-name";
    import { normalizeStoreName } from "$lib/utils/display-text";

    type Outlet = {
        id: number;
        name: string;
        shopNo: number;
        isClosed: boolean;
    };

    type EatRightAccountDetails = {
        name: string;
        userid: string;
        walletBalance: string;
        outlets: Outlet[];
    };

    let accountDetails = $state<EatRightAccountDetails | null>(null);
    let cachedProfile = $state<CachedEatRightProfile | null>(null);
    let navigatingOutletId = $state<number | null>(null);
    let hasCurrentOrder = $state<boolean>(false);

    let isAccountLoading: boolean = $state(false);

    function getBalanceMajor(balanceStr: string | undefined): string {
        if (!balanceStr) return "--";
        const num = parseFloat(balanceStr);
        return Math.floor(num).toString();
    }

    function getBalanceMinor(balanceStr: string | undefined): string {
        if (!balanceStr) return "00";
        const num = parseFloat(balanceStr);
        const fixed = num.toFixed(2);
        return fixed.split(".")[1] || "00";
    }

    /**
     * Method to get Account Details from Backend API
     */
    async function getAccountDetails() {
        try {
            isAccountLoading = true;
            const response = await fetchEatRight("/api/v1/account/show");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }

                throw new Error(
                    data.error ?? "Unable to load EatRight account",
                );
            }

            accountDetails = data;
            cachedProfile = cacheEatRightProfile(data.name, data.userid);
        } catch (error) {
            console.error(error);
        } finally {
            isAccountLoading = false;
        }
    }

    onMount(() => {
        cachedProfile = getCachedEatRightProfile();
        getAccountDetails();
    });

    async function handleNavigation(outletId: number, shopNo: number) {
        if (navigatingOutletId !== null) return;
        navigatingOutletId = outletId;
        try {
            await goto(`/view/order/${outletId}/${shopNo}`);
        } catch (error) {
            console.error(error);
            navigatingOutletId = null;
        }
    }

    const allOutletsClosed = $derived(
        accountDetails?.outlets && accountDetails.outlets.length > 0
            ? accountDetails.outlets.every((o) => o.isClosed)
            : false,
    );
    const hasFloatingCart = $derived(
        cart.totalItems > 0 && !allOutletsClosed && !isAccountLoading,
    );

    // Normalize Wallet Username
    const profile = $derived(cachedProfile);
    const walletOwnerName = $derived.by(() => {
        return greetingName(profile?.name, true);
    });

    // Check the current account belongs to student
    const isStudent = $derived.by(() => {
        return /^\d{2}-[A-Z]{3}-\d{3}$/.test(cachedProfile?.userid ?? "");
    });

    // Greeting based on Department
    const isFrenchDept = $derived(
        cachedProfile?.userid.split("-")[1].slice(1, 3) === "FR",
    );
    const isTamilDept = $derived(
        cachedProfile?.userid.split("-")[1].slice(1, 3) === "TL",
    );

    /**
     * Method to return Greet
     */
    function returnGreet(): string {
        if (isStudent) {
            if (isFrenchDept) return "Bonjour";
            else if (isTamilDept) return "Vanakkam";
            else return "Hello";
        } else {
            return "Hello";
        }
    }
</script>

<MainContainer>
    <div class="safe-top-offset antialiased">
        <div class="min-h-screen w-full">
            <ContentWrapper>
                <!-- Greeting Header -->
                <div
                    class="flex items-center justify-between px-5 pt-1 max-w-md mx-auto lg:max-w-2xl"
                >
                    <!-- Home Header -->
                    <div class="min-w-0">
                        <h1
                            class="text-xl font-bold tracking-tight text-ink truncate"
                        >
                            {#if walletOwnerName}
                                {returnGreet()}, {walletOwnerName}
                            {:else}
                                Welcome
                            {/if}
                        </h1>
                        <p class="text-xs font-medium text-ink-muted mt-0.5">
                            What are you eating today?
                        </p>
                    </div>
                    <a
                        href="/view/settings"
                        aria-label="Open Account Settings"
                        class="icon-btn"
                    >
                        <Settings
                            width="22"
                            height="22"
                            class="text-ink-muted"
                        />
                    </a>
                </div>

                <!-- Wallet Hero Card -->
                <div class="mt-5 px-5 max-w-md mx-auto lg:max-w-2xl">
                    <div
                        class="relative overflow-hidden rounded-[28px] bg-primary p-6 text-white shadow-card"
                    >
                        <!-- light same-hue gradient wash -->
                        <div
                            class="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_35%,rgba(255,255,255,0)_55%),linear-gradient(320deg,rgba(10,54,86,0.28),rgba(10,54,86,0)_50%)]"
                        ></div>

                        <div class="relative z-10">
                            <div class="flex items-center justify-center">
                                <div class="min-w-0">
                                    <p
                                        class="text-[10px] uppercase tracking-[0.16em] text-white/60 font-bold text-center"
                                    >
                                        {#if walletOwnerName && walletOwnerName.length < 9}
                                            {walletOwnerName}'s Wallet Balance
                                        {:else}
                                            Wallet Balance
                                        {/if}
                                    </p>

                                    <div
                                        class="mt-2 h-12 flex items-center justify-center"
                                    >
                                        {#if accountDetails}
                                            <h2
                                                class="flex items-baseline text-5xl font-bold tabular-nums"
                                            >
                                                <span
                                                    class="text-white/50 text-4xl mr-1 font-normal"
                                                    >₹</span
                                                >
                                                <span
                                                    >{getBalanceMajor(
                                                        accountDetails?.walletBalance,
                                                    )}.</span
                                                >
                                                <span
                                                    class="text-3xl font-medium text-white/50"
                                                    >{getBalanceMinor(
                                                        accountDetails?.walletBalance,
                                                    )}</span
                                                >
                                            </h2>
                                        {:else}
                                            <div
                                                class="h-10 w-40 animate-pulse rounded-circle bg-white/15"
                                            ></div>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <div class="mt-6 flex items-center gap-3">
                                <button
                                    onclick={() =>
                                        goto("/view/wallet?action=add-money")}
                                    class="flex-1 h-11 rounded-circle bg-white px-3 text-sm text-primary flex items-center justify-center gap-2 font-bold hover:bg-primary-soft active:scale-98 transition whitespace-nowrap"
                                    aria-label="Add Money to Wallet"
                                >
                                    <WalletIcon size="18" />
                                    <span>Add Money</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section Subheader -->
                <div class="mt-8 px-6 max-w-md mx-auto lg:max-w-2xl">
                    <h2 class="text-xl font-bold tracking-tight text-ink">
                        Food Counters
                    </h2>
                </div>

                <!-- Outlets Card -->
                <div
                    class="mt-3 grid grid-cols-1 gap-3 px-5 max-w-md mx-auto lg:max-w-2xl lg:grid-cols-2"
                    class:pb-cart-float={hasFloatingCart && !hasCurrentOrder}
                    class:pb-current-order-float={hasCurrentOrder &&
                        !hasFloatingCart}
                    class:pb-cart-order-float={hasFloatingCart &&
                        hasCurrentOrder}
                >
                    {#if accountDetails}
                        {#each accountDetails.outlets as outlet}
                            {@const isNavigating =
                                navigatingOutletId === outlet.id}
                            <button
                                onclick={() =>
                                    handleNavigation(outlet.id, outlet.shopNo)}
                                disabled={outlet.isClosed ||
                                    navigatingOutletId !== null}
                                aria-busy={isNavigating}
                                class="group card p-4 text-left transition-all hover:border-line-strong active:scale-[0.99] disabled:cursor-not-allowed"
                                class:opacity-60={outlet.isClosed ||
                                    (navigatingOutletId !== null &&
                                        !isNavigating)}
                                class:border-primary={isNavigating}
                            >
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <div
                                        class="flex items-center gap-3.5 min-w-0"
                                    >
                                        <div
                                            class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft border border-primary/10"
                                        >
                                            <img
                                                src={helpers.mapStoreIcon(
                                                    String(outlet.shopNo),
                                                )}
                                                alt={normalizeStoreName(
                                                    outlet.name,
                                                )}
                                                class="h-8 w-8 object-contain"
                                            />
                                        </div>

                                        <div class="min-w-0">
                                            <h3
                                                class="truncate text-base font-semibold tracking-tight text-ink"
                                            >
                                                {normalizeStoreName(
                                                    outlet.name,
                                                )}
                                            </h3>
                                            <p
                                                class="text-xs text-ink-faint font-medium mt-0.5"
                                            >
                                                Counter {outlet.shopNo}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        {#if isNavigating}
                                            <div
                                                class="flex h-7 w-7 items-center justify-center rounded-circle bg-primary-soft border border-primary/10 text-primary"
                                            >
                                                <Spinner size={16} />
                                            </div>
                                        {:else if outlet.isClosed}
                                            <div
                                                class="flex items-center gap-1 rounded-circle bg-danger-soft border border-danger/10 px-2.5 py-1"
                                            >
                                                <span
                                                    class="text-[11px] font-semibold text-danger"
                                                    >Closed</span
                                                >
                                            </div>
                                        {:else}
                                            <div
                                                class="flex h-7 w-7 items-center justify-center rounded-circle bg-canvas border border-line group-hover:bg-primary-soft transition-colors"
                                            >
                                                <ChevronRightIcon
                                                    class="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </button>
                        {/each}
                    {:else}
                        {#each Array(4) as _}
                            <div class="card p-4">
                                <div class="flex items-center justify-between">
                                    <div
                                        class="flex items-center gap-3.5 w-full"
                                    >
                                        <div
                                            class="h-12 w-12 animate-pulse rounded-xl bg-canvas"
                                        ></div>
                                        <div class="flex-1 space-y-2">
                                            <div
                                                class="h-4 w-1/2 animate-pulse rounded-md bg-canvas"
                                            ></div>
                                            <div
                                                class="h-3 w-1/4 animate-pulse rounded-md bg-canvas"
                                            ></div>
                                        </div>
                                    </div>
                                    <div
                                        class="h-6 w-6 animate-pulse rounded-circle bg-canvas"
                                    ></div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </ContentWrapper>
        </div>

        <!-- Sticky Bottom Floating Action Overlay Tray -->
        {#if hasFloatingCart}
            <FloatingCartBar />
        {/if}
    </div>
</MainContainer>
