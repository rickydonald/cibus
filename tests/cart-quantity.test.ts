import assert from "node:assert/strict";
import test from "node:test";
import { availableItemQuantity } from "../src/lib/cart-quantity.ts";

test("uses available stock instead of a hard quantity cap", () => {
    assert.equal(availableItemQuantity(5), 5);
    assert.equal(availableItemQuantity(10), 10);
    assert.equal(availableItemQuantity(75), 75);
    assert.equal(availableItemQuantity(0), 0);
    assert.equal(availableItemQuantity(2.5), 0);
    assert.equal(availableItemQuantity(Number.POSITIVE_INFINITY), 0);
});
