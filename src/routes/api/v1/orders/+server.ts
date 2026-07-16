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

function devTimestamp(daysAgo: number, hours: number, minutes: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export async function GET(event) {
  if (DEV_MODE) {
    return json({
      orders: [
        { order_no: "ER26071601", outletid: "1", outletname: "Momo's Kitchen", grand_total: 240, order_status: "PLACED", payment_status: "PAID", delivered: "N", created_on: devTimestamp(0, 13, 25) },
        { order_no: "ER26071602", outletid: "3", outletname: "Hotpot Junction", grand_total: 185.5, order_status: "PLACED", payment_status: "PENDING", delivered: "N", created_on: devTimestamp(0, 9, 10) },
        { order_no: "ER26071503", outletid: "7", outletname: "Fresh Juice Bar", grand_total: 90, order_status: "PLACED", payment_status: "PAID", delivered: "Y", created_on: devTimestamp(1, 16, 45) },
        { order_no: "ER26071504", outletid: "4", outletname: "Kebab Corner", grand_total: 320, order_status: "CANCELLED", payment_status: "CANCELLED", delivered: "N", created_on: devTimestamp(1, 12, 5) },
        { order_no: "ER26071205", outletid: "5", outletname: "Yamuna's Kitchen", grand_total: 145, order_status: "PLACED", payment_status: "PAID", delivered: "Y", created_on: devTimestamp(4, 13, 40) },
        { order_no: "ER26071206", outletid: "8", outletname: "Rice Bowl Express", grand_total: 210.75, order_status: "PLACED", payment_status: "PAID", delivered: "Y", created_on: devTimestamp(4, 8, 55) },
      ],
    });
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
