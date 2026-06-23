<script lang="ts">
    import ContentWrapper from "$lib/components/ui/ContentWrapper.svelte";
    import MainContainer from "$lib/components/ui/MainContainer.svelte";

    import {
        ChevronRightIcon,
        LogOut01Icon,
        SearchMdIcon,
        ShoppingCart01Icon,
        UserCircleIcon,
        Wallet01Icon,
        XCircleIcon,
    } from "@untitled-theme/icons-svelte";

    import History from "@lucide/svelte/icons/history";

    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";

    import { cart } from "$lib/store/cart.svelte";

    async function disconnectEatRight() {
        await fetch("/api/v1/disconnect", { method: "POST" });
        await goto("/login");
    }
    import momo from "$lib/assets/outlet-icons/dumpling.svg";
    import fish from "$lib/assets/outlet-icons/fish.svg";
    import hotpot from "$lib/assets/outlet-icons/hotbowl.svg";
    import kebab from "$lib/assets/outlet-icons/kebab.svg";
    import traditional from "$lib/assets/outlet-icons/ricebowl.svg";
    import bun from "$lib/assets/outlet-icons/wheat.svg";
    import juice from "$lib/assets/outlet-icons/bakery.svg";
    import organic from "$lib/assets/outlet-icons/ricebowl.svg";
    import fries from "$lib/assets/outlet-icons/fries.svg";
    import FloatingCartBar from "$lib/components/custom/FloatingCartBar.svelte";

    const outletIcons: Record<string, string> = {
        "1": momo,
        "2": fish,
        "3": hotpot,
        "4": kebab,
        "5": traditional,
        "6": bun,
        "7": juice,
        "8": organic,
        "9": fries,
    };

    function getOutletIcon(name: number) {
        return outletIcons[String(name)] ?? bun;
    }

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
    let isNavigateLoading = $state(false);

    type RecentOrder = {
        order_no: string;
        outletid: string;
        outletname: string;
        grand_total: number;
        order_status: string;
    };

    let isAccountSheetOpen: boolean = $state(false);

    let recentOrder = $state<RecentOrder | null>(null);
    let isRecentOrderLoading = $state(true);

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
        } catch (error) {
            console.error(error);
        }
    }

    async function getRecentOrder() {
        isRecentOrderLoading = true;

        try {
            const response = await fetchEatRight("/api/v1/orders");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode))
                    return;
                return;
            }

            const orders = data.orders;
            if (Array.isArray(orders) && orders.length > 0) {
                const latest = orders[0];
                recentOrder = {
                    order_no: latest.order_no,
                    outletid: latest.outletid,
                    outletname: latest.outletname,
                    grand_total: latest.grand_total,
                    order_status: latest.order_status,
                };
            }
        } catch {
            // silently ignore
        } finally {
            isRecentOrderLoading = false;
        }
    }

    onMount(() => {
        getAccountDetails();
        getRecentOrder();
    });

    async function handleNavigation(outletId: number, shopNo: number) {
        isNavigateLoading = true;
        await goto(`/view/order/${outletId}/${shopNo}`);
    }
</script>

