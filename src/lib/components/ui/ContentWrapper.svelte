<script lang="ts">
    let { children }: { children: import("svelte").Snippet } = $props();
</script>

<div class="mx-auto w-full max-w-2xl">
    {@render children()}
</div>
