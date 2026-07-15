import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";
import { DEV_MODE } from "$lib/server/dev";

function normalizeOrders(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.orders)) return value.orders;
    if (Array.isArray(value.data)) return value.data;
  }
  return [];
}

export async function GET(event) {
  if (DEV_MODE) {
    return json({ orders: [{ order_no: "DEV-001", outletid: "1", outletname: "Momo's Kitchen", grand_total: 240, order_status: "Delivered" }] });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  try {
    const payload = await foodcourtApiRequest<unknown>("/ajax/getUserOrders.jsp", {
      accessToken: session.accessToken,
    });
    return json({ orders: normalizeOrders(payload) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof FoodcourtApiError ? error.status : 502;
    return json({ error: "Failed to load Foodcourt order history" }, { status });
  }
}
