import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingPayment,
  getPendingPayment,
  setPendingPayment,
} from "../src/lib/client/pending-payment.ts";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

test("persists and cancels a pending payment across page restores", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(global, "window");
  Object.defineProperty(global, "window", {
    configurable: true,
    value: {
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
    },
  });

  try {
    const pending = setPendingPayment("ORD123", "/view/wallet");
    assert.equal(pending?.orderId, "ORD123");
    assert.equal(getPendingPayment()?.orderId, "ORD123");

    clearPendingPayment();
    assert.equal(getPendingPayment(), null);
  } finally {
    if (originalWindow) Object.defineProperty(global, "window", originalWindow);
    else Reflect.deleteProperty(global, "window");
  }
});
