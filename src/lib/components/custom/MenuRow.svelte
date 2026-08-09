<script lang="ts">
    import type { Snippet } from "svelte";
    import { ChevronRightIcon } from "@lucide/svelte";
    import Spinner from "$lib/components/custom/Spinner.svelte";
    import type { PasscodeIcon } from "@untitled-theme/icons-svelte";

    interface Props {
        title: string;
        hint?: string;
        /** Leading icon. Any icon component sharing lucide's prop shape. */
        icon?: typeof ChevronRightIcon | typeof PasscodeIcon;
        /** Set to render an <a>. Without it the row is a <button>. */
        href?: string;
        onclick?: (event: MouseEvent) => void;
        /** "danger" tints the icon chip and label for destructive actions. */
        tone?: "default" | "danger";
        disabled?: boolean;
        /** Swaps the chevron for a spinner and blocks further presses. */
        loading?: boolean;
        /** Trailing detail text, shown before the chevron. */
        value?: string;
        /** Turn off for terminal actions — a chevron promises somewhere to go. */
        chevron?: boolean;
        /** Replaces the value and chevron entirely: toggles, badges, counts. */
        trailing?: Snippet;
    }

    let {
        title,
        hint,
        icon: Icon,
        href,
        onclick,
        tone = "default",
        disabled = false,
        loading = false,
        value,
        chevron = true,
        trailing,
    }: Props = $props();

    const isDanger = $derived(tone === "danger");
    const isBlocked = $derived(disabled || loading);
</script>

{#snippet body()}
    {#if Icon}
        <span
            class="menu-row-icon {isDanger
                ? 'border-danger/10 bg-danger-soft text-danger'
                : ''}"
        >
            <Icon size={17} width={19} />
        </span>
    {/if}

    <span class="menu-row-body">
        <span class="min-w-0 flex-1">
            <span class="menu-row-title {isDanger ? 'text-danger' : ''}">
                {title}
            </span>
            {#if hint}
                <span class="menu-row-hint">{hint}</span>
            {/if}
        </span>

        {#if trailing}
            {@render trailing()}
        {:else if loading}
            <Spinner size={16} class="shrink-0 text-ink-faint" />
        {:else}
            {#if value}
                <span class="menu-row-value">{value}</span>
            {/if}
            {#if chevron}
                <ChevronRightIcon size={17} class="menu-row-chevron" />
            {/if}
        {/if}
    </span>
{/snippet}

{#if href}
    <a {href} class="menu-row group">
        {@render body()}
    </a>
{:else}
    <button type="button" class="menu-row group" {onclick} disabled={isBlocked}>
        {@render body()}
    </button>
{/if}
