/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
    CacheFirst,
    NetworkFirst,
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

registerRoute(
    ({ url }) => url.pathname.startsWith("/api/"),
    new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 60 * 60
            })
        ]
    })
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

/* ---------------- Push Notifications ---------------- */

self.addEventListener("push", (event) => {
    if (!event.data) return;

    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title ?? "Eat Right", {
            body: data.body,
            icon: data.icon ?? "/icons/icon-192x192.png",
            badge: data.badge ?? "/icons/icon-192x192.png",
            tag: data.tag,
            data: data.data,
            requireInteraction: data.requireInteraction,
            silent: data.silent,
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url ?? "/";

    event.waitUntil(
        self.clients
            .matchAll({
                type: "window",
                includeUncontrolled: true
            })
            .then((clientList) => {
                for (const client of clientList) {
                    if ("focus" in client) {
                        return client.focus();
                    }
                }
                return self.clients.openWindow(url);
            })
    );
});