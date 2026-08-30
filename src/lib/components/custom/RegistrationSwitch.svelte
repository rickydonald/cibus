<script lang="ts">
    let { value = "student", onChange } = $props<{
        value?: "student" | "staff" | "guest";
        onChange?: (value: "student" | "staff" | "guest") => void;
    }>();

    const options = [
        { key: "student", label: "Student" },
        { key: "staff", label: "Staff" },
        { key: "guest", label: "Guest" },
    ] as const;

    const activeIndex = $derived.by(() =>
        options.findIndex((o) => o.key === value),
    );
</script>

<div class="segment-control" role="tablist" aria-label="Account type">
    <div
        class="indicator"
        style="transform: translateX(calc({activeIndex} * 100%));"
    ></div>

    {#each options as option}
        <button
            type="button"
            role="tab"
            aria-selected={value === option.key}
            class="segment-button"
            class:active={value === option.key}
            onclick={() => onChange?.(option.key)}
        >
            {option.label}
        </button>
    {/each}
</div>

<style>
    /* Square segmented control. The indicator is a hard black block that
     * slides — no radius, no shadow, and a short mechanical transition, since
     * the vocabulary here is a solid object moving rather than a spring. */
    .segment-control {
        position: relative;
        display: flex;
        width: 100%;
        background: var(--color-surface);
        border: 1px solid var(--color-line);
        box-sizing: border-box;
        overflow: hidden;
    }

    .indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: calc(100% / 3);
        background: var(--color-ink);
        transition: transform 160ms ease-in-out;
        will-change: transform;
        z-index: 0;
    }

    .segment-button {
        flex: 1;
        border: none;
        background: transparent;
        padding: 0.8rem 1rem;

        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.14em;

        color: var(--color-ink-faint);
        cursor: pointer;

        position: relative;
        z-index: 1;

        transition: color 160ms ease;
        white-space: nowrap;
    }

    .segment-button.active {
        color: white;
    }

    .segment-button:focus-visible {
        outline: 2px solid var(--color-accent-edge);
        outline-offset: -3px;
    }

    @media (prefers-reduced-motion: reduce) {
        .indicator {
            transition: none;
        }
    }
</style>
