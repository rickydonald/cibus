import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
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
    return json({
      orders: [
        {
          order_no: "DEV-001",
          outletid: "1",
          outletname: "Momo's Kitchen",
          grand_total: 240,
          order_status: "Delivered",
        },
      ],
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;

  const response = await fetch(
    "https://eatright.loyolacollege.edu/ajax/getUserOrders.jsp",
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: "https://eatright.loyolacollege.edu/pagecontroller.jsp",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
      },
    },
  );

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to load EatRight order history",
        response: text,
      },
      { status: response.status },
    );
  }

  try {
    const data = JSON.parse(text.trim());
    return json(
      { orders: normalizeOrders(data) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return json(
      {
        error: "EatRight returned an invalid order history response",
        response: text,
      },
      { status: 502 },
    );
  }
}
