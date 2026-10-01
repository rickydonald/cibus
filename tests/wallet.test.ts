import assert from "node:assert/strict";
import test from "node:test";
import {
    isValidRechargeAmount,
    isWalletRefund,
} from "../src/lib/wallet.ts";
import { createPaymentCallbackPath } from "../src/lib/server/payment-callback.ts";

test("sends only the Svelte callback path to the JSP backend", () => {
    assert.equal(
        createPaymentCallbackPath(),
        "/view/wallet/callback?return=%2Fview%2Fwallet",
    );
});

test("distinguishes refunds from wallet recharges", () => {
    assert.equal(isWalletRefund("Order cancellation refund: ORD-1"), true);
    assert.equal(isWalletRefund("Re-Fund"), true);
    assert.equal(isWalletRefund("Online Recharge"), false);
});

test("accepts whole-rupee recharges above the former Rs.1000 limit", () => {
    assert.equal(isValidRechargeAmount(1), true);
    assert.equal(isValidRechargeAmount(1001), true);
    assert.equal(isValidRechargeAmount(50_000), true);
    assert.equal(isValidRechargeAmount(0), false);
    assert.equal(isValidRechargeAmount(10.5), false);
    assert.equal(isValidRechargeAmount(Number.POSITIVE_INFINITY), false);
});
