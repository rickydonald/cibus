import assert from "node:assert/strict";
import test from "node:test";
import {
    paginateWalletTransactions,
    parseWalletTransactionPage,
    WALLET_TRANSACTION_PAGE_SIZE,
} from "../src/lib/wallet-pagination.ts";

const transactions = Array.from({ length: 61 }, (_, index) => ({
    id: index + 1,
    sort_time: index + 1,
}));

test("caps each wallet transaction page at 25 entries", () => {
    const firstPage = paginateWalletTransactions(transactions, 1);

    assert.equal(WALLET_TRANSACTION_PAGE_SIZE, 25);
    assert.equal(firstPage.transactions.length, 25);
    assert.equal(firstPage.transactions[0].id, 61);
    assert.equal(firstPage.transactions[24].id, 37);
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.total, 61);
});

test("returns subsequent and final wallet transaction pages", () => {
    const secondPage = paginateWalletTransactions(transactions, 2);
    const thirdPage = paginateWalletTransactions(transactions, 3);

    assert.equal(secondPage.transactions.length, 25);
    assert.equal(secondPage.transactions[0].id, 36);
    assert.equal(secondPage.hasMore, true);
    assert.equal(thirdPage.transactions.length, 11);
    assert.equal(thirdPage.transactions[0].id, 11);
    assert.equal(thirdPage.hasMore, false);
});

test("normalizes invalid wallet page parameters", () => {
    assert.equal(parseWalletTransactionPage(null), 1);
    assert.equal(parseWalletTransactionPage("0"), 1);
    assert.equal(parseWalletTransactionPage("1.5"), 1);
    assert.equal(parseWalletTransactionPage("2"), 2);
});