<MainContainer>
    <div class="safe-top-offset text-neutral-900 antialiased ">
        <div class="min-h-screen w-full">
            <ContentWrapper>
                <div class="flex items-baseline justify-end-safe mr-5">
                    <button
                        onclick={disconnectEatRight}
                    >
                        <LogOut01Icon
                            width="28"
                            height="28"
                            color=""
                            class="text-neutral-500"
                        />
                    </button>
                </div>
                <!-- Wallet Panel Tray -->
                <div
                    class="pt-8 px-5 border-b border-neutral-300/80 bg-gradient-to-b from-neutral-100 via-neutral-50 to-[#f5f5f7] relative max-w-md mx-auto sm:rounded-b-[32px]"
                >
                    <div class="flex flex-col items-center justify-center">
                        <p
                            class="text-[10px] uppercase tracking-[0.16em] text-neutral-400 text-center font-bold"
                        >
                            {#if accountDetails}
                                {accountDetails.user.split(" ")[0]}'s Wallet
                                Balance
                            {:else}
                                Wallet Balance
                            {/if}
                        </p>

                        <div
                            class="mt-2.5 h-12 flex items-center justify-center"
                        >
                            {#if accountDetails}
                                <h2
                                    class="flex items-baseline justify-center text-5xl font-bold tracking-tight text-neutral-900 tabular-nums"
                                >
                                    <span
                                        class="text-neutral-400 text-4xl mr-0.5 font-normal"
                                        >₹</span
                                    >
                                    <span
                                        >{getBalanceMajor(
                                            accountDetails?.walletBalance,
                                        )}.</span
                                    >
                                    <span
                                        class="text-3xl font-medium text-neutral-400"
                                        >{getBalanceMinor(
                                            accountDetails?.walletBalance,
                                        )}</span
                                    >
                                </h2>
                            {:else}
                                <div
                                    class="h-10 w-40 animate-pulse rounded-full bg-neutral-200/70"
                                ></div>
                            {/if}
                        </div>
                    </div>

                    <!-- Balanced Navigation Action Layout (50/50 Symmetrical Split) -->
                    <div
                        class="mt-12 flex items-center justify-between pb-4 gap-3"
                    >
                        <button
                            onclick={() => goto("/view/history")}
                            class="flex-1 w-1/2 rounded-full bg-white border border-neutral-200 shadow-2xs px-3 py-3 text-sm flex items-center justify-center gap-2 font-medium text-neutral-700 hover:bg-neutral-50 active:scale-98 transition whitespace-nowrap"
                        >
                            <History
                                size="16"
                                class="text-neutral-500 shrink-0"
                            />
                            <span>View History</span>
                        </button>

                        <button
                            onclick={() => goto("/view/wallet")}
                            class="flex-1 w-1/2 rounded-full bg-neutral-900 shadow-sm px-3 py-3 text-sm text-white flex items-center justify-center gap-2 font-medium hover:bg-neutral-800 active:scale-98 transition whitespace-nowrap"
                        >
                            <Wallet01Icon
                                width="16"
                                class="text-neutral-300 shrink-0"
                            />
                            <span>Add Money</span>
                        </button>
                    </div>
                </div>

                <!-- Search Input Trigger -->
                <div class="px-5 pt-6 max-w-md mx-auto">
                    <button
                        onclick={() => goto("/view/search")}
                        class="flex w-full items-center justify-start gap-3 rounded-2xl border border-neutral-200/80 bg-white px-4 py-3.5 shadow-xs hover:border-neutral-300 transition-colors"
                    >
                        <SearchMdIcon class="h-4 w-4 text-neutral-400" />
                        <span class="text-sm text-neutral-400 font-medium"
                            >Search food items or kitchens...</span
                        >
                    </button>
                </div>

                <!-- Section Subheader -->
                <div class="mt-8 px-6 max-w-md mx-auto">
                    <h2
                        class="text-xl font-bold tracking-tight text-neutral-900"
                    >
                        Food Counters
                    </h2>
                </div>

                <!-- Outlets Card Engine -->
                <div
                    class="mt-3 grid grid-cols-1 gap-3 px-5 pb-32 max-w-md mx-auto"
                >
                    {#if accountDetails}
                        {#each accountDetails.outlets as outlet}
                            <button
                                onclick={() =>
                                    handleNavigation(outlet.id, outlet.shopNo)}
                                disabled={outlet.isClosed || isNavigateLoading}
                                class="group rounded-3xl border border-neutral-200/60 bg-white p-4 text-left shadow-xs transition-all hover:border-neutral-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <div
                                        class="flex items-center gap-3.5 min-w-0"
                                    >
                                        <div
                                            class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 border border-neutral-100"
                                        >
                                            <img
                                                src={getOutletIcon(
                                                    outlet.shopNo,
                                                )}
                                                alt={outlet.name}
                                                class="h-8 w-8 object-contain"
                                            />
                                        </div>

                                        <div class="min-w-0">
                                            <h3
                                                class="truncate text-base font-semibold tracking-tight text-neutral-900"
                                            >
                                                {outlet.name}
                                            </h3>
                                            <p
                                                class="text-xs text-neutral-400 font-medium mt-0.5"
                                            >
                                                Counter {outlet.shopNo}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        {#if outlet.isClosed}
                                            <div
                                                class="flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2.5 py-1"
                                            >
                                                <XCircleIcon
                                                    class="h-3.5 w-3.5 text-rose-500"
                                                />
                                                <span
                                                    class="text-[11px] font-semibold text-rose-600"
                                                    >Closed</span
                                                >
                                            </div>
                                        {:else}
                                            <div
                                                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50 border border-neutral-200/40 group-hover:bg-neutral-100 transition-colors"
                                            >
                                                <ChevronRightIcon
                                                    class="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </button>
                        {/each}
                    {:else}
                        {#each Array(4) as _}
                            <div
                                class="rounded-3xl border border-neutral-200/40 bg-white p-4 shadow-xs"
                            >
                                <div class="flex items-center justify-between">
                                    <div
                                        class="flex items-center gap-3.5 w-full"
                                    >
                                        <div
                                            class="h-12 w-12 animate-pulse rounded-xl bg-neutral-100"
                                        ></div>
                                        <div class="flex-1 space-y-2">
                                            <div
                                                class="h-4 w-1/2 animate-pulse rounded-md bg-neutral-100"
                                            ></div>
                                            <div
                                                class="h-3 w-1/4 animate-pulse rounded-md bg-neutral-100"
                                            ></div>
                                        </div>
                                    </div>
                                    <div
                                        class="h-6 w-6 animate-pulse rounded-full bg-neutral-100"
                                    ></div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </ContentWrapper>
        </div>

        <!-- Sticky Bottom Floating Action Overlay Tray -->
        {#if cart.totalItems > 0}
            <FloatingCartBar />
        {/if}
    </div>
</MainContainer>

<style>
    :global(body) {
        background: #f5f5f7;
    }

    :global(*) {
        -webkit-tap-highlight-color: transparent;
    }
</style>
