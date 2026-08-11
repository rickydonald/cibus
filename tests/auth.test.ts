import assert from "node:assert/strict";
import test from "node:test";
import type { RequestEvent } from "@sveltejs/kit";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { getSafeRedirectPath } from "../src/lib/auth-redirect.ts";
import {
    enforceRateLimits,
    formatRetryAfter,
} from "../src/lib/server/rate-limit.ts";
import {
    EatRightAuthConfigurationError,
    verifyEatRightJwtWithConfig,
    type EatRightJwtVerifierConfig,
} from "../src/lib/server/eatright-jwt-core.ts";

const secret = "test-eatright-jwt-secret-that-is-at-least-32-bytes";
const config: EatRightJwtVerifierConfig = {
    algorithm: "HS256",
    secret,
};

async function createToken(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
        sub: "TEST001",
        name: "Test User",
        jti: "test-token-id",
        ver: 0,
        ...overrides,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(new TextEncoder().encode(secret));
}

test("accepts a correctly signed EatRight JWT", async () => {
    const result = await verifyEatRightJwtWithConfig(await createToken(), config);
    assert.equal(result?.name, "Test User");
    assert.equal(result?.userid, "TEST001");
    assert.equal(result?.tokenVersion, 0);
});

test("accepts an RS256 token using only its public verification key", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({
        sub: "TEST001",
        name: "Test User",
        jti: "rsa-test-token-id",
        ver: 4,
    })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer("cibus-rdmw")
        .setAudience("cibus")
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(privateKey);

    const result = await verifyEatRightJwtWithConfig(token, {
        algorithm: "RS256",
        issuer: "cibus-rdmw",
        audience: "cibus",
        publicKey: await exportSPKI(publicKey),
    });
    assert.equal(result?.userid, "TEST001");
    assert.equal(result?.tokenVersion, 4);
});

test("rejects a JWT with a modified signature", async () => {
    const token = await createToken();
    const [header, payload, signature] = token.split(".");
    const replacement = signature.startsWith("A") ? "B" : "A";
    const tampered = `${header}.${payload}.${replacement}${signature.slice(1)}`;
    assert.equal(await verifyEatRightJwtWithConfig(tampered, config), null);
});

test("uses the JSP subject claim as the user ID", async () => {
    const token = await createToken({ userid: "WRONG", sub: "JSP001" });
    const result = await verifyEatRightJwtWithConfig(token, config);
    assert.equal(result?.userid, "JSP001");
});

test("rejects JWTs without the JSP subject claim", async () => {
    assert.equal(
        await verifyEatRightJwtWithConfig(await createToken({ sub: undefined }), config),
        null,
    );
});

test("rejects JWTs without the JSP JWT token type", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
        sub: "TEST001", name: "Test User", jti: "test-token-id", ver: 0,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(new TextEncoder().encode(secret));
    assert.equal(await verifyEatRightJwtWithConfig(token, config), null);
});

test("rejects expired JWTs", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
        sub: "TEST001", name: "Test User", jti: "test-token-id", ver: 0,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt(now - 120)
        .setExpirationTime(now - 60)
        .sign(new TextEncoder().encode(secret));
    assert.equal(await verifyEatRightJwtWithConfig(token, config), null);
});

test("rejects JWTs older than the seven-day session lifetime", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
        sub: "TEST001", name: "Test User", jti: "test-token-id", ver: 0,
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt(now - 8 * 24 * 60 * 60)
        .setExpirationTime(now + 300)
        .sign(new TextEncoder().encode(secret));
    assert.equal(await verifyEatRightJwtWithConfig(token, config), null);
});

test("validates issuer and audience when both are configured", async () => {
    const scopedConfig = {
        ...config,
        issuer: "foodcourt-test",
        audience: "cibus-test",
    };
    const accepted = await createToken({
        iss: "foodcourt-test",
        aud: "cibus-test",
    });
    const rejected = await createToken({
        iss: "foodcourt-test",
        aud: "another-app",
    });

    assert.equal(
        (await verifyEatRightJwtWithConfig(accepted, scopedConfig))?.userid,
        "TEST001",
    );
    assert.equal(await verifyEatRightJwtWithConfig(rejected, scopedConfig), null);
});

test("fails closed when JWT verification is misconfigured", async () => {
    await assert.rejects(
        verifyEatRightJwtWithConfig(await createToken(), {
            ...config,
            secret: "short",
        }),
        EatRightAuthConfigurationError,
    );
});

test("allows only same-origin redirect paths", () => {
    assert.equal(getSafeRedirectPath("/view/home?tab=orders"), "/view/home?tab=orders");
    assert.equal(getSafeRedirectPath("https://attacker.example"), "/view/home");
    assert.equal(getSafeRedirectPath("//attacker.example"), "/view/home");
    assert.equal(getSafeRedirectPath("/\\attacker.example"), "/view/home");
});

test("rate limits repeated authentication attempts", async () => {
    const event = {
        getClientAddress: () => "203.0.113.10",
    } as RequestEvent;
    const rule = {
        namespace: `auth-test:${Date.now()}`,
        limit: 1,
        windowMs: 60_000,
    };

    assert.equal(enforceRateLimits(event, [rule]), null);
    const response = enforceRateLimits(event, [rule]);
    assert.equal(response?.status, 429);
    assert.equal(response?.headers.get("Retry-After"), "60");
    const payload = await response?.json();
    assert.equal(payload.errorCode, "rate_limited");
    assert.equal(payload.retryAfterSeconds, 60);
    assert.equal(payload.error, "Too many attempts. Try again in 1 minute.");
});

test("formats the remaining rate-limit wait time", () => {
    assert.equal(formatRetryAfter(1), "1 second");
    assert.equal(formatRetryAfter(59), "59 seconds");
    assert.equal(formatRetryAfter(60), "1 minute");
    assert.equal(formatRetryAfter(119), "1 minute 59 seconds");
    assert.equal(formatRetryAfter(120), "2 minutes");
});
