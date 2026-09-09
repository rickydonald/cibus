<script lang="ts">
    import { normalizePasswordResetOtp } from "$lib/password-reset";

    let { id, value = $bindable(""), disabled = false }: {
        id: string;
        value?: string;
        disabled?: boolean;
    } = $props();

    let focused = $state(false);
    let selectionStart = $state(0);
    let selectionEnd = $state(0);

    function trackSelection(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        selectionStart = input.selectionStart ?? 0;
        selectionEnd = input.selectionEnd ?? selectionStart;
    }

    function handleInput(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const raw = input.value;
        const start = normalizePasswordResetOtp(raw.slice(0, input.selectionStart ?? raw.length)).length;
        const end = normalizePasswordResetOtp(raw.slice(0, input.selectionEnd ?? raw.length)).length;
        value = normalizePasswordResetOtp(raw);
        // Normalize after insertion so spaces in pasted/SMS codes do not consume digit slots.
        if (input.value !== value) {
            input.value = value;
            input.setSelectionRange(start, end);
        }
        trackSelection(event);
    }
</script>

<div class="otp-field" class:disabled>
    <div class="otp-boxes" aria-hidden="true">
        {#each Array(6) as _, index}
            <div
                class="otp-box"
                class:active={focused && (selectionStart === selectionEnd
                    ? index === Math.min(selectionStart, 5)
                    : index >= selectionStart && index < selectionEnd)}
            ></div>
        {/each}
    </div>
    <div class="otp-text">
        <!-- One real input preserves native selection, clipboard, arrows, and deletion. -->
        <input
            {id}
            value={value}
            {disabled}
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            aria-label="One-time code, six digits"
            spellcheck="false"
            required
            oninput={handleInput}
            onselect={trackSelection}
            onkeyup={trackSelection}
            onclick={trackSelection}
            onfocus={(event) => { focused = true; trackSelection(event); }}
            onblur={() => (focused = false)}
        />
    </div>
</div>

<style>
    .otp-field {
        position: relative;
        container-type: inline-size;
        height: 3.5rem;
    }
    .otp-boxes {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.5rem;
        height: 100%;
    }
    .otp-box {
        border: 1px solid var(--color-line);
        border-radius: 0.75rem;
        background: var(--color-canvas);
    }
    .otp-box.active {
        border-color: var(--color-primary);
        background: var(--color-surface);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    .otp-text {
        position: absolute;
        inset: 0;
        /* Clip without creating a scroll container: focusing the trailing caret
           must never shift the digits away from their boxes. */
        overflow: clip;
        border-radius: 0.75rem;
    }
    input {
        --cell-step: calc((100cqw + 0.5rem) / 6);
        display: block;
        box-sizing: border-box;
        width: calc(100% + var(--cell-step));
        height: 100%;
        border: 0;
        padding: 0;
        padding-left: calc((var(--cell-step) - 0.5rem - 1ch) / 2);
        background: transparent;
        color: var(--color-ink);
        outline: none;
        font-family: var(--font-mono, monospace);
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: calc(var(--cell-step) - 1ch);
        caret-color: var(--color-primary);
    }
    .disabled { opacity: 0.5; }
</style>
