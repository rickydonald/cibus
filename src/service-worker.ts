/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

import { build, files, version } from "$service-worker";

const ASSETS = `cache${version}`;

const toCache = build.concat(files);
const staticAssets = new Set(toCache);

sw.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(ASSETS).then((cache) => cache.addAll(toCache)).then(() => {
            sw.skipWaiting();
        }),
    );
});

sw.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(async (keys) => {
            for (const key of keys) {
                if (key !== ASSETS) {
                    await caches.delete(key);
                }
            }
            await sw.clients.claim();
        }),
    );
});

async function fetchAndCache(request: Request) {
    const cache = await caches.open(ASSETS);
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return cache.match(request) ?? new Response("Offline", { status: 503 });
    }
}

sw.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    if (url.origin !== location.origin) return;

    if (url.pathname.startsWith("/api/")) {
        event.respondWith(fetchAndCache(event.request));
        return;
    }

    if (staticAssets.has(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
        );
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request) ?? new Response("Offline", { status: 503 })),
    );
});
