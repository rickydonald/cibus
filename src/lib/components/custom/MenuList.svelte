<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        /** Uppercase group caption above the card. */
        label?: string;
        /** Small print below the card, for guidance too long to sit in a row. */
        footnote?: string;
        children: Snippet;
        class?: string;
    }

    let { label, footnote, children, class: className = "" }: Props = $props();
</script>

<section class={className}>
    {#if label}
        <h2 class="section-label px-2 pb-2">{label}</h2>
    {/if}

    <div class="menu-list">
        {@render children()}
    </div>

    {#if footnote}
        <p class="px-2 pt-2 text-xs font-medium leading-5 text-ink-muted">
            {footnote}
        </p>
    {/if}
</section>
