import assert from "node:assert/strict";
import test from "node:test";
import { validateFeedbackInput } from "../src/lib/feedback.ts";

test("validates and trims shop feedback", () => {
    assert.deepEqual(
        validateFeedbackInput({
            category: "shop",
            outletId: 3,
            rating: 5,
            comment: "  Great service and food.  ",
        }),
        {
            ok: true,
            value: {
                category: "shop",
                outletId: 3,
                rating: 5,
                comment: "Great service and food.",
            },
        },
    );
});

test("validates application feedback topics", () => {
    assert.deepEqual(
        validateFeedbackInput({
            category: "app",
            topic: "bug",
            comment: "Checkout remains on the loading screen.",
        }),
        {
            ok: true,
            value: {
                category: "app",
                topic: "bug",
                comment: "Checkout remains on the loading screen.",
            },
        },
    );
});

test("rejects invalid ratings, topics, and short comments", () => {
    assert.equal(
        validateFeedbackInput({
            category: "shop",
            outletId: 1,
            rating: 6,
            comment: "This comment is long enough",
        }).ok,
        false,
    );
    assert.equal(
        validateFeedbackInput({
            category: "app",
            topic: "other",
            comment: "This comment is long enough",
        }).ok,
        false,
    );
    assert.equal(
        validateFeedbackInput({ category: "app", topic: "bug", comment: "Short" })
            .ok,
        false,
    );
});
