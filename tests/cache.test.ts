import assert from "node:assert/strict";
import test from "node:test";
import { hashCacheKey } from "../src/lib/server/cache.ts";

test("uses a full SHA-256 digest for user-specific cache keys", () => {
  const first = hashCacheKey("token-one");
  const second = hashCacheKey("token-two");

  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.equal(first, hashCacheKey("token-one"));
});
