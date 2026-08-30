<!--
  A plate. Flat by default and held by a hairline — depth is an emphasis
  device, so most surfaces on a screen should not have it.

  `raised` gives it the real extrusion. Reach for it when the card is the
  focal object of the screen, not to make a list look nicer.
-->
<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        raised = false,
        tone = "surface",
        padding = "p-4",
        class: klass = "",
        children,
        ...rest
    }: {
        raised?: boolean;
        tone?: "surface" | "accent" | "ink";
        padding?: string;
        class?: string;
        children?: Snippet;
        [key: string]: unknown;
    } = $props();

    const tones = {
        surface: {
            face: "var(--color-surface)",
            ink: "var(--color-ink)",
            right: "var(--color-np-white-50)",
            bottom: "var(--color-np-black-50)",
        },
        accent: {
            face: "var(--color-accent)",
            ink: "var(--color-ink)",
            right: "var(--color-accent-edge)",
            bottom: "var(--color-accent-deep)",
        },
        ink: {
            face: "var(--color-ink)",
            ink: "#ffffff",
            right: "var(--color-np-black-50)",
            bottom: "var(--color-np-black-70)",
        },
    } as const;

    let t = $derived(tones[tone]);
</script>

{#if raised}
    <div
        class="np-elevate np-static block w-full {klass}"
        style="--np-face:{t.face};--np-ink:{t.ink};--np-edge-right:{t.right};--np-edge-bottom:{t.bottom}"
        {...rest}
    >
        <div class="np-face {padding}">{@render children?.()}</div>
    </div>
{:else}
    <div
        class="border border-hairline {padding} {klass}"
        style="background:{t.face};color:{t.ink}"
        {...rest}
    >
        {@render children?.()}
    </div>
{/if}
