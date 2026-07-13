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
    .segment-control {
        position: relative;
        display: flex;
        width: 100%;
        padding: 0.25rem;
        background: var(--color-primary-soft);
        border: 1px solid var(--color-line);
        border-radius: 1rem;
        box-sizing: border-box;
        overflow: hidden;
    }

    .indicator {
        position: absolute;
        top: 0.25rem;
        bottom: 0.25rem;
        left: 0.25rem;

        width: calc((100% - 0.5rem) / 3);

        background: var(--color-primary);
        border-radius: 0.75rem;

        box-shadow:
            0 2px 8px rgba(26, 52, 82, 0.12),
            0 1px 2px rgba(26, 52, 82, 0.08);

        transition:
            transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
            width 200ms ease;

        will-change: transform;
        z-index: 0;
    }

    .segment-button {
        flex: 1;
        border: none;
        background: transparent;
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;

        font-size: 0.875rem;
        font-weight: 650;

        color: var(--color-ink-muted);
        cursor: pointer;

        position: relative;
        z-index: 1;

        transition:
            color 250ms ease,
            transform 150ms ease;

        white-space: nowrap;
    }

    .segment-button.active {
        color: white;
    }

    .segment-button:active {
        transform: scale(0.98);
    }

    .segment-button:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -3px;
    }
</style>
