import { json, type RequestHandler } from "@sveltejs/kit";
import {
  normalizePasswordResetOtp,
  normalizePasswordResetUserId,
} from "$lib/password-reset";
import {
  foodcourtApiRequest,
  FoodcourtApiError,
} from "$lib/server/foodcourt-api";
import { enforceRateLimits } from "$lib/server/rate-limit";

const noStore = { "Cache-Control": "no-store" };
type VerifyResponse = { status?: string; message?: string; resetToken?: unknown };

export const POST: RequestHandler = async (event) => {
  let body: Record<string, unknown>;
  try {
    body = await event.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
  }

  const userId = normalizePasswordResetUserId(body.userId);
  const otp = normalizePasswordResetOtp(body.otp);
  if (!userId || otp.length !== 6) {
    return json({ error: "Enter the six-digit OTP" }, { status: 400, headers: noStore });
  }

  const rateLimited = enforceRateLimits(event, [
    { namespace: "password-reset-verify:ip", limit: 30, windowMs: 15 * 60 * 1000 },
    {
      namespace: "password-reset-verify:userid",
      identifier: userId,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    },
  ]);
  if (rateLimited) return rateLimited;

  try {
    const payload = await foodcourtApiRequest<VerifyResponse>(
      "/ajax/api/verifyPasswordResetOtp.jsp",
      {
        method: "POST",
        body: new URLSearchParams({ userid: userId, otp }),
      },
    );
    const resetToken = typeof payload.resetToken === "string"
      ? payload.resetToken
      : "";
    if (payload.status !== "VERIFIED" || !/^[A-Za-z0-9_-]{40,100}$/.test(resetToken)) {
      return json(
        { error: payload.message ?? "Unable to verify the OTP" },
        { status: 502, headers: noStore },
      );
    }
    return json({ status: "VERIFIED", resetToken }, { headers: noStore });
  } catch (error) {
    if (error instanceof FoodcourtApiError) {
      return json({ error: error.message }, { status: error.status, headers: noStore });
    }
    return json(
      { error: "Unable to reach the OTP verification service" },
      { status: 502, headers: noStore },
    );
  }
};
