const USER_ID_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{1,49}$/;

export function normalizePasswordResetUserId(value: unknown): string | null {
  const userId = String(value ?? "").trim().toUpperCase();
  return USER_ID_PATTERN.test(userId) ? userId : null;
}

export function normalizePasswordResetOtp(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

export function validateResetPassword(
  password: unknown,
  confirmation: unknown,
): string | null {
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return "Password must be between 6 and 128 characters";
  }
  if (password !== confirmation) return "Passwords do not match";
  return null;
}
