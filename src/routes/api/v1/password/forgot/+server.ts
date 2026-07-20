import { json, type RequestHandler } from "@sveltejs/kit";
import { normalizePasswordResetUserId } from "$lib/password-reset";
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
  if (!userId) {
    return json({ error: "Enter a valid user ID" }, { status: 400, headers: noStore });
  }

  const rateLimited = enforceRateLimits(event, [
    { namespace: "password-reset-request:ip", limit: 6, windowMs: 15 * 60 * 1000 },
    {
      namespace: "password-reset-request:userid",
      identifier: userId,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    },
  ]);
  if (rateLimited) return rateLimited;

  try {
    const payload = await foodcourtApiRequest<ResetResponse>(
      "/ajax/api/requestPasswordReset.jsp",
      { method: "POST", body: new URLSearchParams({ userid: userId }) },
    );
    if (payload.status !== "OTP_SENT") {
      return json(
        { error: payload.message ?? "Unable to request an OTP" },
        { status: 502, headers: noStore },
      );
    }
    return json(
      {
        status: "OTP_SENT",
        message: payload.message
          ?? "If the account is eligible, an OTP was sent to its registered mobile number",
      },
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
