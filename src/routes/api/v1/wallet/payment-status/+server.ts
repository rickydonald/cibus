import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";
import { DEV_MODE } from "$lib/server/dev";

export async function GET(event) {
  const orderId = event.url.searchParams.get("order_id")?.trim();
  if (!orderId) {
    return json({ error: "order_id is required" }, { status: 400 });
  }

  if (DEV_MODE) {
    return json({ status: "SUCCESS", orderId });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  try {
    return json(await foodcourtApiRequest(
      `/ajax/paymentStatus.jsp?orderid=${encodeURIComponent(orderId)}`,
      { accessToken: session.accessToken },
    ));
  } catch (error) {
    const status = error instanceof FoodcourtApiError ? error.status : 502;
    return json({ error: "Unable to verify payment status" }, { status });
  }
}
