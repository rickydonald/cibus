<!--
  Quantity stepper. Deliberately flat: it lives inside list rows, and a raised
  control in every row would compete with the screen's one focal object. The
  press feedback is a hard colour inversion instead of an extrusion collapse —
  same mechanical vocabulary, no added depth.
-->
<script lang="ts">
    import { MinusIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";

    let {
        value = $bindable(1),
        min = 1,
        max = Infinity,
        onchange = undefined,
        onremove = undefined,
        disabled = false,
    }: {
        value?: number;
        min?: number;
        max?: number;
        onchange?: (next: number) => void;
        onremove?: () => void;
        disabled?: boolean;
    } = $props();

    // At the floor the minus turns into a bin: the control tells you what the
    // next press actually does rather than silently refusing.
    let atFloor = $derived(value <= min);

    function step(delta: number) {
        const next = value + delta;
        if (next < min) {
            onremove?.();
            return;
        }
        if (next > max) return;
        value = next;
        onchange?.(next);
    }
</script>

<div class="inline-flex items-stretch border border-line bg-surface">
    <button
        type="button"
        class="flex h-9 w-9 items-center justify-center text-ink transition-colors active:bg-ink active:text-white disabled:opacity-30"
        onclick={() => step(-1)}
        {disabled}
        aria-label={atFloor ? "Remove item" : "Decrease quantity"}
    >
        {#if atFloor && onremove}
            <Trash2Icon size={15} strokeWidth={2.4} />
        {:else}
            <MinusIcon size={15} strokeWidth={3} />
        {/if}
    </button>

    <span
        class="flex h-9 min-w-9 items-center justify-center border-x border-line px-1 text-sm font-extrabold tabular-nums"
        aria-live="polite"
    >
        {value}
    </span>

    <button
        type="button"
        class="flex h-9 w-9 items-center justify-center text-ink transition-colors active:bg-ink active:text-white disabled:opacity-30"
        onclick={() => step(1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
    >
        <PlusIcon size={15} strokeWidth={3} />
    </button>
</div>
