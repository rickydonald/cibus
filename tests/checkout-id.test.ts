import assert from "node:assert/strict";
import test from "node:test";
import { CHECKOUT_ID_PATTERN, createCheckoutId } from "../src/lib/checkout-id.ts";

test("creates valid UUID v4 checkout IDs without Web Crypto", () => {
  const ids = Array.from({ length: 100 }, () => createCheckoutId(null));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, CHECKOUT_ID_PATTERN);
});

test("uses randomUUID when the browser provides it", () => {
  const expected = "12345678-1234-4123-8123-123456789abc";
  assert.equal(createCheckoutId({ randomUUID: () => expected }), expected);
});
