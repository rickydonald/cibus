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
