import { json, type RequestHandler } from "@sveltejs/kit";
import {
  normalizePasswordResetUserId,
  validateResetPassword,
} from "$lib/password-reset";
import {
  foodcourtApiRequest,
  FoodcourtApiError,
} from "$lib/server/foodcourt-api";
import { enforceRateLimits } from "$lib/server/rate-limit";

const noStore = { "Cache-Control": "no-store" };
type ResetResponse = { status?: string; message?: string };

export const POST: RequestHandler = async (event) => {
  let body: Record<string, unknown>;
  try {
    body = await event.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
  }

  const userId = normalizePasswordResetUserId(body.userId);
  const resetToken = typeof body.resetToken === "string" ? body.resetToken : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const passwordError = validateResetPassword(newPassword, body.confirmPassword);
  if (!userId || !/^[A-Za-z0-9_-]{40,100}$/.test(resetToken)) {
    return json(
      { error: "The password reset session is invalid or expired" },
      { status: 400, headers: noStore },
    );
  }
  if (passwordError) {
    return json({ error: passwordError }, { status: 400, headers: noStore });
  }

  const rateLimited = enforceRateLimits(event, [
    { namespace: "password-reset-complete:ip", limit: 15, windowMs: 15 * 60 * 1000 },
    {
      namespace: "password-reset-complete:userid",
      identifier: userId,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    },
  ]);
  if (rateLimited) return rateLimited;

  try {
    const payload = await foodcourtApiRequest<ResetResponse>(
      "/ajax/api/resetPassword.jsp",
      {
        method: "POST",
        body: new URLSearchParams({ userid: userId, resetToken, newPassword }),
      },
    );
    if (payload.status !== "SUCCESS") {
      return json(
        { error: payload.message ?? "Unable to reset the password" },
        { status: 502, headers: noStore },
      );
    }
    return json(
      { status: "SUCCESS", message: payload.message ?? "Password reset successfully" },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof FoodcourtApiError) {
      return json({ error: error.message }, { status: error.status, headers: noStore });
    }
    return json(
      { error: "Unable to reach the password reset service" },
      { status: 502, headers: noStore },
    );
  }
};
