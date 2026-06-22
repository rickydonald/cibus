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

<div class="segment-control" role="tablist" aria-label="User Type">
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
        padding: 0.375rem;
        background: rgb(229 229 229);
        border-radius: 1.75rem;
        box-sizing: border-box;
        overflow: hidden;
    }

    .indicator {
        position: absolute;
        top: 0.375rem;
        bottom: 0.375rem;
        left: 0.375rem;

        width: calc((100% - 0.75rem) / 3);

        background: rgb(46 46 46);
        border-radius: 1.4rem;

        box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.08),
            0 1px 2px rgba(0, 0, 0, 0.06);

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
        border-radius: 1.4rem;
        padding: 1rem 1.25rem;

        font-size: 1.125rem;
        font-weight: 500;

        color: rgb(64 64 64);
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

    @media (max-width: 640px) {
        .segment-control {
            padding: 0.25rem;
            border-radius: 1.25rem;
        }

        .indicator {
            top: 0.25rem;
            bottom: 0.25rem;
            left: 0.25rem;
            width: calc((100% - 0.5rem) / 3);
            border-radius: 1rem;
        }

        .segment-button {
            padding: 0.875rem 0.75rem;
            font-size: 1rem;
            border-radius: 1rem;
        }
    }
</style>
