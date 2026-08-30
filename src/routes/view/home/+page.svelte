<script lang="ts">
    import { BottomSheet } from "svelte-bottom-sheet";
    import {
        ChevronRightIcon,
        LogOut01Icon,
        UserCircleIcon,
        Wallet02Icon,
    } from "@untitled-theme/icons-svelte";

    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { redirectIfEatRightConnectRequired } from "$lib/client/eatright-client";
    import {
        cacheEatRightProfileFromUser,
        clearCachedEatRightProfile,
        getCachedEatRightProfile,
        type CachedEatRightProfile,
    } from "$lib/client/eatright-profile";

    import { cart } from "$lib/store/cart.svelte";

    async function disconnectEatRight() {
        await fetch("/api/v1/disconnect", { method: "POST" });
        clearCachedEatRightProfile();
        await goto("/login");
    }

    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";
    import { ReceiptIndianRupeeIcon } from "@lucide/svelte";
    import helpers from "$lib/helpers";
    import { Tag } from "$lib/components/ui";

    type Outlet = {
        id: number;
        name: string;
        shopNo: number;
        isClosed: boolean;
    };

    type EatRightAccountDetails = {
        user: string;
        walletBalance: string;
        outlets: Outlet[];
    };

    let accountDetails = $state<EatRightAccountDetails | null>(null);
    let cachedProfile = $state<CachedEatRightProfile | null>(null);
    let isNavigateLoading = $state(false);

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
            const response = await fetch("/api/v1/account/show");
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
            cachedProfile = cacheEatRightProfileFromUser(data.user);
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

    const profile = $derived(cachedProfile);
    const walletOwnerName = $derived(
        profile?.name ? profile.name.split(" ")[0] : "",
    );
</script>

