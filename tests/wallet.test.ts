import assert from "node:assert/strict";
import test from "node:test";
import {
    remainingWalletCapacity,
    walletLimitMessage,
    wouldExceedWalletLimit,
} from "../src/lib/wallet.ts";
import { createPaymentCallbackPath } from "../src/lib/server/payment-callback.ts";

test("sends only the Svelte callback path to the JSP backend", () => {
    assert.equal(
        createPaymentCallbackPath("/view/wallet"),
        "/view/wallet/callback?return=%2Fview%2Fwallet",
    );
    assert.equal(
        createPaymentCallbackPath("/view/cart"),
        "/view/wallet/callback?return=%2Fview%2Fcart",
    );
});

test("limits the wallet by its resulting balance", () => {
    assert.equal(remainingWalletCapacity(980), 20);
    assert.equal(wouldExceedWalletLimit(980, 20), false);
    assert.equal(wouldExceedWalletLimit(980, 30), true);
});

test("blocks every recharge when the wallet already has Rs.1000", () => {
    assert.equal(remainingWalletCapacity(1000), 0);
    assert.equal(wouldExceedWalletLimit(1000, 1), true);
    assert.match(walletLimitMessage(1000), /reached the ₹1,000 limit/);
});

test("handles paise without floating-point limit errors", () => {
    assert.equal(remainingWalletCapacity(999.9), 0.1);
    assert.equal(wouldExceedWalletLimit(999.9, 0.1), false);
    assert.equal(wouldExceedWalletLimit(999.9, 0.11), true);
});
