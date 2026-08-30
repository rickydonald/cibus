<!--
  Status tag. On a light ground NeoPop tints the background and saturates the
  text; the asymmetric vertical padding optically centres uppercase caps text,
  which sits high in its line box.
-->
<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        tone = "info",
        class: klass = "",
        children,
    }: {
        tone?: "success" | "danger" | "warning" | "info" | "ink";
        class?: string;
        children?: Snippet;
    } = $props();

    const tones = {
        success: "bg-success-soft text-success",
        danger: "bg-danger-soft text-danger",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        ink: "bg-ink text-white",
    } as const;
</script>

<span
    class="inline-flex items-center px-2.5 pt-[5px] pb-[4px] text-[10px] font-extrabold uppercase tracking-[0.16em] {tones[tone]} {klass}"
>
    {@render children?.()}
</span>
