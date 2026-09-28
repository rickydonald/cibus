import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cart navigation does not require Object.groupBy", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/lib/store/cart.svelte.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/view/cart/+page.svelte", import.meta.url), "utf8"),
  ]);

  for (const source of sources) assert.doesNotMatch(source, /Object\.groupBy/);
});

test("client and worker code avoid post-ES2018 runtime requirements", async () => {
	const sources = await Promise.all([
		readFile(new URL("../src/service-worker.ts", import.meta.url), "utf8"),
		readFile(new URL("../src/lib/checkout-id.ts", import.meta.url), "utf8"),
		readFile(new URL("../src/lib/utils/display-text.ts", import.meta.url), "utf8"),
		readFile(
			new URL("../src/routes/view/confirmation/+page.svelte", import.meta.url),
			"utf8",
		),
		readFile(
			new URL("../src/routes/view/search/+page.svelte", import.meta.url),
			"utf8",
		),
	]);

	for (const source of sources) {
		assert.doesNotMatch(
			source,
			/Promise\.allSettled|\.flat\(|\.matchAll\(|globalThis/,
		);
	}
});

test("production JavaScript targets legacy native-module browsers", async () => {
	const config = await readFile(
		new URL("../vite.config.ts", import.meta.url),
		"utf8",
	);

	for (const target of ["chrome64", "safari12", "ios12"]) {
		assert.match(config, new RegExp(`['\"]${target}['\"]`));
	}
});
