<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeftIcon } from "@lucide/svelte";

    interface Props {
        showBackButton?: boolean;
        title: string;
    }
    let { showBackButton, title }: Props = $props();
</script>

<div class="page-header">
    <div
        class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto"
    >
        {#if showBackButton}
            <button
                onclick={() => goto('/view/home')}
                class="icon-btn"
                aria-label="Go back"
            >
                <ArrowLeftIcon class="h-4 w-4" />
            </button>
        {/if}

        <div>
            <h1 class="text-lg font-bold tracking-tight text-ink">
                {title}
            </h1>
        </div>
    </div>
</div>
