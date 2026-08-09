<script lang="ts">
	import "./layout.css";
	import "@ricky-donald/hades/styles.css"
	import favicon from "$lib/assets/logos/icon.png";
	import { Toaster } from "svelte-sonner";
	import { onMount } from "svelte";
	import { onNavigate } from "$app/navigation";
	import { dev } from "$app/environment";
	import { isHubRoute } from "$lib/nav";
	import { install } from "$lib/client/install.svelte";

	let { children } = $props();

	// Not in onMount: a child's onMount runs before its parent's, so pages
	// asking about install state on mount would beat the listener into place.
	// start() is browser-guarded and idempotent, so init is the safe spot.
	install.start();

	onMount(() => {

		// Remove authenticated API responses cached by older service workers.
		if ("caches" in window) {
			void caches.delete("api-cache");
		}

		if ("serviceWorker" in navigator) {
			if (dev) {
				void navigator.serviceWorker
					.getRegistrations()
					.then((registrations) =>
						Promise.all(
							registrations.map((registration) =>
								registration.unregister(),
							),
						),
					);
				return;
			}

			let reloadingForUpdate = false;
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				if (reloadingForUpdate) return;
				reloadingForUpdate = true;
				window.location.reload();
			});

			void navigator.serviceWorker
				.register("/service-worker.js")
				.then((registration) => {
					const activate = (worker: ServiceWorker | null) => {
						if (worker?.state === "installed") {
							worker.postMessage({ type: "SKIP_WAITING" });
						}
					};

					if (registration.waiting) {
						registration.waiting.postMessage({
							type: "SKIP_WAITING",
						});
					}
					registration.addEventListener("updatefound", () => {
						const worker = registration.installing;
						worker?.addEventListener("statechange", () =>
							activate(worker),
						);
					});
					void registration.update();
				});
		}
	});

	// Run a view transition across the hub <-> detail boundary (e.g. home
	// <-> order menu) so the floating cart bar, which is named on both
	// sides, morphs in place instead of hard-cutting with the page. The
	// rest of the page does a soft crossfade. CSS lives in layout.css.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const from = navigation.from?.url.pathname;
		const to = navigation.to?.url.pathname;
		if (!from || !to) return;

		const isDetail = (p: string) =>
			p.startsWith("/view/") && !isHubRoute(p);
		const crosses =
			(isHubRoute(from) && isDetail(to)) ||
			(isDetail(from) && isHubRoute(to));
		if (!crosses) return;

		// Flag this transition so the page content swaps instantly and
		// only the shared floating cart bar morphs (see layout.css).
		document.documentElement.dataset.nav = "cart";

		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			void transition.finished
				.catch(() => {})
				.finally(() => {
					delete document.documentElement.dataset.nav;
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
		href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Plus+Jakarta+Sans:wght@200..800&display=swap"
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
	<title>Eat Right - Loyola College</title>
</svelte:head>
<Toaster
	position="top-center"
	theme="light"
	closeButton
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
