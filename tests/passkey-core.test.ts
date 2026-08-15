import assert from "node:assert/strict";
import test from "node:test";
import {
    createPasskeyInternalSignature,
    extractPasskeyLookup,
    normalizePasskeyBackendBaseUrl,
    normalizePasskeyName,
    passkeyBodyHash,
    PasskeyConfigurationError,
    samePasskeyUserHandle,
    samePasskeyUserID,
    validatePasskeyRelyingPartyConfig,
} from "../src/lib/server/passkey-core.ts";

test("signs the exact method/path/body-hash bound passkey request", () => {
    const rawBody = '{"action":"list"}';
    const signature = createPasskeyInternalSignature({
        secret: Buffer.from(
            "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
            "hex",
        ),
        timestamp: "1770000000123",
        nonce: "abcdefghijklmnopQRSTUVWX",
        rawBody,
    });

    assert.equal(
        passkeyBodyHash(rawBody),
        "584e7600815c4c752e42f8f3c00aa4bf1597f13bb08ed5de443b33097e1a1751",
    );
    assert.equal(signature, "EW4yShr9aSqvbWlZLk6qq1f-3Ui-9enr67MPsor2rXA");
});

test("requires HTTPS for passkey backend traffic except on loopback", () => {
    assert.equal(
        normalizePasskeyBackendBaseUrl("https://api.example.test/foodcourtapi/"),
        "https://api.example.test/foodcourtapi",
    );
    assert.equal(
        normalizePasskeyBackendBaseUrl("http://127.0.0.8:8080/foodcourtapi"),
        "http://127.0.0.8:8080/foodcourtapi",
    );
    assert.throws(
        () => normalizePasskeyBackendBaseUrl("http://10.0.0.5/foodcourtapi"),
        PasskeyConfigurationError,
    );
});

test("accepts only configured secure origins within the RP ID", () => {
    assert.deepEqual(
        validatePasskeyRelyingPartyConfig({
            rpID: "example.edu",
            rpName: "Cibus",
            origins: "https://cibus.example.edu, https://admin.example.edu:8443",
        }),
        {
            rpID: "example.edu",
            rpName: "Cibus",
            origins: ["https://cibus.example.edu", "https://admin.example.edu:8443"],
        },
    );
    assert.throws(
        () => validatePasskeyRelyingPartyConfig({
            rpID: "example.edu",
            rpName: "Cibus",
            origins: "https://example.edu.attacker.test",
        }),
        PasskeyConfigurationError,
    );
    assert.throws(
        () => validatePasskeyRelyingPartyConfig({
            rpID: "example.edu",
            rpName: "Cibus",
            origins: "http://cibus.example.edu",
        }),
        PasskeyConfigurationError,
    );
});

test("extracts bounded ceremony lookup data without trusting claimed identity", () => {
    const credentialId = Buffer.from("credential-id").toString("base64url");
    const challenge = Buffer.alloc(32, 7).toString("base64url");
    const userHandle = Buffer.alloc(32, 8).toString("base64url");
    const clientDataJSON = Buffer.from(JSON.stringify({
        type: "webauthn.get",
        challenge,
        origin: "https://attacker.invalid",
        userid: "ATTACKER",
        crossOrigin: false,
    })).toString("base64url");

    assert.deepEqual(
        extractPasskeyLookup({
            id: credentialId,
            rawId: credentialId,
            type: "public-key",
            response: {
                clientDataJSON,
                userHandle,
            },
        }, "authentication"),
        { credentialId, challenge, userHandle },
    );
    assert.throws(() => extractPasskeyLookup({
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: { clientDataJSON },
    }, "registration"));
});

test("rejects embedded ceremonies and authentication without a user handle", () => {
    const credentialId = Buffer.from("credential-id").toString("base64url");
    const challenge = Buffer.alloc(32, 7).toString("base64url");
    const userHandle = Buffer.alloc(32, 8).toString("base64url");
    const responseFor = (clientData: Record<string, unknown>, includeUserHandle = true) => ({
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: {
            clientDataJSON: Buffer.from(JSON.stringify({
                type: "webauthn.get",
                challenge,
                origin: "https://cibus.example.edu",
                ...clientData,
            })).toString("base64url"),
            ...(includeUserHandle ? { userHandle } : {}),
        },
    });

    assert.throws(() => extractPasskeyLookup(
        responseFor({ crossOrigin: true }),
        "authentication",
    ));
    assert.throws(() => extractPasskeyLookup(
        responseFor({
            crossOrigin: false,
            topOrigin: "https://embedder.example",
        }),
        "authentication",
    ));
    assert.throws(() => extractPasskeyLookup(
        responseFor({ crossOrigin: false }, false),
        "authentication",
    ));
});

test("normalizes friendly names and compares verified account IDs safely", () => {
    assert.equal(normalizePasskeyName("  Ricky's   iPhone  "), "Ricky's iPhone");
    assert.equal(normalizePasskeyName("bad\u0000name"), null);
    assert.equal(samePasskeyUserID(" 23-ucs-001 ", "23-UCS-001"), true);
    assert.equal(samePasskeyUserID("23-UCS-001", "23-UCS-002"), false);
});

test("compares opaque passkey user handles in constant time", () => {
    const handle = Buffer.alloc(32, 11).toString("base64url");
    const otherHandle = Buffer.alloc(32, 12).toString("base64url");
    assert.equal(samePasskeyUserHandle(handle, handle), true);
    assert.equal(samePasskeyUserHandle(handle, otherHandle), false);
    assert.equal(samePasskeyUserHandle(handle, "not-canonical="), false);
});
