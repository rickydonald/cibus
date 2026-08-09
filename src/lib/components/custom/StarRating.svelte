<script lang="ts">
    import { StarIcon } from "@lucide/svelte";

    interface Props {
        /** 0 means unrated. Only whole stars — halves are never produced. */
        value?: number;
        name?: string;
        size?: number;
        disabled?: boolean;
    }

    let {
        value = $bindable(0),
        name = "rating",
        size = 34,
        disabled = false,
    }: Props = $props();

    const STARS = [1, 2, 3, 4, 5];
    const LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

    // Mouse-only preview. Keyboard selection moves `value` itself, so the
    // fill below always reflects whichever is more recent.
    let hovered = $state(0);

    const shown = $derived(hovered || value);
    const caption = $derived(shown ? LABELS[shown - 1] : "Tap a star to rate");
</script>

<div class="flex flex-col items-center gap-2.5">
    <div
        class="flex items-center gap-0.5"
        onmouseleave={() => (hovered = 0)}
        role="presentation"
    >
        {#each STARS as star (star)}
            {@const filled = star <= shown}
            <label
                class="p-1 {disabled ? 'cursor-not-allowed' : 'cursor-pointer'}"
                onmouseenter={() => !disabled && (hovered = star)}
            >
                <input
                    type="radio"
                    {name}
                    {disabled}
                    value={star}
                    bind:group={value}
                    aria-label="{star} {star === 1 ? 'star' : 'stars'}"
                    class="peer sr-only"
                />
                <span
                    class="block rounded-circle transition-transform duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-6 peer-focus-visible:outline-primary {filled &&
                    !disabled
                        ? 'scale-110'
                        : ''}"
                >
                    <StarIcon
                        {size}
                        strokeWidth={1.6}
                        class="transition-colors duration-150 {filled
                            ? 'fill-current text-yellow-400'
                            : 'text-line-strong'}"
                    />
                </span>
            </label>
        {/each}
    </div>

    <p
        class="text-[13px] font-semibold tracking-tight {shown
            ? 'text-ink'
            : 'text-ink-faint'}"
        aria-live="polite"
    >
        {caption}
    </p>
</div>
