import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";

export async function GET(event) {
  if (DEV_MODE) {
    return json([
      {
        orderNo: "DEV-001",
        outletId: 1,
        outletName: "Momo's Kitchen",
        grandTotal: 240,
        status: "Delivered",
      },
    ]);
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

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
    return json({ error: "Failed to load orders" }, { status: response.status });
  }

  try {
    const data = JSON.parse(text.trim());
    const orders = (Array.isArray(data) ? data : []).map((o) => ({
      orderNo: o.order_no,
      outletId: o.outletid,
      outletName: o.outletname,
      grandTotal: o.grand_total,
      status: o.order_status,
    }));
    return json(orders);
  } catch {
    return json({ error: "Invalid response from EatRight" }, { status: 502 });
  }
}
