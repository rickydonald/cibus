import assert from "node:assert/strict";
import test from "node:test";
import { getPageError } from "../src/lib/utils/page-error.ts";

test("route errors offer recovery appropriate to their status", () => {
    assert.equal(getPageError(401).homeHref, "/login");
    assert.equal(getPageError(401).homeLabel, "Sign in");
    for (const status of [400, 401, 403, 404, 410]) {
        assert.equal(getPageError(status).retry, false, `${status} should not suggest retrying`);
    }
    for (const status of [408, 429, 500, 502, 503, 504, 599]) {
        const error = getPageError(status);
        assert.equal(error.retry, true, `${status} should allow retrying`);
        assert.equal(error.homeHref, "/");
    }
    assert.match(getPageError(404).title, /off the menu/);
    assert.match(getPageError(429).description, /Wait a moment/);
    assert.equal(getPageError(418).title, "Something didn’t go as planned");
});
