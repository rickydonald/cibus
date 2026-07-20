import assert from "node:assert/strict";
import test from "node:test";
import {
  createCheckoutCartSnapshot,
  matchesCheckoutCartSnapshot,
  type CheckoutCartItem,
} from "../src/lib/checkout-cart-snapshot.ts";

const cart: CheckoutCartItem[] = [
  {
    id: 12,
    amount: 50,
    qty: 2,
    outletid: 3,
    outletname: "Cafe",
    shopno: 4,
    itemname: "Tea",
  },
  {
    id: 8,
    amount: 80,
    qty: 1,
    outletid: 2,
    outletname: "Bakery",
    shopno: 1,
    itemname: "Roll",
  },
];

test("matches the same checkout cart regardless of item ordering", () => {
  const snapshot = createCheckoutCartSnapshot(cart);
  assert.equal(matchesCheckoutCartSnapshot(snapshot, [...cart].reverse()), true);
});

test("detects quantity, price, and item changes after recharge starts", () => {
  const snapshot = createCheckoutCartSnapshot(cart);

  assert.equal(
    matchesCheckoutCartSnapshot(snapshot, [
      { ...cart[0], qty: 3 },
      cart[1],
    ]),
    false,
  );
  assert.equal(
    matchesCheckoutCartSnapshot(snapshot, [
      cart[0],
      { ...cart[1], amount: 85 },
    ]),
    false,
  );
  assert.equal(matchesCheckoutCartSnapshot(snapshot, [cart[0]]), false);
});
