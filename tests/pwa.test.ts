import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { iosSplashScreens } from "../src/lib/pwa.ts";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function assertPng(path: string, width: number, height: number) {
	const file = await readFile(new URL(`../static${path}`, import.meta.url));
	assert.deepEqual(file.subarray(0, 8), pngSignature, path);
	assert.equal(file.readUInt32BE(16), width, path);
	assert.equal(file.readUInt32BE(20), height, path);
}

test("every iOS startup image exists at its declared resolution", async () => {
	assert.ok(iosSplashScreens.length > 0);

	for (const splash of iosSplashScreens) {
		await assertPng(splash.href, splash.width, splash.height);
		assert.match(splash.media, /orientation: portrait/);
	}
});

test("legacy Apple and Android install icons have valid dimensions", async () => {
	for (const size of [96, 144, 192, 384, 512]) {
		await assertPng(`/icons/${size}.png`, size, size);
	}
	await assertPng("/icons/apple-touch-icon-57.png", 57, 57);
	await assertPng("/icons/apple-touch-icon-114.png", 114, 114);

	const manifest = JSON.parse(
		await readFile(
			new URL("../static/manifest.json", import.meta.url),
			"utf8",
		),
	) as { icons: Array<{ sizes: string; purpose: string }> };
	const anySizes = new Set(
		manifest.icons
			.filter((icon) => icon.purpose === "any")
			.map((icon) => icon.sizes),
	);
	for (const size of [96, 144, 192, 384, 512]) {
		assert.ok(anySizes.has(`${size}x${size}`));
	}
});

test("the service worker uses SvelteKit's versioned asset list", async () => {
	const source = await readFile(
		new URL("../src/service-worker.ts", import.meta.url),
		"utf8",
	);

	assert.match(source, /from "\$service-worker"/);
	assert.doesNotMatch(source, /__WB_MANIFEST|from "workbox-/);
	assert.match(source, /url\.origin !== self\.location\.origin/);
});
