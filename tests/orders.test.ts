import assert from "node:assert/strict";
import test from "node:test";
import { orderTime, parseOrderDate } from "../src/lib/utils/orders.ts";

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
