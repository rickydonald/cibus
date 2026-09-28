/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const CACHE_PREFIX = "eatright-static";
const CURRENT_CACHE = `${CACHE_PREFIX}-${version}`;
const LEGACY_CACHES = new Set([
	"api-cache",
	"assets-cache",
	"font-cache",
	"image-cache",
]);

// SvelteKit supplies only this deployment's generated and static assets. Pages,
// API responses, and third-party resources deliberately stay on the network so
// authenticated data can never be replayed from a shared cache.
const cacheableUrls = new Set(
	[...build, ...files].map((path) => new URL(path, self.location.origin).href),
);

self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") {
		void self.skipWaiting();
	}
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			let cacheNames: string[] = [];
			try {
				cacheNames = await caches.keys();
			} catch {
				// Activation and network access should not depend on Cache Storage.
			}

			await Promise.all(
				cacheNames
					.filter(
						(name) =>
							LEGACY_CACHES.has(name) ||
							(name.startsWith(`${CACHE_PREFIX}-`) &&
								name !== CURRENT_CACHE),
					)
					.map((name) => caches.delete(name).catch(() => false)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !cacheableUrls.has(url.href)) {
		return;
	}

	event.respondWith(serveStaticAsset(event));
});

async function serveStaticAsset(event: FetchEvent): Promise<Response> {
	try {
		const cached = await caches.match(event.request, {
			cacheName: CURRENT_CACHE,
		});
		if (cached) return cached;
	} catch {
		// Cache Storage can be unavailable in private browsing or under quota
		// pressure. A normal network request must still succeed in that case.
	}

	const response = await fetch(event.request);
	if (response.ok && response.type === "basic") {
		event.waitUntil(
			caches
				.open(CURRENT_CACHE)
				.then((cache) => cache.put(event.request, response.clone()))
				.catch(() => undefined),
		);
	}

	return response;
}
