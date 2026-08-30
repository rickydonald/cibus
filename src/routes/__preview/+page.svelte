<!--
  TEMPORARY verification harness — delete before shipping, along with the
  /__preview branch in src/lib/nav.ts.

  Mounts the real route components with every API endpoint stubbed, so the
  redesign can be reviewed without a live session. Nothing here is imported by
  the app itself.  Usage: /__preview?screen=home|cart|wallet|history|search|order|confirmation
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { dev } from "$app/environment";
    import { page } from "$app/state";
    import BottomNav from "$lib/components/custom/BottomNav.svelte";
    import { cart } from "$lib/store/cart.svelte";

    import Home from "../view/home/+page.svelte";
    import Cart from "../view/cart/+page.svelte";
    import Wallet from "../view/wallet/+page.svelte";
    import History from "../view/history/+page.svelte";
    import Search from "../view/search/+page.svelte";
    import Order from "../view/order/[outlet_id]/[shop_no]/+page.svelte";
    import Confirmation from "../view/confirmation/+page.svelte";

    let ready = $state(false);
    const screen = $derived(page.url.searchParams.get("screen") ?? "home");

    const OUTLETS = [
        { id: 1, name: "North Kitchen", shopNo: 1, isClosed: false },
        { id: 2, name: "Grill & Wok", shopNo: 2, isClosed: false },
        { id: 3, name: "Juice Bar", shopNo: 3, isClosed: false },
        { id: 4, name: "Late Night Counter", shopNo: 4, isClosed: true },
    ];

    const MENU = [
        { id: 101, itemname: "Paneer Kathi Roll - YAMUNA'S KITCHEN", amount: 120, available_qty: 8, categoryname: "ROLLS", outletname: "North Kitchen", outletid: 1 },
        { id: 102, itemname: "Masala Dosa", amount: 70, available_qty: 3, categoryname: "SOUTH INDIAN", outletname: "North Kitchen", outletid: 1 },
        { id: 103, itemname: "Veg Fried Rice", amount: 95, available_qty: 12, categoryname: "CHINESE", outletname: "North Kitchen", outletid: 1 },
        { id: 104, itemname: "Filter Coffee", amount: 25, available_qty: 40, categoryname: "BEVERAGES", outletname: "North Kitchen", outletid: 1 },
    ];

    function json(body: unknown) {
        return new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
        });
    }

    onMount(() => {
        // Never stub fetch outside dev.
        if (!dev) return;

        localStorage.setItem(
            "kairos:eatright:profile",
            JSON.stringify({ name: "Aditya Menon", deptNo: "CS-4471" }),
        );

        const real = window.fetch.bind(window);
        window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(
                typeof input === "string" ? input : ((input as Request).url ?? input),
            );

            if (url.includes("/api/v1/account/show"))
                return json({ user: "Aditya Menon(CS-4471)", walletBalance: "1284.50", outlets: OUTLETS });

            if (url.includes("/api/v1/outlets/menu")) return json(MENU);

            if (url.includes("/api/v1/search"))
                return json({ results: MENU.map((m) => ({ ...m, shopno: 1 })) });

            if (url.includes("/api/v1/wallet"))
                return json({
                    transactions: [
                        { date: "28 Aug 2026, 1:12 PM", amount: 120, balance: 1284.5, sort_time: 3, type: "DEBIT", remarks: "Order at North Kitchen" },
                        { date: "27 Aug 2026, 9:40 AM", amount: 500, balance: 1404.5, sort_time: 2, type: "CREDIT", remarks: "Wallet recharge" },
                        { date: "25 Aug 2026, 6:02 PM", amount: 60, balance: 904.5, sort_time: 1, type: "Aborted", remarks: "Cancelled — Juice Bar" },
                    ],
                });

            if (url.includes("/api/v1/orders"))
                return json({
                    orders: [
                        { order_no: "ER-2026-0828-0041", order_status: "PLACED", created_on: "28 Aug 2026, 1:12 PM", payment_status: "PAID", outletid: "1", delivered: "N", grand_total: 215, outletname: "North Kitchen" },
                        { order_no: "ER-2026-0827-0018", order_status: "PLACED", created_on: "27 Aug 2026, 12:30 PM", payment_status: "PAID", outletid: "2", delivered: "Y", grand_total: 90, outletname: "Grill & Wok" },
                    ],
                });

            if (url.includes("/api/v1/order/details"))
                return json({
                    orders: [
                        {
                            order_no: "ER-2026-0828-0041",
                            outlet_name: "North Kitchen",
                            delivered: "N",
                            payment_status: "PAID",
                            grand_total: 215,
                            items: [
                                { item_name: "Paneer Kathi Roll", qty: 1, price: 120, total: 120, status: "CONFIRMED" },
                                { item_name: "Masala Dosa", qty: 1, price: 70, total: 70, status: "CONFIRMED" },
                                { item_name: "Filter Coffee", qty: 1, price: 25, total: 25, status: "PENDING" },
                            ],
                        },
                    ],
                });

            return real(input as never, init);
        }) as typeof window.fetch;

        if (cart.totalItems === 0) {
            cart.add({ id: 101, itemname: "Paneer Kathi Roll", amount: 120, outletid: 1, outletname: "North Kitchen", shopno: 1, available_qty: 8 });
            cart.add({ id: 102, itemname: "Masala Dosa", amount: 70, outletid: 1, outletname: "North Kitchen", shopno: 1, available_qty: 3 });
            cart.add({ id: 201, itemname: "Chicken Momos", amount: 90, outletid: 2, outletname: "Grill & Wok", shopno: 2, available_qty: 6 });
        }

        ready = true;
    });
</script>

{#if !dev}
    <p class="p-8 text-sm">Not available.</p>
{:else if ready}
    {#if screen === "home"}
        <div class="hub-page-shell"><Home /></div>
        <BottomNav />
    {:else if screen === "wallet"}
        <div class="hub-page-shell"><Wallet /></div>
        <BottomNav />
    {:else if screen === "history"}
        <div class="hub-page-shell"><History /></div>
        <BottomNav />
    {:else if screen === "search"}
        <div class="hub-page-shell"><Search /></div>
        <BottomNav />
    {:else if screen === "cart"}
        <Cart />
    {:else if screen === "order"}
        <Order params={{ outlet_id: "1", shop_no: "1" }} data={{}} />
    {:else if screen === "confirmation"}
        <Confirmation />
    {/if}
{/if}
