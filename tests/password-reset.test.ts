import assert from "node:assert/strict";
import test from "node:test";
import {
  isGuestUserId,
  normalizePasswordResetOtp,
  normalizePasswordResetUserId,
  validateResetPassword,
} from "../src/lib/password-reset.ts";

test("normalizes and validates password-reset user IDs", () => {
  assert.equal(normalizePasswordResetUserId(" 23-ucs-001 "), "23-UCS-001");
  assert.equal(normalizePasswordResetUserId("invalid user"), null);
  assert.equal(normalizePasswordResetUserId("x"), null);
});

test("identifies guest accounts that cannot reset passwords", () => {
  assert.equal(isGuestUserId(" guest12 "), true);
  assert.equal(isGuestUserId("23-ucs-001"), false);
  assert.equal(isGuestUserId("staff001"), false);
});

test("keeps only the first six OTP digits", () => {
  assert.equal(normalizePasswordResetOtp("12a 34-567"), "123456");
});

test("validates reset password length and confirmation", () => {
  assert.match(validateResetPassword("short", "short") ?? "", /between 6 and 128/);
  assert.match(validateResetPassword("new-password", "different") ?? "", /do not match/);
  assert.equal(validateResetPassword("new-password", "new-password"), null);
});
