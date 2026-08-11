import assert from "node:assert/strict";
import test from "node:test";
import { TtlCache, hashCacheKey } from "../src/lib/server/cache.ts";

test("uses a full SHA-256 digest for user-specific cache keys", () => {
    const first = hashCacheKey("token-one");
    const second = hashCacheKey("token-two");

    assert.equal(first.length, 43);
    assert.notEqual(first, second);
    assert.equal(first, hashCacheKey("token-one"));
});

test("evicts expired cache entries", () => {
    const originalNow = Date.now;
    let now = 1_000;
    Date.now = () => now;
    try {
        const cache = new TtlCache<string>(100);
        cache.set("expired", "value");
        now += 101;
        assert.equal(cache.get("expired"), undefined);
    } finally {
        Date.now = originalNow;
    }
});

test("bounds cache entries by evicting the oldest key", () => {
    const cache = new TtlCache<string>(10_000, 2);
    cache.set("first", "1");
    cache.set("second", "2");
    cache.set("third", "3");

    assert.equal(cache.get("first"), undefined);
    assert.equal(cache.get("second"), "2");
    assert.equal(cache.get("third"), "3");
});
