<script lang="ts">
    import ContentWrapper from "$lib/components/ui/ContentWrapper.svelte";
    import MainContainer from "$lib/components/ui/MainContainer.svelte";

    import { BottomSheet } from "svelte-bottom-sheet";
    import {
        ChevronRightIcon,
        LogOut01Icon,
        UserCircleIcon,
        Wallet02Icon,
    } from "@untitled-theme/icons-svelte";

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
    import CurrentOrderBanner from "$lib/components/custom/CurrentOrderBanner.svelte";
    import { Settings } from "@lucide/svelte";
    import helpers from "$lib/helpers";

    type Outlet = {
        id: number;
        name: string;
        shopNo: number;
        isClosed: boolean;
    };

    type EatRightAccountDetails = {
        user: string;
        userid: string;
        walletBalance: string;
        outlets: Outlet[];
    };

    let accountDetails = $state<EatRightAccountDetails | null>(null);
    let cachedProfile = $state<CachedEatRightProfile | null>(null);
    let isNavigateLoading = $state(false);
    let hasCurrentOrder = $state(false);

    let isAccountSheetOpen: boolean = $state(false);
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
            cachedProfile = cacheEatRightProfile(data.user, data.userid);
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
        isNavigateLoading = true;
        await goto(`/view/order/${outletId}/${shopNo}`);
    }

    const allOutletsClosed = $derived(
        accountDetails?.outlets && accountDetails.outlets.length > 0
            ? accountDetails.outlets.every((o) => o.isClosed)
            : false,
    );
    const hasFloatingCart = $derived(
        cart.totalItems > 0 && !allOutletsClosed && !isAccountLoading,
    );

    const profile = $derived(cachedProfile);
    const walletOwnerName = $derived.by(() => {
        return profile?.name.split(" ")[0];
    });
</script>

<MainContainer>
    <div class="safe-top-offset antialiased">
        <div class="min-h-screen w-full">
            <ContentWrapper>
                <!-- Greeting Header -->
                <div
                    class="flex items-center justify-between px-5 pt-1 max-w-md mx-auto lg:max-w-2xl"
                >
                    <div class="min-w-0">
                        <h1
                            class="text-xl font-bold tracking-tight text-ink truncate"
                        >
                            {#if walletOwnerName}
                                Hello, {walletOwnerName}
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
                        <div
                            class="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.1),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.06),transparent_40%)]"
                        ></div>

                        <div class="relative z-10">
                            <p
                                class="text-[10px] uppercase tracking-[0.16em] text-white/60 font-bold"
                            >
                                Wallet Balance
                            </p>

                            <div class="mt-2 h-12 flex items-center">
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

                            <div class="mt-6 flex items-center gap-3">
                                <button
                                    onclick={() => goto("/view/wallet")}
                                    class="flex-1 h-11 rounded-circle bg-white px-3 text-sm text-primary flex items-center justify-center gap-2 font-bold hover:bg-primary-soft active:scale-98 transition whitespace-nowrap"
                                    aria-label="Add Money to Wallet"
                                >
                                    <Wallet02Icon width="16" class="shrink-0" />
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
                            <button
                                onclick={() =>
                                    handleNavigation(outlet.id, outlet.shopNo)}
                                disabled={outlet.isClosed || isNavigateLoading}
                                class="group card p-4 text-left transition-all hover:border-line-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
                                                alt={outlet.name}
                                                class="h-8 w-8 object-contain"
                                            />
                                        </div>

                                        <div class="min-w-0">
                                            <h3
                                                class="truncate text-base font-semibold tracking-tight text-ink"
                                            >
                                                {outlet.name}
                                            </h3>
                                            <p
                                                class="text-xs text-ink-faint font-medium mt-0.5"
                                            >
                                                Counter {outlet.shopNo}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        {#if outlet.isClosed}
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

        <CurrentOrderBanner
            stacked={hasFloatingCart}
            onActiveChange={(active) => (hasCurrentOrder = active)}
        />

        <!-- Sticky Bottom Floating Action Overlay Tray -->
        {#if hasFloatingCart}
            <FloatingCartBar />
        {/if}
    </div>
</MainContainer>
