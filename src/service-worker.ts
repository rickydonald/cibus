/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
    CacheFirst,
    NetworkOnly,
    StaleWhileRevalidate
} from "workbox-strategies";

import { ExpirationPlugin } from "workbox-expiration";


declare let self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<{
        url: string;
        revision?: string | null;
    }>;
};

precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

clientsClaim();

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// API responses contain authenticated, user-specific data and must never be
// shared or replayed from a runtime cache. Remove the previous cache as soon
// as this service worker activates.
self.addEventListener("activate", (event) => {
    event.waitUntil(caches.delete("api-cache"));
});

registerRoute(
    ({ url }) => url.pathname.startsWith("/api/"),
    new NetworkOnly()
);

registerRoute(
    ({ request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker",
    new StaleWhileRevalidate({
        cacheName: "assets-cache"
    })
);

registerRoute(
    ({ request }) => request.destination === "font",
    new CacheFirst({
        cacheName: "font-cache",
        plugins: [
            new ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
            })
        ]
    })
);

registerRoute(
    ({ request }) => request.destination === "image",
    new CacheFirst({
        cacheName: "image-cache",
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
            })
        ]
    })
);
