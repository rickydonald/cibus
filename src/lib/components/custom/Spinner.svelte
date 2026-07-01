<script lang="ts">
    interface Props {
        size?: number | string;
        class?: string;
        color?: string;
        strokeWidth?: number;
    }

    let {
        size = 16,
        class: className = "",
        color = "currentColor",
        strokeWidth = 4,
    }: Props = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class={`animate-spin ${className}`}
    style={`color: ${color};`}
    aria-hidden="true"
>
    <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width={strokeWidth}
        class="opacity-25"
    />

    <path
        fill="currentColor"
        class="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
</svg>
