<!--
  NeoPop button.

  `elevated` is the extruded one — it is the emphasis device, so a screen
  should normally carry exactly one. `flat` is the same face with no side
  faces, for secondary actions and for anything sitting inside an already
  raised surface (stacked extrusions read as noise). `link` is text with a
  1px underline.

  Sizes are fixed heights with horizontal-only padding; the label centres via
  flex. That is what keeps a row of buttons optically aligned regardless of
  label length.
-->
<script lang="ts">
    import type { Snippet } from "svelte";

    type Kind = "elevated" | "flat" | "link";
    type Tone =
        | "accent"
        | "purple"
        | "pink"
        | "sun"
        | "mint"
        | "tang"
        | "plain"
        | "ink"
        | "danger";
    type Size = "big" | "medium" | "small";

    let {
        kind = "elevated",
        tone = "accent",
        size = "medium",
        fullWidth = false,
        disabled = false,
        href = undefined,
        children,
        class: klass = "",
        ...rest
    }: {
        kind?: Kind;
        tone?: Tone;
        size?: Size;
        fullWidth?: boolean;
        disabled?: boolean;
        href?: string;
        children?: Snippet;
        class?: string;
        [key: string]: unknown;
    } = $props();

    // Every family below is a NeoPop ramp: face = 500, right edge = 600,
    // bottom edge = 700. Edges come off the ramp rather than from a computed
    // darken, which desaturates and muddies the faces.
    //
    // Tone carries meaning, not taste — see the role table in layout.css.
    // Light faces take black ink; only ink/danger/purple/pink carry white.
    const tones = {
        accent: {
            face: "var(--color-accent)",
            ink: "var(--color-ink)",
            right: "var(--color-accent-edge)",
            bottom: "var(--color-accent-deep)",
            border: "",
        },
        purple: {
            face: "var(--color-purple)",
            ink: "#ffffff",
            right: "var(--color-purple-edge)",
            bottom: "var(--color-purple-deep)",
            border: "",
        },
        pink: {
            face: "var(--color-pink)",
            ink: "#ffffff",
            right: "var(--color-pink-edge)",
            bottom: "var(--color-pink-deep)",
            border: "",
        },
        sun: {
            face: "var(--color-sun)",
            ink: "var(--color-ink)",
            right: "var(--color-sun-edge)",
            bottom: "var(--color-sun-deep)",
            border: "",
        },
        mint: {
            face: "var(--color-mint)",
            ink: "var(--color-ink)",
            right: "var(--color-mint-edge)",
            bottom: "var(--color-mint-deep)",
            border: "",
        },
        tang: {
            face: "var(--color-tang)",
            ink: "var(--color-ink)",
            right: "var(--color-tang-edge)",
            bottom: "var(--color-tang-deep)",
            border: "",
        },
        plain: {
            face: "var(--color-surface)",
            ink: "var(--color-ink)",
            right: "var(--color-np-white-50)",
            bottom: "var(--color-np-black-50)",
            border: "border border-line",
        },
        ink: {
            face: "var(--color-ink)",
            ink: "#ffffff",
            right: "var(--color-np-black-50)",
            bottom: "var(--color-np-black-70)",
            border: "",
        },
        danger: {
            face: "var(--color-danger)",
            ink: "#ffffff",
            right: "#f47564",
            bottom: "#b3392a",
            border: "",
        },
    } as const;

    const sizes = {
        big: "h-[50px] px-[30px] text-sm",
        medium: "h-10 px-5 text-xs",
        small: "h-[30px] px-[25px] text-[11px]",
    } as const;

    let t = $derived(tones[tone]);
    let vars = $derived(
        `--np-face:${t.face};--np-ink:${t.ink};--np-edge-right:${t.right};--np-edge-bottom:${t.bottom}`,
    );
    let faceClass = $derived(
        `np-face flex items-center justify-center gap-2 font-extrabold uppercase tracking-[0.12em] ${sizes[size]} ${t.border} ${fullWidth ? "w-full" : ""}`,
    );
    let shellClass = $derived(
        `${fullWidth ? "block w-full" : "inline-flex w-fit"} cursor-pointer select-none border-0 bg-transparent p-0 disabled:pointer-events-none disabled:opacity-40 ${klass}`,
    );
</script>

{#if kind === "link"}
    <svelte:element
        this={href ? "a" : "button"}
        {href}
        class="inline-flex cursor-pointer border-b border-current p-0 text-sm font-extrabold uppercase tracking-[0.12em] disabled:opacity-40 {klass}"
        disabled={href ? undefined : disabled}
        role={href ? undefined : "button"}
        {...rest}
    >
        {@render children?.()}
    </svelte:element>
{:else if kind === "flat"}
    <svelte:element
        this={href ? "a" : "button"}
        {href}
        class="{shellClass} {sizes[size]} {t.border} flex items-center justify-center gap-2 font-extrabold uppercase tracking-[0.12em] transition-transform active:translate-x-px active:translate-y-px"
        style="background:{t.face};color:{t.ink}"
        disabled={href ? undefined : disabled}
        {...rest}
    >
        {@render children?.()}
    </svelte:element>
{:else}
    <svelte:element
        this={href ? "a" : "button"}
        {href}
        class="np-elevate {shellClass}"
        style={vars}
        disabled={href ? undefined : disabled}
        aria-disabled={href && disabled ? "true" : undefined}
        {...rest}
    >
        <span class={faceClass}>{@render children?.()}</span>
    </svelte:element>
{/if}
