<script lang="ts">
    import { Sheet } from "@ricky-donald/hades";
    import { toast } from "svelte-sonner";
    import {
        DownloadIcon,
        ExternalLinkIcon,
        ShareIcon,
        SquarePlusIcon,
        ZapIcon,
    } from "@lucide/svelte";
    import { install } from "$lib/client/install.svelte";

    let { open = $bindable(false) }: { open?: boolean } = $props();

    let isPrompting = $state(false);

    const iosSteps = [
        { icon: ShareIcon, text: "Tap the Share button in Safari's toolbar." },
        { icon: SquarePlusIcon, text: 'Scroll down and pick "Add to Home Screen".' },
        { icon: ZapIcon, text: 'Tap "Add" — Eat Right lands on your home screen.' },
    ];

    async function handleInstall() {
        if (isPrompting) return;
        isPrompting = true;
        try {
            const outcome = await install.promptInstall();
            if (outcome === "accepted") {
                open = false;
                toast.success("Eat Right added to your home screen");
            } else if (outcome === "unavailable") {
                toast.error("Your browser didn't offer the install dialog.");
            }
        } finally {
            isPrompting = false;
        }
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(window.location.origin);
            toast.success("Link copied — paste it into your browser");
        } catch {
            toast.error("Couldn't copy the link. Copy it from the address bar.");
        }
    }
</script>

<Sheet
    bind:open
    title="Add Eat Right to your home screen"
    description="Open it like any other app — no browser tabs, and it starts where you left off."
>
    <div class="px-5 pb-6">
        {#if install.mode === "promptable"}
            <button
                type="button"
                class="btn-primary h-13 w-full text-sm"
                onclick={handleInstall}
                disabled={isPrompting}
            >
                <DownloadIcon size={17} strokeWidth={2.2} />
                {isPrompting ? "Waiting for your device..." : "Install app"}
            </button>
        {:else if install.mode === "ios"}
            <ol class="flex flex-col gap-3">
                {#each iosSteps as step, index (index)}
                    <li
                        class="flex items-center gap-3.5 rounded-2xl border border-line bg-canvas p-3.5"
                    >
                        <span
                            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary-soft text-primary-ink"
                        >
                            <step.icon size={17} />
                        </span>
                        <span
                            class="text-[13px] font-medium leading-5 text-ink"
                        >
                            {step.text}
                        </span>
                    </li>
                {/each}
            </ol>
        {:else if install.mode === "webview"}
            <div
                class="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3.5"
            >
                <ExternalLinkIcon
                    size={17}
                    class="mt-0.5 shrink-0 text-warning"
                />
                <p class="text-[13px] font-medium leading-5 text-ink">
                    You're viewing this inside another app, which can't install
                    to your home screen. Open Eat Right in
                    {install.isIOS ? "Safari" : "Chrome"} first — usually from
                    the menu in the corner.
                </p>
            </div>

            <button
                type="button"
                class="btn-quiet mt-3 h-12 w-full text-sm"
                onclick={copyLink}
            >
                Copy link
            </button>
        {/if}

        <button
            type="button"
            class="mt-3 h-11 w-full text-xs font-semibold text-ink-faint transition-colors hover:text-ink-muted"
            onclick={() => {
                install.dismiss();
                open = false;
            }}
        >
            Don't show this again
        </button>
    </div>
</Sheet>