<div class="safe-top-offset antialiased">
    <div class="min-h-screen w-full">
        <div class="mx-auto w-full max-w-2xl">
            <!-- Greeting -->
            <div
                class="mx-auto flex max-w-md items-start justify-between px-5 pt-1"
            >
                <div class="min-w-0">
                    <p class="section-label">
                        {#if walletOwnerName}Welcome back{:else}Eat Right{/if}
                    </p>
                    <h1
                        class="mt-1.5 truncate text-[28px] font-extrabold leading-tight tracking-tight text-ink"
                    >
                        {#if walletOwnerName}
                            {walletOwnerName}
                        {:else}
                            Welcome
                        {/if}
                    </h1>
                </div>
                <button
                    aria-label="Open Account Settings"
                    class="icon-btn mt-1"
                    onclick={() => (isAccountSheetOpen = !isAccountSheetOpen)}
                >
                    <UserCircleIcon width="20" height="20" />
                </button>
            </div>

            <!--
              Wallet hero — the one raised object on this screen. Black face on
              the light canvas gives the hardest contrast available, and leaves
              the accent free to mark the single primary action inside it.
            -->
            <div class="mx-auto mt-7 max-w-md px-5">
                <div
                    class="np-elevate np-static block w-full"
                    style="--np-face:var(--color-ink);--np-ink:#ffffff;--np-edge-right:var(--color-np-black-50);--np-edge-bottom:var(--color-np-black-70)"
                >
                    <div class="np-face p-6">
                        <p
                            class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50"
                        >
                            Wallet Balance
                        </p>

                        <div class="mt-3 flex h-12 items-center">
                            {#if accountDetails}
                                <h2
                                    class="flex items-baseline text-5xl font-extrabold tabular-nums tracking-tight"
                                >
                                    <span
                                        class="mr-1 text-3xl font-bold text-white/40"
                                        >₹</span
                                    >
                                    <span
                                        >{getBalanceMajor(
                                            accountDetails?.walletBalance,
                                        )}</span
                                    >
                                    <span class="text-3xl text-white/40"
                                        >.{getBalanceMinor(
                                            accountDetails?.walletBalance,
                                        )}</span
                                    >
                                </h2>
                            {:else}
                                <div
                                    class="h-9 w-40 animate-pulse bg-white/15"
                                ></div>
                            {/if}
                        </div>

                        <!--
                          Flat, not extruded: stacking a raised control inside
                          an already raised surface reads as noise.
                        -->
                        <div class="mt-7 flex items-stretch gap-2.5">
                            <button
                                onclick={() => goto("/view/history")}
                                class="flex h-11 flex-1 items-center justify-center gap-2 border border-white/25 px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white transition-colors active:bg-white active:text-ink"
                                aria-label="View Order History"
                            >
                                <ReceiptIndianRupeeIcon
                                    size="15"
                                    class="shrink-0"
                                />
                                <span>Orders</span>
                            </button>

                            <button
                                onclick={() => goto("/view/wallet")}
                                class="flex h-11 flex-1 items-center justify-center gap-2 bg-accent px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink transition-transform active:translate-x-px active:translate-y-px"
                                aria-label="Add Money to Wallet"
                            >
                                <Wallet02Icon width="15" class="shrink-0" />
                                <span>Add money</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section header -->
            <div class="mx-auto mt-10 max-w-md px-5">
                <p class="section-label">Available now</p>
                <h2
                    class="mt-1.5 text-xl font-extrabold tracking-tight text-ink"
                >
                    Food Counters
                </h2>
            </div>

            <!--
              Outlet rows stay flat and are separated by hairlines rather than
              gaps. A list of raised cards would compete with the wallet hero
              and flatten the hierarchy.
            -->
            <div
                class="mx-auto mt-4 max-w-md px-5"
                class:pb-cart-float={cart.totalItems > 0 &&
                    !allOutletsClosed &&
                    !isAccountLoading}
            >
                {#if accountDetails}
                    <div class="border border-hairline bg-surface">
                        {#each accountDetails.outlets as outlet, i}
                            <button
                                onclick={() =>
                                    handleNavigation(outlet.id, outlet.shopNo)}
                                disabled={outlet.isClosed || isNavigateLoading}
                                class="group flex w-full items-center justify-between gap-3 p-4 text-left transition-colors active:bg-canvas disabled:cursor-not-allowed {i >
                                0
                                    ? 'border-t border-hairline'
                                    : ''}"
                            >
                                <div
                                    class="flex min-w-0 items-center gap-3.5 {outlet.isClosed
                                        ? 'opacity-40'
                                        : ''}"
                                >
                                    <div
                                        class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas"
                                    >
                                        <img
                                            src={helpers.mapStoreIcon(
                                                String(outlet.shopNo),
                                            )}
                                            alt={outlet.name}
                                            class="h-7 w-7 object-contain"
                                        />
                                    </div>

                                    <div class="min-w-0">
                                        <h3
                                            class="truncate text-[15px] font-extrabold tracking-tight text-ink"
                                        >
                                            {outlet.name}
                                        </h3>
                                        <p
                                            class="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-faint"
                                        >
                                            Counter {outlet.shopNo}
                                        </p>
                                    </div>
                                </div>

                                {#if outlet.isClosed}
                                    <Tag tone="danger">Closed</Tag>
                                {:else}
                                    <div
                                        class="flex h-7 w-7 shrink-0 items-center justify-center bg-ink transition-colors"
                                    >
                                        <ChevronRightIcon
                                            class="h-4 w-4 text-accent"
                                        />
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="border border-hairline bg-surface">
                        {#each Array(4) as _, i}
                            <div
                                class="flex items-center justify-between p-4 {i >
                                0
                                    ? 'border-t border-hairline'
                                    : ''}"
                            >
                                <div class="flex w-full items-center gap-3.5">
                                    <div
                                        class="h-11 w-11 animate-pulse bg-canvas"
                                    ></div>
                                    <div class="flex-1 space-y-2">
                                        <div
                                            class="h-3.5 w-1/2 animate-pulse bg-canvas"
                                        ></div>
                                        <div
                                            class="h-2.5 w-1/4 animate-pulse bg-canvas"
                                        ></div>
                                    </div>
                                </div>
                                <div class="h-7 w-7 animate-pulse bg-canvas"></div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- Sticky Bottom Floating Action Overlay Tray -->
    {#if cart.totalItems > 0 && !allOutletsClosed && !isAccountLoading}
        <FloatingCartBar />
    {/if}
</div>

<BottomSheet bind:isSheetOpen={isAccountSheetOpen} settings={{ maxHeight: 0.5 }}>
    <BottomSheet.Overlay>
        <BottomSheet.Sheet>
            <BottomSheet.Handle />
            <BottomSheet.Content class="w-full!">
                <div class="w-full">
                    <p class="section-label pl-1">Account</p>
                    <h1
                        class="mt-1.5 pl-1 text-xl font-extrabold tracking-tight text-ink"
                    >
                        {profile?.name ?? "--"}
                    </h1>

                    <div class="mt-5 border border-hairline bg-canvas">
                        <div class="p-3.5">
                            <p class="section-label">Name</p>
                            <p
                                class="mt-1 text-base font-extrabold tracking-tight text-ink"
                            >
                                {profile?.name ?? "--"}
                            </p>
                        </div>
                        <div class="border-t border-hairline p-3.5">
                            <p class="section-label">
                                Department Number/Staff ID
                            </p>
                            <p
                                class="mt-1 text-base font-extrabold tracking-tight text-ink"
                            >
                                {profile?.deptNo || "--"}
                            </p>
                        </div>
                    </div>

                    <button
                        class="mt-4 flex w-full items-center justify-center gap-2 bg-danger p-3.5 text-xs font-extrabold uppercase tracking-[0.14em] text-white transition-transform active:translate-x-px active:translate-y-px"
                        onclick={disconnectEatRight}
                    >
                        <LogOut01Icon class="h-4 w-4" />
                        <span>Logout</span>
                    </button>
                </div>
            </BottomSheet.Content>
        </BottomSheet.Sheet>
    </BottomSheet.Overlay>
</BottomSheet>
