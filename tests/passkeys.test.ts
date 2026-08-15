import assert from "node:assert/strict";
import test from "node:test";
import {
    PasskeyApiError,
    formatPasskeyDate,
    formatPasskeyDateCompact,
    getPasskeyErrorMessage,
} from "../src/lib/client/passkeys.ts";

test("preserves safe API errors for passkey actions", () => {
    const error = new PasskeyApiError("Current password is incorrect", 401);
    assert.equal(
        getPasskeyErrorMessage(error, "register"),
        "Current password is incorrect",
    );
});

test("turns cancelled WebAuthn prompts into actionable login guidance", () => {
    assert.equal(
        getPasskeyErrorMessage({ name: "NotAllowedError" }, "authenticate"),
        "Passkey sign-in was cancelled or timed out. Try again or use your password.",
    );
});

test("explains when an authenticator cannot create a discoverable passkey", () => {
    assert.equal(
        getPasskeyErrorMessage(
            {
                name: "ConstraintError",
                code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
            },
            "register",
        ),
        "This device or security key can't create a passkey that works without a user ID. Try another device or passkey provider.",
    );
});

test("explains when user verification is unavailable", () => {
    for (const code of [
        "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
    ]) {
        assert.equal(
            getPasskeyErrorMessage({ name: "ConstraintError", code }, "register"),
            "This device couldn't verify you with a fingerprint, face, or PIN. Try another device or security key.",
        );
    }
});

test("gives unknown WebAuthn constraint failures a secure fallback", () => {
    assert.equal(
        getPasskeyErrorMessage({ name: "ConstraintError" }, "register"),
        "This device couldn't meet Eat Right's passkey security requirements. Try another device or security key.",
    );
});

test("formats valid passkey dates and rejects invalid values", () => {
    assert.match(formatPasskeyDate("2026-08-15T06:30:00.000Z") ?? "", /15 Aug 2026/);
    assert.equal(formatPasskeyDate("not-a-date"), null);
    assert.equal(formatPasskeyDate(null), null);
});

test("drops the year from compact passkey dates only while it is current", () => {
    const thisYear = new Date().getFullYear();
    const compact = formatPasskeyDateCompact(`${thisYear}-08-15T06:30:00.000Z`) ?? "";
    assert.match(compact, /15 Aug/);
    assert.doesNotMatch(compact, new RegExp(String(thisYear)));

    assert.match(
        formatPasskeyDateCompact(`${thisYear - 2}-08-15T06:30:00.000Z`) ?? "",
        new RegExp(`15 Aug ${thisYear - 2}`),
    );
    assert.equal(formatPasskeyDateCompact("not-a-date"), null);
    assert.equal(formatPasskeyDateCompact(null), null);
});
