<script lang="ts">
    import { page } from "$app/state";
    import { isHubRoute } from "$lib/nav";
    import BottomNav from "$lib/components/custom/BottomNav.svelte";

    let { children }: { children: import("svelte").Snippet } = $props();

    const showBottomNav = $derived(isHubRoute(page.url.pathname));
</script>

{#if showBottomNav}
    <div class="hub-page-shell">
        {@render children()}
    </div>
    <BottomNav />
{:else}
    {@render children()}
{/if}
