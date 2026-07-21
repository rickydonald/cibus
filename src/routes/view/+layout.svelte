<script lang="ts">
    import { page } from "$app/state";
    import { isHubRoute } from "$lib/nav";
    import BottomNav from "$lib/components/custom/BottomNav.svelte";
    import SideNav from "$lib/components/custom/SideNav.svelte";
    import { cart } from "$lib/stores/cart.svelte";

    let { data, children }: {
        data: { userid: string };
        children: import("svelte").Snippet;
    } = $props();

    $effect(() => cart.scopeToUser(data.userid));

    const showBottomNav = $derived(isHubRoute(page.url.pathname));
</script>

<SideNav />

<div class="lg:pl-64">
    {#if showBottomNav}
        <div class="hub-page-shell">
            {@render children()}
        </div>
    {:else}
        {@render children()}
    {/if}
</div>

{#if showBottomNav}
    <BottomNav />
{/if}
