import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Supply SvelteKit's runtime environment module in this isolated Node test process.
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "$env/dynamic/private") {
            return { url: "data:text/javascript,export const env = process.env", shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});

test("API configuration is resolved at request time without crashing module imports", async (t) => {
    const previous = process.env.FOODCOURT_API_BASE_URL;
    delete process.env.FOODCOURT_API_BASE_URL;
    t.after(() => {
        if (previous === undefined) delete process.env.FOODCOURT_API_BASE_URL;
        else process.env.FOODCOURT_API_BASE_URL = previous;
        hooks.deregister();
    });

    const { foodcourtApiRequest, officialApiUrl, FoodcourtApiError } =
        await import("../src/lib/server/foodcourt-api.ts");
    const fetchMock = t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"ok":true}'));
    const unavailable = (error: unknown) => error instanceof FoodcourtApiError && error.status === 503;

    await assert.rejects(foodcourtApiRequest("/ajax/test.jsp"), unavailable);
    for (const value of ["", "  ", "not-a-url", "file:///tmp/api", "https://example.test/api?key=secret", "https://example.test/api#fragment", "https://user:secret@example.test/api"]) {
        process.env.FOODCOURT_API_BASE_URL = value;
        assert.throws(() => officialApiUrl("/ajax/test.jsp"), unavailable);
    }
    assert.equal(fetchMock.mock.callCount(), 0);

    process.env.FOODCOURT_API_BASE_URL = " https://example.test/foodcourtapi/// ";
    assert.equal(officialApiUrl("ajax/test.jsp"), "https://example.test/foodcourtapi/ajax/test.jsp");
    assert.equal(officialApiUrl("/"), "https://example.test/foodcourtapi/");
    assert.deepEqual(await foodcourtApiRequest("/ajax/test.jsp"), { ok: true });
    assert.equal(fetchMock.mock.calls[0].arguments[0], "https://example.test/foodcourtapi/ajax/test.jsp");
});
