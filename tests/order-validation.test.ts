import assert from "node:assert/strict";
import test from "node:test";
import { hasDuplicateItemIds } from "../src/lib/order-validation.ts";

test("rejects duplicate item IDs even when other cart fields differ", () => {
  assert.equal(hasDuplicateItemIds([{ id: 12 }, { id: 99 }, { id: 12 }]), true);
});

test("accepts a cart containing unique item IDs", () => {
  assert.equal(hasDuplicateItemIds([{ id: 12 }, { id: 99 }, { id: 41 }]), false);
});
