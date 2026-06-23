<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/logos/icon.png";
    import { Toaster } from "svelte-sonner";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
		rel="stylesheet"
	/>
	<link rel="icon" href={favicon} />
	<title>Eat Right</title>
</svelte:head>
<Toaster
	position="top-center"
	class="rounded-2xl"
 />
{@render children()}
