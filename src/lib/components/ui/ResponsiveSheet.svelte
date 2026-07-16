<script lang="ts">
    import { BottomSheet } from "svelte-bottom-sheet";

    let {
        isOpen = $bindable(false),
        settings = {},
        mobileContentClass = "px-6 pt-6 pb-8 relative",
        desktopPanelClass = "",
        showDesktopCloseButton = false,
        children,
    }: {
        isOpen?: boolean;
        settings?: Record<string, unknown>;
        mobileContentClass?: string;
        desktopPanelClass?: string;
        showDesktopCloseButton?: boolean;
        children: import("svelte").Snippet;
    } = $props();
</script>

<BottomSheet bind:isSheetOpen={isOpen} settings={settings}>
    <BottomSheet.Overlay />
    <BottomSheet.Sheet>
        <BottomSheet.Content>
            <div class={mobileContentClass}>
                {#if showDesktopCloseButton}
                    <button
                        type="button"
                        aria-label="Close"
                        onclick={() => (isOpen = false)}
                        class="hidden sm:flex absolute top-4 right-4 w-9 h-9 bg-gray-200 hover:bg-gray-300 items-center justify-center rounded-circle transition-colors duration-200 z-50"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-700">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                {/if}
                {@render children()}
            </div>
            {#if desktopPanelClass}
                <div class={desktopPanelClass}>
                    {@render children()}
                </div>
            {/if}
        </BottomSheet.Content>
    </BottomSheet.Sheet>
</BottomSheet>
