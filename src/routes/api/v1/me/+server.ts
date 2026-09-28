import { json } from "@sveltejs/kit";
import {
  foodcourtAuthErrorResponse,
  resolveEatRightSessionFromEvent,
} from "$lib/server/eatright";
import { getAccountSummary } from "$lib/server/eatright-data";
import { FoodcourtApiError } from "$lib/server/foodcourt-api";
import { DEV_MODE } from "$lib/server/dev";

export async function GET(event) {
  if (DEV_MODE) {
    return json({
      name: "Dev User",
      userid: "DEVUSER",
      walletBalance: "250.00",
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  try {
    const account = await getAccountSummary(session);
    return json({
      name: session.name,
      userid: session.userid,
      walletBalance: account.walletBalance,
    });
  } catch (error) {
    console.error(error);
    const authError = foodcourtAuthErrorResponse(event, error);
    if (authError) return authError;

    return json(
      { error: "Unable to load the EatRight account" },
      { status: error instanceof FoodcourtApiError ? error.status : 502 },
    );
  }
}
