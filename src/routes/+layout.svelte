<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/logos/icon.png";
	import { Toaster } from "svelte-sonner";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("/service-worker.js");
		}
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#f5f5f7" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Eat Right" />
	<meta name="mobile-web-app-capable" content="yes" />
	<link rel="apple-touch-icon" href="/icons/512.png" />
	<title>Eat Right</title>
</svelte:head>
<Toaster position="top-center" class="rounded-2xl" />
{@render children()}
