<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/logos/icon.png";
	import { Toaster } from "svelte-sonner";
	import { onMount } from "svelte";
	import { onNavigate } from "$app/navigation";
	import { dev } from "$app/environment";

	let { children } = $props();

	onMount(() => {
		// Remove authenticated API responses cached by older service workers.
		if ("caches" in window) {
			void caches.delete("api-cache");
		}

		if ("serviceWorker" in navigator) {
			if (dev) {
				void navigator.serviceWorker.getRegistrations().then((registrations) =>
					Promise.all(registrations.map((registration) => registration.unregister())),
				);
				return;
			}

			let reloadingForUpdate = false;
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				if (reloadingForUpdate) return;
				reloadingForUpdate = true;
				window.location.reload();
			});

			void navigator.serviceWorker.register("/service-worker.js").then((registration) => {
				const activate = (worker: ServiceWorker | null) => {
					if (worker?.state === "installed") {
						worker.postMessage({ type: "SKIP_WAITING" });
					}
				};

				if (registration.waiting) {
					registration.waiting.postMessage({ type: "SKIP_WAITING" });
				}
				registration.addEventListener("updatefound", () => {
					const worker = registration.installing;
					worker?.addEventListener("statechange", () => activate(worker));
				});
				void registration.update();
			});
		}
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap"
		rel="stylesheet"
	/>

	<link
		href="https://fonts.googleapis.com/css2?family=Red+Hat+Mono:wght@300..700&display=swap"
		rel="stylesheet"
	/>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#f5f6f8" />
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
	/>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Eat Right" />
	<meta name="mobile-web-app-capable" content="yes" />
	<link rel="apple-touch-icon" href="/icons/512.png" />
	<title>Eat Right</title>
</svelte:head>
<Toaster
	position="top-center"
	theme="light"
	closeButton
	expand
	duration={3500}
	gap={10}
	visibleToasts={3}
	offset={{ top: "calc(var(--safe-area-inset-top) + 1rem)" }}
	mobileOffset={{
		top: "calc(var(--safe-area-inset-top) + 0.75rem)",
		left: "0.75rem",
		right: "0.75rem",
	}}
	toastOptions={{
		classes: {
			toast: "eatright-toast",
			content: "eatright-toast-content",
			title: "eatright-toast-title",
			description: "eatright-toast-description",
			icon: "eatright-toast-icon",
			closeButton: "eatright-toast-close",
			actionButton: "eatright-toast-action",
			cancelButton: "eatright-toast-cancel",
		},
	}}
/>
{@render children()}
