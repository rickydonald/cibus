import assert from "node:assert/strict";
import test from "node:test";
import {
    isActiveOrder,
    orderState,
    orderTime,
    parseOrderDate,
} from "../src/lib/utils/orders.ts";

test("parses the JSP day-first order timestamp in Indian time", () => {
    assert.equal(
        parseOrderDate("06-08-2026 10:31 AM")?.toISOString(),
        "2026-08-06T05:01:00.000Z",
    );
});

test("parses midnight and noon from the JSP timestamp", () => {
    assert.equal(
        parseOrderDate("21-07-2026 12:05 AM")?.toISOString(),
        "2026-07-20T18:35:00.000Z",
    );
    assert.equal(
        parseOrderDate("21-07-2026 12:05 PM")?.toISOString(),
        "2026-07-21T06:35:00.000Z",
    );
});

test("treats timezone-less SQL timestamps as Indian local time", () => {
    assert.equal(
        parseOrderDate("2026-08-06 22:15:00")?.toISOString(),
        "2026-08-06T16:45:00.000Z",
    );
});

test("formats order time in Indian time", () => {
    assert.equal(
        orderTime({
            order_no: "ORD-1",
            order_status: "PLACED",
            created_on: "06-08-2026 10:31 AM",
            payment_status: "PAID",
            outletid: "1",
            delivered: "N",
            grand_total: 50,
            outletname: "Test",
        }),
        "10:31 am",
    );
});

// The confirmation page classifies a receipt, which carries only the three
// status fields — getOrderDetails.jsp has no outlet/list metadata.
test("classifies a receipt-shaped order without list metadata", () => {
    assert.equal(
        orderState({ payment_status: "PAID", delivered: "N" }),
        "preparing",
    );
    assert.equal(
        orderState({ payment_status: "PAID", delivered: "Y" }),
        "delivered",
    );
    assert.equal(
        orderState({ payment_status: "PENDING", delivered: "N" }),
        "payment-pending",
    );
});

// getOrderDetails.jsp can still report PAID for an order the list has
// already cancelled, which is why order_status is merged in from the list.
test("cancellation from the order list wins over a paid receipt", () => {
    assert.equal(
        orderState({
            order_status: "CANCELLED",
            payment_status: "PAID",
            delivered: "N",
        }),
        "cancelled",
    );
});

test("cancellation outranks a delivered flag", () => {
    assert.equal(
        orderState({
            order_status: "CANCELLED",
            payment_status: "PAID",
            delivered: "Y",
        }),
        "cancelled",
    );
});

test("a failed payment reads as cancelled", () => {
    assert.equal(
        orderState({ payment_status: "FAILED", delivered: "N" }),
        "cancelled",
    );
});

test("a missing order_status does not cancel an order", () => {
    assert.equal(
        orderState({ order_status: null, payment_status: "PAID", delivered: "N" }),
        "preparing",
    );
});

// The confirmation page stops polling once nothing is active, so a
// cancelled counter must not keep the 30-second poll alive.
test("cancelled and delivered orders are not active", () => {
    assert.equal(
        isActiveOrder({ order_status: "CANCELLED", payment_status: "CANCELLED", delivered: "N" }),
        false,
    );
    assert.equal(
        isActiveOrder({ payment_status: "PAID", delivered: "Y" }),
        false,
    );
    assert.equal(isActiveOrder({ payment_status: "PAID", delivered: "N" }), true);
    assert.equal(
        isActiveOrder({ payment_status: "PENDING", delivered: "N" }),
        true,
    );
});
